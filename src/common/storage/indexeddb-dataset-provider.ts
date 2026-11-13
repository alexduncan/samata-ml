import type { DatasetProvider } from 'web-ml';
import type { IDBPDatabase } from 'idb';
import { getMetadata, getRows, type SamataDBSchema } from './db';
import type {
	ColumnStats,
	DatasetMetadata,
	NumericColumnStats,
	RawRecord
} from '../../types/dataset';

/** A preprocessing operation applied while values are written into caller-owned views. */
export type PreprocessingStep =
	| {
			column: string;
			method: 'impute';
			strategy: 'mean' | 'median' | 'mode' | 'constant';
			value?: number | string | boolean;
	  }
	| { column: string; method: 'one-hot'; categories?: string[] };

/** Options used to create an IndexedDB-backed provider. */
export interface IndexedDBDatasetProviderOptions {
	/** Open v2 samata database. The caller owns and closes this connection. */
	db: IDBPDatabase<SamataDBSchema>;
	/** Completed dataset to read. */
	datasetId: string;
	/** Feature column names, in the desired input order. */
	featureColumns: string[];
	/** Optional target column names. */
	targetColumns?: string[];
	/** Required preprocessing for categorical features and missing cells. */
	preprocessing?: PreprocessingStep[];
	/** Number of rows to fetch per IndexedDB page. Defaults to 500. */
	batchSize?: number;
}

/** Error raised when the requested dataset cannot be converted to model buffers. */
export class DatasetProviderError extends Error {
	/** Stable provider error code for callers. */
	readonly code:
		| 'DATASET_NOT_FOUND'
		| 'UNKNOWN_COLUMN'
		| 'UNSUPPORTED_COLUMN'
		| 'MISSING_PREPROCESSING'
		| 'MISSING_VALUE'
		| 'BUFFER_TOO_SMALL'
		| 'ABORTED';

	/** Creates an error with a stable code and readable context. */
	constructor(code: DatasetProviderError['code'], message: string) {
		super(message);
		this.name = 'DatasetProviderError';
		this.code = code;
	}
}

type FeaturePlan = {
	column: ColumnStats;
	metadataIndex: number;
	width: number;
	oneHot: boolean;
	categories: string[];
	imputeValue?: number | boolean | string;
};

type TargetPlan = {
	column: ColumnStats;
	metadataIndex: number;
	categories: string[];
	imputeValue?: number | boolean | string;
};

function sortedCategories(column: ColumnStats): string[] {
	if (column.type === 'categorical')
		return Object.keys(column.categoryCounts).sort((a, b) => a.localeCompare(b));
	if (column.type === 'boolean') return ['false', 'true'];
	return [];
}

function numericImpute(column: NumericColumnStats, strategy: 'mean' | 'median'): number {
	return strategy === 'mean' ? column.mean : column.median;
}

function modeFromStats(column: ColumnStats): string | boolean | number | undefined {
	if (column.type === 'categorical') {
		return Object.entries(column.categoryCounts).sort(
			([a, countA], [b, countB]) => countB - countA || a.localeCompare(b)
		)[0]?.[0];
	}
	if (column.type === 'boolean') {
		return column.trueCount > column.falseCount ? true : false;
	}
	return undefined;
}

async function resolveImpute(
	column: ColumnStats,
	step: Extract<PreprocessingStep, { method: 'impute' }>,
	db: IDBPDatabase<SamataDBSchema>,
	datasetId: string,
	metadataIndex: number,
	rowCount: number
): Promise<number | string | boolean | undefined> {
	if (step.strategy === 'constant') {
		if (
			column.type === 'numeric' &&
			typeof step.value === 'number' &&
			Number.isFinite(step.value)
		) {
			return step.value;
		}
		if (column.type === 'boolean' && typeof step.value === 'boolean') return step.value;
		if (column.type === 'categorical' && typeof step.value === 'string') return step.value;
		return undefined;
	}
	if (step.strategy === 'mean' || step.strategy === 'median') {
		if (column.type !== 'numeric') return undefined;
		return numericImpute(column, step.strategy);
	}
	if (column.type === 'numeric') {
		const counts = new Map<number, number>();
		for (let offset = 0; offset < rowCount; offset += 500) {
			const rows = await getRows(db, datasetId, offset, 500);
			for (const row of rows) {
				const value = row.values[metadataIndex];
				if (typeof value === 'number') counts.set(value, (counts.get(value) ?? 0) + 1);
			}
		}
		return [...counts.entries()].sort(
			([a, countA], [b, countB]) => countB - countA || a - b
		)[0]?.[0];
	}
	return modeFromStats(column);
}

function findStep(
	steps: PreprocessingStep[],
	column: string,
	method: 'impute'
): Extract<PreprocessingStep, { method: 'impute' }> | undefined;
function findStep(
	steps: PreprocessingStep[],
	column: string,
	method: 'one-hot'
): Extract<PreprocessingStep, { method: 'one-hot' }> | undefined;
function findStep(
	steps: PreprocessingStep[],
	column: string,
	method: PreprocessingStep['method']
): PreprocessingStep | undefined {
	return steps.find((step) => step.column === column && step.method === method);
}

