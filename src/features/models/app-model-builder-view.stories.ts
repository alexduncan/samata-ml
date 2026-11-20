import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { $route } from '../../router/router';
import { $appState } from '../../stores/app.store';
import { $datasetResources, type ResourceStatus } from '../../stores/dataset.store';
import {
	DEFAULT_ONE_SHOT_SETUP,
	INITIAL_APP_STATE,
	type ModelRecord,
	type PersistedAppState
} from '../../types/state';
import type { DatasetMetadata } from '../../types/dataset';
import { featureA11yFindings } from '../../../tests/a11y-feature-findings';
import './app-model-builder-view';

const builderFindings = featureA11yFindings.filter(
	(f) => f.target[0]?.[0] === 'app-model-builder-view'
);

function model(overrides: Partial<ModelRecord>): ModelRecord {
	return {
		num: 1,
		createdAt: 1,
		status: 'draft',
		completedSteps: ['choose-model', 'select-features'],
		modelId: 'logistic-regression',
		features: ['petal length', 'petal width'],
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
		ui: {},
		...overrides
	};
}

function seed(targetType: 'categorical' | 'numeric', overrides: Partial<ModelRecord> = {}) {
	const target = targetType === 'categorical' ? 'class' : 'sepal length';
	const columns = [
		{ name: 'sepal length', type: 'numeric', missingCount: 0 },
		{ name: 'petal length', type: 'numeric', missingCount: 0 },
		{ name: 'petal width', type: 'numeric', missingCount: 0 },
		{ name: 'class', type: 'categorical', missingCount: 0 }
	] as const;
	const state: PersistedAppState = {
		...structuredClone(INITIAL_APP_STATE),
		onboarding: { welcomeDismissed: true },
		dataset: {
			id: 'iris',
			name: 'Iris',
			source: 'sample',
			rowCount: 150,
			columns: columns.map((c) => ({ ...c }))
		},
		target,
		models: [model(overrides)],
		nextModelNum: 2
	};
	$appState.set(state);
	$datasetResources.set({
		datasetId: 'iris',
		status: 'ready',
		descriptor: null,
		error: null,
		metadata: {
			id: 'iris',
			name: 'Iris',
			source: 'sample',
			sampleId: 'iris',
			rowCount: 150,
			byteLength: 1,
			createdAt: 1,
			delimiter: ',',
			paddedRowCount: 0,
			skippedRows: { count: 0, rowNumbers: [] },
			columns: columns.map((c) =>
				c.type === 'categorical'
					? {
							...c,
							distinctCount: 3,
							categoryCounts: { a: 50, b: 50, c: 50 }
						}
					: { ...c, count: 150, min: 0, max: 1, mean: 0, median: 0, integer: false }
			)
		} as unknown as DatasetMetadata
	});
}

function seedTraining(status: ResourceStatus = 'ready', completed = false) {
	const previous = {
		app: $appState.get(),
		resources: $datasetResources.get(),
		route: $route.get()
	};
	const completedSteps: ModelRecord['completedSteps'] = [
		'choose-model',
		'select-features',
		'configure-model'
	];
	if (completed) completedSteps.push('configure-training');
	seed('categorical', {
		completedSteps,
		trainingSetup: completed ? DEFAULT_ONE_SHOT_SETUP : null
	});
	$route.set({ kind: 'workflow', path: '/models/1', section: 3, modelNum: 1 });
	if (status !== 'ready') {
		$datasetResources.set({
			datasetId: 'iris',
			status,
			metadata: null,
			descriptor: null,
			error: null
		});
	}
	return () => {
		$appState.set(previous.app);
		$datasetResources.set(previous.resources);
		$route.set(previous.route);
	};
}

/** Connected model builder showing the configuration workflow. */
const meta = {
	title: 'Models/Model builder',
	component: 'app-model-builder-view',
	parameters: {
		layout: 'fullscreen',
		// Excludes every app-model-builder-view finding in tests/a11y-feature-findings.ts, all
		// tracked by the HUMAN.md contrast-repair item.
		a11y: {
			test: 'error',
			context: {
				exclude: builderFindings.map((f) => ({ fromShadowDom: f.target[0]! }))
			}
		},
		docs: {
			description: {
				component:
					'Do: let the builder persist valid edits. Complete Section 3 through Save & Continue and Section 4 through Train Model. Don’t render a configuration form until its model and dataset are ready.'
			}
		}
	},
	render: () => html`<app-model-builder-view model-num="1"></app-model-builder-view>`
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Section 3 active with the Logistic Regression form. */
export const ConfigureModel: Story = { beforeEach: () => seed('categorical') };
/** Sections 1 to 3 complete, so axe checks the Section 3 Edit button name. */
export const ConfigureModelComplete: Story = {
	beforeEach: () =>
		seed('categorical', {
			completedSteps: ['choose-model', 'select-features', 'configure-model']
		})
};
/** WML-P2-UI-8: Section 4 ready for an eligible target. */
export const ConfigureTraining: Story = {
	name: 'WML-P2-UI-8: ConfigureTraining',
	beforeEach: () => seedTraining()
};
/** WML-P2-UI-8: the completed setup and the pending training step. */
export const TrainingSetupCompleted: Story = {
	name: 'WML-P2-UI-8: TrainingSetupCompleted',
	beforeEach: () => seedTraining('ready', true)
};
/** WML-P2-UI-8: current metadata is loading. */
export const TrainingSetupLoading: Story = {
	name: 'WML-P2-UI-8: TrainingSetupLoading',
	beforeEach: () => seedTraining('loading')
};
/** WML-P2-UI-8: an unsuccessful read displays a Retry action. */
export const TrainingSetupRetry: Story = {
	name: 'WML-P2-UI-8: TrainingSetupRetry',
	beforeEach: () => seedTraining('error')
};
/** A numeric target has no classification model. */
export const NoClassifierNumericTarget: Story = {
	beforeEach: () => seed('numeric', { completedSteps: [], modelId: null, features: [] })
};
/** Section 3 beside a long saved value. */
export const LongLabel: Story = {
	beforeEach: () =>
		seed('categorical', {
			modelId: 'support-vector-classifier',
			hyperparameters: { mode: 'manual', values: { C: 123456.789 } }
		})
};
/** Right-to-left direction. */
export const RTL: Story = {
	beforeEach: () => {
		seed('categorical');
		document.documentElement.dir = 'rtl';
	}
};
