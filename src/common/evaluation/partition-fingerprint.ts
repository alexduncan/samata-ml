import type { StoredClassLabel } from '../../types/model-evaluation';

/** Inputs that identify the held-out rows, partitions and class axis of an evaluation. */
export interface PartitionFingerprintInput {
	datasetId: string;
	kind: 'one_shot' | 'cross_validation';
	/** Folds for cross-validation, test ratio for One-Shot. */
	foldsOrTestRatio: number;
	randomState: number;
	classLabels: readonly StoredClassLabel[];
	/** `[originalSourceRowIndex, partitionIndex]` pairs in any order. */
	rows: readonly (readonly [number, number])[];
}

/**
 * Lowercase SHA-256 over `["samata-eval-v1", datasetId, kind, foldsOrTestRatio, randomState,
 * classLabels, rows]` with rows sorted numerically by original source row. Equal digests mean
 * models were scored on the same rows, partitions and class axis.
 */
export async function partitionFingerprint(input: PartitionFingerprintInput): Promise<string> {
	const rows = input.rows
		.map(([row, partition]) => [row, partition])
		.sort((a, b) => a[0]! - b[0]!);
	const payload = JSON.stringify([
		'samata-eval-v1',
		input.datasetId,
		input.kind,
		input.foldsOrTestRatio,
		input.randomState,
		input.classLabels,
		rows
	]);
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join(
		''
	);
}