function checkAbort(signal?: AbortSignal): void {
	if (signal?.aborted) throw new DatasetProviderError('ABORTED', 'Dataset loading was aborted');
}

function getValue(row: RawRecord, metadataIndex: number): number | boolean | string | null {
	return row.values[metadataIndex] ?? null;
}

/**
 * Provides completed IndexedDB datasets directly into the arrays allocated by web-ml.
 */
export class IndexedDBDatasetProvider implements DatasetProvider {
	readonly sampleCount: number;
	readonly featureCount: number;
	readonly targetCount: number;
	/** Expanded feature names, including generated one-hot names. */
	readonly featureNames: string[];
	/** Sorted string labels used for categorical or boolean targets. */
	readonly targetCategories: string[];
	private readonly batchSize: number;
	private readonly options: IndexedDBDatasetProviderOptions;
	private readonly featurePlans: FeaturePlan[];
	private readonly targetPlans: TargetPlan[];

	private constructor(
		options: IndexedDBDatasetProviderOptions,
		metadata: DatasetMetadata,
		featurePlans: FeaturePlan[],
		targetPlans: TargetPlan[],
		featureNames: string[]
	) {
		this.options = options;
		this.sampleCount = metadata.rowCount;
		this.featurePlans = featurePlans;
		this.targetPlans = targetPlans;
		this.featureNames = featureNames;
		this.featureCount = featureNames.length;
		this.targetCount = targetPlans.length;
		this.targetCategories = targetPlans.flatMap((plan) => plan.categories);
		this.batchSize = options.batchSize ?? 500;
	}

	/**
	 * Validates the selected columns and precomputes row-major write plans.
	 *
	 * @param options - Dataset, open database, columns and preprocessing rules.
	 * @returns A provider ready to fill buffers allocated by web-ml.
	 */
	static async create(
		options: IndexedDBDatasetProviderOptions
	): Promise<IndexedDBDatasetProvider> {
		const metadata = await getMetadata(options.db, options.datasetId);
		if (!metadata) {
			throw new DatasetProviderError(
				'DATASET_NOT_FOUND',
				`Dataset ${options.datasetId} was not found`
			);
		}
		const steps = options.preprocessing ?? [];
		const columnsByName = new Map(
			metadata.columns.map((column, index) => [column.name, { column, index }])
		);
		const featurePlans: FeaturePlan[] = [];
		const featureNames: string[] = [];
		for (const name of options.featureColumns) {
			const entry = columnsByName.get(name);
			if (!entry)
				throw new DatasetProviderError('UNKNOWN_COLUMN', `Unknown feature column: ${name}`);
			const { column, index: metadataIndex } = entry;
			if (column.type === 'text' || column.type === 'datetime') {
				throw new DatasetProviderError(
					'UNSUPPORTED_COLUMN',
					`Unsupported feature column ${name}: ${column.type}`
				);
			}
			const oneHot = findStep(steps, name, 'one-hot');
			const imputeStep = findStep(steps, name, 'impute');
			if (column.type === 'categorical' && !oneHot) {
				throw new DatasetProviderError(
					'MISSING_PREPROCESSING',
					`Categorical feature ${name} requires one-hot preprocessing`
				);
			}
			const categories = oneHot ? (oneHot.categories ?? sortedCategories(column)) : [];
			if (oneHot && column.type !== 'categorical') {
				throw new DatasetProviderError(
					'MISSING_PREPROCESSING',
					`One-hot preprocessing requires categorical column ${name}`
				);
			}
			if (
				oneHot &&
				(categories.length === 0 || new Set(categories).size !== categories.length)
			) {
				throw new DatasetProviderError(
					'MISSING_PREPROCESSING',
					`One-hot categories for ${name} must be non-empty and unique`
				);
			}
			const imputeValue = imputeStep
				? await resolveImpute(
						column,
						imputeStep,
						options.db,
						options.datasetId,
						metadataIndex,
						metadata.rowCount
					)
				: undefined;
			if (imputeStep && imputeValue === undefined) {
				throw new DatasetProviderError(
					'MISSING_PREPROCESSING',
					`Cannot resolve ${imputeStep.strategy} imputation for ${name}`
				);
			}
			const width = oneHot ? categories.length : 1;
			featurePlans.push({
				column,
				metadataIndex,
				width,
				oneHot: Boolean(oneHot),
				categories,
				...(imputeValue !== undefined ? { imputeValue } : {})
			});
			featureNames.push(
				...(oneHot ? categories.map((category) => `${name}=${category}`) : [name])
			);
		}
		const targetPlans: TargetPlan[] = [];
		for (const name of options.targetColumns ?? []) {
			const entry = columnsByName.get(name);
			if (!entry)
				throw new DatasetProviderError('UNKNOWN_COLUMN', `Unknown target column: ${name}`);
			const { column, index: metadataIndex } = entry;
			if (column.type === 'text' || column.type === 'datetime') {
				throw new DatasetProviderError(
					'UNSUPPORTED_COLUMN',
					`Unsupported target column ${name}: ${column.type}`
				);
			}
			const imputeStep = findStep(steps, name, 'impute');
			const imputeValue = imputeStep
				? await resolveImpute(
						column,
						imputeStep,
						options.db,
						options.datasetId,
						metadataIndex,
						metadata.rowCount
					)
				: undefined;
			if (imputeStep && imputeValue === undefined) {
				throw new DatasetProviderError(
					'MISSING_PREPROCESSING',
					`Cannot resolve ${imputeStep.strategy} imputation for ${name}`
				);
			}
			targetPlans.push({
				column,
				metadataIndex,
				categories: sortedCategories(column),
				...(imputeValue !== undefined ? { imputeValue } : {})
			});
		}
		const batchSize = options.batchSize ?? 500;
		if (!Number.isInteger(batchSize) || batchSize < 1) {
			throw new DatasetProviderError(
				'MISSING_PREPROCESSING',
				'batchSize must be a positive integer'
			);
		}
		return new IndexedDBDatasetProvider(
			options,
			metadata,
			featurePlans,
			targetPlans,
			featureNames
		);
	}

