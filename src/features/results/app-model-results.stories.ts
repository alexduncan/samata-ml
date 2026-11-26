import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, userEvent, waitFor } from 'storybook/test';
import {
	breastCancerOneShot,
	irisCrossValidation,
	manyClasses,
	svcBinaryNoProbabilities
} from '../../../tests/fixtures/results/evaluations';
import { withLongLabels } from '../../../tests/fixtures/results/variants';
import { $appState } from '../../stores/app.store';
import {
	$modelResults,
	currentResultIdentity,
	type ModelResultsStatus
} from '../../stores/model-results.store';
import {
	DEFAULT_ONE_SHOT_SETUP,
	INITIAL_APP_STATE,
	type ModelRecord,
	type PersistedAppState
} from '../../types/state';
import type { StoredEvaluation } from '../../types/model-evaluation';
import type { AppModelResults } from './app-model-results';
import './app-model-results';

function seed(
	status: ModelResultsStatus | 'untrained',
	evaluation: StoredEvaluation | null = null
): () => void {
	const previous = { app: $appState.get(), results: $modelResults.get() };
	const trained = status !== 'untrained';
	const model: ModelRecord = {
		num: 1,
		createdAt: 1,
		status: trained ? 'trained' : 'draft',
		completedSteps: trained
			? [
					'choose-model',
					'select-features',
					'configure-model',
					'configure-training',
					'training',
					'results'
				]
			: ['choose-model', 'select-features', 'configure-model', 'configure-training'],
		modelId: 'logistic-regression',
		features: ['petal length', 'petal width'],
		modelOptions: {},
		hyperparameters: { mode: 'manual', values: {} },
		multiclass: null,
		trainingSetup: DEFAULT_ONE_SHOT_SETUP,
		progress: null,
		resultRevision: trained ? 'story-run' : null,
		error: null,
		timings: null,
		durationMs: trained ? 2100 : null,
		metrics: null,
		ui: {}
	};
	const state: PersistedAppState = {
		...structuredClone(INITIAL_APP_STATE),
		onboarding: { welcomeDismissed: true, betaTelemetryAccepted: false },
		dataset: {
			id: 'iris',
			name: 'Iris',
			source: 'sample',
			rowCount: 150,
			columns: [
				{ name: 'petal length', type: 'numeric', missingCount: 0 },
				{ name: 'petal width', type: 'numeric', missingCount: 0 },
				{ name: 'class', type: 'categorical', missingCount: 0 }
			]
		},
		target: 'class',
		models: [model],
		nextModelNum: 2
	};
	$appState.set(state);
	const identity = currentResultIdentity(1);
	if (trained && identity) {
		$modelResults.set({
			1: {
				identity,
				status,
				evaluation: status === 'ready' ? evaluation : null,
				error: status === 'error' ? 'read failed' : ''
			}
		});
	} else {
		$modelResults.set({});
	}
	return () => {
		$appState.set(previous.app);
		$modelResults.set(previous.results);
	};
}

