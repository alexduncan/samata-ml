import { atom } from 'nanostores';
import {
	INITIAL_APP_STATE,
	isModelEligibleColumnType,
	type DatasetSummary,
	type HyperparameterConfig,
	type HyperparameterValue,
	type ModelRecord,
	type ModelSectionId,
	type MulticlassStrategy,
	type PersistedAppState,
	type TrainingProgress,
	type ValidationMethodology,
	type WorkflowPath
} from '../types/state';
import { $scrollState, clearScroll } from './scroll.store';

/**
 * Nanostore holding persisted domain application state.
 * Follows specification/state-and-storage.md §3 and specification/COMPONENTS.md §5.
 */
export const $appState = atom<PersistedAppState>(INITIAL_APP_STATE);

const SECTION_ORDER: ModelSectionId[] = [
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
 * Updates the active workflow resume path.
 */
export function setResumePath(resumePath: WorkflowPath): boolean {
	return updateState((state) => ({
		...state,
		resumePath
	}));
}

/**
 * Called when a dataset is successfully loaded or selected.
 * Preserves downstream state if schema is identical; resets target and models on change.
 */
export function loadDatasetSucceeded(dataset: DatasetSummary): boolean {
	let isDifferentDataset = false;
	const success = updateState((state) => {
		const current = state.dataset;
		const isSameDataset =
			current !== null &&
			current.id === dataset.id &&
			current.columns.length === dataset.columns.length &&
			current.columns.every(
				(c, i) => c.name === dataset.columns[i]?.name && c.type === dataset.columns[i]?.type
			);

		if (isSameDataset) {
			return {
				...state,
				dataset,
				data: { mode: 'preview', selectedColumn: null }
			};
		}

		isDifferentDataset = true;
		return {
			...state,
			dataset,
			data: { mode: 'preview', selectedColumn: null },
			target: null,
			models: [],
			nextModelNum: 1
		};
	});

	if (success && isDifferentDataset) {
		clearNonDataScroll();
	}
	return success;
}

/**
 * Clears the active dataset, target, models, and non-data scroll snapshots,
 * and resets data mode to 'select'. Preserves onboarding and preferences.
 * Follows specification/plans/step-1-load-data-and-preview.md D6.
 */
export function clearDataset(): boolean {
	const success = updateState((state) => ({
		...state,
		dataset: null,
		data: { mode: 'select', selectedColumn: null },
		target: null,
		models: [],
		nextModelNum: 1
	}));

	if (success) {
		clearNonDataScroll();
	}
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

/**
 * Sets the target column name.
 * Rejects if models exist until confirmDiscardModels is called.
 */
export function setTarget(column: string): boolean {
	return updateState((state) => {
		if (!state.dataset) return false;

		const col = state.dataset.columns.find((c) => c.name === column);
		if (!col || !isModelEligibleColumnType(col.type)) return false;

		// Discard confirmation required if models already exist
		if (state.models.length > 0 && state.target !== column) {
			return false;
		}

		// Target column can never be in a model's features list
		const updatedModels = state.models.map((m) => ({
			...m,
			features: m.features.filter((f) => f !== column)
		}));

		return {
			...state,
			target: column,
			models: updatedModels
		};
	});
}

/**
 * Confirms discarding all models and associated scroll states.
 */
export function confirmDiscardModels(): boolean {
	const success = updateState((state) => ({
		...state,
		models: [],
		nextModelNum: 1
	}));
	if (success) {
		clearModelAndResultScroll();
	}
	return success;
}

/**
 * Creates a new draft model record.
 *
 * @returns Allocated model number or false if target is not set.
 */
export function createModel(): number | false {
	let createdNum = 0;
	const success = updateState((state) => {
		if (!state.dataset || !state.target) return false;

		createdNum = state.nextModelNum;
		const newModel: ModelRecord = {
			num: createdNum,
			createdAt: Date.now(),
			status: 'draft',
			completedSteps: [],
			modelId: null,
			features: [],
			modelOptions: {},
			hyperparameters: { mode: 'manual', values: {} },
			multiclass: null,
			trainingSetup: null,
			progress: null,
			error: null,
			timings: null,
			durationMs: null,
			metrics: null,
			ui: {}
		};

		return {
			...state,
			nextModelNum: state.nextModelNum + 1,
			models: [...state.models, newModel]
		};
	});

	return success ? createdNum : false;
}

/**
 * Selects the web-ml model architecture for Section 1.
 */
export function chooseModel(
	num: number,
	modelId: string,
	defaults?: {
		modelOptions?: Record<string, HyperparameterValue>;
		hyperparameters?: HyperparameterConfig;
		multiclass?: MulticlassStrategy | null;
	}
): boolean {
	return updateState((state) => {
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
	});
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
	});
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
	return updateState((state) => {
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
	});
}

/**
 * Sets Section 3 multiclass strategy.
 * Equality is a no-op returning true; changes invalidate downstream sections per D7.
 */
