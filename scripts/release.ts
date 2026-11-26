import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT_DIR } from './config';

/**
 * Supported release bump kinds for {@link bumpSemVer} and the release CLI.
 */
export type ReleaseBump = 'prerelease' | 'patch' | 'minor' | 'major';

/**
 * Parsed Semantic Versioning components supported by `samata-ml`.
 */
export interface ParsedSemVer {
	/** Major version integer (`>= 0`). */
	major: number;
	/** Minor version integer (`>= 0`). */
	minor: number;
	/** Patch version integer (`>= 0`). */
	patch: number;
	/** Beta prerelease counter (`>= 1`), or `null` for a stable release. */
	prerelease: number | null;
}

const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-beta\.([1-9]\d*))?$/;
const VALID_BUMPS = new Set<string>(['prerelease', 'patch', 'minor', 'major']);

/**
 * Parses a SemVer string in `MAJOR.MINOR.PATCH` or `MAJOR.MINOR.PATCH-beta.N` form.
 *
 * @param version - Version string to validate and parse.
 * @returns Parsed major, minor, patch and optional beta prerelease number.
 * @throws Error if the string is malformed, has leading zeros, build metadata, or an unsupported prerelease.
 * @example
 * ```ts
 * parseSemVer('0.1.0-beta.1'); // { major: 0, minor: 1, patch: 0, prerelease: 1 }
 * ```
 */
export function parseSemVer(version: string): ParsedSemVer {
	const match = SEMVER_PATTERN.exec(version);
	if (!match) {
		throw new Error(`Invalid SemVer version: "${version}"`);
	}
	return {
		major: Number(match[1]),
		minor: Number(match[2]),
		patch: Number(match[3]),
		prerelease: match[4] !== undefined ? Number(match[4]) : null
	};
}

/**
 * Computes the next SemVer version for the requested bump type.
 *
 * @param version - Current SemVer version string.
 * @param bump - Bump category (`prerelease`, `patch`, `minor`, or `major`).
 * @param preid - Prerelease identifier to emit when bumping a prerelease (defaults to `'beta'`).
 * @returns Next SemVer version string.
 * @throws Error if `version` is invalid or `bump` is unsupported.
 * @example
 * ```ts
 * bumpSemVer('0.1.0-beta.1', 'prerelease'); // '0.1.0-beta.2'
 * ```
 */
export function bumpSemVer(version: string, bump: ReleaseBump, preid = 'beta'): string {
	const parsed = parseSemVer(version);
	if (!VALID_BUMPS.has(bump)) {
		throw new Error(`Invalid release bump: "${bump}"`);
	}

	switch (bump) {
		case 'prerelease':
			if (parsed.prerelease !== null) {
				return `${parsed.major}.${parsed.minor}.${parsed.patch}-${preid}.${parsed.prerelease + 1}`;
			}
			return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}-${preid}.1`;
		case 'patch':
			if (parsed.prerelease !== null) {
				return `${parsed.major}.${parsed.minor}.${parsed.patch}`;
			}
			return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
		case 'minor':
			if (parsed.prerelease !== null && parsed.patch === 0) {
				return `${parsed.major}.${parsed.minor}.0`;
			}
			return `${parsed.major}.${parsed.minor + 1}.0`;
		case 'major':
			if (parsed.prerelease !== null && parsed.minor === 0 && parsed.patch === 0) {
				return `${parsed.major}.0.0`;
			}
			return `${parsed.major + 1}.0.0`;
	}
}

/**
 * Formats a Keep a Changelog section heading and bullet list for a release.
 *
 * @param version - Release SemVer string.
 * @param isoDate - ISO 8601 date or timestamp whose `YYYY-MM-DD` prefix is used.
 * @param notes - Release note entries; falls back to `No notable changes.` when empty.
 * @returns Formatted Markdown section.
 * @throws Error if `isoDate` does not begin with a `YYYY-MM-DD` calendar date.
 * @example
 * ```ts
 * formatChangelogEntry('0.1.0-beta.2', '2026-11-23T12:00:00Z', ['Added telemetry']);
 * ```
 */
export function formatChangelogEntry(
	version: string,
	isoDate: string,
	notes: readonly string[]
): string {
	if (!/^\d{4}-\d{2}-\d{2}/.test(isoDate)) {
		throw new Error(`Invalid ISO date for changelog entry: "${isoDate}"`);
	}
	const date = isoDate.slice(0, 10);
	const cleaned = notes.map((note) => note.trim().replace(/^[-*]\s+/, '')).filter(Boolean);
	const bullets =
		cleaned.length > 0 ? cleaned.map((note) => `- ${note}`) : ['- No notable changes.'];
	return `## [${version}] - ${date}\n\n${bullets.join('\n')}`;
}

interface UnreleasedExtraction {
	notes: string[];
	beforeUnreleased: string;
	afterUnreleased: string;
}