const meta = {
	title: 'Results/Model results',
	component: 'app-model-results',
	tags: ['autodocs'],
	parameters: {
		a11y: { test: 'error' },
		docs: {
			description: {
				component:
					'Do read the headline first, then the spread, the errors and the probability views. Do train again when a result is legacy or lost: the saved configuration is kept. Don’t read these scores as a comparison with other models; that is a separate view.'
			}
		}
	},
	render: () => html`<app-model-results model-num="1"></app-model-results>`
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

async function settled(canvasElement: HTMLElement): Promise<AppModelResults> {
	const element = canvasElement.querySelector<AppModelResults>('app-model-results')!;
	await element.whenSettled();
	return element;
}

/** Binary target, One-Shot, with probabilities: every shared block. */
export const Binary: Story = {
	beforeEach: () => seed('ready', breastCancerOneShot()),
	play: async ({ canvasElement }) => {
		const element = await settled(canvasElement);
		await waitFor(() =>
			expect(element.shadowRoot!.querySelectorAll('section.block h3')).toHaveLength(5)
		);
		expect(element.shadowRoot!.querySelector('app-threshold-explorer')).not.toBeNull();
		const disclosure =
			element.shadowRoot!.querySelector<HTMLDetailsElement>('.terms-disclosure')!;
		expect(disclosure.open).toBe(false);
		await userEvent.click(disclosure.querySelector('summary')!);
		expect(disclosure.open).toBe(true);
		expect(disclosure.querySelector('dl')?.textContent).toContain('Probability threshold');
	}
};
/** Multiclass target, five-fold Cross-Validation: Classee strips, no threshold explorer. */
export const Multiclass: Story = {
	beforeEach: () => seed('ready', irisCrossValidation()),
	play: async ({ canvasElement }) => {
		const element = await settled(canvasElement);
		expect(element.shadowRoot!.querySelector('app-classee-strips')).not.toBeNull();
		expect(element.shadowRoot!.querySelector('app-threshold-explorer')).toBeNull();
		const disclosure =
			element.shadowRoot!.querySelector<HTMLDetailsElement>('.terms-disclosure')!;
		await userEvent.click(disclosure.querySelector('summary')!);
		expect(disclosure.open).toBe(true);
		expect(disclosure.querySelector('dl')?.textContent).toContain('Mean across folds');
	}
};
/** Twenty-five classes show a filter and scrolling tables. */
export const ManyClasses: Story = { beforeEach: () => seed('ready', manyClasses()) };
/** A model trained without probability estimates explains each unavailable section. */
export const NoProbabilities: Story = {
	beforeEach: () => seed('ready', svcBinaryNoProbabilities())
};
/** Long class names wrap or are shortened on the axes and complete in the tables. */
export const LongLabel: Story = {
	beforeEach: () => seed('ready', withLongLabels(irisCrossValidation())),
	play: async ({ canvasElement }) => {
		const element = await settled(canvasElement);
		const disclosure =
			element.shadowRoot!.querySelector<HTMLDetailsElement>('.terms-disclosure')!;
		await userEvent.click(disclosure.querySelector('summary')!);
		expect(disclosure.open).toBe(true);
	}
};
/** Logical layout under right-to-left direction. */
export const RTL: Story = {
	beforeEach: () => seed('ready', irisCrossValidation()),
	render: () => html`<div dir="rtl"><app-model-results model-num="1"></app-model-results></div>`,
	play: async ({ canvasElement }) => {
		const element = await settled(canvasElement);
		const disclosure =
			element.shadowRoot!.querySelector<HTMLDetailsElement>('.terms-disclosure')!;
		await userEvent.click(disclosure.querySelector('summary')!);
		expect(disclosure.open).toBe(true);
		expect(getComputedStyle(disclosure).direction).toBe('rtl');
	}
};
async function expectTermsAbsent({ canvasElement }: { canvasElement: HTMLElement }) {
	const element = canvasElement.querySelector<AppModelResults>('app-model-results')!;
	await element.updateComplete;
	expect(element.shadowRoot!.querySelector('.terms-disclosure')).toBeNull();
}
/** The saved results are being read. */
export const Loading: Story = { beforeEach: () => seed('loading'), play: expectTermsAbsent };
/** A model that has not been trained has nothing to show. */
export const Empty: Story = { beforeEach: () => seed('untrained'), play: expectTermsAbsent };
/** A Phase 3 result stays usable but has no detailed results. */
export const Legacy: Story = { beforeEach: () => seed('legacy'), play: expectTermsAbsent };
/** The saved result has gone missing since it was acknowledged. */
export const Lost: Story = { beforeEach: () => seed('lost'), play: expectTermsAbsent };
/** A read failure gives an alert and Retry. */
export const ReadError: Story = {
	beforeEach: () => seed('error'),
	play: async ({ canvasElement }) => {
		const element = await settled(canvasElement);
		expect(element.shadowRoot!.querySelector('[role="alert"]')).not.toBeNull();
		expect(element.shadowRoot!.querySelector('.terms-disclosure')).toBeNull();
	}
};
