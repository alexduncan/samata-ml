import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, waitFor } from 'storybook/test';
import { irisCrossValidation } from '../../../tests/fixtures/results/evaluations';
import { $appState } from '../../stores/app.store';
import { $modelResults, currentResultIdentity } from '../../stores/model-results.store';
import { DEFAULT_ONE_SHOT_SETUP, INITIAL_APP_STATE, type ModelRecord } from '../../types/state';
import './app-results-view';

function seed(populated: boolean): () => void {
	const previous = { app: $appState.get(), results: $modelResults.get() };
	const models: ModelRecord[] = populated
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
		onboarding: { welcomeDismissed: true },
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
					status: 'ready',
					evaluation: irisCrossValidation(),
					error: ''
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
					'Compare models evaluated on the same rows and inspect trade-offs without an automatic winner.'
			}
		}
	},
	render: () => html`<app-results-view></app-results-view>`
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Two saved cross-validation evaluations. */
export const Populated: Story = {
	beforeEach: () => seed(true),
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
export const Blocked: Story = { beforeEach: () => seed(false) };
