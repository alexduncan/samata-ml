import { atom } from 'nanostores';
import type { TrainingRunIdentity } from '../types/model-result';
import {
	provisionalModelIn,
	DEFAULT_MODEL_RESULTS_UI,
	INITIAL_APP_STATE,
	isModelEligibleColumnType,
	MODEL_COLORS,
	sanitiseModelResultsUi,
	type DatasetSummary,
	type HyperparameterConfig,
	type HyperparameterValue,
	type ModelColor,
	type ModelRecord,
	type ModelResultsUi,
	type ModelSectionId,
	type MulticlassStrategy,
	type PersistedAppState,
	type ProvisionalModelIdentity,
	type TrainingProgress,
	type TrainingError,
	type ValidationMethodology,
	type WorkflowPath
} from '../types/state';
import { $scrollState, clearScroll } from './scroll.store';
import {
	comparisonOwner,
	emptyComparisonResults,
	ownedComparisonResults,
	sameComparisonOwner,
	sanitiseComparisonUi
} from './comparison-preferences';
import type { ComparisonOwner, ComparisonUi } from '../types/state';

/**
 * Nanostore holding persisted domain application state.
 * Follows specification/state-and-storage.md §3 and specification/COMPONENTS.md §5.
 */
export const $appState = atom<PersistedAppState>(INITIAL_APP_STATE);

/** Model builder sections in workflow order; a section is downstream of every section before it. */
export const SECTION_ORDER: readonly ModelSectionId[] = [
	'choose-model',
	'select-features',
	'configure-model',
	'configure-training',
	'training',
	'results'
];

/**
 * Deep structural equality check for JSON-compatible values.
 */
function jsonEqual(a: unknown, b: unknown): boolean {
	if (a === b) return true;
	if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
		return false;
	}
	if (Array.isArray(a) !== Array.isArray(b)) {
		return false;
	}
	if (Array.isArray(a) && Array.isArray(b)) {
		if (a.length !== b.length) return false;
		for (let i = 0; i < a.length; i++) {
			if (!jsonEqual(a[i], b[i])) return false;
		}
		return true;
	}
	const keysA = Object.keys(a as Record<string, unknown>);
	const keysB = Object.keys(b as Record<string, unknown>);
	if (keysA.length !== keysB.length) return false;
	for (const key of keysA) {
		if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
		if (!jsonEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) {
			return false;
		}
	}
	return true;
}

/**
 * Invalidates every section in SECTION_ORDER strictly after the owner section per D7.
 */
function invalidateLaterSections(
	completedSteps: ModelSectionId[],
	owner: ModelSectionId
): ModelSectionId[] {
	const ownerIndex = SECTION_ORDER.indexOf(owner);
	if (ownerIndex === -1) return completedSteps;
	const later = new Set(SECTION_ORDER.slice(ownerIndex + 1));
	return completedSteps.filter((s) => !later.has(s));
}

/**
 * Clears all scroll snapshots other than keys starting with 'data:'.
 */
function clearNonDataScroll(): void {
	const currentKeys = Object.keys($scrollState.get().snapshots);
	const keysToClear = currentKeys.filter((k) => !k.startsWith('data:'));
	if (keysToClear.length > 0) {
		clearScroll(keysToClear);
	}
}

/**
 * Clears scroll snapshots for models, models/*, and results.
 */
function clearModelAndResultScroll(): void {
	const currentKeys = Object.keys($scrollState.get().snapshots);
	const keysToClear = currentKeys.filter(
		(k) => k === 'models' || k.startsWith('models/') || k === 'results'
	);
	if (keysToClear.length > 0) {
		clearScroll(keysToClear);
	}
}

/**
 * Helper to update state with an updated timestamp while preserving immutability.
 * Skips setting the store when the transform returns the same reference per D7.
 */
function updateState(transform: (state: PersistedAppState) => PersistedAppState | false): boolean {
	const current = $appState.get();
	const next = transform(current);
	if (next === false) {
		return false;
	}
	if (next === current) {
		return true;
	}
	$appState.set({
		...next,
		updatedAt: Date.now()
	});
	return true;
}

/**
 * Dismisses the welcome onboarding modal.
 */
export function dismissWelcome(): boolean {
	return updateState((state) => ({
		...state,
		onboarding: { ...state.onboarding, welcomeDismissed: true }
	}));
}

