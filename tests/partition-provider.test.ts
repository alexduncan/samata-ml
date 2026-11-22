import { expect, test } from 'bun:test';
import { PartitionDatasetProvider } from '../src/features/models/training/partition-provider';
import type { PreparedClassification } from '../src/features/models/training/types';

const data: PreparedClassification = {
	features: Float64Array.of(3, 1, 6, Number.NaN, 9, 2),
	columns: [
		{ name: 'amount', kind: 'numeric' },
		{ name: 'category', kind: 'categorical', categories: ['A', 'B', 'C'] }
	],
	targetCodes: Float64Array.of(0, 1, 1),
	classLabels: [true, false],
	sourceRowIndices: [1, 4, 5],
	excludedTargetRows: 3
};

test('WML-P3-DATA-2: writes requested row and feature order into the provided buffers', async () => {
	const indices = Uint32Array.of(2, 0, 1);
	const provider = new PartitionDatasetProvider(data, indices);
	indices[0] = 1;
	expect([provider.sampleCount, provider.featureCount, provider.targetCount]).toEqual([3, 2, 1]);
	const features = new Float64Array(6);
	const targets = new Float64Array(3);
	const progress: number[] = [];
	await provider.load(features, targets, undefined, (fraction) => progress.push(fraction));
	expect([...features]).toEqual([9, 2, 3, 1, 6, Number.NaN]);
	expect([...targets]).toEqual([1, 0, 1]);
	expect(progress).toEqual([0, 1]);

	const featuresOnly = new Float64Array(6);
	await provider.load(featuresOnly);
	expect([...featuresOnly]).toEqual([...features]);
});

test('WML-P3-DATA-2: observes abort before writing and between copy batches', async () => {
	const provider = new PartitionDatasetProvider(
		data,
		Array.from({ length: 1024 }, () => 0)
	);
	const features = new Float64Array(2048).fill(-1);
	const targets = new Float64Array(1024).fill(-1);
	const aborted = AbortSignal.abort();
	await expect(provider.load(features, targets, aborted)).rejects.toMatchObject({
		name: 'AbortError'
	});
	expect(features[0]).toBe(-1);
	const controller = new AbortController();
	const progress: number[] = [];
	await expect(
		provider.load(features, targets, controller.signal, (fraction) => {
			progress.push(fraction);
			if (fraction > 0) controller.abort();
		})
	).rejects.toMatchObject({ name: 'AbortError' });
	expect(progress).toEqual([0, 0.5]);
	expect(targets[511]).toBe(0);
	expect(targets[512]).toBe(-1);
	expect(features[1024]).toBe(-1);
});

test('WML-P3-DATA-3: rejects invalid indices and mismatched shapes without writing', async () => {
	for (const indices of [[], [-1], [3], [0.5], [NaN]]) {
		expect(() => new PartitionDatasetProvider(data, indices)).toThrow('invalid-dimensions');
	}
	expect(
		() => new PartitionDatasetProvider({ ...data, features: Float64Array.of(1) }, [0])
	).toThrow('invalid-dimensions');
	const provider = new PartitionDatasetProvider(data, [1]);
	await expect(provider.load(new Float64Array(1))).rejects.toMatchObject({
		code: 'invalid-dimensions'
	});
	const features = Float64Array.of(-1, -1);
	await expect(provider.load(features, new Float64Array(2))).rejects.toMatchObject({
		code: 'invalid-dimensions'
	});
	expect([...features]).toEqual([-1, -1]);
});
