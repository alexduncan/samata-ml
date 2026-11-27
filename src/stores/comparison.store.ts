import { atom, computed } from 'nanostores';
import { AnalysisClient } from '../features/results/analysis-client';
import type { RopeRequest, RopeView } from '../features/results/analysis-protocol';
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
import { $appState, modelSwatchAssignments, setComparisonUi } from './app.store';
import { SUPERVISED_MODELS } from '../features/models/model-catalogue';
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
	const colours = modelSwatchAssignments(state).colours;
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
				label:
					model.modelLabel?.trim() ||
					SUPERVISED_MODELS.find(({ id }) => id === model.modelId)?.name ||
					model.modelId ||
					`Model ${model.num}`,
				modelColor: colours.get(model.num)!,
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
		(unavailableModels.some((model) => model.reason === 'loading')
			? null
			: (groups.find((group) => !group.disabled) ?? null));
	const selected = activeGroup
		? activeGroup.fingerprint === ui.fingerprint
			? ui.selected.filter((num) => activeGroup.models.some((model) => model.num === num))
			: activeGroup.models.slice(0, 8).map((model) => model.num)
		: [];
	const selectedModels =
		activeGroup?.models.filter((model) => selected.includes(model.num)) ?? [];
	const pairA =
		selectedModels.length < 2
			? null
			: (selectedModels.find((model) => model.num === ui.pairA) ?? selectedModels[0] ?? null);
	const pairB = pairA
		? (selectedModels.find((model) => model.num === ui.pairB && model.num !== pairA.num) ??
			selectedModels.find((model) => model.num !== pairA.num) ??
			null)
		: null;
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
	setComparisonUi(owner, {
		fingerprint: active.fingerprint,
		selected: selected.filter((num) => valid.has(num))
	});
}

declare const WEB_ML_RUNTIME_REVISION: string;

/** Current asynchronous posterior resource. */
export type RopeAnalysis =
	| { status: 'idle' | 'loading' | 'unavailable' | 'error'; key: string | null }
	| { status: 'ready'; key: string; result: RopeView };

/** Posterior for the current ordered pair and committed width. */
export const $ropeAnalysis = atom<RopeAnalysis>({ status: 'idle', key: null });
let analysisClient: AnalysisClient | null = null;
let analysisTimer: ReturnType<typeof setTimeout> | null = null;
let analysisAbort: AbortController | null = null;
let analysisSequence = 0;
let lastInput: { key: string; request: Omit<RopeRequest, 'id' | 'type'> } | null = null;

function cancelAnalysis(): void {
	if (analysisTimer !== null) clearTimeout(analysisTimer);
	analysisTimer = null;
	analysisAbort?.abort();
	analysisAbort = null;
	analysisSequence++;
}

/** Clears a pending or displayed result when the comparison route is left. */
export function clearRopeAnalysis(): void {
	cancelAnalysis();
	lastInput = null;
	analysisClient?.dispose();
	analysisClient = null;
	$ropeAnalysis.set({ status: 'idle', key: null });
}

/** Schedules the current eligible ordered pair, replacing superseded work. */
export function requestComparisonAnalysis(): void {
	const comparison = $comparison.get();
	const a = comparison.pairA,
		b = comparison.pairB;
	const identityA = a && currentResultIdentity(a.num);
	const identityB = b && currentResultIdentity(b.num);
	if (
		!a ||
		!b ||
		!identityA ||
		!identityB ||
		a.evaluation.protocol.kind !== 'cross_validation' ||
		b.evaluation.protocol.kind !== 'cross_validation'
	) {
		cancelAnalysis();
		lastInput = null;
		$ropeAnalysis.set({ status: 'unavailable', key: null });
		return;
	}
	const partsA = a.evaluation.partitions.toSorted((x, y) => x.index - y.index);
	const partsB = b.evaluation.partitions.toSorted((x, y) => x.index - y.index);
	if (
		partsA.length < 2 ||
		partsA.length !== partsB.length ||
		partsA.some((part, index) => part.index !== partsB[index]?.index)
	) {
		cancelAnalysis();
		lastInput = null;
		$ropeAnalysis.set({ status: 'unavailable', key: null });
		return;
	}
	const width = ownedComparisonResults($appState.get(), $appState.get()).ui.ropeWidth;
	const revision = typeof WEB_ML_RUNTIME_REVISION === 'undefined' ? '' : WEB_ML_RUNTIME_REVISION;
	const key = JSON.stringify([
		revision,
		a.evaluation.partitionFingerprint,
		identityA,
		identityB,
		width
	]);
	const current = $ropeAnalysis.get();
	if (current.status === 'ready' && current.key === key) return;
	if (current.status === 'loading' && current.key === key) return;
	if (current.status === 'error' && current.key === key) return;
	cancelAnalysis();
	const request = {
		scoresA: partsA.map((part) => part.test.balancedAccuracy),
		scoresB: partsB.map((part) => part.test.balancedAccuracy),
		rope: width,
		testFraction: 1 / partsA.length
	};
	lastInput = { key, request };
	scheduleAnalysis(key, request);
}

function scheduleAnalysis(key: string, request: Omit<RopeRequest, 'id' | 'type'>): void {
	const sequence = analysisSequence;
	$ropeAnalysis.set({ status: 'loading', key });
	analysisTimer = setTimeout(() => {
		analysisTimer = null;
		const controller = new AbortController();
		analysisAbort = controller;
		analysisClient ??= new AnalysisClient();
		void analysisClient.requestRope(request, controller.signal).then(
			(result) => {
				if (sequence === analysisSequence)
					$ropeAnalysis.set({ status: 'ready', key, result });
			},
			() => {
				if (sequence === analysisSequence) $ropeAnalysis.set({ status: 'error', key });
			}
		);
	}, 250);
}

/** Retries the current failed analysis using a fresh request. */
export function retryComparisonAnalysis(): void {
	if (!lastInput) return;
	cancelAnalysis();
	scheduleAnalysis(lastInput.key, lastInput.request);
}

$comparison.listen(() => {
	if ($ropeAnalysis.get().status !== 'idle') requestComparisonAnalysis();
});
