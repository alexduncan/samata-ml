import { describe, expect, it } from 'bun:test';
import { segmentDescription } from '../src/common/description-segments';

describe('segmentDescription (WML-P1-DESC-1)', () => {
	const terms = [
		{ term: 'solver', title: 'The method used to fit the model.' },
		{ term: 'learning rate', title: 'The step size.' }
	];

	it('WML-P1-DESC-1: wraps the first occurrence of each term and keeps the rest as text', () => {
		const segments = segmentDescription(
			'The solver sets the solver and the learning rate.',
			terms
		);
		expect(segments).toEqual([
			{ text: 'The ' },
			{ abbr: 'solver', title: 'The method used to fit the model.' },
			{ text: ' sets the solver and the ' },
			{ abbr: 'learning rate', title: 'The step size.' },
			{ text: '.' }
		]);
	});

	it('WML-P1-DESC-1: ignores absent and empty terms and returns plain text unchanged', () => {
		expect(segmentDescription('Nothing special.', terms)).toEqual([
			{ text: 'Nothing special.' }
		]);
		expect(segmentDescription('Text', [{ term: '', title: 'x' }])).toEqual([{ text: 'Text' }]);
		expect(segmentDescription('', terms)).toEqual([]);
	});

	it('WML-P1-DESC-1: never re-wraps text inside an existing abbreviation', () => {
		const segments = segmentDescription('learning rate', [
			{ term: 'learning rate', title: 'a' },
			{ term: 'rate', title: 'b' }
		]);
		expect(segments).toEqual([{ abbr: 'learning rate', title: 'a' }]);
	});

	it('WML-P1-DESC-1: produces only text and abbr objects, never markup strings', () => {
		for (const segment of segmentDescription('The solver <b>x</b>', terms)) {
			expect(Object.keys(segment).sort()).toEqual(
				'abbr' in segment ? ['abbr', 'title'] : ['text']
			);
		}
	});
});
