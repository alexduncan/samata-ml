import { describe, expect, it } from 'bun:test';
import { decodeProtectedDomain } from '../src/common/storage/training-domain';
import type { ColumnType } from '../src/types/state';
import { isTemporalColumnType, TEMPORAL_COLUMN_TYPES } from '../src/types/state';

describe('temporal column vocabulary', () => {
	it('TEMP-AC-1: isTemporalColumnType accepts only date, time and datetime', () => {
		const all: ColumnType[] = [
			'numeric',
			'categorical',
			'boolean',
			'date',
			'time',
			'datetime',
			'text'
		];
		expect(all.filter(isTemporalColumnType)).toEqual(['date', 'time', 'datetime']);
		expect([...TEMPORAL_COLUMN_TYPES]).toEqual(['date', 'time', 'datetime']);
	});

	it('TEMP-AC-3: persisted state accepts date, time and legacy datetime and rejects unknown types', () => {
		const withTypes = (...types: string[]) => ({
			dataset: {
				id: 'd',
				name: 'D',
				source: 'upload',
				rowCount: 1,
				columns: types.map((type, index) => ({ name: `c${index}`, type, missingCount: 0 }))
			},
			target: null,
			models: [],
			nextModelNum: 1,
			data: { mode: 'preview', selectedColumn: null }
		});
		const accepted = decodeProtectedDomain(withTypes('date', 'time', 'datetime', 'numeric'));
		expect(accepted).not.toBeNull();
		expect(decodeProtectedDomain(withTypes('date', 'duration'))).toBeNull();
	});
});
