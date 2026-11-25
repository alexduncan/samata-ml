import { describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import { parseSync, Visitor } from 'oxc-parser';

export const KNOWN_DRIFT: string[] = [];

const KNOWN_DRIFT_SET = new Set(KNOWN_DRIFT);

const ROOT_CSS_PATH = path.resolve('css/root.css');

/**
 * Parses all custom properties (--name:) declared in css/root.css.
 */
export function getRootTokens(): Set<string> {
	const content = fs.readFileSync(ROOT_CSS_PATH, 'utf8');
	const tokens = new Set<string>();
	for (const match of content.matchAll(/--([a-zA-Z0-9_-]+)\s*:/g)) {
		tokens.add('--' + match[1]);
	}
	return tokens;
}

/**
 * Recursively retrieves all files in a directory matching given extensions.
 */
export function getSourceFiles(dir: string, extensions: string[]): string[] {
	if (!fs.existsSync(dir)) return [];
	const results: string[] = [];
	const entries = fs.readdirSync(dir, { recursive: true, withFileTypes: true });
	for (const entry of entries) {
		if (entry.isFile() && extensions.some((ext) => entry.name.endsWith(ext))) {
			const parent = entry.parentPath || dir;
			const fullPath = path.relative('.', path.join(parent, entry.name));
			results.push(fullPath);
		}
	}
	return results.sort();
}

/**
 * Checks a file for unknown token usage.
 * Global tokens from css/root.css, component-local private properties (--_name),
 * and properties declared in the same file are considered known.
 */
export function checkUnknownTokens(
	filePath: string,
	globalTokens: Set<string>
): Array<{ token: string; line: number }> {
	const content = fs.readFileSync(filePath, 'utf8');
	const lines = content.split('\n');
	const localTokens = new Set<string>(globalTokens);

	// Collect any local custom properties declared in this file
	for (const match of content.matchAll(/--([a-zA-Z0-9_-]+)\s*:/g)) {
		localTokens.add('--' + match[1]);
	}

	const violations: Array<{ token: string; line: number }> = [];

	lines.forEach((lineText, idx) => {
		for (const match of lineText.matchAll(/var\(\s*(--[a-zA-Z0-9_-]+)/g)) {
			const token = match[1];
			if (!token) continue;
			// Private local properties (--_*) are always valid
			if (token.startsWith('--_')) continue;
			if (!localTokens.has(token)) {
				violations.push({ token, line: idx + 1 });
			}
		}
	});

	return violations;
}

/**
 * Checks a file for literal colours in var() fallbacks or in CSS declarations.
 */
export function checkLiteralColours(filePath: string): Array<{ issue: string; line: number }> {
	if (filePath === 'css/root.css') return [];
	const content = fs.readFileSync(filePath, 'utf8');
	const lines = content.split('\n');
	const violations: Array<{ issue: string; line: number }> = [];

	const colorLiteralRegex =
		/(#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|\b(?:red|green|blue|black|white|gray|grey|slate|sky)\b)/i;

	lines.forEach((lineText, idx) => {
		// 1. Literal colours in var() fallbacks
		const fallbackMatches = lineText.matchAll(/var\(\s*--[a-zA-Z0-9_-]+\s*,\s*([^)]+)\)/g);
		for (const match of fallbackMatches) {
			const fallbackValue = match[1]?.trim();
			if (fallbackValue && colorLiteralRegex.test(fallbackValue)) {
				violations.push({
					issue: `Literal colour in var() fallback: "${match[0]}"`,
					line: idx + 1
				});
			}
		}

		// 2. In TypeScript styles (src/**/*.ts), check for literal colours in colour declarations
		if (filePath.endsWith('.ts')) {
			const declMatch = lineText.match(
				/^\s*(color|background(-color)?|border(-color)?|outline(-color)?)\s*:\s*([^;]+);/
			);
			if (declMatch && declMatch[5]) {
				const value = declMatch[5].trim();
				// Allow transparent, currentColor, inherit, initial, none
				if (/^(transparent|currentColor|inherit|initial|none)$/i.test(value)) {
					return;
				}
				// If not purely var(), check for colour literal
				if (colorLiteralRegex.test(value) && !value.startsWith('var(')) {
					violations.push({
						issue: `Literal colour declaration: "${declMatch[0].trim()}"`,
						line: idx + 1
					});
				}
			}
		}
	});

	return violations;
}

/**
 * Checks a file for <style> tags inside html`...` tagged templates.
 */
export function checkStyleInTemplate(filePath: string): Array<{ issue: string; line: number }> {
	if (!filePath.endsWith('.ts')) return [];
	const content = fs.readFileSync(filePath, 'utf8');
	const violations: Array<{ issue: string; line: number }> = [];

	// Match html`...` templates that contain <style
	const htmlTemplateRegex = /html\s*`([\s\S]*?)`/g;
	let match;
	while ((match = htmlTemplateRegex.exec(content)) !== null) {
		const templateContent = match[1];
		if (templateContent && /<style\b/i.test(templateContent)) {
			// Estimate line number
			const upToMatch = content.slice(0, match.index);
			const line = upToMatch.split('\n').length;
			violations.push({
				issue: '<style> element found inside html`...` template',
				line
			});
		}
	}

	return violations;
}

function cssText(content: string, extension: '.css' | '.ts'): string {
	const styles =
		extension === '.css'
			? content
			: [...content.matchAll(/\bcss\s*`((?:\\[\s\S]|[^`])*)`/g)]
					.map((match) => match[1])
					.join('\n');
	return styles
		.replace(/\/\*[\s\S]*?\*\//g, ' ')
		.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, '');
}

function physicalDeclarations(content: string, extension: '.css' | '.ts'): string[] {
	const styles = cssText(content, extension);
	const properties =
		/(?:^|[;{}])\s*((?:left|right)|(?:(?:scroll-)?(?:margin|padding)|border)-(?:left|right)(?:-(?:width|style|color))?|border-(?:top|bottom)-(?:left|right)-radius)\s*:/gm;
	const values = /(?:^|[;{}])\s*(?:text-align|float|clear)\s*:\s*(?:left|right)\b/gm;
	return [...styles.matchAll(properties), ...styles.matchAll(values)].map((match) =>
		match[0].trim()
	);
}

function forbiddenCss(content: string, extension: '.css' | '.ts'): string[] {
	return [...cssText(content, extension).matchAll(/!\s*important\b|:host-context\s*\(/gi)].map(
		(match) => match[0]
	);
}

function inlineStyleBindings(file: string, source: string): string[] {
	const { program, errors } = parseSync(file, source);
	if (errors.length) return errors.map(({ message }) => `${file}: ${message}`);
	const tags = new Set<string>();
	const namespaces = new Set<string>();
	const issues: string[] = [];
	const report = (offset: number, issue: string) => {
		issues.push(`${file}:${source.slice(0, offset).split('\n').length}: ${issue}`);
	};

	for (const statement of program.body) {
		if (statement.type !== 'ImportDeclaration' || statement.importKind === 'type') continue;
		const module = statement.source.value;
		if (/^(?:lit|lit-html)\/directives\/style-map(?:\.js)?$/.test(module)) {
			report(statement.start, 'Lit style-map import');
		}
		if (
			!/^(?:lit|lit-html|lit-element)(?:\/(?:static-html|static|lit-html)\.js)?$/.test(module)
		)
			continue;
		for (const specifier of statement.specifiers) {
			if (specifier.type === 'ImportNamespaceSpecifier') namespaces.add(specifier.local.name);
			if (
				specifier.type === 'ImportSpecifier' &&
				specifier.imported.type === 'Identifier' &&
				['html', 'svg', 'mathml'].includes(specifier.imported.name)
			) {
				tags.add(specifier.local.name);
			}
		}
	}

	new Visitor({
		TaggedTemplateExpression({ tag, quasi: template }) {
			const namedTag = tag.type === 'Identifier' && tags.has(tag.name);
			const namespaceTag =
				tag.type === 'MemberExpression' &&
				!tag.computed &&
				tag.object.type === 'Identifier' &&
				namespaces.has(tag.object.name) &&
				tag.property.type === 'Identifier' &&
				['html', 'svg', 'mathml'].includes(tag.property.name);
			if (!namedTag && !namespaceTag) return;

			const markup = template.quasis
				.map(({ value }) => value.cooked ?? value.raw)
				.join('lit-expression');
			new HTMLRewriter()
				.on('*', {
					element(element) {
						if (element.hasAttribute('style') || element.hasAttribute('?style')) {
							report(
								template.start,
								`inline style attribute on <${element.tagName}>`
							);
						}
					}
				})
				.transform(markup);
		}
	}).visit(program);
	return issues;
}

describe('Inline styles under the production CSP', () => {
	it('BETA-ERR-2: production Lit templates do not emit inline style attributes or use style-map', () => {
		const issues = getSourceFiles('src', ['.ts'])
			.filter((file) => !file.endsWith('.stories.ts'))
			.flatMap((file) => inlineStyleBindings(file, fs.readFileSync(file, 'utf8')));
		expect(issues).toEqual([]);
	});

	it('BETA-ERR-2: finds nested templates, imported aliases and varied attribute bindings', () => {
		const source = [
			"import { html as markup } from 'lit';",
			"import * as lit from 'lit';",
			"import { styleMap as mapStyles } from 'lit/directives/style-map.js';",
			'const content = markup`<div STYLE="color: blue">${markup`<span style=${mapStyles(styles)}></span>`}</div>`;',
			"const vector = lit.svg`<circle style='fill: blue'></circle>`;",
			'const toggle = markup`<p ?style=${enabled}>Example</p>`;'
		].join('\n');
		expect(inlineStyleBindings('nested.ts', source)).toEqual([
			'nested.ts:3: Lit style-map import',
			'nested.ts:4: inline style attribute on <div>',
			'nested.ts:4: inline style attribute on <span>',
			'nested.ts:5: inline style attribute on <circle>',
			'nested.ts:6: inline style attribute on <p>'
		]);
	});

	it('BETA-ERR-2: leaves text, unrelated templates and CSSOM writes alone', () => {
		const source = [
			"import { html } from 'lit';",
			'const prose = html`<p title=\'Use style="width: 1px"\'>style="width: 1px"</p><!-- <p style="width: 1px"> -->`;',
			'const other = tag`<p style="width: 1px">`;',
			'element.style.inlineSize = "10px";'
		].join('\n');
		expect(inlineStyleBindings('inert.ts', source)).toEqual([]);
	});
});

