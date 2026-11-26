/**
 * Derives the dataset name for an uploaded file: the file name without a `.csv` extension.
 *
 * Shared by the ingestion pipeline (which stores it as `metadata.name`) and the load store
 * (which shows it while loading), so the heading does not change at completion.
 *
 * @param fileName - Name of the uploaded file.
 * @returns The display name, or `'Uploaded dataset'` when the stem is empty.
 */
export function uploadDatasetName(fileName: string): string {
	return fileName.replace(/\.csv$/i, '') || 'Uploaded dataset';
}
