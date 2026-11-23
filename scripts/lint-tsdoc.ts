import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { TSDocConfiguration, TSDocParser, TextRange } from '@microsoft/tsdoc';
import { TSDocConfigFile } from '@microsoft/tsdoc-config';
import { parseSync } from 'oxc-parser';

/**
 * Diagnostic emitted while linting TypeScript files for TSDoc compliance.
 */
export interface LintMessage {
	/** Path to the linted TypeScript file. */
	file: string;
	/** 1-based line number of the diagnostic. */
	line: number;
	/** 1-based column number of the diagnostic. */
	column: number;
	/** TSDoc or parser message identifier. */
	messageId: string;
	/** Human-readable diagnostic message without coordinate prefixes. */
	text: string;
}

const DEFAULT_CONFIG_PATH = path.resolve(import.meta.dir, '..', 'tsdoc.json');

async function collectTypeScriptFiles(target: string, files: Set<string>): Promise<void> {
	const info = await stat(target);
	if (info.isFile()) {
		if (target.endsWith('.ts') && !target.endsWith('.d.ts')) {
			files.add(path.resolve(target));
		}
		return;
	}
	if (!info.isDirectory()) return;

	const entries = await readdir(target, { withFileTypes: true });
	entries.sort((left, right) => left.name.localeCompare(right.name));
	for (const entry of entries) {
		if (entry.name === 'node_modules' || entry.name === '.git') continue;
		const fullPath = path.join(target, entry.name);
		if (entry.isDirectory()) {
			await collectTypeScriptFiles(fullPath, files);
		} else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
			files.add(path.resolve(fullPath));
		}
	}
}

function createConfiguredParser(configPath: string): TSDocParser {
	const configFile = TSDocConfigFile.loadFile(configPath);
	if (configFile.fileNotFound) {
		throw new Error(`TSDoc configuration not found: ${configPath}`);
	}
	const configuration = new TSDocConfiguration();
	configFile.configureParser(configuration);
	if (configFile.hasErrors) {
		throw new Error(configFile.getErrorSummary());
	}
	return new TSDocParser(configuration);
}

function toDisplayPath(filePath: string): string {
	const relative = path.relative(process.cwd(), filePath);
	if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
		return relative;
	}
	return filePath;
}

/**
 * Lints all TypeScript files under `paths` against the repository `tsdoc.json` rules.
 *
 * @param paths - Files or directories to expand into sorted `.ts` files (excluding `.d.ts`).
 * @param configPath - Optional path to the `tsdoc.json` configuration file.
 * @returns Ordered list of TSDoc and TypeScript parser diagnostics.
 */
export async function lintTsdoc(
	paths: string[],
	configPath: string = DEFAULT_CONFIG_PATH
): Promise<LintMessage[]> {
	const parser = createConfiguredParser(configPath);
	const files = new Set<string>();
	for (const entry of paths) {
		await collectTypeScriptFiles(entry, files);
	}

	const sortedFiles = [...files].sort((left, right) => left.localeCompare(right));
	const messages: LintMessage[] = [];

	for (const filePath of sortedFiles) {
		const displayPath = toDisplayPath(filePath);
		const sourceText = await readFile(filePath, 'utf8');
		const fileRange = TextRange.fromString(sourceText);
		const parsed = parseSync(filePath, sourceText);

		for (const parseError of parsed.errors) {
			const offset = parseError.labels[0]?.start ?? 0;
			const loc = fileRange.getLocation(offset);
			messages.push({
				file: displayPath,
				line: loc.line || 1,
				column: loc.column || 1,
				messageId: 'parse-error',
				text: parseError.message
			});
		}

		for (const comment of parsed.comments) {
			if (comment.type !== 'Block' || !sourceText.startsWith('/**', comment.start)) {
				continue;
			}
			const commentRange = TextRange.fromStringRange(sourceText, comment.start, comment.end);
			const context = parser.parseRange(commentRange);
			for (const msg of context.log.messages) {
				const rawLoc = msg.textRange.getLocation(msg.textRange.pos);
				const loc = rawLoc.line > 0 ? rawLoc : commentRange.getLocation(comment.start);
				messages.push({
					file: displayPath,
					line: loc.line || 1,
					column: loc.column || 1,
					messageId: msg.messageId,
					text: msg.unformattedText
				});
			}
		}
	}

	return messages;
}

if (import.meta.main) {
	const cliPaths = process.argv.slice(2);
	const targets = cliPaths.length > 0 ? cliPaths : ['src', 'scripts'];
	lintTsdoc(targets)
		.then((messages) => {
			if (messages.length === 0) return;
			for (const message of messages) {
				console.error(
					`${message.file}:${message.line}:${message.column} ${message.messageId} ${message.text}`
				);
			}
			process.exitCode = 1;
		})
		.catch((error) => {
			console.error(error instanceof Error ? error.message : String(error));
			process.exitCode = 1;
		});
}
