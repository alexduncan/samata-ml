import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { $appState } from '../../stores/app.store';
import { $datasetResources } from '../../stores/dataset.store';
import { INITIAL_APP_STATE, type ModelRecord, type PersistedAppState } from '../../types/state';
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

/** Connected model builder showing Section 3. */
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
					'Do: let the builder persist each valid edit and complete Section 3 only through Save & Continue. Don’t: render the configuration form for a model that has no classifier selected.'
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
