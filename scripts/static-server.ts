import path from "node:path";
import { isPathInside } from "./filesystem";

/**
 * Returns the HTTP content type header value for a static file path.
 */
export function contentTypeFromPath(filePath: string): string {
	if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
	if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
	if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
	if (filePath.endsWith(".map")) return "application/json; charset=utf-8";
	if (filePath.endsWith(".svg")) return "image/svg+xml";
	if (filePath.endsWith(".png")) return "image/png";
	if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg";
	if (filePath.endsWith(".webp")) return "image/webp";
	if (filePath.endsWith(".ico")) return "image/x-icon";
	return "application/octet-stream";
}

/**
 * Serves one static file from a web root and optionally transforms HTML before returning it.
 */
export async function serveStaticFile(options: {
	requestPath: string;
	rootDir: string;
	transformHtml?: (html: string) => string;
}): Promise<Response> {
	// The same static file handler is used for dev and dist mode. Dev mode
	// passes an HTML transform that injects the live reload client.
	const reqPath = options.requestPath === "/" ? "/index.html" : options.requestPath;
	const normalizedPath = path.normalize(reqPath).replace(/^\/+/, "");
	let resolved = path.resolve(options.rootDir, normalizedPath);

	// Keep requests such as /../package.json from escaping the selected web root.
	if (!isPathInside(options.rootDir, resolved)) {
		return new Response("Forbidden", { status: 403 });
	}

	let file = Bun.file(resolved);
	if (!(await file.exists())) {
		resolved = path.resolve(options.rootDir, "index.html");
		file = Bun.file(resolved);
		if (!(await file.exists())) {
			return new Response("Not Found", { status: 404 });
		}
	}

	if (resolved.endsWith(".html")) {
		const html = await file.text();
		return new Response(options.transformHtml ? options.transformHtml(html) : html, {
			headers: { "Content-Type": "text/html; charset=utf-8" },
		});
	}

	return new Response(file, {
		headers: {
			"Content-Type": contentTypeFromPath(resolved),
		},
	});
}
