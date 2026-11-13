import { FINE_BINS, HISTOGRAM_MAX_BINS, MEDIAN_COLLECT_LIMIT } from './limits';

/** Count and exact range for one fine-histogram bucket. */
export interface FineBucket {
	count: number;
	min: number | null;
	max: number | null;
}

/** Rank location within a fine-histogram bucket. */
export interface LocatedRank {
	bin: number;
	rankInBin: number;
}

/** A bounded histogram that locates ranks without retaining individual values. */
export class FineHistogram {
	/** Counts and exact range for each bucket. */
	readonly buckets: FineBucket[];
	/** Number of values added to the histogram. */
	count = 0;
	private readonly min: number;
	private readonly max: number;

	/** Creates a fine histogram over a known value range. */
	constructor(min: number, max: number, bins = FINE_BINS) {
		if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) {
			throw new RangeError('Histogram bounds must be finite and ordered.');
		}
		if (!Number.isInteger(bins) || bins < 1)
			throw new RangeError('Histogram bins must be a positive integer.');
		this.min = min;
		this.max = max;
		this.buckets = Array.from({ length: bins }, () => ({ count: 0, min: null, max: null }));
	}

	/** Adds one finite value and updates its bucket's exact range. */
	add(value: number): void {
		if (!Number.isFinite(value)) throw new RangeError('Histogram values must be finite.');
		const bucket = this.buckets[this.binIndex(value)]!;
		bucket.count++;
		bucket.min = bucket.min === null ? value : Math.min(bucket.min, value);
		bucket.max = bucket.max === null ? value : Math.max(bucket.max, value);
		this.count++;
	}

	/** Gets the bucket index for a value, clamped to the histogram range. */
	binIndex(value: number): number {
		if (this.max === this.min) return 0;
		return Math.max(
			0,
			Math.min(
				this.buckets.length - 1,
				Math.floor(((value - this.min) / (this.max - this.min)) * this.buckets.length)
			)
		);
	}

	/** Locates a zero-based rank and its offset within the selected bucket. */
	locate(rank: number): LocatedRank {
		if (!Number.isInteger(rank) || rank < 0 || rank >= this.count) {
			throw new RangeError('Rank is outside the values added to the histogram.');
		}
		let before = 0;
		for (let bin = 0; bin < this.buckets.length; bin++) {
			const count = this.buckets[bin]!.count;
			if (rank < before + count) return { bin, rankInBin: rank - before };
			before += count;
		}
		throw new RangeError('Rank could not be located.');
	}
}

/** Display histogram shape and counts for a numeric column. */
export interface DisplayHistogram {
	start: number;
	width: number;
	counts: number[];
}

function niceCeil(value: number, integer: boolean): number {
	const choices = integer ? [1, 2, 5] : [1, 2, 2.5, 5];
	const magnitude = 10 ** Math.floor(Math.log10(value));
	for (const choice of choices) {
		const width = choice * magnitude;
		if (width >= value) return integer ? Math.max(1, width) : width;
	}
	return (integer ? 10 : 10) * magnitude;
}

/** Chooses the approved readable display-histogram bins for a numeric column. */
export function createDisplayHistogram(
	count: number,
	min: number,
	max: number,
	integer: boolean
): DisplayHistogram {
	if (count < 1 || !Number.isFinite(min) || !Number.isFinite(max) || max < min) {
		throw new RangeError('A display histogram needs values with finite ordered bounds.');
	}
	if (min === max) return { start: min - 0.5, width: 1, counts: [0] };
	if (integer && max - min + 1 <= HISTOGRAM_MAX_BINS) {
		const bins = Math.floor(max - min + 1);
		return { start: min - 0.5, width: 1, counts: Array.from({ length: bins }, () => 0) };
	}

	const target = Math.min(HISTOGRAM_MAX_BINS, Math.max(1, Math.ceil(Math.sqrt(count))));
	let width = niceCeil((max - min) / target, integer);
	let start = Math.floor(min / width) * width;
	let bins = Math.max(1, Math.ceil((max - start) / width));
	while (bins > HISTOGRAM_MAX_BINS) {
		width = niceCeil(width * 1.01, integer);
		start = Math.floor(min / width) * width;
		bins = Math.max(1, Math.ceil((max - start) / width));
	}
	return { start, width, counts: Array.from({ length: bins }, () => 0) };
}

