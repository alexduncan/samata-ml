import { computed } from 'nanostores';
import {
	agreementCounts,
	classErrorRows,
	comparisonBaselines,
	comparisonConfusionView,
	comparisonTableRow,
	confusionDelta,
	groupComparisons,
	sortComparisonRows,
	type ComparisonModel
} from '../features/results/comparison-model';
import { sameTrainingRun } from '../features/models/training/result-validation';
import { $appState, setComparisonUi } from './app.store';
import { comparisonOwner, ownedComparisonResults } from './comparison-preferences';
import type { ComparisonOwner } from '../types/state';
import {
	$modelResults,
	currentResultIdentity,
	loadModelResults,
	retryModelResults
} from './model-results.store';

/** Comparison groups and unavailable resources for the current trained models. */
export const $comparison = computed([$appState, $modelResults], (state, resources) => {
	const models: ComparisonModel[] = [];
	const unavailableModels: { num: number; reason: 'loading' | 'legacy' | 'lost' | 'error' }[] =
		[];
	for (const model of state.models.filter((entry) => entry.status === 'trained')) {
		const identity = currentResultIdentity(model.num);
		const resource = resources[model.num];
		if (
			!identity ||
			!resource ||
			!sameTrainingRun(identity, resource.identity) ||
			resource.status === 'idle' ||
			resource.status === 'loading'
		) {
			unavailableModels.push({ num: model.num, reason: 'loading' });
		} else if (resource.status === 'ready' && resource.evaluation) {
			models.push({
				num: model.num,
				label: `Model ${model.num}`,
				evaluation: resource.evaluation
			});
		} else {
			unavailableModels.push({
				num: model.num,
				reason: resource.status === 'ready' ? 'error' : resource.status
			});
		}
	}
	const groups = groupComparisons(models);
	const ui = ownedComparisonResults(state, state).ui;
	const activeGroup =
		groups.find((group) => group.fingerprint === ui.fingerprint && !group.disabled) ??
		groups.find((group) => !group.disabled) ??
		null;
	const selected = activeGroup
		? activeGroup.fingerprint === ui.fingerprint
			? ui.selected.filter((num) => activeGroup.models.some((model) => model.num === num))
			: activeGroup.models.slice(0, 8).map((model) => model.num)
		: [];
	const selectedModels =
		activeGroup?.models.filter((model) => selected.includes(model.num)) ?? [];
	const pairA =
		selectedModels.find((model) => model.num === ui.pairA) ?? selectedModels[0] ?? null;
	const pairB =
		selectedModels.find((model) => model.num === ui.pairB && model.num !== pairA?.num) ??
		selectedModels.find((model) => model.num !== pairA?.num) ??
		null;
	const comparable = selectedModels.length >= 2;
	return {
		groups,
		activeGroup,
		selected,
		unavailableModels,
		pairA,
		pairB,
		classFilter:
			activeGroup &&
			activeGroup.models[0]!.evaluation.classLabels.length > 20 &&
			ui.classFilter !== null &&
			ui.classFilter < activeGroup.models[0]!.evaluation.classLabels.length
				? ui.classFilter
				: null,
		tableRows: comparable
			? sortComparisonRows(selectedModels.map(comparisonTableRow), ui.sort)
			: [],
		baselines: comparable ? comparisonBaselines(selectedModels) : { rows: [], mismatched: [] },
		classErrors: comparable ? classErrorRows(selectedModels) : [],
		agreement: comparable ? agreementCounts(selectedModels) : [],
		confusionDelta: pairA && pairB ? confusionDelta(pairA, pairB) : null,
		confusionView: pairA && pairB ? comparisonConfusionView(pairA, pairB, ui.classFilter) : null
	};
});

$comparison.listen((comparison) => {
	const state = $appState.get();
	const owner = comparisonOwner(state);
	if (
		owner &&
		comparison.activeGroup?.fingerprint === state.results.ui.fingerprint &&
		state.results.ui.classFilter !== comparison.classFilter
	) {
		setComparisonUi(owner, { classFilter: comparison.classFilter });
	}
});

/** Loads all trained model evaluations for comparison. */
export async function loadComparisonResults(): Promise<void> {
	await Promise.all(
		$appState
			.get()
			.models.filter((model) => model.status === 'trained')
			.map((model) => loadModelResults(model.num))
	);
}

/** Retries reading a model's evaluation. */
export async function retryComparisonResults(num: number): Promise<void> {
	await retryModelResults(num);
}

/** Selects a comparable group and its default models in one owned update. */
export function selectComparisonGroup(owner: ComparisonOwner, fingerprint: string): void {
	const group = $comparison
		.get()
		.groups.find((entry) => entry.fingerprint === fingerprint && !entry.disabled);
	if (!group) return;
	const selected = group.models.slice(0, 8).map((model) => model.num);
	setComparisonUi(owner, {
		fingerprint,
		selected,
		pairA: selected[0] ?? null,
		pairB: selected[1] ?? null,
		classFilter: null
	});
}

/** Updates selected models, retaining the ordered pair when it remains valid. */
export function selectComparisonModels(owner: ComparisonOwner, selected: number[]): void {
	const active = $comparison.get().activeGroup;
	if (!active) return;
	const valid = new Set(active.models.map((model) => model.num));
	setComparisonUi(owner, { selected: selected.filter((num) => valid.has(num)) });
}