/**
 * Records acceptance of beta cookieless analytics and dismisses the welcome onboarding modal.
 */
export function acceptBetaTelemetry(): void {
	updateState((state) => ({
		...state,
		onboarding: {
			...state.onboarding,
			welcomeDismissed: true,
			betaTelemetryAccepted: true
		}
	}));
}

/** Updates comparison choices only for the context captured by the caller. */
export function setComparisonUi(
	expectedOwner: ComparisonOwner,
	patch: Partial<ComparisonUi>
): void {
	updateState((state) => {
		const owner = comparisonOwner(state);
		if (!sameComparisonOwner(expectedOwner, owner)) return state;
		const previous = ownedComparisonResults(state, state);
		return {
			...state,
			results: {
				owner,
				ui: sanitiseComparisonUi(
					{ ...previous.ui, ...patch },
					state.models.map((model) => model.num)
				)
			}
		};
	});
}

/**
 * Updates the active workflow resume path.
 */
export function setResumePath(resumePath: WorkflowPath): boolean {
	return updateState((state) => ({
		...state,
		resumePath
	}));
}

/** Produces the loaded-dataset domain without moving scroll or publishing memory. */
export function reduceDatasetReplacement(
	state: PersistedAppState,
	dataset: DatasetSummary | null
): PersistedAppState {
	const current = state.dataset;
	const same = Boolean(
		dataset &&
		current &&
		current.id === dataset.id &&
		current.columns.length === dataset.columns.length &&
		current.columns.every(
			(column, index) =>
				column.name === dataset.columns[index]?.name &&
				column.type === dataset.columns[index]?.type
		)
	);
	return {
		...state,
		dataset,
		data: { mode: dataset ? 'preview' : 'select', selectedColumn: null },
		...(same
			? {}
			: {
					target: null,
					models: [],
					nextModelNum: 1,
					newModelNum: null,
					nextModelColorIndex: 0,
					comparisonContextEpoch: state.comparisonContextEpoch + 1,
					results: emptyComparisonResults()
				})
	};
}

/** Called by fixture and store consumers after a successful dataset load. */
export function loadDatasetSucceeded(dataset: DatasetSummary): boolean {
	const previous = $appState.get();
	const next = reduceDatasetReplacement(previous, dataset);
	const success = updateState(() => next);
	if (success && next.models !== previous.models) clearNonDataScroll();
	return success;
}

/** Clears the current dataset and downstream choices. */
export function clearDataset(): boolean {
	const success = updateState((state) => reduceDatasetReplacement(state, null));
	if (success) clearNonDataScroll();
	return success;
}

/**
 * Toggles data view mode ('select' or 'preview').
 */
export function setDataMode(mode: 'select' | 'preview'): boolean {
	return updateState((state) => ({
		...state,
		data: { ...state.data, mode }
	}));
}

/**
 * Sets the selected column in the data inspection panel.
 * Non-null name must belong to current dataset columns.
 */
export function setSelectedColumn(selectedColumn: string | null): boolean {
	return updateState((state) => {
		if (selectedColumn !== null) {
			if (!state.dataset || !state.dataset.columns.some((c) => c.name === selectedColumn)) {
				return false;
			}
		}
		if (state.data.selectedColumn === selectedColumn) {
			return state;
		}
		return {
			...state,
			data: { ...state.data, selectedColumn }
		};
	});
}

/** Produces a target change and any explicitly confirmed model discard. */
export function reduceTargetChange(
	state: PersistedAppState,
	column: string,
	confirmed: boolean
): PersistedAppState | false {
	const selected = state.dataset?.columns.find((entry) => entry.name === column);
	if (!selected || !isModelEligibleColumnType(selected.type)) return false;
	if (state.target === column) return state;
	if (state.models.length > 0 && !confirmed) return false;
	return {
		...state,
		target: column,
		models: [],
		newModelNum: null,
		nextModelColorIndex: 0,
		comparisonContextEpoch: state.comparisonContextEpoch + 1,
		results: emptyComparisonResults(),
		...(confirmed && { nextModelNum: 1 })
	};
}

/** Sets a target without discarding existing models. */
export function setTarget(column: string): boolean {
	return updateState((state) => reduceTargetChange(state, column, false));
}

