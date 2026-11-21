import { describe, expect, test } from 'bun:test';
import {
	partitionFingerprint,
	type PartitionFingerprintInput
} from '../src/common/evaluation/partition-fingerprint';

function iris(): PartitionFingerprintInput {
	return {
		datasetId: 'iris',
		kind: 'cross_validation',
		foldsOrTestRatio: 5,
		randomState: 42,
		classLabels: ['setosa', 'versicolor', 'virginica'],
		rows: Array.from({ length: 150 }, (_, row) => [row, row % 5] as const)
	};
}

describe('partition fingerprint', () => {
	test('WML-P4-EVAL-3: matches the fixed digest for the Iris fixture', async () => {
		expect(await partitionFingerprint(iris())).toBe(
			'40ce1bc409808674c576dd76a94c41f7e5e3c7e8c47f654e97fcdd7382b8c993'
		);
	});

	test('WML-P4-EVAL-3: is stable across row-pair input order', async () => {
		const shuffled = { ...iris(), rows: [...iris().rows].reverse() };
		expect(await partitionFingerprint(shuffled)).toBe(await partitionFingerprint(iris()));
	});

	test('WML-P4-EVAL-3: changes with dataset, protocol, partition or class axis', async () => {
		const base = await partitionFingerprint(iris());
		const changed: PartitionFingerprintInput[] = [
			{ ...iris(), datasetId: 'penguins' },
			{ ...iris(), kind: 'one_shot' },
			{ ...iris(), foldsOrTestRatio: 3 },
			{ ...iris(), randomState: 7 },
			{
				...iris(),
				rows: iris().rows.map(([row, part]) => [row, row === 3 ? 4 : part] as const)
			},
			{ ...iris(), classLabels: ['versicolor', 'setosa', 'virginica'] },
			{ ...iris(), classLabels: [0, 1, 2] },
			{ ...iris(), classLabels: ['0', '1', '2'] }
		];
		const digests = await Promise.all(changed.map(partitionFingerprint));
		for (const digest of digests) {
			expect(digest).toMatch(/^[0-9a-f]{64}$/);
			expect(digest).not.toBe(base);
		}
		expect(new Set(digests).size).toBe(digests.length);
	});

	test('WML-P4-EVAL-3: distinguishes numeric from string labels', async () => {
		const numeric = await partitionFingerprint({ ...iris(), classLabels: [0, 1, 2] });
		const text = await partitionFingerprint({ ...iris(), classLabels: ['0', '1', '2'] });
		expect(numeric).not.toBe(text);
	});
});
