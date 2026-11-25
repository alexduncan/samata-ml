import { computed } from 'nanostores';
import { $appState } from './app.store';
import type { ModelRecord, PersistedAppState } from '../types/state';

/**
 * Computed store returning true when a valid dataset summary is loaded.
 */
export const $hasDataset = computed($appState, (state) => state.dataset !== null);

/**
 * Computed store returning true when both a dataset and valid target are selected.
 */
export const $hasTarget = computed(
	$appState,
	(state) => state.dataset !== null && state.target !== null
);

/**
 * Computed store returning list of models with status 'trained'.
 */
export const $trainedModels = computed($appState, (state) =>
	state.models.filter((m): m is ModelRecord => m.status === 'trained')
);

/**
 * Computed store returning true when at least two models are trained.
 */
export const $canCompare = computed($trainedModels, (trained) => trained.length >= 2);

/**
 * Reasons why a workflow page cannot render its normal content.
 * Follows specification/app-state-and-navigation.md §4.2 and §4.3.
 */
export type BlockedReason =
	| 'DATASET_REQUIRED'
	| 'TARGET_REQUIRED'
	| 'MODEL_NOT_FOUND'
	| 'TWO_TRAINED_MODELS_REQUIRED';

/**
 * Pure evaluation of the blocked reason for a specific route and application state.
 * Returns null if the route can render its primary content.
 * Follows specification/app-state-and-navigation.md §4.3 and D5.
 *
 * @param route - Normalized path (e.g. '/data', '/target', '/models', '/models/1', '/results').
 * @param state - Current persisted application state.
 */
export function blockedReason(route: string, state: PersistedAppState): BlockedReason | null {
	// 1. /data is never blocked
	if (route === '/data') {
		return null;
	}

	const hasDataset = state.dataset !== null;
	const hasTarget = hasDataset && state.target !== null;
	const trainedCount = state.models.filter((m) => m.status === 'trained').length;

	// 2. /target requires dataset
	if (route === '/target') {
		return hasDataset ? null : 'DATASET_REQUIRED';
	}

	// 3. /models requires dataset and target
	if (route === '/models' || route === '/models/new') {
		if (!hasDataset) return 'DATASET_REQUIRED';
		if (!hasTarget) return 'TARGET_REQUIRED';
		return null;
	}

	// 4. /models/{num}: null if model exists, else MODEL_NOT_FOUND per D5
	const modelMatch = route.match(/^\/models\/(\d+)$/);
	if (modelMatch && modelMatch[1]) {
		const num = Number.parseInt(modelMatch[1], 10);
		const modelExists = state.models.some((m) => m.num === num);
		return modelExists ? null : 'MODEL_NOT_FOUND';
	}

	// 5. /results: TWO_TRAINED_MODELS_REQUIRED unless at least two models are trained per D5
	if (route === '/results') {
		return trainedCount >= 2 ? null : 'TWO_TRAINED_MODELS_REQUIRED';
	}

	return null;
}