/** Confirms discarding all models and associated scroll states. */
export function confirmDiscardModels(): boolean {
	const success = updateState((state) => ({
		...state,
		models: [],
		nextModelNum: 1,
		newModelNum: null,
		nextModelColorIndex: 0,
		comparisonContextEpoch: state.comparisonContextEpoch + 1,
		results: emptyComparisonResults()
	}));
	if (success) clearModelAndResultScroll();
	return success;
}

/** Allocates a draft model against the latest protected counter. */
export function reduceCreateModel(
	state: PersistedAppState,
	createdAt: number
): PersistedAppState | false {
	if (!state.dataset || !state.target) return false;
	const newModel: ModelRecord = {
		num: state.nextModelNum,
		createdAt,
		status: 'draft',
		completedSteps: [],
		modelId: null,
		features: [],
		modelOptions: {},
		hyperparameters: { mode: 'manual', values: {} },
		multiclass: null,
		trainingSetup: null,
		progress: null,
		resultRevision: null,
		provisionalCompletedRunId: null,
		modelLabel: null,
		error: null,
		timings: null,
		durationMs: null,
		metrics: null,
		ui: { trainingLogOpen: false }
	};
	return { ...state, nextModelNum: state.nextModelNum + 1, models: [...state.models, newModel] };
}

/** Removes only the current unfinished provisional record, preserving its allocated number. */
export function reduceAbandonProvisional(
	state: PersistedAppState,
	binding: ProvisionalModelIdentity
): PersistedAppState | false {
	const model = provisionalModelIn(state.models, state.newModelNum);
	if (
		state.dataset?.id !== binding.datasetId ||
		state.target !== binding.target ||
		state.comparisonContextEpoch !== binding.comparisonContextEpoch ||
		model?.num !== binding.modelNum ||
		model.createdAt !== binding.modelCreatedAt ||
		model.status !== 'draft'
	)
		return false;
	return { ...state, newModelNum: null, models: state.models.filter((entry) => entry !== model) };
}

/** Creates a draft in memory for reducer consumers. */
export function createModel(): number | false {
	const modelNum = $appState.get().nextModelNum;
	return updateState((state) => reduceCreateModel(state, Date.now())) ? modelNum : false;
}

type ModelDefaults = {
	modelOptions?: Record<string, HyperparameterValue>;
	hyperparameters?: HyperparameterConfig;
	multiclass?: MulticlassStrategy | null;
};

function reduceChooseModel(
	state: PersistedAppState,
	num: number,
	modelId: string,
	defaults?: ModelDefaults
): PersistedAppState | false {
	const model = state.models.find((m) => m.num === num);
	if (!model || model.status !== 'draft') return false;

	if (model.modelId === modelId) {
		return state;
	}

	const updatedModels = state.models.map((m) => {
		if (m.num !== num) return m;

		return {
			...m,
			modelId,
			modelOptions: defaults?.modelOptions ?? {},
			hyperparameters: defaults?.hyperparameters ?? { mode: 'manual', values: {} },
			multiclass: defaults?.multiclass ?? null,
			completedSteps: m.completedSteps.filter(
				(s) =>
					s !== 'select-features' &&
					s !== 'configure-model' &&
					s !== 'configure-training' &&
					s !== 'training' &&
					s !== 'results'
			)
		};
	});

	return { ...state, models: updatedModels };
}

/** Selects the web-ml model architecture for Section 1. */
export function chooseModel(num: number, modelId: string, defaults?: ModelDefaults): boolean {
	return updateState((state) => reduceChooseModel(state, num, modelId, defaults));
}

/**
 * Sets features list for Section 2.
 * Rejects unknown, non-model-eligible (including text/datetime), target, or duplicated columns.
 * Order-insensitive equality is a no-op returning true; changes invalidate downstream sections per D7.
 */
export function setFeatures(num: number, names: string[]): boolean {
	return updateState((state) => {
		const model = state.models.find((m) => m.num === num);
		if (!model || model.status !== 'draft') return false;
		if (!state.dataset) return false;

		const nameSet = new Set(names);
		if (nameSet.size !== names.length) return false;

		for (const name of names) {
			const col = state.dataset.columns.find((c) => c.name === name);
			if (!col) return false;
			if (!isModelEligibleColumnType(col.type)) return false;
			if (state.target !== null && name === state.target) return false;
		}

		const currentFeaturesSet = new Set(model.features);
		const isSameSet =
			currentFeaturesSet.size === nameSet.size &&
			names.every((n) => currentFeaturesSet.has(n));

		if (isSameSet) {
			return state;
		}

		const updatedModels = state.models.map((m) => {
			if (m.num !== num) return m;
			return {
				...m,
				features: names,
				completedSteps: invalidateLaterSections(m.completedSteps, 'select-features')
			};
		});

		return { ...state, models: updatedModels };
	});
}

