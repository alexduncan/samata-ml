import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

interface Source {
	path: string;
	content: string;
}

function sources(directory: string): Source[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const file = path.posix.join(directory, entry.name);
		if (entry.name === 'fixtures' || entry.name.endsWith('-snapshots')) return [];
		if (entry.isDirectory()) return sources(file);
		return /\.(ts|css)$/.test(file)
			? [{ path: file, content: readFileSync(file, 'utf8') }]
			: [];
	});
}

function violations(source: Source): Record<string, string[]> {
	const result: Record<string, string[]> = {
		'CONV-1': [],
		'CONV-2': [],
		'CONV-3': [],
		'CONV-4': []
	};
	if (
		!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\.(?:store|styles|worker|stories|test|e2e|d))?\.(?:ts|css)$/.test(
			path.posix.basename(source.path)
		)
	) {
		result['CONV-1']!.push(source.path);
	}
	if (!source.path.endsWith('.ts')) return result;
	if (source.path.startsWith('src/common/')) {
		for (const imported of new Bun.Transpiler({ loader: 'ts' }).scanImports(source.content)) {
			if (/^(?:lit(?:\/|$)|@lit\/|@nanostores\/lit$)/.test(imported.path)) {
				result['CONV-4']!.push(`${source.path}: ${imported.path}`);
			}
		}
	}
	if (source.path.startsWith('src/') && !source.path.endsWith('.stories.ts')) {
		for (const match of source.content.matchAll(
			/@customElement\(\s*['"]([^'"]+)['"]\s*\)\s*(?:export\s+)?class\s+(\w+)/g
		)) {
			const tag = match[1]!;
			const placed = tag.startsWith('ui-')
				? source.path === `src/components/${tag}.ts`
				: tag.startsWith('app-') && /^src\/features\/[^/]+\/[^/]+\.ts$/.test(source.path);
			if (!placed || path.posix.basename(source.path) !== `${tag}.ts`)
				result['CONV-2']!.push(`${source.path}: ${tag}`);
			const className = tag
				.split('-')
				.map((part) => part[0]!.toUpperCase() + part.slice(1))
				.join('');
			if (match[2] !== className)
				result['CONV-3']!.push(`${source.path}: expected ${className}`);
		}
	}
	return result;
}

describe('Repository conventions', () => {
	const files = ['src', 'tests', 'scripts', 'css'].flatMap(sources);
	for (const id of ['CONV-1', 'CONV-2', 'CONV-3', 'CONV-4']) {
		it(`${id}: repository sources satisfy the convention`, () => {
			expect(files.flatMap((source) => violations(source)[id]!)).toEqual([]);
		});
	}
	it('CONV-1: rejects camelCase and unsupported suffixes, accepts existing roles', () => {
		for (const file of ['src/config/pipelineSteps.ts', 'src/sample.helper.ts']) {
			expect(violations({ path: file, content: '' })['CONV-1']).toEqual([file]);
		}
		for (const file of [
			'src/stores/app.store.ts',
			'src/types/env.d.ts',
			'css/train-model.css'
		]) {
			expect(violations({ path: file, content: '' })['CONV-1']).toEqual([]);
		}
	});
	it('CONV-2: rejects incorrect placement and mismatched tag filenames', () => {
		const content = "@customElement('app-example') export class AppExample {}";
		for (const file of ['src/components/app-example.ts', 'src/features/shell/other.ts']) {
			expect(violations({ path: file, content })['CONV-2']).toHaveLength(1);
		}
		expect(
			violations({ path: 'src/features/shell/app-example.ts', content })['CONV-2']
		).toEqual([]);
		expect(
			violations({
				path: 'src/components/ui-example.ts',
				content: "@customElement('ui-example') class UiExample {}"
			})['CONV-2']
		).toEqual([]);
	});
	it('CONV-3: rejects incorrect class names and excludes story-only hosts', () => {
		const content = "@customElement('ui-example') class WrongName {}";
		expect(
			violations({ path: 'src/components/ui-example.ts', content })['CONV-3']
		).toHaveLength(1);
		const story = violations({ path: 'src/styles/button.stories.ts', content });
		expect(story['CONV-2']).toEqual([]);
		expect(story['CONV-3']).toEqual([]);
	});
	it('CONV-4: rejects static, re-exported and dynamic Lit imports in common', () => {
		for (const content of [
			"import { html } from 'lit';",
			"export { css } from 'lit';",
			"import('lit/decorators.js');",
			"import { StoreController } from '@nanostores/lit';"
		]) {
			expect(violations({ path: 'src/common/example.ts', content })['CONV-4']).toHaveLength(
				1
			);
		}
		expect(
			violations({
				path: 'src/common/example.ts',
				content: "import { atom } from 'nanostores'; const example = 'lit';"
			})['CONV-4']
		).toEqual([]);
	});
});
