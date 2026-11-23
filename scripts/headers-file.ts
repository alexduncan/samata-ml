/**
 * One header directive inside a `_headers` rule block.
 */
export interface HeaderDirective {
	/** Header name (case-preserved). */
	name: string;
	/** Header value (`''` when `detach` is true). */
	value: string;
	/** True when this directive is a Cloudflare `! Header` detach instruction. */
	detach: boolean;
}

/**
 * One path-matching rule block parsed from a Cloudflare `_headers` file.
 */
export interface HeaderRule {
	/** Absolute URL path pattern with at most one `*` wildcard. */
	pattern: string;
	/** Ordered list of header directives applied when `pattern` matches. */
	directives: HeaderDirective[];
}

const VALID_HEADER_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

function validatePattern(pattern: string): void {
	if (!pattern.startsWith('/')) {
		throw new Error(`Invalid _headers pattern "${pattern}": pattern must start with "/"`);
	}
	if (pattern.includes(':')) {
		throw new Error(
			`Invalid _headers pattern "${pattern}": ":placeholder" syntax is not supported`
		);
	}
	const firstStar = pattern.indexOf('*');
	if (firstStar !== -1 && pattern.indexOf('*', firstStar + 1) !== -1) {
		throw new Error(`Invalid _headers pattern "${pattern}": at most one "*" splat is allowed`);
	}
}

function parseDirective(trimmedLine: string, lineNumber: number): HeaderDirective {
	if (trimmedLine.startsWith('!')) {
		const rest = trimmedLine.slice(1).trim();
		if (!rest || rest.includes(':') || !VALID_HEADER_NAME.test(rest)) {
			throw new Error(`Malformed detach directive on line ${lineNumber}: "${trimmedLine}"`);
		}
		return { name: rest, value: '', detach: true };
	}

	const colonIndex = trimmedLine.indexOf(':');
	if (colonIndex <= 0) {
		throw new Error(`Malformed header directive on line ${lineNumber}: "${trimmedLine}"`);
	}
	const name = trimmedLine.slice(0, colonIndex).trim();
	const value = trimmedLine.slice(colonIndex + 1).trim();
	if (!VALID_HEADER_NAME.test(name) || value.length === 0) {
		throw new Error(`Malformed header directive on line ${lineNumber}: "${trimmedLine}"`);
	}
	return { name, value, detach: false };
}

/**
 * Parses a Cloudflare static-asset `_headers` file into ordered {@link HeaderRule} entries.
 *
 * @param text - Raw contents of the `_headers` file.
 * @returns Ordered list of parsed rules.
 * @throws Error if a pattern, header line, or indentation is malformed or uses `:placeholder`.
 * @example
 * ```ts
 * const rules = parseHeadersFile('/*\n  Cache-Control: public, max-age=0, must-revalidate\n');
 * ```
 */
export function parseHeadersFile(text: string): HeaderRule[] {
	const rules: HeaderRule[] = [];
	const lines = text.replace(/\r\n/g, '\n').split('\n');
	let currentRule: HeaderRule | null = null;

	for (let index = 0; index < lines.length; index++) {
		const rawLine = lines[index]!;
		const lineNumber = index + 1;
		const trimmed = rawLine.trim();

		if (trimmed.length === 0 || trimmed.startsWith('#')) {
			continue;
		}

		const isIndented = /^\s/.test(rawLine);
		if (!isIndented) {
			if (/\s/.test(trimmed)) {
				throw new Error(`Invalid _headers pattern on line ${lineNumber}: "${trimmed}"`);
			}
			validatePattern(trimmed);
			currentRule = { pattern: trimmed, directives: [] };
			rules.push(currentRule);
			continue;
		}

		if (!currentRule) {
			throw new Error(
				`Header directive on line ${lineNumber} appears before any path pattern`
			);
		}
		currentRule.directives.push(parseDirective(trimmed, lineNumber));
	}

	return rules;
}

function matchesPattern(pattern: string, pathname: string): boolean {
	const starIndex = pattern.indexOf('*');
	if (starIndex === -1) {
		return pathname === pattern;
	}
	const prefix = pattern.slice(0, starIndex);
	const suffix = pattern.slice(starIndex + 1);
	return (
		pathname.length >= prefix.length + suffix.length &&
		pathname.startsWith(prefix) &&
		pathname.endsWith(suffix)
	);
}

/**
 * Resolves effective response headers for `pathname` using Cloudflare `_headers` matching rules.
 *
 * Rules are evaluated in file order; matching header names accumulate with comma joining, and
 * `! Header` directives delete previously accumulated values for that header.
 *
 * @param rules - Parsed rules from {@link parseHeadersFile}.
 * @param pathname - Request URL pathname (must start with `/`).
 * @returns Resolved `Headers` object.
 * @throws Error if `pathname` does not start with `/`.
 * @example
 * ```ts
 * const headers = resolveHeaders(parseHeadersFile(text), '/bundles/app.1234567890.js');
 * ```
 */
export function resolveHeaders(rules: readonly HeaderRule[], pathname: string): Headers {
	if (!pathname.startsWith('/')) {
		throw new Error(`Pathname must start with "/": "${pathname}"`);
	}
	const resolved = new Headers();
	for (const rule of rules) {
		if (!matchesPattern(rule.pattern, pathname)) {
			continue;
		}
		for (const directive of rule.directives) {
			if (directive.detach) {
				resolved.delete(directive.name);
			} else {
				resolved.append(directive.name, directive.value);
			}
		}
	}
	return resolved;
}