/**
 * Initialises feature selection once for Section 2.
 * Validates current dataset/target, draft status and names using the same eligibility guards as setFeatures.
 * If model.ui.featureSelectionInitialised === true, returns true without mutating.
 * Otherwise sets features and ui.featureSelectionInitialised = true atomically,
 * preserving other UI keys and applying normal downstream invalidation.
 */
export function initialiseFeatureSelection(num: number, names: string[]): boolean {
	return updateState((state) => reduceInitialiseFeatureSelection(state, num, names));
}

function reduceInitialiseFeatureSelection(
	state: PersistedAppState,
	num: number,
	names: string[]
): PersistedAppState | false {
	const model = state.models.find((m) => m.num === num);
	if (!model || model.status !== 'draft') return false;
	if (!state.dataset) return false;

	const nameSet = new Set(names);
	if (nameSet.size !== names.length) return false;

	for (const name of names) {
		const col = state.dataset.columns.find((c) => c.name === name);
		if (!col) return false;
		if (!isModelEligibleColumnType(col.type)) return false;
		if (state.target !== null && name === state.target) return false;
	}

	if (model.ui.featureSelectionInitialised === true) {
		return state;
	}

	const updatedModels = state.models.map((m) => {
		if (m.num !== num) return m;
		return {
			...m,
			features: names,
			ui: {
				...m.ui,
				featureSelectionInitialised: true
			},
			completedSteps: invalidateLaterSections(m.completedSteps, 'select-features')
		};
	});

	return { ...state, models: updatedModels };
}

/**
 * Toggles a single feature selection.
 */
export function toggleFeature(num: number, name: string): boolean {
	const current = $appState.get();
	const model = current.models.find((m) => m.num === num);
	if (!model || model.status !== 'draft') return false;
	if (current.target === name) return false;

	const nextFeatures = model.features.includes(name)
		? model.features.filter((f) => f !== name)
		: [...model.features, name];

	return setFeatures(num, nextFeatures);
}

/**
 * Sets Section 2 model-specific options.
 * Equality is a no-op returning true; changes invalidate downstream sections per D7.
 */
export function setModelOptions(
	num: number,
	options: Record<string, HyperparameterValue>
): boolean {
	return updateState((state) => {
		const model = state.models.find((m) => m.num === num);
		if (!model || model.status !== 'draft') return false;

		if (jsonEqual(model.modelOptions, options)) {
			return state;
		}

		const updatedModels = state.models.map((m) => {
			if (m.num !== num) return m;
			return {
				...m,
				modelOptions: options,
				completedSteps: invalidateLaterSections(m.completedSteps, 'configure-model')
			};
		});
		return { ...state, models: updatedModels };
	});
}

/**
 * Sets Section 3 hyperparameters.
 * Equality is a no-op returning true; changes invalidate downstream sections per D7.
 */
export function setHyperparameters(num: number, config: HyperparameterConfig): boolean {
	return updateState((state) => reduceHyperparameters(state, num, config));
}

function reduceHyperparameters(
	state: PersistedAppState,
	num: number,
	config: HyperparameterConfig
): PersistedAppState | false {
	const model = state.models.find((m) => m.num === num);
	if (!model || model.status !== 'draft') return false;

	if (jsonEqual(model.hyperparameters, config)) {
		return state;
	}

	const updatedModels = state.models.map((m) => {
		if (m.num !== num) return m;
		return {
			...m,
			hyperparameters: config,
			completedSteps: invalidateLaterSections(m.completedSteps, 'configure-model')
		};
	});
	return { ...state, models: updatedModels };
}

/**
 * Sets Section 3 multiclass strategy.
 * Equality is a no-op returning true; changes invalidate downstream sections per D7.
 */
export function setMulticlassStrategy(num: number, strategy: MulticlassStrategy | null): boolean {
	return updateState((state) => reduceMulticlassStrategy(state, num, strategy));
}