/** Adds a value to a display histogram using the approved clamped bin formula. */
export function addToDisplayHistogram(histogram: DisplayHistogram, value: number): void {
	const index = Math.max(
		0,
		Math.min(
			histogram.counts.length - 1,
			Math.floor((value - histogram.start) / histogram.width)
		)
	);
	histogram.counts[index] = histogram.counts[index]! + 1;
}

/** Supplies accepted values to an order-statistics pass without requiring an array. */
export type ScanNumericValues = (visit: (value: number) => void) => Promise<void>;

/** Options for exact, bounded-memory median selection. */
export interface ExactMedianOptions {
	/** Maximum values held while sorting one target bucket. */
	collectLimit?: number;
	/** Maximum number of sub-bucket rounds after the first histogram. */
	maxRounds?: number;
	/** Fine histogram resolution. */
	bins?: number;
	/** Optional observer used by tests to verify collection stays bounded. */
	onCollect?: (values: number) => void;
}

async function resolveRank(
	initial: FineHistogram,
	rank: number,
	scanValues: ScanNumericValues,
	options: Required<Pick<ExactMedianOptions, 'collectLimit' | 'maxRounds' | 'bins'>> &
		Pick<ExactMedianOptions, 'onCollect'>
): Promise<number> {
	let histogram = initial;
	let localRank = rank;
	const ancestorBuckets: { histogram: FineHistogram; index: number }[] = [];
	for (let round = 0; ; round++) {
		const located = histogram.locate(localRank);
		const bucket = histogram.buckets[located.bin]!;
		if (bucket.min === bucket.max) return bucket.min!;
		if (bucket.count <= options.collectLimit) {
			const values: number[] = [];
			await scanValues((value) => {
				if (
					ancestorBuckets.every(
						({ histogram: parent, index }) => parent.binIndex(value) === index
					) &&
					histogram.binIndex(value) === located.bin
				) {
					values.push(value);
				}
			});
			options.onCollect?.(values.length);
			values.sort((left, right) => left - right);
			if (values.length !== bucket.count || values[located.rankInBin] === undefined) {
				throw new Error('The value scan did not match the selected median bucket.');
			}
			return values[located.rankInBin]!;
		}
		if (round >= options.maxRounds)
			throw new Error('Exact median selection exceeded its round limit.');
		const next = new FineHistogram(bucket.min!, bucket.max!, options.bins);
		await scanValues((value) => {
			if (
				ancestorBuckets.every(
					({ histogram: parent, index }) => parent.binIndex(value) === index
				) &&
				histogram.binIndex(value) === located.bin
			) {
				next.add(value);
			}
		});
		ancestorBuckets.push({ histogram, index: located.bin });
		histogram = next;
		localRank = located.rankInBin;
	}
}

/**
 * Resolves the exact median by refining only the buckets containing the middle ranks.
 *
 * @param histogram - Fine histogram already filled during the statistics pass.
 * @param scanValues - Reusable bounded-memory scan over the typed numeric values.
 * @param options - Collection cap and testable histogram limits.
 * @returns Exact median value.
 */
export async function exactMedian(
	histogram: FineHistogram,
	scanValues: ScanNumericValues,
	options: ExactMedianOptions = {}
): Promise<number> {
	if (histogram.count === 0) throw new RangeError('A median needs at least one value.');
	const resolved = {
		collectLimit: options.collectLimit ?? MEDIAN_COLLECT_LIMIT,
		maxRounds: options.maxRounds ?? 8,
		bins: options.bins ?? FINE_BINS,
		onCollect: options.onCollect
	};
	if (resolved.collectLimit < 1 || resolved.maxRounds < 0 || resolved.bins < 2) {
		throw new RangeError('Median selection limits are invalid.');
	}
	const lo = Math.floor((histogram.count - 1) / 2);
	const hi = Math.floor(histogram.count / 2);
	const lower = await resolveRank(histogram, lo, scanValues, resolved);
	if (hi === lo) return lower;
	const upper = await resolveRank(histogram, hi, scanValues, resolved);
	return (lower + upper) / 2;
}
