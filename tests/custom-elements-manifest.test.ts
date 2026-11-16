import { expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

test('CEM-AC-1: generated content-dialog properties and event match the closed API without private members', () => {
	execFileSync('bun', ['run', 'storybook:manifest'], { stdio: 'pipe' });
	const manifest = JSON.parse(readFileSync('custom-elements.json', 'utf8'));
	const declarations = manifest.modules.flatMap(
		(module: { declarations?: Record<string, unknown>[] }) => module.declarations ?? []
	);
	const dialog = declarations.find(
		(declaration: { tagName?: string }) => declaration.tagName === 'app-content-dialog'
	);
	expect(dialog).toBeDefined();
	expect(dialog.members.map((member: { name: string }) => member.name).sort()).toEqual([
		'content',
		'contentDir',
		'contentLang',
		'heading',
		'labels',
		'open',
		'status'
	]);
	expect(
		dialog.members.every(
			(member: { privacy?: string; kind: string }) =>
				member.privacy !== 'private' && member.kind === 'field'
		)
	).toBe(true);
	const attributes = Object.fromEntries(
		dialog.attributes.map((attribute: { name: string; fieldName: string }) => [
			attribute.fieldName,
			attribute.name
		])
	);
	expect(attributes).toEqual({
		open: 'open',
		heading: 'heading',
		contentLang: 'content-lang',
		contentDir: 'content-dir',
		status: 'status'
	});
	expect(dialog.events).toEqual([
		{
			name: 'app-content-dialog-close',
			type: { text: 'CustomEvent<ContentDialogCloseDetail>' },
			description: 'The user dismissed the dialog.'
		}
	]);
	const fields = Object.fromEntries(
		dialog.members.map((member: { name: string; default?: string }) => [member.name, member])
	);
	expect(fields.open.default).toBe('false');
	expect(fields.heading.default).toBe("''");
	expect(fields.content.default).toBe('null');
	expect(fields.status.default).toBe("'loading'");
	expect(fields.labels.default).toContain("close: 'Close'");
	expect(fields.labels.default).toContain(
		'This content could not be loaded. Check your connection, then close this dialog and try again.'
	);
	expect(dialog.slots ?? []).toEqual([]);
	expect(dialog.cssParts ?? []).toEqual([]);
	expect(dialog.cssProperties ?? []).toEqual([]);
});
