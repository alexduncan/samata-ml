import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, fn, userEvent, waitFor } from 'storybook/test';
import { $route } from '../../router/router';
import { $appState } from '../../stores/app.store';
import { $modelResults, currentResultIdentity } from '../../stores/model-results.store';
import { irisCrossValidation } from '../../../tests/fixtures/results/evaluations';
import { $datasetResources, type ResourceStatus } from '../../stores/dataset.store';
import {
	$trainingSession,
	appendTrainingLog,
	createTrainingSession,
	setTrainingSessionStatus
} from '../../stores/training.store';
import {
	DEFAULT_ONE_SHOT_SETUP,
	INITIAL_APP_STATE,
	type ModelRecord,
	type PersistedAppState
} from '../../types/state';
import type { DatasetMetadata } from '../../types/dataset';
import type { TrainingRunIdentity } from '../../types/model-result';
import { featureA11yFindings } from '../../../tests/a11y-feature-findings';
import {
	$publicationPending,
	createTrainingService,
	setTrainingServiceForTesting
} from './training/training-service';
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

function seed(
	targetType: 'categorical' | 'numeric' | 'boolean',
	overrides: Partial<ModelRecord> = {}
) {
	const target = targetType === 'numeric' ? 'sepal length' : 'class';
	const columns = [
		{ name: 'sepal length', type: 'numeric', missingCount: 0 },
		{ name: 'petal length', type: 'numeric', missingCount: 0 },
		{ name: 'petal width', type: 'numeric', missingCount: 0 },
		{
			name: 'class',
			type: targetType === 'boolean' ? 'boolean' : 'categorical',
			missingCount: 0
		}
	] as const;
	const state: PersistedAppState = {
		...structuredClone(INITIAL_APP_STATE),
		onboarding: { welcomeDismissed: true, betaTelemetryAccepted: false },
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
					: c.type === 'boolean'
						? { ...c, trueCount: 75, falseCount: 75, lexicon: ['true', 'false'] }
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
	beforeEach: () => seedTraining(),
	play: async ({ canvasElement }) => {
		const builder = canvasElement.querySelector('app-model-builder-view')!;
		await builder.updateComplete;
		const setup = builder.shadowRoot!.querySelector('app-training-setup')!;
		await setup.updateComplete;
		const root = setup.shadowRoot!;
		const description = root.getElementById('strategy-description')!;
		expect(description.textContent).toContain('Train once on one part of the data');
		await userEvent.selectOptions(root.querySelector('select')!, 'nested_cv');
		await builder.updateComplete;
		await setup.updateComplete;
		expect(description.textContent).toContain('Divide the data into groups');
		expect(description.textContent).not.toContain('80%');
	}
};
/** A saved draft from before training became available can reopen its setup. */
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

const identity: TrainingRunIdentity = {
	datasetId: 'iris',
	target: 'class',
	modelNum: 1,
	modelCreatedAt: 1,
	configurationKey: 'story-config',
	runId: 'story-run'
};

function seedRun(status: 'training' | 'trained', completed: boolean) {
	const restore = seedTraining('ready', true);
	const state = $appState.get();
	const previousSessions = $trainingSession.get();
	const previousPublication = $publicationPending.get();
	const record = state.models[0]!;
	$appState.set({
		...state,
		models: [
			{
				...record,
				status,
				resultRevision: identity.runId,
				durationMs: status === 'trained' ? 2100 : null,
				completedSteps: completed
					? [...record.completedSteps, 'training']
					: record.completedSteps
			}
		]
	});
	$trainingSession.set(new Map());
	createTrainingSession(identity);
	return () => {
		setTrainingServiceForTesting();
		$trainingSession.set(previousSessions);
		$publicationPending.set(previousPublication);
		restore();
	};
}

const runtimeUnavailable = fn(
	async () => ({ ok: false, code: 'environment-not-supported' }) as const
);

/** Start refusal stays in Section 4 with a localised reason and usable controls. */
export const RuntimeUnavailable: Story = {
	beforeEach: () => {
		const restore = seedTraining();
		runtimeUnavailable.mockClear();
		setTrainingServiceForTesting({ ...createTrainingService(), start: runtimeUnavailable });
		return () => {
			setTrainingServiceForTesting();
			restore();
		};
	},
	play: async ({ canvasElement }) => {
		const builder = canvasElement.querySelector('app-model-builder-view')!;
		await builder.updateComplete;
		const setup = builder.shadowRoot!.querySelector('app-training-setup')!;
		await setup.updateComplete;
		const submit = setup.shadowRoot!.querySelector<HTMLButtonElement>('button[type=submit]')!;
		submit.click();
		await waitFor(() => {
			expect(runtimeUnavailable).toHaveBeenCalledTimes(1);
			expect(builder.shadowRoot!.querySelector('[role=alert]')).toHaveTextContent(
				'This page cannot start training'
			);
		});
		expect(submit).toBeEnabled();
	}
};

const retryPublication = fn(async () => {
	const state = $appState.get();
	$appState.set({
		...state,
		models: state.models.map((entry) => ({
			...entry,
			status: 'trained',
			durationMs: 2100,
			completedSteps: [...entry.completedSteps, 'training']
		}))
	});
	setTrainingSessionStatus(identity, 'complete', appendTrainingLog([], { key: 'completed' }, 1));
	$publicationPending.set(null);
	return { ok: true, value: undefined } as const;
});

/** Committed result recovery retries saving through the service and enables View Results. */
export const ResultPublicationPending: Story = {
	beforeEach: () => {
		const restore = seedRun('training', false);
		setTrainingSessionStatus(identity, 'saving');
		setTrainingSessionStatus(identity, 'publication-pending');
		$publicationPending.set({ operationId: 'story-save', kind: 'finish', identity });
		retryPublication.mockClear();
		setTrainingServiceForTesting({ ...createTrainingService(), retry: retryPublication });
		return restore;
	},
	play: async ({ canvasElement }) => {
		const builder = canvasElement.querySelector('app-model-builder-view')!;
		await builder.updateComplete;
		const panel = builder.shadowRoot!.querySelector('[data-testid=training-step]')!;
		expect(panel.querySelector('[role=alert]')).toHaveTextContent('The result is saved');
		const viewResults = panel.querySelector<HTMLButtonElement>('header button:last-child')!;
		expect(viewResults).toBeDisabled();
		panel.querySelector<HTMLButtonElement>('.notification button')!.click();
		await waitFor(() => {
			expect(retryPublication).toHaveBeenCalledTimes(1);
			expect(viewResults).toBeEnabled();
		});
	}
};

/** A stopped run with an unsaved repair shows Retry saving on that model. */
export const StoppedRepairPending: Story = {
	beforeEach: () => {
		const restore = seedRun('training', false);
		setTrainingSessionStatus(identity, 'stopped-pending');
		$publicationPending.set(null);
		return restore;
	}
};

/** A completed result is available for acknowledgement, with history still inspectable. */
export const TrainingComplete: Story = {
	beforeEach: () => {
		const restore = seedRun('trained', true);
		setTrainingSessionStatus(
			identity,
			'complete',
			appendTrainingLog([], { key: 'completed' }, 1)
		);
		return restore;
	}
};
/** Section 6 shows the shared results of an acknowledged trained model. */
export const ModelResultsShown: Story = {
	beforeEach: () => {
		const restore = seedRun('trained', true);
		const state = $appState.get();
		const previous = $modelResults.get();
		const record = state.models[0]!;
		$appState.set({
			...state,
			models: [{ ...record, completedSteps: [...record.completedSteps, 'results'] }]
		});
		const identity = currentResultIdentity(1);
		if (identity) {
			$modelResults.set({
				1: { identity, status: 'ready', evaluation: irisCrossValidation(), error: '' }
			});
		}
		return () => {
			$modelResults.set(previous);
			restore();
		};
	},
	play: async ({ canvasElement }) => {
		const builder = canvasElement.querySelector('app-model-builder-view')!;
		await builder.whenSettled();
		const results = builder.shadowRoot!.querySelector('app-model-results')!;
		await waitFor(() =>
			expect(results.shadowRoot!.querySelector('app-results-summary')).not.toBeNull()
		);
	}
};
/** All illustrated classifiers are available for a categorical target. */
export const ChooseCategoricalModel: Story = {
	beforeEach: () => seed('categorical', { completedSteps: [], modelId: null, features: [] })
};
/** All illustrated classifiers are available for a Boolean target. */
export const ChooseBooleanModel: Story = {
	beforeEach: () => seed('boolean', { completedSteps: [], modelId: null, features: [] })
};
/** The current choice stays visible while Section 1 is active. */
export const ChooseModelSelected: Story = {
	beforeEach: () => seed('categorical', { completedSteps: [], features: [] })
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