export function setMulticlassStrategy(num: number, strategy: MulticlassStrategy | null): boolean {
	return updateState((state) => {
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
	});
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
	return updateState((state) => {
		const model = state.models.find((m) => m.num === num);
		if (!model || model.status !== 'draft') return false;

		if (model.completedSteps.includes(section)) return state;

		const updatedModels = state.models.map((m) => {
			if (m.num !== num) return m;
			return { ...m, completedSteps: [...m.completedSteps, section] };
		});
		return { ...state, models: updatedModels };
	});
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

/**
 * Transitions model status to 'training' when sections 1–3 are complete and trainingSetup is set.
 * Completes Section 4 (configure-training) per D8.
 */
export function startTraining(num: number): boolean {
	return updateState((state) => {
		const model = state.models.find((m) => m.num === num);
		if (!model || model.status !== 'draft') return false;
		if (model.trainingSetup === null) return false;

		const required: ModelSectionId[] = ['choose-model', 'select-features', 'configure-model'];
		const canTrain = required.every((s) => model.completedSteps.includes(s));
		if (!canTrain) return false;

		const completedSteps = model.completedSteps.includes('configure-training')
			? model.completedSteps
			: [...model.completedSteps, 'configure-training' as const];

		const updatedModels = state.models.map((m) => {
			if (m.num !== num) return m;
			return {
				...m,
				status: 'training' as const,
				error: null,
				progress: { percent: 0, statusMessage: 'Initializing...' },
				completedSteps
			};
		});
		return { ...state, models: updatedModels };
	});
}

/**
 * Updates training progress during execution.
 */
export function updateTrainingProgress(num: number, progress: TrainingProgress): boolean {
	return updateState((state) => {
		const model = state.models.find((m) => m.num === num);
		if (!model || model.status !== 'training') return false;

		const updatedModels = state.models.map((m) => {
			if (m.num !== num) return m;
			return { ...m, progress };
		});
		return { ...state, models: updatedModels };
	});
}

/**
 * Transitions model to 'trained' upon successful completion.
 */
export function trainingSucceeded(
	num: number,
	result: {
		metrics: Record<string, number>;
		timings?: { steps: { label: string; durationMs: number }[]; totalMs: number } | null;
		durationMs?: number | null;
	}
): boolean {
	return updateState((state) => {
		const model = state.models.find((m) => m.num === num);
		if (!model || model.status !== 'training') return false;

		const updatedModels = state.models.map((m) => {
			if (m.num !== num) return m;
			const completed = m.completedSteps.includes('training')
				? m.completedSteps
				: [...m.completedSteps, 'training' as const];
			return {
				...m,
				status: 'trained' as const,
				progress: null,
				error: null,
				metrics: result.metrics,
				timings: result.timings ?? null,
				durationMs: result.durationMs ?? null,
				completedSteps: completed
			};
		});
		return { ...state, models: updatedModels };
	});
}

/**
 * Reverts model to 'draft' with error details upon training failure, reopening configure-training.
 */
export function trainingFailed(num: number, message: string, details?: string): boolean {
	return updateState((state) => {
		const model = state.models.find((m) => m.num === num);
		if (!model || model.status !== 'training') return false;

		const updatedModels = state.models.map((m) => {
			if (m.num !== num) return m;
			return {
				...m,
				status: 'draft' as const,
				progress: null,
				error: {
					code: 'TRAINING_FAILED' as const,
					message,
					timestamp: Date.now(),
					details
				},
				completedSteps: m.completedSteps.filter(
					(s) => s !== 'configure-training' && s !== 'training' && s !== 'results'
				)
			};
		});
		return { ...state, models: updatedModels };
	});
}

/**
 * Cancels active model training, reopening configure-training.
 */
export function cancelTraining(num: number): boolean {
	return updateState((state) => {
		const model = state.models.find((m) => m.num === num);
		if (!model || model.status !== 'training') return false;

		const updatedModels = state.models.map((m) => {
			if (m.num !== num) return m;
			return {
				...m,
				status: 'draft' as const,
				progress: null,
				error: {
					code: 'TRAINING_CANCELLED' as const,
					message: 'Training was cancelled',
					timestamp: Date.now()
				},
				completedSteps: m.completedSteps.filter(
					(s) => s !== 'configure-training' && s !== 'training' && s !== 'results'
				)
			};
		});
		return { ...state, models: updatedModels };
	});
}

/**
 * Recovers interrupted model training from browser reload, reopening configure-training.
 */
export function recoverInterrupted(num: number): boolean {
	return updateState((state) => {
		const model = state.models.find((m) => m.num === num);
		if (!model || model.status !== 'training') return false;

		const updatedModels = state.models.map((m) => {
			if (m.num !== num) return m;
			return {
				...m,
				status: 'draft' as const,
				progress: null,
				error: {
					code: 'TRAINING_INTERRUPTED_BY_RELOAD' as const,
					message: 'Training was interrupted by a page reload',
					timestamp: Date.now()
				},
				completedSteps: m.completedSteps.filter(
					(s) => s !== 'configure-training' && s !== 'training' && s !== 'results'
				)
			};
		});
		return { ...state, models: updatedModels };
	});
}

/**
 * Marks results section viewed for a trained model.
 */
export function viewResults(num: number): boolean {
	return updateState((state) => {
		const model = state.models.find((m) => m.num === num);
		if (!model || model.status !== 'trained') return false;

		if (model.completedSteps.includes('results')) return state;

		const updatedModels = state.models.map((m) => {
			if (m.num !== num) return m;
			return { ...m, completedSteps: [...m.completedSteps, 'results' as const] };
		});
		return { ...state, models: updatedModels };
	});
}
