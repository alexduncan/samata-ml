import type { DatasetProvider } from 'web-ml';
import { ClassificationError, type PreparedClassification } from './types';

const LOAD_BATCH_SIZE = 512;

/**
 * Writes one retained-row partition into web-ml's row-major buffers. The same row index
 * supplies the feature slice and label, including when the requested order differs.
 */
export class PartitionDatasetProvider implements DatasetProvider {
	readonly sampleCount: number;
	readonly featureCount: number;
	readonly targetCount = 1;
	private readonly indices: readonly number[];

	constructor(
		private readonly data: PreparedClassification,
		indices: ArrayLike<number>
	) {
		this.featureCount = data.columns.length;
		this.indices = Array.from(indices);
		this.sampleCount = this.indices.length;
		if (
			this.sampleCount === 0 ||
			this.featureCount === 0 ||
			data.features.length !== data.targetCodes.length * this.featureCount ||
			this.indices.some(
				(index) =>
					!Number.isSafeInteger(index) || index < 0 || index >= data.targetCodes.length
			)
		) {
			throw new ClassificationError('invalid-dimensions');
		}
	}

	/** Fills the exact caller-owned buffers and reports progress from zero to one. */
	async load(
		features: Float64Array,
		targets?: Float64Array,
		signal?: AbortSignal,
		onProgress?: (fraction: number) => void
	): Promise<void> {
		signal?.throwIfAborted();
		if (
			features.length !== this.sampleCount * this.featureCount ||
			(targets !== undefined && targets.length !== this.sampleCount)
		) {
			throw new ClassificationError('invalid-dimensions');
		}

		onProgress?.(0);
		for (let offset = 0; offset < this.sampleCount; offset += LOAD_BATCH_SIZE) {
			signal?.throwIfAborted();
			const end = Math.min(offset + LOAD_BATCH_SIZE, this.sampleCount);
			for (let row = offset; row < end; row++) {
				const index = this.indices[row]!;
				const start = index * this.featureCount;
				features.set(
					this.data.features.subarray(start, start + this.featureCount),
					row * this.featureCount
				);
				if (targets !== undefined) targets[row] = this.data.targetCodes[index]!;
			}
			onProgress?.(end / this.sampleCount);
			if (end < this.sampleCount) {
				// Yield so a worker cancellation message can reach the signal during a large copy.
				await new Promise<void>((resolve) => setTimeout(resolve, 0));
			}
		}
		signal?.throwIfAborted();
	}
}
