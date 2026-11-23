import { parseHeadersFile } from './headers-file';

/**
 * Options for {@link renderHeaders}.
 */
export interface RenderHeadersOptions {
	/** When true, inserts the beta Umami Cloud script and gateway sources into the CSP. */
	telemetry: boolean;
	/** Crawler policy (`'closed'` adds global `X-Robots-Tag: noindex, nofollow, nosnippet`). */
	crawler: 'closed' | 'public';
}

const UMAMI_SCRIPT_URL = 'https://cloud.umami.is/script.js';
const UMAMI_GATEWAY_URL = 'https://gateway.umami.is';
const MAX_LINE_LENGTH = 2000;
const MAX_RULES = 100;

function insertUmamiCspTokens(cspValue: string): string {
	const directives = cspValue
		.split(';')
		.map((part) => part.trim())
		.filter(Boolean);

	let foundScriptSrc = false;
	let foundConnectSrc = false;

	const updated = directives.map((directive) => {
		const tokens = directive.split(/\s+/);
		const name = tokens[0]?.toLowerCase();

		if (name === 'script-src') {
			foundScriptSrc = true;
			const selfIndex = tokens.indexOf("'self'");
			if (selfIndex === -1) {
				throw new Error("Baseline CSP script-src directive must contain 'self'");
			}
			const nextTokens = [...tokens];
			nextTokens.splice(selfIndex + 1, 0, UMAMI_SCRIPT_URL);
			return nextTokens.join(' ');
		}

		if (name === 'connect-src') {
			foundConnectSrc = true;
			return `${tokens.join(' ')} ${UMAMI_GATEWAY_URL}`;
		}

		return directive;
	});

	if (!foundScriptSrc || !foundConnectSrc) {
		throw new Error('Baseline CSP must include both script-src and connect-src directives');
	}

	return `${updated.join('; ')};`;
}

/**
 * Renders the deployment `_headers` file from the baseline `public/_headers` template.
 *
 * Performs single-pass transformation: preserves all baseline rules and CSP sources, adds
 * revalidation `Cache-Control` (and global `X-Robots-Tag` when closed) to `/*`, optionally inserts
 * Umami Cloud CSP tokens, and appends immutable `/bundles/*` and `/web-ml/*` rules with `! Cache-Control`.
 *
 * @param baseline - Raw text of the baseline `public/_headers` file.
 * @param options - Telemetry and crawler policy flags.
 * @returns Rendered `_headers` file text.
 * @throws Error if the baseline is malformed, already includes cache/global crawler/bundle rules or Umami tokens, or exceeds Cloudflare size limits.
 */
export function renderHeaders(baseline: string, options: RenderHeadersOptions): string {
	const rules = parseHeadersFile(baseline);
	const rootRule = rules.find((rule) => rule.pattern === '/*');
	if (!rootRule) {
		throw new Error('Baseline _headers must define a "/*" rule');
	}

	for (const rule of rules) {
		if (rule.pattern === '/bundles/*' || rule.pattern === '/web-ml/*') {
			throw new Error(`Baseline _headers must not already define "${rule.pattern}"`);
		}
		for (const directive of rule.directives) {
			const lowerName = directive.name.toLowerCase();
			if (lowerName === 'cache-control') {
				throw new Error('Baseline _headers must not already contain Cache-Control');
			}
			if (rule.pattern === '/*' && lowerName === 'x-robots-tag') {
				throw new Error('Baseline _headers must not already contain global X-Robots-Tag');
			}
		}
	}

	const cspDirective = rootRule.directives.find(
		(directive) =>
			!directive.detach && directive.name.toLowerCase() === 'content-security-policy'
	);
	if (!cspDirective) {
		throw new Error('Baseline "/*" rule must define Content-Security-Policy');
	}
	if (
		!/\bscript-src\b/i.test(cspDirective.value) ||
		!/\bconnect-src\b/i.test(cspDirective.value)
	) {
		throw new Error('Baseline CSP must include both script-src and connect-src directives');
	}
	if (
		cspDirective.value.includes(UMAMI_SCRIPT_URL) ||
		cspDirective.value.includes(UMAMI_GATEWAY_URL)
	) {
		throw new Error('Baseline CSP must not already contain Umami tokens');
	}

	const lines = baseline.replace(/\r\n/g, '\n').trimEnd().split('\n');
	const renderedLines: string[] = [];
	let inRootRule = false;
	let insertedRootExtras = false;

	const appendRootExtras = () => {
		if (insertedRootExtras) return;
		renderedLines.push('  Cache-Control: public, max-age=0, must-revalidate');
		if (options.crawler === 'closed') {
			renderedLines.push('  X-Robots-Tag: noindex, nofollow, nosnippet');
		}
		insertedRootExtras = true;
	};

	for (const rawLine of lines) {
		const trimmed = rawLine.trim();
		const isIndented = /^\s/.test(rawLine);

		if (!isIndented && trimmed.length > 0 && !trimmed.startsWith('#')) {
			if (inRootRule) {
				appendRootExtras();
			}
			inRootRule = trimmed === '/*';
			renderedLines.push(rawLine);
			continue;
		}

		if (
			inRootRule &&
			options.telemetry &&
			isIndented &&
			trimmed.toLowerCase().startsWith('content-security-policy:')
		) {
			const colonIndex = rawLine.indexOf(':');
			const prefix = rawLine.slice(0, colonIndex + 1);
			const value = rawLine.slice(colonIndex + 1).trim();
			renderedLines.push(`${prefix} ${insertUmamiCspTokens(value)}`);
			continue;
		}

		if (inRootRule && trimmed.length === 0) {
			appendRootExtras();
			inRootRule = false;
		}

		renderedLines.push(rawLine);
	}

	if (inRootRule) {
		appendRootExtras();
	}

	renderedLines.push(
		'',
		'/bundles/*',
		'  ! Cache-Control',
		'  Cache-Control: public, max-age=31536000, immutable',
		'',
		'/web-ml/*',
		'  ! Cache-Control',
		'  Cache-Control: public, max-age=31536000, immutable'
	);

	const output = `${renderedLines.join('\n')}\n`;
	const outputLines = output.split('\n');
	for (let i = 0; i < outputLines.length; i++) {
		if (outputLines[i]!.length > MAX_LINE_LENGTH) {
			throw new Error(
				`Rendered _headers line ${i + 1} exceeds Cloudflare limit of ${MAX_LINE_LENGTH} characters`
			);
		}
	}
	const parsedRendered = parseHeadersFile(output);
	if (parsedRendered.length > MAX_RULES) {
		throw new Error(
			`Rendered _headers defines ${parsedRendered.length} rules, exceeding Cloudflare limit of ${MAX_RULES}`
		);
	}

	return output;
}