function reduceMulticlassStrategy(
	state: PersistedAppState,
	num: number,
	strategy: MulticlassStrategy | null
): PersistedAppState | false {
	const model = state.models.find((m) => m.num === num);
	if (!model || model.status !== 'draft') return false;

	if (model.multiclass === strategy) {
		return state;
	}

	const updatedModels = state.models.map((m) => {
		if (m.num !== num) return m;
		return {
			...m,
			multiclass: strategy,
			completedSteps: invalidateLaterSections(m.completedSteps, 'configure-model')
		};
	});
	return { ...state, models: updatedModels };
}

/**
 * Sets Section 4 training setup.
 * Equality is a no-op returning true; changes invalidate downstream sections per D7.
 */
export function setTrainingSetup(num: number, setup: ValidationMethodology | null): boolean {
	return updateState((state) => {
		const model = state.models.find((m) => m.num === num);
		if (!model || model.status !== 'draft') return false;

		if (jsonEqual(model.trainingSetup, setup)) {
			return state;
		}

		const updatedModels = state.models.map((m) => {
			if (m.num !== num) return m;
			return {
				...m,
				trainingSetup: setup,
				completedSteps: invalidateLaterSections(m.completedSteps, 'configure-training')
			};
		});
		return { ...state, models: updatedModels };
	});
}

/**
 * Marks a model workflow section completed.
 */
export function completeSection(num: number, section: ModelSectionId): boolean {
	return updateState((state) => reduceCompleteSection(state, num, section));
}

function reduceCompleteSection(
	state: PersistedAppState,
	num: number,
	section: ModelSectionId
): PersistedAppState | false {
	const model = state.models.find((m) => m.num === num);
	if (!model || model.status !== 'draft') return false;

	if (model.completedSteps.includes(section)) return state;

	const updatedModels = state.models.map((m) => {
		if (m.num !== num) return m;
		return { ...m, completedSteps: [...m.completedSteps, section] };
	});
	return { ...state, models: updatedModels };
}

/** Exact input submitted for one editable wizard section. */
export type WizardStepSubmission =
	| { section: 'choose-model'; modelId: string; defaultFeatures: string[] }
	| { section: 'select-features' }
	| {
			section: 'configure-model';
			config: HyperparameterConfig;
			strategy: MulticlassStrategy | null;
	  };

/** Builds one draft candidate containing the editable fields and their section completion. */
export function reduceWizardStep(
	state: PersistedAppState,
	model: ModelRecord,
	submission: WizardStepSubmission
): PersistedAppState | false {
	const { num, completedSteps } = model;
	if (
		model.status !== 'draft' ||
		SECTION_ORDER.find((section) => !completedSteps.includes(section)) !== submission.section
	)
		return false;
	let next: PersistedAppState | false = state;
	switch (submission.section) {
		case 'choose-model':
			next = reduceChooseModel(state, num, submission.modelId);
			if (next && !model.ui.featureSelectionInitialised)
				next = reduceInitialiseFeatureSelection(next, num, submission.defaultFeatures);
			break;
		case 'select-features':
			if (model.features.length === 0) return false;
			break;
		case 'configure-model':
			next = reduceHyperparameters(state, num, submission.config);
			if (next) next = reduceMulticlassStrategy(next, num, submission.strategy);
	}
	return next && reduceCompleteSection(next, num, submission.section);
}

/**
 * Re-opens a completed section for editing, invalidating downstream sections.
 */
export function reopenSection(num: number, section: ModelSectionId): boolean {
	return updateState((state) => {
		const model = state.models.find((m) => m.num === num);
		if (!model || model.status !== 'draft') return false;

		const targetIdx = SECTION_ORDER.indexOf(section);
		if (targetIdx === -1) return false;

		const updatedModels = state.models.map((m) => {
			if (m.num !== num) return m;
			const remainingSteps = m.completedSteps.filter((s) => {
				const idx = SECTION_ORDER.indexOf(s);
				return idx < targetIdx;
			});
			return { ...m, completedSteps: remainingSteps };
		});
		return { ...state, models: updatedModels };
	});
}

function matchingModel(
	state: PersistedAppState,
	identity: TrainingRunIdentity
): ModelRecord | undefined {
	if (state.dataset?.id !== identity.datasetId || state.target !== identity.target)
		return undefined;
	return state.models.find(
		(model) => model.num === identity.modelNum && model.createdAt === identity.modelCreatedAt
	);
}

