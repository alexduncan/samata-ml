import { describe, expect, test } from 'bun:test';
import { selectDataViewMode } from '../src/features/data/data-view-mode';
import { INITIAL_APP_STATE } from '../src/types/state';

const dataset = {
	id: 'd1',
	name: 'Iris',
	source: 'sample' as const,
	rowCount: 3,
	columns: []
};
const withData = (mode: 'select' | 'preview', hasDataset: boolean) => ({
	dataset: hasDataset ? dataset : null,
	data: { ...INITIAL_APP_STATE.data, mode }
});

describe('selectDataViewMode (DVM-1)', () => {
	test('shows the preview while ingesting with no dataset', () => {
		expect(
			selectDataViewMode(withData('select', false), { stage: 'ingesting', errorStage: null })
		).toEqual({ mode: 'preview', showLoadAlert: false });
	});

	test('keeps the preview through the publication gap and when ready', () => {
		expect(
			selectDataViewMode(withData('preview', true), { stage: 'ingesting', errorStage: null })
		).toEqual({ mode: 'preview', showLoadAlert: false });
		expect(
			selectDataViewMode(withData('preview', true), { stage: 'idle', errorStage: null })
		).toEqual({ mode: 'preview', showLoadAlert: false });
	});

	test('returns to selection with an alert after an ingesting failure with no dataset', () => {
		expect(
			selectDataViewMode(withData('select', false), {
				stage: 'idle',
				errorStage: 'ingesting'
			})
		).toEqual({ mode: 'selection', showLoadAlert: true });
	});

	test('stays in the preview without an alert once the replacement committed', () => {
		expect(
			selectDataViewMode(withData('preview', true), {
				stage: 'idle',
				errorStage: 'ingesting'
			})
		).toEqual({ mode: 'preview', showLoadAlert: false });
	});

	test('a validating failure shows the selection view with no alert', () => {
		expect(
			selectDataViewMode(withData('select', false), {
				stage: 'idle',
				errorStage: 'validating'
			})
		).toEqual({ mode: 'selection', showLoadAlert: false });
	});
});
