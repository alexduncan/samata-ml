import { describe, expect, it } from 'bun:test';
import {
	addToDisplayHistogram,
	createDisplayHistogram,
	FineHistogram,
	exactMedian
} from '../src/features/data/ingestion/order-statistics';

function makeFineHistogram(values: number[]): FineHistogram {
	let min = Infinity;
	let max = -Infinity;
	for (const value of values) {
		min = Math.min(min, value);
		max = Math.max(max, value);
	}
	const histogram = new FineHistogram(min, max);
	for (const value of values) histogram.add(value);
	return histogram;
}

async function medianFrom(
	values: number[],
	collectLimit?: number,
	onCollect?: (size: number) => void
) {
	const histogram = makeFineHistogram(values);
	return exactMedian(
		histogram,
		async (visit) => {
			for (const value of values) visit(value);
		},
		{ collectLimit, onCollect }
	);
}

describe('streaming order statistics', () => {
	it('matches a full sort for odd, even, and large random arrays', async () => {
		let seed = 0x12345678;
		const random = () => {
			seed ^= seed << 13;
			seed ^= seed >>> 17;
			seed ^= seed << 5;
			return (seed >>> 0) / 0x1_0000_0000;
		};
		for (const size of [1, 2, 7, 10_000, 2_000_001]) {
			const values = Array.from({ length: size }, random);
			const sorted = [...values].sort((left, right) => left - right);
			const lo = Math.floor((size - 1) / 2);
			const hi = Math.floor(size / 2);
			const expected = (sorted[lo]! + sorted[hi]!) / 2;
			let largestCollection = 0;
			const result = await medianFrom(values, 1000, (collected) => {
				largestCollection = Math.max(largestCollection, collected);
			});
			expect(result).toBe(expected);
			expect(largestCollection).toBeLessThanOrEqual(1000);
		}
	});

	it('resolves a dominant repeated value from bucket ranges without collecting', async () => {
		const values = [
			...Array(18_000).fill(0),
			...Array.from({ length: 2_000 }, (_, i) => i + 1)
		];
		const collected: number[] = [];
		expect(await medianFrom(values, 100, (size) => collected.push(size))).toBe(0);
		expect(collected).toEqual([]);
	});

	it('builds approved integer, float, bounded, and constant display histograms', () => {
		const smallIntegers = createDisplayHistogram(3, 2007, 2009, true);
		expect(smallIntegers).toEqual({ start: 2006.5, width: 1, counts: [0, 0, 0] });

		const tenthValues = createDisplayHistogram(400, 0, 9.99, false);
		expect(tenthValues).toMatchObject({ start: 0, width: 0.5 });
		expect(tenthValues.counts).toHaveLength(20);
		for (let index = 0; index < 400; index++) {
			addToDisplayHistogram(tenthValues, (index * 9.99) / 399);
		}
		expect(tenthValues.counts.reduce((sum, value) => sum + value, 0)).toBe(400);
		expect(tenthValues.counts.at(-1)).toBeGreaterThan(0);

		const broadFloats = createDisplayHistogram(344, -3.2, 41.7, false);
		expect(broadFloats).toMatchObject({ start: -5, width: 2.5 });
		expect(broadFloats.counts.length).toBeLessThanOrEqual(100);
		addToDisplayHistogram(broadFloats, 41.7);
		expect(broadFloats.counts.at(-1)).toBe(1);

		expect(createDisplayHistogram(50, 4, 4, true)).toEqual({
			start: 3.5,
			width: 1,
			counts: [0]
		});
	});
});