	/** Fills pre-allocated row-major feature and target views from the stored dataset. */
	async load(
		features: Float64Array,
		targets?: Float64Array,
		signal?: AbortSignal,
		onProgress?: (fraction: number) => void
	): Promise<void> {
		const requiredFeatures = this.sampleCount * this.featureCount;
		const requiredTargets = this.sampleCount * this.targetCount;
		if (
			features.length < requiredFeatures ||
			(requiredTargets > 0 && (!targets || targets.length < requiredTargets))
		) {
			throw new DatasetProviderError(
				'BUFFER_TOO_SMALL',
				'Feature or target buffer is too small'
			);
		}
		checkAbort(signal);
		let offset = 0;
		while (offset < this.sampleCount) {
			checkAbort(signal);
			const rows = await getRows(
				this.options.db,
				this.options.datasetId,
				offset,
				this.batchSize
			);
			checkAbort(signal);
			if (rows.length === 0) {
				throw new DatasetProviderError(
					'DATASET_NOT_FOUND',
					`Rows for dataset ${this.options.datasetId} are unavailable`
				);
			}
			for (const row of rows) this.writeRow(row, features, targets);
			offset += rows.length;
			onProgress?.(Math.min(offset / this.sampleCount, 1));
		}
		checkAbort(signal);
	}

	private writeRow(row: RawRecord, features: Float64Array, targets?: Float64Array): void {
		const steps = this.options.preprocessing ?? [];
		const featureOffset = row.rowIndex * this.featureCount;
		let featureIndex = 0;
		for (const plan of this.featurePlans) {
			let value = getValue(row, plan.metadataIndex);
			const impute = findStep(steps, plan.column.name, 'impute');
			if (value === null) {
				if (!impute || plan.imputeValue === undefined) {
					throw new DatasetProviderError(
						'MISSING_VALUE',
						`Missing value in column ${plan.column.name}, row ${row.rowIndex + 1}`
					);
				}
				value = plan.imputeValue;
			}
			if (plan.oneHot) {
				const selected = plan.categories.indexOf(String(value));
				if (selected < 0)
					throw new DatasetProviderError(
						'UNSUPPORTED_COLUMN',
						`Unknown category ${String(value)} in ${plan.column.name}`
					);
				for (let categoryIndex = 0; categoryIndex < plan.width; categoryIndex++) {
					features[featureOffset + featureIndex + categoryIndex] =
						categoryIndex === selected ? 1 : 0;
				}
				featureIndex += plan.width;
			} else {
				features[featureOffset + featureIndex] = Number(value);
				featureIndex++;
			}
		}
		if (targets && this.targetPlans.length) {
			const targetOffset = row.rowIndex * this.targetCount;
			for (let index = 0; index < this.targetPlans.length; index++) {
				const plan = this.targetPlans[index]!;
				let value = getValue(row, plan.metadataIndex);
				const impute = findStep(steps, plan.column.name, 'impute');
				if (value === null) {
					if (!impute || plan.imputeValue === undefined) {
						throw new DatasetProviderError(
							'MISSING_VALUE',
							`Missing value in column ${plan.column.name}, row ${row.rowIndex + 1}`
						);
					}
					value = plan.imputeValue;
				}
				if (plan.categories.length) {
					const category = String(value);
					const categoryIndex = plan.categories.indexOf(category);
					if (categoryIndex < 0)
						throw new DatasetProviderError(
							'UNSUPPORTED_COLUMN',
							`Unknown target category ${category} in ${plan.column.name}`
						);
					targets[targetOffset + index] = categoryIndex;
				} else {
					targets[targetOffset + index] = Number(value);
				}
			}
		}
	}
}
