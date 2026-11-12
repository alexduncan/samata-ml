import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';

const CONTENT_DIR = path.join(process.cwd(), 'content');
const GENERATED_DIR = path.join(process.cwd(), 'src', 'generated');
const PAGES_DIR = path.join(GENERATED_DIR, 'pages');
const ROUTES_FILE = path.join(GENERATED_DIR, 'routes.ts');

export interface StaticPageData {
	title: string;
	short_title: string;
	html: string;
	url: string;
}

/**
 * Recursively gets all markdown files in a directory.
 */
async function getMarkdownFiles(dir: string): Promise<string[]> {
	let files: string[] = [];
	try {
		const entries = await readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(dir, entry.name);
			if (entry.isDirectory()) {
				files = files.concat(await getMarkdownFiles(fullPath));
			} else if (entry.isFile() && entry.name.endsWith('.md')) {
				files.push(fullPath);
			}
		}
	} catch (e) {
		// Ignore if directory doesn't exist
		if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
			console.error(`Error reading directory ${dir}:`, e);
		}
	}
	return files;
}

/**
 * Generates the TypeScript files from Markdown files.
 */
export async function generateStaticPages(): Promise<void> {
	console.log('Generating static pages from Markdown...');
	
	await mkdir(GENERATED_DIR, { recursive: true });
	await mkdir(PAGES_DIR, { recursive: true });

	const pagesDir = path.join(CONTENT_DIR, 'pages');
	const modelsDir = path.join(CONTENT_DIR, 'models');
	
	const pageFiles = await getMarkdownFiles(pagesDir);
	const modelFiles = await getMarkdownFiles(modelsDir);
	
	const allFiles = [...pageFiles, ...modelFiles];
	const routesMapping: Record<string, string> = {}; // URL to local module path
	let pageCount = 0;

	for (const filePath of allFiles) {
		const fileContent = await readFile(filePath, 'utf-8');
		const parsed = matter(fileContent);
		const html = await marked.parse(parsed.content);
		
		// Calculate URL and paths based on file path relative to content dir
		const relativePath = path.relative(CONTENT_DIR, filePath);
		const parsedPath = path.parse(relativePath);
		
		// Map 'pages/about' -> 'about', 'models/linear' -> 'model/linear'
		let url = '';
		let moduleName = '';
		
		if (parsedPath.dir === 'pages') {
			url = `/${parsedPath.name}`;
			moduleName = parsedPath.name;
		} else if (parsedPath.dir === 'models') {
			url = `/model/${parsedPath.name}`;
			moduleName = `model_${parsedPath.name}`; // Ensure valid TS module path/name
		} else {
			// Fallback
			url = `/${parsedPath.dir}/${parsedPath.name}`;
			moduleName = `${parsedPath.dir.replace(/\//g, '_')}_${parsedPath.name}`;
		}

		// Ensure moduleName is safe for filenames
		moduleName = moduleName.replace(/[^a-zA-Z0-9_]/g, '_');

		const pageData: StaticPageData = {
			title: parsed.data.title || parsedPath.name,
			short_title: parsed.data.short_title || parsedPath.name,
			html: html,
			url: url
		};

		// 1. Generate the individual page TS file
		const pageFileContent = `// THIS FILE IS AUTO-GENERATED. DO NOT EDIT MANUALLY.
import m from 'mithril';
import { Layout } from '../../views/layout';
import { StaticPageView } from '../../views/staticPage';

const pageData = ${JSON.stringify(pageData, null, '\t')};

export default {
	view: () => [
		m(Layout({ view: () => m('section') })),
		m(StaticPageView, { pageData })
	]
};
`;
		
		const outputFilePath = path.join(PAGES_DIR, `${moduleName}.ts`);
		await writeFile(outputFilePath, pageFileContent, 'utf-8');
		
		// Record the route mapping for routes.ts
		routesMapping[url] = `./pages/${moduleName}`;
		pageCount++;
	}

	// 2. Generate routes.ts
	let routesFileContent = `// THIS FILE IS AUTO-GENERATED. DO NOT EDIT MANUALLY.\nimport m from 'mithril';\n\n`;
	routesFileContent += `export const dynamicRoutes: m.RouteDefs = {\n`;
	
	for (const [url, modulePath] of Object.entries(routesMapping)) {
		routesFileContent += `\t"${url}": {\n`;
		routesFileContent += `\t\tonmatch: () => import('${modulePath}').then(module => module.default)\n`;
		routesFileContent += `\t},\n`;
	}
	
	routesFileContent += `};\n`;

	await writeFile(ROUTES_FILE, routesFileContent, 'utf-8');
	console.log(`Generated ${pageCount} static pages and routes mapping.`);
}

// Allow running directly
if (import.meta.url === `file://${process.argv[1]}`) {
	generateStaticPages().catch(console.error);
}