describe('Static Style and Token Guards (TOK-1 .. TOK-6)', () => {
	const globalTokens = getRootTokens();
	const allFiles = [...getSourceFiles('src', ['.ts']), ...getSourceFiles('css', ['.css'])];

	it('TOK-1: all var(--x) references use known tokens from css/root.css or local declarations', () => {
		const nonDriftFiles = allFiles.filter((f) => !KNOWN_DRIFT_SET.has(f));
		const failures: Array<{
			file: string;
			violations: Array<{ token: string; line: number }>;
		}> = [];

		for (const file of nonDriftFiles) {
			const violations = checkUnknownTokens(file, globalTokens);
			if (violations.length > 0) {
				failures.push({ file, violations });
			}
		}

		if (failures.length > 0) {
			const summary = failures
				.map(
					(f) =>
						`${f.file}: ${f.violations.map((v) => `${v.token} (line ${v.line})`).join(', ')}`
				)
				.join('\n');
			expect.unreachable(`TOK-1 failed with unknown tokens:\n${summary}`);
		}
		expect(failures.length).toBe(0);
	});

	it('TOK-2: no literal colour values in declarations or var() fallbacks outside css/root.css', () => {
		const nonDriftFiles = allFiles.filter((f) => !KNOWN_DRIFT_SET.has(f));
		const failures: Array<{
			file: string;
			violations: Array<{ issue: string; line: number }>;
		}> = [];

		for (const file of nonDriftFiles) {
			const violations = checkLiteralColours(file);
			if (violations.length > 0) {
				failures.push({ file, violations });
			}
		}

		if (failures.length > 0) {
			const summary = failures
				.map(
					(f) =>
						`${f.file}: ${f.violations.map((v) => `${v.issue} (line ${v.line})`).join(', ')}`
				)
				.join('\n');
			expect.unreachable(`TOK-2 failed with literal colours:\n${summary}`);
		}
		expect(failures.length).toBe(0);
	});

	it('TOK-3: no <style> tags inside html`...` templates in component code', () => {
		const nonDriftFiles = allFiles.filter((f) => !KNOWN_DRIFT_SET.has(f));
		const failures: Array<{
			file: string;
			violations: Array<{ issue: string; line: number }>;
		}> = [];

		for (const file of nonDriftFiles) {
			const violations = checkStyleInTemplate(file);
			if (violations.length > 0) {
				failures.push({ file, violations });
			}
		}

		if (failures.length > 0) {
			const summary = failures
				.map(
					(f) =>
						`${f.file}: ${f.violations.map((v) => `${v.issue} (line ${v.line})`).join(', ')}`
				)
				.join('\n');
			expect.unreachable(`TOK-3 failed with <style> inside html template:\n${summary}`);
		}
		expect(failures.length).toBe(0);
	});

	it('TOK-4: the repaired shell has no token exemptions', () => {
		expect(KNOWN_DRIFT).toEqual([]);
	});

	it('TOK-5: CSS declarations use logical inline directions', () => {
		const failures = allFiles
			.filter((file) => !KNOWN_DRIFT_SET.has(file))
			.flatMap((file) =>
				physicalDeclarations(
					fs.readFileSync(file, 'utf8'),
					file.endsWith('.css') ? '.css' : '.ts'
				).map((issue) => `${file}: ${issue}`)
			);
		expect(failures).toEqual([]);
	});

	it('TOK-5: rejects physical style probes and accepts non-CSS scroll coordinates', () => {
		expect(
			physicalDeclarations('a { margin-left: 1rem; right: 0; text-align: left; }', '.css')
		).toHaveLength(3);
		expect(
			physicalDeclarations(
				'const styles = css`a { border-right-color: var(--stone-700); }`;',
				'.ts'
			)
		).toHaveLength(1);
		expect(
			physicalDeclarations(
				'const position = { top: 1, left: 2 }; const label = "right: 0;";',
				'.ts'
			)
		).toEqual([]);
		expect(
			physicalDeclarations(
				'a { margin-inline-start: 1rem; content: "x; left: 1px;"; /* right: 1px; */ }',
				'.css'
			)
		).toEqual([]);
	});

	it('TOK-6: styles contain neither important overrides nor host-context selectors', () => {
		const failures = allFiles
			.filter((file) => !KNOWN_DRIFT_SET.has(file))
			.flatMap((file) =>
				forbiddenCss(
					fs.readFileSync(file, 'utf8'),
					file.endsWith('.css') ? '.css' : '.ts'
				).map((issue) => `${file}: ${issue}`)
			);
		expect(failures).toEqual([]);
	});

	it('TOK-6: rejects forbidden CSS probes and ignores comments and JavaScript strings', () => {
		expect(
			forbiddenCss(
				'const styles = css`:host-context(.dark) { display: block !important; }`;',
				'.ts'
			)
		).toHaveLength(2);
		expect(forbiddenCss('a { display: block ! important; }', '.css')).toHaveLength(1);
		expect(forbiddenCss('const text = "!important :host-context()";', '.ts')).toEqual([]);
		expect(
			forbiddenCss('/* !important :host-context() */ a { content: "!important"; }', '.css')
		).toEqual([]);
	});
});
