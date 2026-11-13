import { describe, expect, it } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

export const KNOWN_DRIFT = [
	'src/app.ts',
	'src/features/navigation/app-sidebar.ts',
	'src/features/navigation/app-content-modal.ts',
	'src/features/onboarding/app-welcome-modal.ts'
];

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
			// Exception per visual-design.md §2: backdrop token to be added in remediation
			if (
				filePath === 'src/styles/dialog.styles.ts' &&
				lineText.includes('rgb(30 25 22 / 55%)')
			) {
				return;
			}
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

describe('Static Style and Token Guards (TOK-1 .. TOK-4)', () => {
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

	it('TOK-4: all files in KNOWN_DRIFT fail at least one guard (drift files must not pass)', () => {
		for (const file of KNOWN_DRIFT) {
			const unknownTokens = checkUnknownTokens(file, globalTokens);
			const literalColours = checkLiteralColours(file);
			const styleInTemplate = checkStyleInTemplate(file);

			const totalViolations =
				unknownTokens.length + literalColours.length + styleInTemplate.length;

			expect(totalViolations).toBeGreaterThan(0);
		}
	});
});
