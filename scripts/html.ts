import { readFile, writeFile } from "node:fs/promises";

export type BuildMode = "development" | "production";

export type HtmlAssets = {
	cssHref: string;
	jsSrc: string;
	inlineCssText?: string;
};

/**
 * Returns the template variables available to public HTML files for a build mode.
 */
export function templateVariables(mode: BuildMode): Record<string, string> {
	const now = new Date().toISOString();
	return {
		MODE: mode,
		APP_ENV: mode,
		BASE_URL: "/",
		BUILD_TIME: now,
		TIMESTAMP: now,
		YEAR: `${new Date().getUTCFullYear()}`,
	};
}

/**
 * Replaces supported template variable tokens in an HTML string.
 */
export function replaceTemplateVariables(html: string, mode: BuildMode): string {
	// Support both {{ TOKEN }} and %TOKEN% so the public template can stay simple.
	const vars = templateVariables(mode);
	return Object.entries(vars).reduce((acc, [key, value]) => {
		const curlyToken = new RegExp(`{{\\s*${key}\\s*}}`, "g");
		const percentToken = new RegExp(`%${key}%`, "g");
		return acc.replace(curlyToken, value).replace(percentToken, value);
	}, html);
}

/**
 * Rewrites the stylesheet and script tags in an HTML string to point at built assets.
 */
export function rewriteHtmlAssets(html: string, assets: HtmlAssets): string {
	let next = html;

	next = next.replace(
		/<link\s+[^>]*rel=["']stylesheet["'][^>]*>/i,
		`<link rel="stylesheet" href="${assets.cssHref}" />`,
	);

	// Some templates are intentionally minimal, so add a stylesheet tag if one is missing.
	if (!/<link\s+[^>]*rel=["']stylesheet["'][^>]*>/i.test(html)) {
		next = next.replace(
			"</head>",
			`\t\t<link rel="stylesheet" href="${assets.cssHref}" />\n\t</head>`,
		);
	}

	next = next.replace(
		/<script\s+[^>]*src=["'][^"']+["'][^>]*><\/script>/i,
		`<script type="module" src="${assets.jsSrc}"></script>`,
	);

	// Some templates are intentionally minimal, so add a script tag if one is missing.
	if (!/<script\s+[^>]*src=["'][^"']+["'][^>]*><\/script>/i.test(html)) {
		next = next.replace("</body>", `\t\t<script type="module" src="${assets.jsSrc}"></script>\n\t</body>`);
	}

	if (assets.inlineCssText !== undefined) {
		next = next.replace(
			"</head>",
			`\t\t<style data-inline-build="true">\n${assets.inlineCssText}\n\t\t</style>\n\t</head>`,
		);
	}

	return next;
}

/**
 * Reads an HTML file, applies template variables and asset paths, then writes it back.
 */
export async function transformIndexHtml(
	filePath: string,
	mode: BuildMode,
	assets: HtmlAssets,
): Promise<void> {
	// HTML transformation is shared by dev and production builds so asset tags
	// are rewritten consistently in both output directories.
	const html = await readFile(filePath, "utf8");
	const withVars = replaceTemplateVariables(html, mode);
	const rewritten = rewriteHtmlAssets(withVars, assets);
	await writeFile(filePath, rewritten, "utf8");
}
