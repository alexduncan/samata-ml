import { atom } from 'nanostores';
import {
	INITIAL_APP_STATE,
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
import { clearScroll } from './scroll.store';

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
 * Helper to update state with an updated timestamp while preserving immutability.
 */
function updateState(transform: (state: PersistedAppState) => PersistedAppState | false): boolean {
	const current = $appState.get();
	const next = transform(current);
	if (next === false) {
		return false;
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
	return updateState((state) => {
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
				dataset
			};
		}

		clearScroll(['target', 'models', 'results']);
		return {
			...state,
			dataset,
			data: { mode: 'preview', selectedColumn: null },
			target: null,
			models: [],
			nextModelNum: 1
		};
	});
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
 */
export function setSelectedColumn(selectedColumn: string | null): boolean {
	return updateState((state) => ({
		...state,
		data: { ...state.data, selectedColumn }
	}));
}

/**
 * Sets the target column name.
 * Rejects if models exist until confirmDiscardModels is called.
 */
export function setTarget(column: string): boolean {
	return updateState((state) => {
		if (!state.dataset) return false;

		const col = state.dataset.columns.find((c) => c.name === column);
		if (!col || col.type === 'text') return false;

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
	clearScroll(['target', 'models', 'results']);
	return updateState((state) => ({
		...state,
		models: [],
		nextModelNum: 1
	}));
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
 */
export function setFeatures(num: number, names: string[]): boolean {
	return updateState((state) => {
		const model = state.models.find((m) => m.num === num);
		if (!model || model.status !== 'draft') return false;

		// Target column must never be a feature
		if (state.target && names.includes(state.target)) return false;

		const updatedModels = state.models.map((m) => {
			if (m.num !== num) return m;
			return {
				...m,
				features: names,
				completedSteps: m.completedSteps.filter(
					(s) =>
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
 */
export function setModelOptions(
	num: number,
	options: Record<string, HyperparameterValue>
): boolean {
	return updateState((state) => {
		const model = state.models.find((m) => m.num === num);
		if (!model || model.status !== 'draft') return false;

		const updatedModels = state.models.map((m) => {
			if (m.num !== num) return m;
			return { ...m, modelOptions: options };
		});
		return { ...state, models: updatedModels };
	});
}

/**
 * Sets Section 3 hyperparameters.
 */
export function setHyperparameters(num: number, config: HyperparameterConfig): boolean {
	return updateState((state) => {
		const model = state.models.find((m) => m.num === num);
		if (!model || model.status !== 'draft') return false;

		const updatedModels = state.models.map((m) => {
			if (m.num !== num) return m;
			return { ...m, hyperparameters: config };
		});
		return { ...state, models: updatedModels };
	});
}

/**
 * Sets Section 3 multiclass strategy.
 */
export function setMulticlassStrategy(num: number, strategy: MulticlassStrategy | null): boolean {
	return updateState((state) => {
		const model = state.models.find((m) => m.num === num);
		if (!model || model.status !== 'draft') return false;

		const updatedModels = state.models.map((m) => {
			if (m.num !== num) return m;
			return { ...m, multiclass: strategy };
		});
		return { ...state, models: updatedModels };
	});
}

/**
 * Sets Section 4 training setup.
 */
export function setTrainingSetup(num: number, setup: ValidationMethodology | null): boolean {
	return updateState((state) => {
		const model = state.models.find((m) => m.num === num);
		if (!model || model.status !== 'draft') return false;

		const updatedModels = state.models.map((m) => {
			if (m.num !== num) return m;
			return { ...m, trainingSetup: setup };
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
 * Transitions model status to 'training' when sections 1–4 are complete.
 */
export function startTraining(num: number): boolean {
	return updateState((state) => {
		const model = state.models.find((m) => m.num === num);
		if (!model || model.status !== 'draft') return false;

		const required: ModelSectionId[] = [
			'choose-model',
			'select-features',
			'configure-model',
			'configure-training'
		];
		const canTrain = required.every((s) => model.completedSteps.includes(s));
		if (!canTrain) return false;

		const updatedModels = state.models.map((m) => {
			if (m.num !== num) return m;
			return {
				...m,
				status: 'training' as const,
				error: null,
				progress: { percent: 0, statusMessage: 'Initializing...' }
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
 * Reverts model to 'draft' with error details upon training failure.
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
				completedSteps: m.completedSteps.filter((s) => s !== 'training')
			};
		});
		return { ...state, models: updatedModels };
	});
}

/**
 * Cancels active model training.
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
				}
			};
		});
		return { ...state, models: updatedModels };
	});
}

/**
 * Recovers interrupted model training from browser reload.
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
				}
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