function updateRunModel(
	state: PersistedAppState,
	identity: TrainingRunIdentity,
	change: (model: ModelRecord) => ModelRecord
): PersistedAppState | false {
	const model = matchingModel(state, identity);
	if (model?.status !== 'training' || model.resultRevision !== identity.runId) return false;
	const updated = change(model);
	if (model === updated) return state;
	return { ...state, models: state.models.map((entry) => (entry === model ? updated : entry)) };
}

/** Creates the pending domain for an accepted run without publishing it to the store. */
export function reduceTrainingStart(
	state: PersistedAppState,
	identity: TrainingRunIdentity
): PersistedAppState | false {
	const model = matchingModel(state, identity);
	const required: ModelSectionId[] = ['choose-model', 'select-features', 'configure-model'];
	if (
		!model ||
		model.status !== 'draft' ||
		!model.trainingSetup ||
		!identity.runId ||
		!required.every((section) => model.completedSteps.includes(section))
	)
		return false;

	const completedSteps = model.completedSteps.includes('configure-training')
		? model.completedSteps
		: [...model.completedSteps, 'configure-training' as const];

	return {
		...state,
		models: state.models.map((entry) =>
			entry === model
				? {
						...model,
						status: 'training',
						error: null,
						resultRevision: identity.runId,
						metrics: null,
						timings: null,
						durationMs: null,
						progress: {
							percent: null,
							stage: 'preparing',
							phase: null,
							statusMessage: 'preparing'
						},
						completedSteps
					}
				: entry
		)
	};
}

/** Applies the start transition for one captured model identity. */
export function startTraining(identity: TrainingRunIdentity): boolean {
	return updateState((state) => reduceTrainingStart(state, identity));
}

/** Updates compact training progress only for the matching active run. */
export function updateTrainingProgress(
	identity: TrainingRunIdentity,
	progress: TrainingProgress
): boolean {
	if (
		progress.percent !== null &&
		(!Number.isFinite(progress.percent) || progress.percent < 0 || progress.percent > 95)
	)
		return false;
	return updateState((state) =>
		updateRunModel(state, identity, (model) => {
			const previous = model.progress?.percent;
			return previous !== null &&
				previous !== undefined &&
				(progress.percent === null || progress.percent < previous)
				? model
				: { ...model, progress };
		})
	);
}

/** Terminal outcome of a single protected training attempt. */
export type TrainingOutcome =
	| {
			kind: 'success';
			durationMs: number;
			metrics?: Record<string, number> | null;
			modelLabel?: string | null;
	  }
	| { kind: 'stopped'; error: TrainingError };

/** Projects persisted swatches and the deterministic fallback for legacy trained records. */
export function modelSwatchAssignments(
	state: Pick<PersistedAppState, 'models' | 'nextModelColorIndex'>
): { colours: ReadonlyMap<number, ModelColor>; nextIndex: number } {
	const colours = new Map<number, ModelColor>();
	let nextIndex = state.nextModelColorIndex;
	const trained = state.models.filter(({ status }) => status === 'trained');
	trained.sort((left, right) => left.num - right.num);
	for (const model of trained) {
		const colour = model.modelColor ?? MODEL_COLORS[nextIndex]!;
		colours.set(model.num, colour);
		if (!model.modelColor) nextIndex = (nextIndex + 1) % MODEL_COLORS.length;
	}
	return { colours, nextIndex };
}

/** Creates the terminal candidate only for the current model creation and run ID. */
export function reduceTrainingOutcome(
	state: PersistedAppState,
	identity: TrainingRunIdentity,
	outcome: TrainingOutcome
): PersistedAppState | false {
	if (outcome.kind === 'stopped') {
		return updateRunModel(state, identity, (model) => ({
			...model,
			status: 'draft',
			error: outcome.error,
			progress: null,
			resultRevision: null,
			metrics: null,
			timings: null,
			durationMs: null,
			completedSteps: model.completedSteps.filter(
				(section) =>
					section !== 'configure-training' &&
					section !== 'training' &&
					section !== 'results'
			)
		}));
	}
	const { colours, nextIndex } = modelSwatchAssignments(state);
	const provisional = state.newModelNum === identity.modelNum;
	const model = matchingModel(state, identity);
	const colour = model?.modelColor ?? MODEL_COLORS[nextIndex]!;
	const completed = updateRunModel(state, identity, (current) => ({
		...current,
		status: 'trained',
		error: null,
		progress: null,
		metrics: outcome.metrics ?? null,
		timings: null,
		durationMs: outcome.durationMs,
		modelColor: colour,
		modelLabel: outcome.modelLabel ?? null,
		...(provisional && {
			provisionalCompletedRunId: current.provisionalCompletedRunId ?? identity.runId
		}),
		completedSteps: current.completedSteps.includes('training')
			? current.completedSteps
			: [...current.completedSteps, 'training']
	}));
	if (!completed) return false;
	return {
		...completed,
		...(provisional && { newModelNum: null }),
		nextModelColorIndex: model?.modelColor ? nextIndex : (nextIndex + 1) % MODEL_COLORS.length,
		models: completed.models.map((record) => {
			const legacyColour = colours.get(record.num);
			return legacyColour && !record.modelColor
				? { ...record, modelColor: legacyColour }
				: record;
		})
	};
}

