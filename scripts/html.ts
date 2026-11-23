import { readFile, writeFile } from 'node:fs/promises';

/** Target HTML build mode. */
export type BuildMode = 'development' | 'production';

/**
 * Asset URLs and metadata injected into `index.html` by {@link transformIndexHtml}.
 */
export type HtmlAssets = {
	/** Root-absolute URL for the stylesheet `<link>` element. */
	cssHref: string;
	/** Root-absolute URL for the entry module `<script>` element. */
	jsSrc: string;
	/** Optional semantic application version written as `<meta name="app-version">`. */
	appVersion?: string;
};

/**
 * Returns the template variables available to public HTML files for a build mode.
 *
 * @param mode - Build mode (`development` or `production`).
 * @returns Mapping of template variable names to string values.
 */
export function templateVariables(mode: BuildMode): Record<string, string> {
	const now = new Date().toISOString();
	return {
		MODE: mode,
		APP_ENV: mode,
		BASE_URL: '/',
		BUILD_TIME: now,
		TIMESTAMP: now,
		YEAR: `${new Date().getUTCFullYear()}`
	};
}

/**
 * Replaces supported template variable tokens in an HTML string.
 *
 * @param html - Source HTML string.
 * @param mode - Build mode (`development` or `production`).
 * @returns HTML with template variables substituted.
 */
export function replaceTemplateVariables(html: string, mode: BuildMode): string {
	// Support both {{ TOKEN }} and %TOKEN% so the public template can stay simple.
	const vars = templateVariables(mode);
	return Object.entries(vars).reduce((acc, [key, value]) => {
		const curlyToken = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
		const percentToken = new RegExp(`%${key}%`, 'g');
		return acc.replace(curlyToken, value).replace(percentToken, value);
	}, html);
}

function escapeAttr(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

/**
 * Rewrites the stylesheet, script and optional version meta tags in an HTML string.
 *
 * @param html - HTML document string.
 * @param assets - Asset paths and optional `appVersion` to inject.
 * @returns Updated HTML document string.
 */
export function rewriteHtmlAssets(html: string, assets: HtmlAssets): string {
	let next = html;

	next = next.replace(
		/<link\s+[^>]*rel=["']stylesheet["'][^>]*>/i,
		`<link rel="stylesheet" href="${assets.cssHref}" />`
	);

	// Some templates are intentionally minimal, so add a stylesheet tag if one is missing.
	if (!/<link\s+[^>]*rel=["']stylesheet["'][^>]*>/i.test(html)) {
		next = next.replace(
			'</head>',
			`\t\t<link rel="stylesheet" href="${assets.cssHref}" />\n\t</head>`
		);
	}

	next = next.replace(
		/<script\s+[^>]*src=["'][^"']+["'][^>]*><\/script>/i,
		`<script type="module" src="${assets.jsSrc}"></script>`
	);

	// Some templates are intentionally minimal, so add a script tag if one is missing.
	if (!/<script\s+[^>]*src=["'][^"']+["'][^>]*><\/script>/i.test(html)) {
		next = next.replace(
			'</body>',
			`\t\t<script type="module" src="${assets.jsSrc}"></script>\n\t</body>`
		);
	}

	if (assets.appVersion !== undefined) {
		const metaTag = `<meta name="app-version" content="${escapeAttr(assets.appVersion)}" />`;
		if (/<meta\s+[^>]*name=["']app-version["'][^>]*>/i.test(next)) {
			next = next.replace(/<meta\s+[^>]*name=["']app-version["'][^>]*>/i, metaTag);
		} else {
			next = next.replace('</head>', `\t\t${metaTag}\n\t</head>`);
		}
	}

	return next;
}

/**
 * Reads an HTML file, applies template variables and asset paths, then writes it back.
 *
 * @param filePath - Path to the HTML file to rewrite in place.
 * @param mode - Build mode (`development` or `production`).
 * @param assets - Built asset paths and optional version metadata.
 */
export async function transformIndexHtml(
	filePath: string,
	mode: BuildMode,
	assets: HtmlAssets
): Promise<void> {
	// HTML transformation is shared by dev and production builds so asset tags
	// are rewritten consistently in both output directories.
	const html = await readFile(filePath, 'utf8');
	const withVars = replaceTemplateVariables(html, mode);
	const rewritten = rewriteHtmlAssets(withVars, assets);
	await writeFile(filePath, rewritten, 'utf8');
}
