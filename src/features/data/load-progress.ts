import type { IngestionProgress } from './ingestion/pipeline';

/** Kind of load a progress view describes: a sample (four steps) or an upload's second pass (three). */
export type LoadStageKind = 'sample' | 'upload';

/** Presentation values for a labelled `<progress>` element. */
export interface LoadProgressView {
	/** Current ingestion phase. */
	phase: IngestionProgress['phase'];
	/** Current value, or `null` when the phase is indeterminate (omit `value` on the element). */
	value: number | null;
	/** Maximum value for a determinate phase; `1` when indeterminate. */
	max: number;
	/** One-based index of the current step. */
	stepIndex: number;
	/** Total number of steps for this kind of load. */
	stepCount: number;
}

const SAMPLE_PHASES: readonly IngestionProgress['phase'][] = [
	'download',
	'parse',
	'typing',
	'statistics'
];
const UPLOAD_PASS_TWO_PHASES: readonly IngestionProgress['phase'][] = [
	'parse',
	'typing',
	'statistics'
];

/**
 * Maps ingestion progress to determinate or indeterminate progress-bar values.
 *
 * Download and parse use bytes, typing uses rows, and statistics counts finished numeric
 * columns (the per-scan row counter restarts and is ignored).
 *
 * @param progress - Latest ingestion progress.
 * @param kind - Whether the load is a sample or an upload's second pass.
 * @returns Values for the in-page progress bar.
 */
export function toLoadProgressView(
	progress: IngestionProgress,
	kind: LoadStageKind
): LoadProgressView {
	const phases = kind === 'sample' ? SAMPLE_PHASES : UPLOAD_PASS_TWO_PHASES;
	const stepIndex = Math.max(1, phases.indexOf(progress.phase) + 1);
	const base = { phase: progress.phase, stepIndex, stepCount: phases.length };
	const determinate = (value: number, max: number): LoadProgressView => ({
		...base,
		value: Math.min(Math.max(value, 0), max),
		max
	});
	const indeterminate: LoadProgressView = { ...base, value: null, max: 1 };

	switch (progress.phase) {
		case 'download':
		case 'parse':
			return progress.totalBytes !== null && progress.totalBytes > 0
				? determinate(progress.bytesProcessed, progress.totalBytes)
				: indeterminate;
		case 'typing':
			return progress.totalRows !== null && progress.totalRows > 0
				? determinate(progress.rowsProcessed, progress.totalRows)
				: indeterminate;
		case 'statistics':
			return progress.columnsTotal !== undefined && progress.columnsTotal > 0
				? determinate(progress.columnsProcessed ?? 0, progress.columnsTotal)
				: indeterminate;
	}
}
