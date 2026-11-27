import { mkdtemp, realpath, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CONTENT_DIR, PUBLIC_DIR, ROOT_DIR } from './config';

const CONTENT_INPUT = /^(?:content\/|public\/|scripts\/|src\/|package\.json$|bun\.lock$)/;

function git(...args: string[]): string {
	const result = Bun.spawnSync(['git', ...args], { cwd: ROOT_DIR });
	if (result.exitCode !== 0) {
		throw new Error(`git ${args[0]} failed: ${result.stderr.toString().trim()}`);
	}
	return result.stdout.toString();
}

async function checkStagedContent(): Promise<number> {
	const staged = git('diff', '--cached', '--name-only', '--no-renames', '-z', '--').split('\0');
	if (!staged.some((file) => CONTENT_INPUT.test(file))) return 0;
	if (git('ls-files', '--unmerged', '-z')) {
		throw new Error('Resolve unmerged index entries before checking staged content.');
	}

	const snapshot = await mkdtemp(path.join(tmpdir(), 'samata-content-index-'));
	try {
		git('checkout-index', '--all', `--prefix=${snapshot}${path.sep}`);
		const dependencies = await realpath(path.join(ROOT_DIR, 'node_modules'));
		await symlink(dependencies, path.join(snapshot, 'node_modules'), 'junction');
		const child = Bun.spawn([process.execPath, 'run', 'content:check'], {
			cwd: snapshot,
			stdout: 'inherit',
			stderr: 'inherit'
		});
		return await child.exited;
	} finally {
		await rm(snapshot, { recursive: true, force: true });
	}
}

async function checkContent(): Promise<number> {
	const [{ buildContent, ContentValidationError }, { prepareDatasetDatasheets }] =
		await Promise.all([import('./build-content'), import('./dataset-datasheets')]);
	const [articles, datasheets] = await Promise.allSettled([
		buildContent(ROOT_DIR, { validateOnly: true, assetRoot: PUBLIC_DIR }),
		prepareDatasetDatasheets(path.join(CONTENT_DIR, 'datasets'), PUBLIC_DIR)
	]);
	const errors =
		datasheets.status === 'fulfilled'
			? [...datasheets.value.values()].flatMap(({ errors }) => errors)
			: [`datasets: ${String(datasheets.reason)}`];
	if (articles.status === 'rejected') {
		if (articles.reason instanceof ContentValidationError) {
			errors.push(...articles.reason.diagnostics);
		} else {
			errors.push(`content: ${String(articles.reason)}`);
		}
	}
	for (const error of errors.sort()) console.error(error);
	if (errors.length) return 1;
	console.log('Authored Markdown passed validation.');
	return 0;
}

if (import.meta.main) {
	const args = process.argv.slice(2);
	try {
		if (args.length === 0) process.exitCode = await checkContent();
		else if (args.length === 1 && args[0] === '--staged') {
			process.exitCode = await checkStagedContent();
		} else {
			throw new Error('Usage: bun run content:check [--staged]');
		}
	} catch (error) {
		console.error(
			`Content check failed: ${error instanceof Error ? error.message : String(error)}`
		);
		process.exitCode = 1;
	}
}
