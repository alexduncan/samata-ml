import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, waitFor } from 'storybook/test';
import {
	breastCancerOneShot,
	irisCrossValidation
} from '../../../tests/fixtures/results/evaluations';
import { withLongLabels } from '../../../tests/fixtures/results/variants';
import { $appState } from '../../stores/app.store';
import {
	$modelResults,
	currentResultIdentity,
	type ModelResultsStatus
} from '../../stores/model-results.store';
import { DEFAULT_ONE_SHOT_SETUP, INITIAL_APP_STATE, type ModelRecord } from '../../types/state';
import './app-results-view';

type StoryState =
	| 'blocked'
	| 'ready'
	| 'one-shot'
	| 'loading'
	| 'legacy'
	| 'lost'
	| 'error'
	| 'incompatible'
	| 'long';

function seed(state: StoryState): () => void {
	const previous = { app: $appState.get(), results: $modelResults.get() };
	const resourceStatus: ModelResultsStatus =
		state === 'loading' || state === 'legacy' || state === 'lost' || state === 'error'
			? state
			: 'ready';
	const models: ModelRecord[] =
		state !== 'blocked'
			? [1, 2].map((num) => ({
					num,
					createdAt: num,
					status: 'trained',
					completedSteps: [
						'choose-model',
						'select-features',
						'configure-model',
						'configure-training',
						'training',
						'results'
					],
					modelId: 'logistic-regression',
					features: ['petal length'],
					modelOptions: {},
					hyperparameters: { mode: 'manual', values: {} },
					multiclass: null,
					trainingSetup: DEFAULT_ONE_SHOT_SETUP,
					progress: null,
					resultRevision: `story-${num}`,
					error: null,
					timings: null,
					durationMs: 2100,
					metrics: null,
					ui: {}
				}))
			: [];
	$appState.set({
		...structuredClone(INITIAL_APP_STATE),
		onboarding: { welcomeDismissed: true, betaTelemetryAccepted: false },
		dataset: {
			id: 'iris',
			name: 'Iris',
			source: 'sample',
			rowCount: 150,
			columns: [
				{ name: 'petal length', type: 'numeric', missingCount: 0 },
				{ name: 'class', type: 'categorical', missingCount: 0 }
			]
		},
		target: 'class',
		models,
		nextModelNum: models.length + 1
	});
	$modelResults.set(
		Object.fromEntries(
			models.map(({ num }) => [
				num,
				{
					identity: currentResultIdentity(num)!,
					status: resourceStatus,
					evaluation: ['loading', 'legacy', 'lost', 'error'].includes(state)
						? null
						: state === 'one-shot'
							? breastCancerOneShot()
							: state === 'long'
								? withLongLabels(irisCrossValidation())
								: state === 'incompatible' && num === 2
									? {
											...irisCrossValidation(),
											partitionFingerprint: 'b'.repeat(64)
										}
									: irisCrossValidation(),
					error: state === 'error' ? 'Read failed' : ''
				}
			])
		)
	);
	return () => {
		$appState.set(previous.app);
		$modelResults.set(previous.results);
	};
}

const meta = {
	title: 'Results/Compare results',
	component: 'app-results-view',
	tags: ['autodocs'],
	parameters: {
		a11y: { test: 'error' },
		docs: {
			description: {
				component:
					'Do compare models evaluated on the same rows and inspect the measures together. Do not treat one metric as an automatic winner.'
			}
		}
	},
	render: () => html`<app-results-view></app-results-view>`
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Two saved cross-validation evaluations. */
export const Populated: Story = {
	beforeEach: () => seed('ready'),
	play: async ({ canvasElement }) => {
		await waitFor(() =>
			expect(
				canvasElement
					.querySelector('app-results-view')!
					.shadowRoot!.querySelector('app-comparison-table')
			).not.toBeNull()
		);
	}
};
/** Fewer than two models have been trained. */
export const Blocked: Story = { beforeEach: () => seed('blocked') };
/** One-Shot results explain why paired-fold analysis is unavailable. */
export const OneShot: Story = { beforeEach: () => seed('one-shot') };
/** The saved evaluations are loading. */
export const Loading: Story = { beforeEach: () => seed('loading') };
/** The saved evaluations predate detailed results. */
export const Legacy: Story = { beforeEach: () => seed('legacy') };
/** The saved evaluations have been lost. */
export const Lost: Story = { beforeEach: () => seed('lost') };
/** An evaluation could not be read. */
export const ReadError: Story = { beforeEach: () => seed('error') };
/** Different evaluation rows cannot form a comparison. */
export const Incompatible: Story = { beforeEach: () => seed('incompatible') };
/** Long class labels remain available in tables. */
export const LongLabels: Story = { beforeEach: () => seed('long') };
/** The comparison in right-to-left layout. */
export const RTL: Story = {
	beforeEach: () => seed('ready'),
	render: () => html`<div dir="rtl"><app-results-view></app-results-view></div>`
};