/** Publishes a completed matching run after its durable result is acknowledged. */
export function trainingSucceeded(identity: TrainingRunIdentity, durationMs: number): boolean {
	return updateState((state) =>
		reduceTrainingOutcome(state, identity, { kind: 'success', durationMs })
	);
}

function stopTraining(
	identity: TrainingRunIdentity,
	code: TrainingError['code'],
	message: string
): boolean {
	return updateState((state) =>
		reduceTrainingOutcome(state, identity, {
			kind: 'stopped',
			error: { code, message, timestamp: Date.now() }
		})
	);
}

/** Reopens the matching failed run's training setup with a safe message. */
export function trainingFailed(identity: TrainingRunIdentity, message: string): boolean {
	return stopTraining(identity, 'TRAINING_FAILED', message);
}

/** Reopens training setup after cancellation of the matching run. */
export function cancelTraining(identity: TrainingRunIdentity): boolean {
	return stopTraining(identity, 'TRAINING_CANCELLED', 'Training was cancelled');
}

/** Reopens training setup after interruption of the matching run. */
export function recoverInterrupted(identity: TrainingRunIdentity): boolean {
	return stopTraining(
		identity,
		'TRAINING_INTERRUPTED_BY_RELOAD',
		'Training was interrupted by a page reload'
	);
}

/** Stores the disclosure preference without replacing a model's other UI selections. */
export function setTrainingLogOpen(num: number, open: boolean): boolean {
	if (typeof open !== 'boolean') return false;
	return updateState((state) => {
		const model = state.models.find((entry) => entry.num === num);
		if (!model) return false;
		if ((model.ui.trainingLogOpen ?? false) === open) return state;
		return {
			...state,
			models: state.models.map((entry) =>
				entry === model ? { ...model, ui: { ...model.ui, trainingLogOpen: open } } : entry
			)
		};
	});
}

/**
 * Merges a valid partial change into one model's Section 6 display preferences. Invalid
 * patches and no-op patches change and write nothing.
 */
export function setModelResultsUi(num: number, patch: Partial<ModelResultsUi>): boolean {
	const changes = sanitiseModelResultsUi(patch);
	const keys = Object.keys(patch);
	if (keys.length === 0 || Object.keys(changes).length !== keys.length) return false;
	return updateState((state) => {
		const model = state.models.find((entry) => entry.num === num);
		if (!model) return false;
		const current = { ...DEFAULT_MODEL_RESULTS_UI, ...model.ui.results };
		if (
			(Object.keys(changes) as (keyof ModelResultsUi)[]).every(
				(key) => current[key] === changes[key]
			)
		) {
			return state;
		}
		const results = { ...model.ui.results, ...changes };
		return {
			...state,
			models: state.models.map((entry) =>
				entry === model ? { ...model, ui: { ...model.ui, results } } : entry
			)
		};
	});
}

/** Produces a result acknowledgement for the matching trained model. */
export function reduceViewResults(
	state: PersistedAppState,
	num: number
): PersistedAppState | false {
	const model = state.models.find((entry) => entry.num === num);
	if (!model || model.status !== 'trained') return false;
	if (model.completedSteps.includes('results')) return state;
	return {
		...state,
		models: state.models.map((entry) =>
			entry === model
				? { ...entry, completedSteps: [...entry.completedSteps, 'results'] }
				: entry
		)
	};
}

/** Marks the result acknowledgement in memory for reducer consumers. */
export function viewResults(num: number): boolean {
	return updateState((state) => reduceViewResults(state, num));
}
