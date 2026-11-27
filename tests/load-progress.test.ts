import { describe, expect, it } from 'bun:test';
import { toLoadProgressView } from '../src/features/data/load-progress';
import type { IngestionProgress } from '../src/features/data/ingestion/pipeline';

function progress(update: Partial<IngestionProgress>): IngestionProgress {
	return {
		phase: 'parse',
		bytesProcessed: 0,
		totalBytes: null,
		rowsProcessed: 0,
		totalRows: null,
		...update
	};
}

describe('toLoadProgressView', () => {
	it('LOADP-1: is indeterminate for a download with unknown size', () => {
		const view = toLoadProgressView(
			progress({ phase: 'download', totalBytes: null }),
			'sample'
		);
		expect(view.value).toBeNull();
		expect(view).toMatchObject({ stepIndex: 1, stepCount: 4 });
	});

	it('LOADP-1: is determinate in bytes for parse', () => {
		expect(
			toLoadProgressView(
				progress({ phase: 'parse', bytesProcessed: 30, totalBytes: 120 }),
				'upload'
			)
		).toMatchObject({ value: 30, max: 120, stepIndex: 1, stepCount: 3 });
	});

	it('LOADP-1: is determinate in rows for typing', () => {
		expect(
			toLoadProgressView(
				progress({ phase: 'typing', rowsProcessed: 5000, totalRows: 20000 }),
				'sample'
			)
		).toMatchObject({ value: 5000, max: 20000, stepIndex: 3, stepCount: 4 });
	});

	it('LOADP-1: counts finished columns for statistics and ignores per-scan rows', () => {
		const view = toLoadProgressView(
			progress({
				phase: 'statistics',
				rowsProcessed: 3,
				totalRows: 1000,
				columnsProcessed: 1,
				columnsTotal: 3
			}),
			'upload'
		);
		expect(view).toMatchObject({ value: 1, max: 3, stepIndex: 3, stepCount: 3 });
	});

	it('LOADP-1: is indeterminate for statistics without numeric columns', () => {
		const view = toLoadProgressView(
			progress({ phase: 'statistics', columnsProcessed: 0, columnsTotal: 0 }),
			'sample'
		);
		expect(view.value).toBeNull();
		expect(view).toMatchObject({ stepIndex: 4, stepCount: 4 });
	});
});
