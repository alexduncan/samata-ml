import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, userEvent } from 'storybook/test';
import { $appState } from '../../stores/app.store';
import { $datasetResources } from '../../stores/dataset.store';
import { DEFAULT_ONE_SHOT_SETUP, INITIAL_APP_STATE, type ModelRecord } from '../../types/state';
import { featureA11yFindings } from '../../../tests/a11y-feature-findings';
import { createCrossValidationSetup } from './training-setup';
import {
	createTrainingService,
	setTrainingServiceForTesting,
	type TrainingCommandResult
} from './training/training-service';
import './app-models-view';

function seedModels() {
	const previousState = $appState.get();
	const previousResources = $datasetResources.get();
	const pending: ModelRecord = {
		num: 3,
		createdAt: 1,
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
		error: null,
		timings: null,
		durationMs: null,
		metrics: null,
		ui: {}
	};
	const configured: ModelRecord = {
		...pending,
		num: 1,
		completedSteps: [
			'choose-model',
			'select-features',
			'configure-model',
			'configure-training'
		],
		modelId: 'logistic-regression',
		trainingSetup: DEFAULT_ONE_SHOT_SETUP
	};
	$appState.set({
		...structuredClone(INITIAL_APP_STATE),
		dataset: {
			id: 'iris',
			name: 'Iris',
			source: 'sample',
			rowCount: 150,
			columns: [{ name: 'class', type: 'categorical', missingCount: 0 }]
		},
		target: 'class',
		models: [
			configured,
			{ ...configured, num: 2, trainingSetup: createCrossValidationSetup(7) },
			pending
		],
		nextModelNum: 4
	});
	$datasetResources.set({
		datasetId: 'iris',
		status: 'ready',
		metadata: {
			id: 'iris',
			name: 'Iris',
			source: 'sample',
			sampleId: 'iris',
			delimiter: ',',
			rowCount: 150,
			byteLength: 1,
			createdAt: 1,
			paddedRowCount: 0,
			skippedRows: { count: 0, rowNumbers: [] },
			columns: [
				{
					name: 'class',
					type: 'categorical',
					missingCount: 0,
					missingTokens: {},
					invalidCount: 0,
					invalidExamples: [],
					distinctCount: 3,
					categoryCounts: { setosa: 50, versicolor: 50, virginica: 50 }
				}
			]
		},
		descriptor: null,
		error: null
	});
	return () => {
		$appState.set(previousState);
		$datasetResources.set(previousResources);
	};
}

/** Model configuration and training setup summaries. */
const meta = {
	title: 'Models/Models overview',
	component: 'app-models-view',
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		a11y: {
			test: 'error',
			context: {
				exclude: featureA11yFindings
					.filter((finding) => finding.target[0]?.[0] === 'app-models-view')
					.map((finding) => ({ fromShadowDom: finding.target[0]! }))
			}
		},
		docs: {
			description: {
				component:
					'Do: show a summary for each completed training setup. Don’t display a draft selection as a completed setup.'
			}
		}
	},
	render: () => html`<app-models-view></app-models-view>`
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** WML-P2-UI-9: two completed setup strategies and one unconfigured model. */
export const TrainingSetupSummaries: Story = {
	name: 'WML-P2-UI-9: Training setup summaries',
	beforeEach: seedModels,
	play: async ({ canvasElement }) => {
		const models = canvasElement.querySelector('app-models-view')!;
		await models.updateComplete;
		const cells = models.shadowRoot!.querySelectorAll('tbody td:nth-child(4)');
		expect([...cells].map((cell) => cell.textContent?.trim())).toEqual([
			'One-Shot (80% / 20%)',
			'Cross-Validation (7 folds)',
			'Not configured'
		]);
	}
};

/** The overview with a longer caption in right-to-left direction. */
export const RtlLongLabel: Story = {
	beforeEach: () => {
		const restore = seedModels();
		const direction = document.documentElement.dir;
		const state = $appState.get();
		document.documentElement.dir = 'rtl';
		$appState.set({
			...state,
			dataset: {
				...state.dataset!,
				name: 'Iris Flower Species Measurements from Three Varieties'
			}
		});
		return () => {
			document.documentElement.dir = direction;
			restore();
		};
	}
};

function createStoryFixture(createModel: () => Promise<TrainingCommandResult<number>>) {
	const restore = seedModels();
	setTrainingServiceForTesting({ ...createTrainingService(), createModel });
	return () => {
		setTrainingServiceForTesting();
		restore();
	};
}

/** A pending model allocation keeps navigation idle. */
export const PendingCreation: Story = {
	beforeEach: () => {
		let settle!: (result: TrainingCommandResult<number>) => void;
		const pending = new Promise<TrainingCommandResult<number>>((resolve) => {
			settle = resolve;
		});
		const restore = createStoryFixture(() => pending);
		return () => {
			settle({ ok: false, code: 'cancelled' });
			restore();
		};
	},
	play: async ({ canvasElement }) => {
		const models = canvasElement.querySelector('app-models-view')!;
		await models.updateComplete;
		const button = models.shadowRoot!.querySelector<HTMLButtonElement>(
			'.header-actions button.btn-primary'
		)!;
		await userEvent.click(button);
		await expect(button).toHaveTextContent('Saving…');
		await expect(button).toBeDisabled();
	}
};

/** A failed model allocation stays on the overview and offers another attempt. */
export const FailedCreation: Story = {
	beforeEach: () => createStoryFixture(async () => ({ ok: false, code: 'storage-unavailable' })),
	play: async ({ canvasElement }) => {
		const models = canvasElement.querySelector('app-models-view')!;
		await models.updateComplete;
		const button = models.shadowRoot!.querySelector<HTMLButtonElement>(
			'.header-actions button.btn-primary'
		)!;
		await userEvent.click(button);
		await models.updateComplete;
		await expect(models.shadowRoot!.querySelector('[role="alert"]')).toHaveTextContent(
			'The new model could not be saved.'
		);
		await expect(button).toBeEnabled();
	}
};