function extractUnreleasedSection(changelog: string): UnreleasedExtraction {
	const headerMatch = /^## \[Unreleased\][^\n]*\n?/m.exec(changelog);
	if (!headerMatch || headerMatch.index === undefined) {
		throw new Error('CHANGELOG.md is missing an "## [Unreleased]" heading');
	}
	const headerStart = headerMatch.index;
	const bodyStart = headerStart + headerMatch[0].length;
	const rest = changelog.slice(bodyStart);
	const nextHeadingMatch = /^## \[/m.exec(rest);
	const body =
		nextHeadingMatch && nextHeadingMatch.index !== undefined
			? rest.slice(0, nextHeadingMatch.index)
			: rest;
	const afterUnreleased =
		nextHeadingMatch && nextHeadingMatch.index !== undefined
			? rest.slice(nextHeadingMatch.index)
			: '';

	const notes = body
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0 && !line.startsWith('### '));

	return {
		notes,
		beforeUnreleased: changelog.slice(0, headerStart + headerMatch[0].length),
		afterUnreleased
	};
}

function runCommandOrThrow(args: string[], label: string): void {
	const result = Bun.spawnSync(args, {
		cwd: ROOT_DIR,
		stdin: 'inherit',
		stdout: 'inherit',
		stderr: 'inherit'
	});
	if (result.exitCode !== 0) {
		throw new Error(`${label} failed with exit code ${result.exitCode}`);
	}
}

function assertCleanGitWorkingTree(): void {
	const result = Bun.spawnSync(['git', 'status', '--porcelain'], {
		cwd: ROOT_DIR,
		stdout: 'pipe',
		stderr: 'pipe'
	});
	if (result.exitCode !== 0) {
		const stderr = new TextDecoder().decode(result.stderr).trim();
		throw new Error(`Unable to inspect git status: ${stderr}`);
	}
	const output = new TextDecoder().decode(result.stdout).trim();
	if (output.length > 0) {
		throw new Error('Working tree must be clean before cutting a release');
	}
}

async function runCli(argv: string[]): Promise<void> {
	let bumpArg: string | undefined;
	let dryRun = false;

	for (const arg of argv) {
		if (arg === '--dry-run') {
			dryRun = true;
		} else if (!arg.startsWith('-') && bumpArg === undefined) {
			bumpArg = arg;
		} else {
			throw new Error(`Unexpected argument: "${arg}"`);
		}
	}

	if (!bumpArg || !VALID_BUMPS.has(bumpArg)) {
		throw new Error(
			'Usage: bun run version:release <prerelease|patch|minor|major> [--dry-run]'
		);
	}

	const bump = bumpArg as ReleaseBump;
	const pkgPath = path.join(ROOT_DIR, 'package.json');
	const changelogPath = path.join(ROOT_DIR, 'CHANGELOG.md');

	const pkgText = await readFile(pkgPath, 'utf8');
	const pkg = JSON.parse(pkgText) as { version?: unknown };
	if (typeof pkg.version !== 'string') {
		throw new Error('package.json is missing a string "version" field');
	}

	const currentVersion = pkg.version;
	const nextVersion = bumpSemVer(currentVersion, bump);
	const changelogText = await readFile(changelogPath, 'utf8');
	const { notes, beforeUnreleased, afterUnreleased } = extractUnreleasedSection(changelogText);
	const section = formatChangelogEntry(nextVersion, new Date().toISOString(), notes);

	if (dryRun) {
		console.log(`${currentVersion} → ${nextVersion}`);
		console.log('');
		console.log(section);
		return;
	}

	assertCleanGitWorkingTree();
	runCommandOrThrow(['bun', 'run', 'lint'], 'bun run lint');
	runCommandOrThrow(['bun', 'run', 'check'], 'bun run check');
	runCommandOrThrow(['bun', 'run', 'build'], 'bun run build');
	runCommandOrThrow(['bun', 'run', 'plans:check'], 'bun run plans:check');

	const updatedPkg = pkgText.replace(/("version"\s*:\s*)"[^"]*"/, `$1"${nextVersion}"`);
	const updatedChangelog = `${beforeUnreleased.trimEnd()}\n\n${section}\n\n${afterUnreleased.trimStart()}`;

	await writeFile(pkgPath, updatedPkg, 'utf8');
	await writeFile(changelogPath, updatedChangelog, 'utf8');

	runCommandOrThrow(
		['bun', 'run', 'format', '--paths', 'package.json', 'CHANGELOG.md'],
		'bun run format'
	);

	console.log(`${currentVersion} → ${nextVersion}`);
	console.log('');
	console.log('Next steps:');
	console.log('  git add package.json CHANGELOG.md');
	console.log(`  git commit -m "chore: release v${nextVersion}"`);
	console.log(`  git tag -a v${nextVersion} -m "Release v${nextVersion}"`);
}

if (import.meta.main) {
	runCli(process.argv.slice(2)).catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	});
}
