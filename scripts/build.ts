import { DIST_DIR } from "./config";
import { buildProductionBundle } from "./build-assets";
import { generateStaticPages } from "./generate-pages";

/**
 * Runs the production build entrypoint and prints the generated asset names.
 */
async function main(): Promise<void> {
	console.log("Starting production build...");
	await generateStaticPages();
	const result = await buildProductionBundle();

	console.log(`Production build complete.`);
	console.log(`Output directory: ${DIST_DIR}`);
	console.log(`JavaScript asset: ${result.jsFile}`);
	console.log(`CSS asset: ${result.cssFile}`);
}

await main();
