import { LitElement, css, html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { ref } from 'lit/directives/ref.js';
import { repeat } from 'lit/directives/repeat.js';
import { StoreController } from '@nanostores/lit';
import { computed } from 'nanostores';
import { ContentLoadError, loadContentEntry } from '../../common/content/content-loader';
import {
	$leaveConfirmation,
	$route,
	getEffectiveModelNum,
	getEffectiveWorkflowRoute,
	getWorkflowEntryId,
	ownsWizardLeave,
	provisionalResultIdentity,
	provisionalRouteModel,
	promoteProvisionalResult,
	resolveWizardLeave,
	retireWizardOwner
} from '../../router/router';
import {
	$appState,
	modelSwatchAssignments,
	reopenSection,
	SECTION_ORDER,
	setFeatures,
	setHyperparameters,
	setTrainingLogOpen,
	setTrainingSetup,
	toggleFeature,
	type WizardStepSubmission
} from '../../stores/app.store';
import { params } from '@nanostores/i18n';
import { $format, i18n } from '../../i18n';
import {
	$datasetResources,
	loadDatasetResources,
	type DatasetResourcesState
} from '../../stores/dataset.store';
import { blockedReason } from '../../stores/predicates';
import { flushNow } from '../../stores/persister';
import {
	$trainingSession,
	getTrainingSession,
	type TrainingSession
} from '../../stores/training.store';
import { buttonStyles } from '../../styles/button.styles';
import { cardStyles } from '../../styles/card.styles';
import { chicletStyles } from '../../styles/chiclet.styles';
import { dialogStyles } from '../../styles/dialog.styles';
import { notificationStyles } from '../../styles/notification.styles';
import { tableStyles } from '../../styles/table.styles';
import { trainModelStyles } from '../../styles/train-model.styles';
import { headingFocusStyles } from '../../styles/heading-focus.styles';
import { helpLinkStyles } from '../../styles/help-link.styles';
import { modelSwatchStyles } from '../../styles/model-swatch.styles';
import type { ColumnStats } from '../../types/dataset';
import type { TrainingLogEntry, TrainingRunIdentity } from '../../types/model-result';
import {
	DEFAULT_ONE_SHOT_SETUP,
	FIXED_ONE_SHOT_TEST_RATIO,
	FIXED_TRAINING_RANDOM_STATE,
	MODEL_COLORS,
	type ColumnType,
	type ModelRecord,
	type ModelSectionId,
	type PersistedAppState,
	type ProvisionalModelIdentity,
	type TrainingProgress,
	type ValidationMethodology
} from '../../types/state';
import { buildFeatureRows, formatFeatureNote, type FeatureRow } from './feature-eligibility';
import {
	isClassifierId,
	modelsForTarget,
	savedModelName,
	SUPERVISED_MODELS,
	type ClassifierId,
	type ModelCatalogueEntry
} from './model-catalogue';
import type { ModelDescriptionStatus } from './app-model-description-dialog';
import './app-model-description-dialog';
import './app-model-card';
import './app-model-configuration';
import './app-training-setup';
import './app-training-progress';
import '../results/app-model-results';
import type { AppModelResults } from '../results/app-model-results';
import type { AppTrainingSetup, TrainingSetupLabels } from './app-training-setup';
import type {
	ConfigurationLabels,
	ModelConfigurationChangeDetail,
	ModelConfigurationContinueDetail
} from './app-model-configuration';
import type { ModelDocument } from '../../types/model-document';
import { getModelDocument } from './model-documents';
import {
	buildConfigurationLabels,
	CONFIGURE_MODEL_MESSAGES,
	CONFIGURE_MODEL_TEMPLATES,
	flatOptionMessages
} from './model-option-copy';
import { MULTICLASS_STRATEGY } from './model-presentation-policy';
import {
	computeTrainingSetupBounds,
	createCrossValidationSetup,
	formatTrainingSetupSummary,
	validateFoldCount,
	type TrainingSetupBounds
} from './training-setup';
import {
	$publicationPending,
	getTrainingService,
	type TrainingCommandFailure
} from './training/training-service';
import { sameTrainingRun } from './training/result-validation';
import { StickyHeaderController } from '../shell/sticky-header-controller';

const MODEL_ART: Readonly<Record<ClassifierId, string>> = {
	'bernoulli-nb': '/assets/bernoulli-naive-bayes.svg',
	'decision-tree-classifier': '/assets/decision-tree-classifier.svg',
	'gaussian-nb': '/assets/gaussian-naive-bayes.svg',
	'k-neighbors-classifier': '/assets/k-nearest-neighbours-classifier.svg',
	'logistic-regression': '/assets/logistic-regression.svg',
	'mlp-classifier': '/assets/mlp-classifier.svg',
	'multinomial-nb': '/assets/multinomial-naive-bayes.svg',
	'support-vector-classifier': '/assets/support-vector-classifier.svg'
};

const messages = i18n('app-model-builder-view', {
	logisticCardTitle: 'Logistic Regression',
	logisticCardDescription:
		'A classification tool used to predict a binary outcome by estimating the exact probability of an event happening. Highly reliable for clear-cut, two-option decisions.',
	noModelHeading: 'No classification model available',
	noModelText: 'This target is numeric. Regression will be added later.',
	noModelLink: 'Choose a categorical or boolean target',
	chooseHeading: '1. Choose Model',
	chosenHeading: params<{ name: string }>('1. {name}'),
	featuresHeading: '2. Select Features',
	featuresHelp: 'What are features?',
	oneFeatureHeading: '2. 1 Feature Selected',
	featuresSelectedHeading: params<{ count: string }>('2. {count} Features Selected'),
	reopenChoose: 'Edit Choose Model',
	reopenFeatures: 'Edit Select Features',
	wizardPending: 'This step was saved. Retry saving to continue.',
	wizardSaveFailed: 'This step could not be saved. Try again.',
	configureHeading: '3. Configure Model',
	configuredHeading: '3. Model Configured',
	helpLink: 'What do these settings mean?',
	edit: 'Edit',
	completed: 'Completed',
	reopenConfigure: 'Edit Configure Model',
	trainingSetupHeading: '4. Training Setup',
	trainingSetupHelp: 'What is this?',
	reopenTrainingSetup: 'Edit Training Setup',
	completedTrainingSetup: params<{ summary: string }>('4. {summary}'),
	oneShotHeading: 'One-Shot Training',
	crossValidationHeading: params<{ folds: string }>('{folds} Fold Cross-Validation'),
	selectedTrainingSetup: 'Selected training setup:',
	oneShotSummary: 'One-Shot (80% / 20%)',
	crossValidationSummary: params<{ folds: number }>('Cross-Validation ({folds} folds)'),
	trainingSetupNotConfigured: 'Not configured',
	trainingSetupLoading: 'Loading dataset metadata…',
	trainingSetupError: 'The dataset metadata could not be read.',
	trainingSetupMalformedStats: 'The class counts for this target could not be read.',
	trainingSetupTargetMissing: 'The current target is unavailable for training setup.',
	trainingSetupBlocked:
		'Training setup requires at least two classes with two labelled rows each.',
	trainingSetupChooseTarget: 'Choose a target',
	retryTrainingSetup: 'Retry',
	trainingSetupForm: 'Training Setup',
	strategyLabel: 'Training Strategy',
	strategyOneShot: 'One-Shot',
	strategyCrossValidation: 'Cross-Validation',
	oneShotDefinition: 'Train once on one part of the data and test on the part set aside.',
	crossValidationDefinition:
		'Divide the data into groups, then train and check a model several times, using a different group for the check each time.',
	learnMore: 'Learn more',
	oneShotNote: 'Requests an 80% training and 20% held-out test split.',
	foldsLabel: 'Cross-validation Folds',
	foldsExactValueLabel: 'Number of folds (exact value)',
	foldsHelp: 'Each fold is used once for validation. More folds take longer to train.',
	matrixCaption: 'Cross-validation training iterations',
	matrixRunHeader: 'Run',
	matrixTrainingCell: 'Training',
	matrixValidationCell: 'Validation',
	legendLabel: 'Fold partition legend',
	legendTraining: 'Training',
	legendValidation: 'Validation',
	foldSummary: params<Parameters<TrainingSetupLabels['foldSummary']>[0]>(
		'Each of the {folds} runs trains on {trainFolds} folds ({trainPercent}) and validates on 1 fold ({validationPercent}).'
	),
	foldErrorInvalidNumber: 'Enter a valid whole number.',
	foldErrorRange: params<{ min: number; max: number }>(
		'Enter a whole number between {min} and {max}.'
	),
	trainModel: 'Train Model',
	trainingHeading: '5. Train Model',
	trainingActiveHeading: '5. Training Model…',
	trainingStoppedHeading: '5. Training Stopped',
	trainingCompleteHeading: '5. Training Complete',
	resultsHeading: '6. Model Results',
	savedResultsHeading: params<{ name: string }>('{name} Results'),
	savedModelFallback: params<{ num: string }>('Model {num}'),
	trainingProgress: 'Training progress',
	waitingToTrain: 'Waiting to train',
	trainingPreparing: 'Preparing data',
	trainingQueued: 'Waiting for the training worker',
	trainingLoading: 'Loading training data',
	trainingInitialising: 'Initialising the model',
	trainingFitting: 'Fitting the model',
	trainingTransforming: 'Transforming training data',
	trainingTuning: 'Checking model settings',
	trainingEvaluating: 'Evaluating the model',
	trainingFinalising: 'Finishing training',
	trainingCrossValidation: 'Running cross-validation',
	trainingFoldStart: params<{ fold: string; folds: string }>('Starting fold {fold} of {folds}'),
	trainingFoldComplete: params<{ fold: string }>('Fold {fold} complete'),
	trainingRefitStart: 'Refitting the model on all eligible rows',
	trainingRefitComplete: 'Refit complete',
	trainingWorkerRetried: 'A training worker was restarted',
	trainingReducedPerformance: 'Training is using reduced-performance mode',
	trainingSaving: 'Saving results',
	trainingComplete: 'Training complete',
	trainingStopped: 'Training stopped',
	trainingCancelling: 'Cancelling training',
	trainingCancelled: 'Training was cancelled. You can start again.',
	trainingFailed: 'Training could not finish. Check your setup and try again.',
	trainingInterrupted: 'Training was interrupted. You can start again.',
	trainingPartitionRejected:
		'The training library rejected this setup. Try a different evaluation method or adjust the model settings.',
	trainingRuntimeUnavailable:
		'This page cannot start training. Open it in a browser tab that supports isolated training and try again.',
	trainingStorageUnavailable: 'Training progress could not be saved. Try again.',
	trainingBusy: 'Another operation is using this model or data. Try again when it finishes.',
	trainingRemote: 'Training in another tab',
	trainingPendingResult: 'The result is saved, but progress could not be saved. Retry saving.',
	trainingPendingStop: 'Training has stopped, but progress could not be saved. Retry saving.',
	trainingPendingStart:
		'The start was saved, but training did not begin. Retry saving before starting again.',
	trainingPendingResultsView:
		'The change is saved, but progress could not be saved. Retry saving.',
	trainingResultUnavailable: 'The saved result could not be read.',
	backToModels: 'Back to Models',
	leaveTitle: 'Leave this model?',
	leaveDescription: 'Leaving will discard this unfinished model and its settings.',
	stay: 'Stay',
	leave: 'Leave',
	leaveWorking: 'Leaving the model…',
	leavePending: 'The change is saved, but finishing is pending. Retry saving.',
	leaveBusy: 'This model is busy. Try again when training in the other tab has finished.',
	leaveError: 'The unfinished model could not be discarded. Try again.',
	trainingElapsed: params<{ seconds: string }>('Elapsed time {seconds}'),
	cancelTraining: 'Cancel Training',
	viewResults: 'View Results',
	retrySaving: 'Retry saving',
	...flatOptionMessages(),
	...CONFIGURE_MODEL_MESSAGES,
	reset: params<{ name: string }>(CONFIGURE_MODEL_TEMPLATES.reset),
	removeLayer: params<{ layer: number }>(CONFIGURE_MODEL_TEMPLATES.removeLayer),
	layerSize: params<{ layer: number }>(CONFIGURE_MODEL_TEMPLATES.layerSize),
	exactValue: params<{ name: string }>(CONFIGURE_MODEL_TEMPLATES.exactValue)
});

type TrainingSetupResource =
	| { kind: 'loading' | 'error' | 'target-missing' | 'malformed-stats' }
	| { kind: 'ready'; targetStats: ColumnStats; bounds: TrainingSetupBounds };

const TRAINING_SETUP_HELP_PATH = '/help/training-setup';

function selectTrainingSetupResource(
	appState: PersistedAppState,
	resources: DatasetResourcesState
): TrainingSetupResource {
	const datasetId = appState.dataset?.id;
	if (
		!datasetId ||
		resources.datasetId !== datasetId ||
		resources.status === 'idle' ||
		resources.status === 'loading'
	) {
		return { kind: 'loading' };
	}

	const metadata = resources.metadata;
	if (
		resources.status !== 'ready' ||
		!metadata ||
		metadata.id !== datasetId ||
		!Array.isArray(metadata.columns)
	) {
		return { kind: 'error' };
	}

	let targetStats: ColumnStats | null = null;
	for (const column of metadata.columns) {
		if (
			!column ||
			typeof column !== 'object' ||
			Array.isArray(column) ||
			typeof column.name !== 'string' ||
			typeof column.type !== 'string'
		) {
			return { kind: 'error' };
		}
		if (
			column.name === appState.target &&
			(column.type === 'categorical' || column.type === 'boolean')
		) {
			targetStats ??= column;
		}
	}
	if (!targetStats) return { kind: 'target-missing' };

	const bounds = computeTrainingSetupBounds(targetStats);
	return bounds.minClassCount === null
		? { kind: 'malformed-stats' }
		: { kind: 'ready', targetStats, bounds };
}

const $trainingSetupResource = computed(
	[$appState, $datasetResources],
	selectTrainingSetupResource
);

function getActiveStep(model: ModelRecord): number {
	if (model.status === 'training') return 5;
	if (model.status === 'trained') return model.completedSteps.includes('results') ? 6 : 5;
	const incomplete = SECTION_ORDER.slice(0, 3).findIndex(
		(step) => !model.completedSteps.includes(step)
	);
	return incomplete < 0 ? 4 : incomplete + 1;
}

function trainingSetupKey(appState: PersistedAppState, modelNum: number): string {
	return JSON.stringify([appState.dataset?.id, appState.target, modelNum]);
}

type WizardAdvance = {
	key: string;
	entryId: string | undefined;
	from: number;
	model: ModelRecord;
	focusOwner: Element | null;
	runId?: string;
	advancing?: boolean;
};

const completedStepIcon = html`<svg class="icon" aria-hidden="true"><use href="#check" /></svg>`;
const wizardIconSprite = html` <svg class="wizard-icons" aria-hidden="true" focusable="false">
	<symbol id="check" viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd">
		<path
			d="M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18m5.73 5.29a1 1 0 0 0-1.41 0L10 14.6l-2.31-2.32a1 1 0 1 0-1.42 1.42l3.02 3.02a1 1 0 0 0 1.42 0l7.02-7.03a1 1 0 0 0 0-1.41" />
	</symbol>
</svg>`;

function belongsToModel(
	identity: TrainingRunIdentity,
	appState: PersistedAppState,
	model: ModelRecord
): boolean {
	return (
		identity.datasetId === appState.dataset?.id &&
		identity.target === appState.target &&
		identity.modelNum === model.num &&
		identity.modelCreatedAt === model.createdAt
	);
}

function displaySession(
	sessions: ReadonlyMap<string, TrainingSession>,
	appState: PersistedAppState,
	model: ModelRecord
): TrainingSession | undefined {
	for (const session of sessions.values()) {
		if (!belongsToModel(session.identity, appState, model)) continue;
		if (model.status === 'draft') {
			if (session.status === 'pending' || session.status === 'cancelling') return session;
		} else if (session.identity.runId === model.resultRevision) {
			return session;
		}
	}
	return undefined;
}

/**
 * Connected root workflow view for Step 3: Model Builder (/models/:num).
 * Manages 6-step accordion sections, Choose Model (Logistic Regression card + text entries fallback),
 * and Select Features with confirmed reopening.
 * Follows specification/plans/step-3-train-models-overview-and-setup.md D1, D4, D5, D6, TODO-06, TODO-07.
 */
@customElement('app-model-builder-view')
export class AppModelBuilderView extends LitElement {
	static override readonly styles = [
		headingFocusStyles,
		dialogStyles,
		buttonStyles,
		cardStyles,
		chicletStyles,
		tableStyles,
		notificationStyles,
		trainModelStyles,
		helpLinkStyles,
		modelSwatchStyles,
		css`
			:host {
				display: block;
			}

			:host([hidden]) {
				display: none;
			}

			.page-body {
				margin: 0 2rem 2rem;
			}

			.page-header {
				position: sticky;
				z-index: 10;
				box-sizing: border-box;
				inset-block-start: 0;
				background-color: var(--stone-50);
				padding: 1.5rem 2rem;
				inline-size: 100%;

				@media (max-height: 30rem) {
					position: static;
				}

				> h1 {
					margin: 0;
					color: var(--stone-900);
					font-weight: 500;
					font-size: 1.5rem;
				}

				> .model-results {
					display: flex;
					align-items: center;
					gap: 0.875rem;
					overflow-wrap: anywhere;
				}

				> p {
					margin: 0.25rem 0 0;
					color: var(--stone-700);
					line-height: 1.5;
				}
			}

			a {
				color: var(--blue-700);
			}

			.train-step-panel[aria-labelledby='step-4-title'] a:focus-visible {
				outline: 2px solid var(--focus-ring);
				outline-offset: 2px;
			}

			code {
				font-family: var(--font-mono);
			}

			#features-form fieldset {
				margin: 0;
				border: 0;
				padding: 0;
			}

			/* Section Actions */
			.section-actions {
				display: flex;
				align-items: center;
				gap: 1rem;
				margin-block-start: 1.5rem;
			}

			.validation-hint {
				margin: 0;
				color: var(--stone-600);
				font-size: 0.875rem;
			}

			.completed-summary {
				padding: 0.5rem 0;
				color: var(--stone-800);
			}

			/* Models list in Section 1 */
			.cards-grid {
				display: grid;
				grid-template-columns: repeat(auto-fill, minmax(min(280px, 100%), 1fr));
				gap: 1.5rem;
				margin-block: 1rem 0;
				padding: 0;
				list-style: none;

				app-model-card {
					block-size: 100%;
				}
			}

			.no-model-notice {
				margin-block-start: 1.5rem;

				> h3 {
					margin: 0 0 0.5rem;
					font-size: 1rem;
				}

				> p {
					margin: 0 0 0.5rem;
					color: var(--stone-700);
				}
			}

			/* Features selection in Section 2 */
			.features-table-container {
				margin-block-start: 1rem;
				inline-size: 100%;
				overflow-x: auto;
			}

			.table-checkbox-col {
				inline-size: 3rem;
				text-align: center;
			}

			.notes-list {
				margin: 0;
				padding-inline-start: 1.25rem;
			}

			.reopen-btn {
				padding: 0.25rem 0.5rem;
				font-size: 0.875rem;
			}

			.pending-notice {
				margin: 0;
				color: var(--neutral-700);
				font-style: italic;
			}
			.stopped-actions {
				display: flex;
				flex-wrap: wrap;
				gap: 0.5rem;
			}
		`
	];

	private readonly stickyHeader = new StickyHeaderController(this);
	private readonly appStateController = new StoreController(this, $appState);
	private readonly resourcesController = new StoreController(this, $datasetResources);
	private readonly trainingSetupResource = new StoreController(this, $trainingSetupResource);
	private readonly trainingSessions = new StoreController(this, $trainingSession);
	private readonly publication = new StoreController(this, $publicationPending);
	private readonly departure = new StoreController(this, $leaveConfirmation);
	private readonly routeController = new StoreController(this, $route);
	private readonly translations = new StoreController(this, messages);

	/** Monotonically allocated sequential model number (e.g. 1 for /models/1). */
	@property({ type: Number, attribute: 'model-num' })
	accessor modelNum = 0;

	/** Last rendered provisional binding, retained until this wizard releases ownership. */
	private provisionalBinding: ProvisionalModelIdentity | undefined;
	/** A saved model opens its results directly on the corresponding numbered route. */
	private numberedRoute = false;

	// Description dialog state
	@state() private accessor dialogOpen = false;
	@state() private accessor dialogHeading = '';
	@state() private accessor dialogContent: DocumentFragment | null = null;
	@state() private accessor dialogFallback = '';
	@state() private accessor dialogStatus: ModelDescriptionStatus = 'loading';
	@state() private accessor activeDescribeModelId: string | null = null;

	// Reopening state
	private pendingReopenSection: ModelSectionId | null = null;
	@state() private accessor trainingNotice:
		| {
				key: string;
				code: TrainingCommandFailure['code'];
				pending?: TrainingCommandFailure['pending'];
		  }
		| undefined;
	@state() private accessor resultReadFailed = false;
	@state() private accessor verifiedProvisional = false;
	@state() private accessor showingResults = false;
	@state() private accessor retryingPublication = false;
	@state() private accessor retryingTraining = false;
	@state() private accessor leavingModel = false;
	@state() private accessor wizardAdvance: WizardAdvance | undefined;
	@state() private accessor wizardNotice:
		| { key: string; step: number; model: ModelRecord; operationId?: string }
		| undefined;
	private stepMotion: HTMLElement | undefined;
	@state() private accessor leaveFailure: TrainingCommandFailure | undefined;
	private openLeaveToken: number | undefined;

	private loadPromise: Promise<void> | null = null;
	private trainingSetupChild: { element: Element; key: string } | null = null;
	private contentAbortController = new AbortController();
	private checkedResultKey: string | null = null;
	private logWatermark: { runId: string; id: number } | null = null;
	private announcement = '';
	private activeAttempt: TrainingRunIdentity | null = null;
	private displayedRun:
		| { key: string; entryId: string | undefined; identity: TrainingRunIdentity }
		| undefined;
	private stoppedRecovery: { key: string; entryId: string | undefined } | undefined;
	private restoreSubmitFocus: TrainingRunIdentity | null = null;

	private get currentModel(): ModelRecord | undefined {
		if (this.provisionalBinding)
			return provisionalRouteModel(this.provisionalBinding, this.appStateController.value);
		return this.appStateController.value.models.find((m) => m.num === this.modelNum);
	}

	private get confirmDialogEl(): HTMLDialogElement | null {
		return this.renderRoot?.querySelector('dialog[data-confirm="reopen-section"]') ?? null;
	}

	private get leaveDialog(): HTMLDialogElement | null {
		return this.renderRoot?.querySelector('dialog[data-confirm="leave-new-model"]') ?? null;
	}

	private get leaveIntent() {
		const intent = this.departure.value;
		const binding = this.provisionalBinding;
		if (
			intent &&
			binding &&
			intent.binding.modelNum === binding.modelNum &&
			intent.binding.modelCreatedAt === binding.modelCreatedAt &&
			intent.binding.datasetId === binding.datasetId &&
			intent.binding.target === binding.target &&
			intent.binding.comparisonContextEpoch === binding.comparisonContextEpoch
		)
			return intent;
	}

	override willUpdate(_changed: PropertyValues<this>): void {
		const workflow = getEffectiveWorkflowRoute(this.routeController.value);
		const provisional = workflow.kind === 'workflow' ? workflow.provisional : undefined;
		this.provisionalBinding =
			provisional?.kind === 'bound' && provisional.identity.modelNum === this.modelNum
				? provisional.identity
				: undefined;
		this.numberedRoute = workflow.kind === 'workflow' && workflow.modelNum === this.modelNum;

		const appState = this.appStateController.value;
		const datasetId = appState.dataset?.id ?? null;

		if (datasetId) {
			const resources = this.resourcesController.value;
			if (resources.datasetId !== datasetId || resources.status === 'idle') {
				this.loadPromise = loadDatasetResources(datasetId);
			}
		}

		const model = this.currentModel;
		const session = model && displaySession(this.trainingSessions.value, appState, model);
		const key = model && this.trainingNoticeKey(model);
		const showingTraining = model?.status === 'training';
		this.rememberDisplayedRun(model, session, key);
		const advance = this.wizardAdvance;
		if (advance) {
			if (!this.ownsWizardAdvance(advance)) {
				this.clearStepMotion();
				this.wizardAdvance = undefined;
			} else if (this.routeController.value.kind === 'reserved' && this.stepMotion) {
				this.clearStepMotion();
			}
			if (
				this.wizardAdvance === advance &&
				advance.runId &&
				model?.resultRevision === advance.runId &&
				session &&
				['running', 'cancelling', 'saving', 'publication-pending', 'complete'].includes(
					session.status
				)
			) {
				void this.finishWizardAdvance(advance);
			}
		} else if (this.stepMotion && this.routeController.value.kind !== 'workflow')
			this.clearStepMotion();
		this.updateTrainingSubmitFocus(model, session, showingTraining);
		this.updateTrainingAnnouncement(session ?? (model && this.stoppedSession(model)));

		const resultKey =
			model?.status === 'trained' && model.resultRevision
				? JSON.stringify([key, model.resultRevision, this.provisionalBinding])
				: null;
		if (resultKey !== this.checkedResultKey) {
			this.checkedResultKey = resultKey;
			this.resultReadFailed = false;
			this.verifiedProvisional = false;
			if (this.provisionalBinding && model?.status === 'trained') {
				const expected = provisionalResultIdentity(this.provisionalBinding);
				if (!expected) this.resultReadFailed = true;
				else
					void getTrainingService()
						.loadCompletedResult(model.num, expected)
						.then((result) => {
							if (this.checkedResultKey !== resultKey || !this.isConnected) return;
							this.verifiedProvisional =
								result !== null && sameTrainingRun(expected, result);
							this.resultReadFailed = !this.verifiedProvisional;
						});
			} else if (
				!this.numberedRoute &&
				model?.status === 'trained' &&
				session?.status !== 'complete'
			) {
				void getTrainingService()
					.loadCompletedResult(model.num)
					.then((result) => {
						if (this.checkedResultKey === resultKey)
							this.resultReadFailed = result === null;
					});
			}
		}
	}

	private updateTrainingSubmitFocus(
		model: ModelRecord | undefined,
		session: TrainingSession | undefined,
		showingTraining: boolean
	): void {
		const activeAttempt = this.activeAttempt;
		this.activeAttempt = showingTraining ? (session?.identity ?? null) : null;
		if (
			!model ||
			showingTraining ||
			model.status !== 'draft' ||
			getActiveStep(model) !== 4 ||
			model.completedSteps.includes('configure-training') ||
			!this.isCurrentTrainingRoute(this.trainingNoticeKey(model))
		) {
			this.restoreSubmitFocus = null;
			return;
		}

		const appState = this.appStateController.value;
		if (this.restoreSubmitFocus && !belongsToModel(this.restoreSubmitFocus, appState, model)) {
			this.restoreSubmitFocus = null;
		}
		if (
			activeAttempt &&
			belongsToModel(activeAttempt, appState, model) &&
			this.shadowRoot?.activeElement?.closest('[data-testid="training-step"]')
		) {
			this.restoreSubmitFocus = activeAttempt;
		}
	}

	private rememberDisplayedRun(
		model: ModelRecord | undefined,
		session: TrainingSession | undefined,
		key: string | undefined
	): void {
		const route = this.routeController.value;
		const entryId = getWorkflowEntryId();
		const owner = this.displayedRun ?? this.stoppedRecovery;
		if (
			!key ||
			(route.kind !== 'workflow' && route.kind !== 'reserved') ||
			getEffectiveModelNum(route) !== this.modelNum ||
			(owner && (owner.key !== key || owner.entryId !== entryId))
		) {
			this.displayedRun = undefined;
			this.stoppedRecovery = undefined;
			return;
		}
		if (model?.status === 'trained') {
			this.displayedRun = undefined;
			this.stoppedRecovery = undefined;
		} else if (model?.status === 'training' && session) {
			const owned = getTrainingService().activeIdentity(model.num);
			if (owned && sameTrainingRun(owned, session.identity)) {
				this.displayedRun = { key, entryId, identity: session.identity };
				this.stoppedRecovery = undefined;
			}
		}
	}

	private stoppedSession(model: ModelRecord): TrainingSession | undefined {
		const run = this.displayedRun;
		if (
			!run ||
			model.status !== 'draft' ||
			run.key !== this.trainingNoticeKey(model) ||
			(model.error?.code !== 'TRAINING_CANCELLED' && model.error?.code !== 'TRAINING_FAILED')
		)
			return;
		return getTrainingSession(run.identity);
	}

	override updated(changed: PropertyValues<this>): void {
		if (changed.has('modelNum') && changed.get('modelNum') !== undefined) {
			this.handleCancelReopen();
		}
		this.syncLeaveDialog();
		const model = this.currentModel;
		const intent = this.restoreSubmitFocus;
		const stopped = model && this.stoppedSession(model);
		if (
			intent &&
			stopped &&
			sameTrainingRun(intent, stopped.identity) &&
			(stopped.status === 'cancelled' || stopped.status === 'failed')
		) {
			const button = this.renderRoot.querySelector<HTMLButtonElement>('[data-stopped-retry]');
			if (button && !button.disabled) {
				button.focus({ preventScroll: true });
				this.restoreSubmitFocus = null;
			}
		}
	}

	override disconnectedCallback(): void {
		this.handleCancelReopen();
		if (this.provisionalBinding) retireWizardOwner(this.provisionalBinding);
		this.provisionalBinding = undefined;
		this.openLeaveToken = undefined;
		this.leaveDialog?.close();
		super.disconnectedCallback();
		this.activeAttempt = null;
		this.displayedRun = undefined;
		this.stoppedRecovery = undefined;
		this.restoreSubmitFocus = null;
		this.clearStepMotion();
		this.wizardAdvance = undefined;
		this.contentAbortController.abort();
	}

	/**
	 * Focuses this route's heading after rendering, unless cancelled or disconnected.
	 *
	 * @param signal - Cancels a superseded navigation's focus request.
	 */
	async focusHeading(signal: AbortSignal): Promise<void> {
		if (signal.aborted || !this.isConnected) return;
		await this.updateComplete;
		if (signal.aborted || !this.isConnected) return;
		this.renderRoot.querySelector<HTMLElement>('.page-header > h1')?.focus({
			preventScroll: true
		});
	}

	/**
	 * Waits for current metadata resources and render updates to settle.
	 */
	async whenSettled(): Promise<void> {
		await this.updateComplete;
		if (this.loadPromise) {
			try {
				await this.loadPromise;
			} catch {
				// Errors captured in store
			}
		} else if (this.resourcesController.value.status === 'loading') {
			await new Promise<void>((resolve) => {
				const unbind = $datasetResources.subscribe((res) => {
					if (res.status !== 'loading') {
						unbind();
						resolve();
					}
				});
			});
		}
		await this.updateComplete;
		await this.renderRoot.querySelector<AppModelResults>('app-model-results')?.whenSettled();
	}

	// ==========================================
	// Description Dialog Handlers
	// ==========================================

	private async openModelDescription(modelId: string, name: string): Promise<void> {
		this.activeDescribeModelId = modelId;
		this.dialogHeading = name;
		this.dialogOpen = true;
		this.dialogStatus = 'loading';
		this.dialogContent = null;

		const entry = SUPERVISED_MODELS.find((e) => e.id === modelId);
		this.dialogFallback = entry?.description ?? '';

		this.contentAbortController.abort();
		this.contentAbortController = new AbortController();

		try {
			const result = await loadContentEntry('models', modelId, {
				signal: this.contentAbortController.signal
			});
			if (this.activeDescribeModelId === modelId) {
				this.dialogContent = result.content;
				this.dialogStatus = 'ready';
			}
		} catch (err) {
			if (this.contentAbortController.signal.aborted) return;
			if (this.activeDescribeModelId === modelId) {
				if (err instanceof ContentLoadError && err.code === 'NOT_FOUND') {
					this.dialogStatus = 'missing';
				} else {
					this.dialogStatus = 'error';
				}
			}
		}
	}

	private handleModelDescriptionOpen(e: CustomEvent<{ modelId: string; name: string }>): void {
		void this.openModelDescription(e.detail.modelId, e.detail.name);
	}

	private handleDescriptionClose(): void {
		this.dialogOpen = false;
	}

	private handleDescriptionRetry(): void {
		if (this.activeDescribeModelId && this.dialogHeading) {
			void this.openModelDescription(this.activeDescribeModelId, this.dialogHeading);
		}
	}

	// ==========================================
	// Section 1: Choose Model Handlers
	// ==========================================

	private handleModelSelect(e: CustomEvent<{ modelId: string; name: string }>): void {
		const resources = this.resourcesController.value;
		const appState = this.appStateController.value;
		if (!resources.metadata || resources.datasetId !== appState.dataset?.id || !appState.target)
			return;
		void this.saveWizardStep(1, {
			section: 'choose-model',
			modelId: e.detail.modelId,
			defaultFeatures: buildFeatureRows(
				resources.metadata,
				appState.target,
				resources.descriptor
			)
				.filter((r) => r.initiallySelected)
				.map((r) => r.name)
		});
	}

	// ==========================================
	// Section 2: Select Features Handlers
	// ==========================================

	private handleFeatureToggle(featureName: string): void {
		toggleFeature(this.modelNum, featureName);
	}

	private handleContinueSelectFeatures(): void {
		const model = this.currentModel;
		if (!model || model.features.length === 0) return;
		void this.saveWizardStep(2, { section: 'select-features' });
	}

	private beginWizardAdvance(from: number, model = this.currentModel): WizardAdvance | undefined {
		if (!model || this.wizardAdvance || this.stepMotion || getActiveStep(model) !== from)
			return;
		const key = this.trainingNoticeKey(model);
		if (!this.isCurrentTrainingRoute(key)) return;
		const advance = {
			key,
			entryId: getWorkflowEntryId(),
			from,
			model,
			focusOwner: this.shadowRoot?.activeElement ?? document.activeElement
		};
		this.wizardAdvance = advance;
		return advance;
	}

	private ownsWizardAdvance(advance: WizardAdvance): boolean {
		const route = this.routeController.value;
		const model = this.currentModel;
		return (
			this.isConnected &&
			(route.kind === 'workflow' || route.kind === 'reserved') &&
			getEffectiveModelNum(route) === this.modelNum &&
			getWorkflowEntryId() === advance.entryId &&
			Boolean(model && this.trainingNoticeKey(model) === advance.key)
		);
	}

	private async saveWizardStep(step: number, submission?: WizardStepSubmission): Promise<void> {
		const notice = this.wizardNotice;
		const operationId =
			notice?.step === step &&
			this.currentModel &&
			notice.key === this.trainingNoticeKey(this.currentModel)
				? notice.operationId
				: undefined;
		if (Boolean(submission) === Boolean(operationId)) return;
		const advance = this.beginWizardAdvance(
			step,
			operationId ? notice?.model : this.currentModel
		);
		if (!advance) return;
		const service = getTrainingService();
		const result = submission
			? await service.saveWizardStep(this.modelNum, submission)
			: await service.retryWizardStep(this.modelNum, operationId!);
		if (this.wizardAdvance !== advance) return;
		if (result.ok) {
			await this.finishWizardAdvance(advance);
		} else {
			this.wizardAdvance = undefined;
			if (this.ownsWizardAdvance(advance))
				this.wizardNotice = {
					key: advance.key,
					step,
					model: advance.model,
					operationId: result.operationId
				};
		}
	}

	private renderWizardNotice(model: ModelRecord, step: number): TemplateResult | typeof nothing {
		const notice = this.wizardNotice;
		if (notice?.step !== step || notice.key !== this.trainingNoticeKey(model)) return nothing;
		const t = this.translations.value;
		return html`<div class="notification notification-alert">
			<p class="notification-text" role="alert">
				${notice.operationId ? t.wizardPending : t.wizardSaveFailed}
			</p>
			${notice.operationId
				? html`<button
						type="button"
						class="btn"
						aria-disabled=${this.wizardAdvance ? 'true' : nothing}
						@click=${() => this.saveWizardStep(step)}>
						${t.retrySaving}
					</button>`
				: nothing}
		</div>`;
	}

	private clearStepMotion(): void {
		const content = this.stepMotion;
		if (!content) return;
		content.classList.remove('step-sizing', 'step-collapsed');
		content.style.removeProperty('block-size');
		content.inert = false;
		this.stepMotion = undefined;
	}

	private async animateStep(content: HTMLElement, opening: boolean): Promise<boolean> {
		const size = content.offsetHeight;
		if (size === 0) return true;
		this.stepMotion = content;
		content.inert = true;
		content.style.setProperty('block-size', opening ? '0px' : `${size}px`);
		content.classList.toggle('step-collapsed', opening);
		content.getBoundingClientRect();
		content.classList.add('step-sizing');
		content.classList.toggle('step-collapsed', !opening);
		content.style.setProperty('block-size', opening ? `${size}px` : '0px');
		await Promise.allSettled(content.getAnimations().map((item) => item.finished));
		if (this.stepMotion !== content) return false;
		if (opening) this.clearStepMotion();
		return true;
	}

	private async finishWizardAdvance(advance: WizardAdvance): Promise<void> {
		if (advance.advancing || this.wizardAdvance !== advance) return;
		advance.advancing = true;
		await this.updateComplete;
		if (this.wizardAdvance !== advance) return;
		const model = this.currentModel;
		const motion = matchMedia('(prefers-reduced-motion: no-preference)');
		const oldStep = this.renderRoot.querySelector('.step-active');
		const oldContent = oldStep?.querySelector<HTMLElement>('.train-step-content');
		let focusOwner = this.shadowRoot?.activeElement ?? document.activeElement;
		const ownsFocus =
			focusOwner === advance.focusOwner || Boolean(oldStep?.contains(focusOwner));
		if (
			model &&
			getActiveStep(model) > advance.from &&
			motion.matches &&
			oldContent &&
			this.isCurrentTrainingRoute(advance.key)
		) {
			if (ownsFocus) {
				oldStep?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
				focusOwner = this.shadowRoot?.activeElement ?? document.activeElement;
			}
			await this.animateStep(oldContent, false);
		}
		if (this.wizardAdvance !== advance) return;
		if (this.wizardNotice?.step === advance.from) this.wizardNotice = undefined;
		this.wizardAdvance = undefined;
		await this.updateComplete;
		this.clearStepMotion();
		if (
			!this.ownsWizardAdvance(advance) ||
			!this.isCurrentTrainingRoute(advance.key) ||
			this.wizardAdvance
		)
			return;
		const next = this.renderRoot.querySelector('.step-active');
		if (
			!next ||
			next === oldStep ||
			!this.currentModel ||
			getActiveStep(this.currentModel) <= advance.from
		)
			return;
		const content = next.querySelector<HTMLElement>('.train-step-content');
		if (motion.matches && content && !(await this.animateStep(content, true))) return;
		const focused = this.shadowRoot?.activeElement ?? document.activeElement;
		if (
			ownsFocus &&
			(focused === focusOwner || (!motion.matches && focused === document.body)) &&
			this.ownsWizardAdvance(advance) &&
			this.isCurrentTrainingRoute(advance.key) &&
			!this.wizardAdvance &&
			next.matches('.step-active')
		)
			next.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true });
	}

	// ==========================================
	// Reopening Flow
	// ==========================================

	private handleReopenClick(section: ModelSectionId): void {
		const model = this.currentModel;
		if (
			!model ||
			model.status !== 'draft' ||
			(this.wizardAdvance && !this.wizardAdvance.advancing) ||
			!this.isCurrentTrainingRoute(this.trainingNoticeKey(model))
		)
			return;
		this.clearStepMotion();
		this.wizardAdvance = undefined;

		// A confirmation is needed only when a section after this one is complete
		const completed = model.completedSteps;
		const hasDownstream = SECTION_ORDER.slice(SECTION_ORDER.indexOf(section) + 1).some(
			(later) => completed.includes(later)
		);

		if (hasDownstream) {
			this.pendingReopenSection = section;
			if (this.confirmDialogEl) {
				try {
					this.confirmDialogEl.showModal();
				} catch {
					this.confirmDialogEl.open = true;
				}
			}
		} else if (reopenSection(this.modelNum, section)) {
			this.displayedRun = undefined;
			this.stoppedRecovery = undefined;
		}
	}

	private handleConfirmReopen(): void {
		if (this.pendingReopenSection) {
			if (reopenSection(this.modelNum, this.pendingReopenSection)) {
				this.displayedRun = undefined;
				this.stoppedRecovery = undefined;
			}
			this.pendingReopenSection = null;
		}
		if (this.confirmDialogEl?.open) {
			this.confirmDialogEl.close();
			this.confirmDialogEl.returnValue = '';
		}
	}

	private handleCancelReopen(): void {
		this.pendingReopenSection = null;
		if (this.confirmDialogEl?.open) {
			this.confirmDialogEl.close();
			this.confirmDialogEl.returnValue = '';
		}
	}

	private handleNativeReopenClose(): void {
		const dialog = this.confirmDialogEl;
		if (dialog?.open) return;
		this.pendingReopenSection = null;
		if (dialog) dialog.returnValue = '';
		this.syncLeaveDialog();
	}

	private syncLeaveDialog(): void {
		const dialog = this.leaveDialog;
		const intent = this.leaveIntent;
		if (!dialog) return;
		if (dialog.open && this.openLeaveToken !== intent?.token) {
			this.openLeaveToken = undefined;
			dialog.close();
		}
		if (!intent || dialog.open || this.confirmDialogEl?.open || this.dialogOpen) return;
		this.leaveFailure = undefined;
		this.openLeaveToken = intent.token;
		dialog.returnValue = '';
		dialog.showModal();
		dialog.querySelector<HTMLElement>('[data-stay]')?.focus({ preventScroll: true });
	}

	private handleNativeLeaveClose(): void {
		const dialog = this.leaveDialog;
		if (!dialog || dialog.open) return;
		const token = this.openLeaveToken;
		this.openLeaveToken = undefined;
		dialog.returnValue = '';
		if (token !== undefined) resolveWizardLeave(token, false);
	}

	private handleLeaveCancel(event: Event): void {
		if (this.leavingModel || this.leaveFailure?.pending) {
			event.preventDefault();
			return;
		}
		this.stayWithModel();
	}

	private stayWithModel(): void {
		const token = this.openLeaveToken;
		this.openLeaveToken = undefined;
		if (token !== undefined) resolveWizardLeave(token, false);
	}

	private async discardAndLeave(): Promise<void> {
		const intent = this.leaveIntent;
		if (!intent || this.leavingModel || !ownsWizardLeave(intent.token)) return;
		const retry = Boolean(this.leaveFailure?.pending);
		this.leavingModel = true;
		this.leaveFailure = undefined;
		try {
			const result = await getTrainingService().abandonNewModel(intent.binding, retry);
			if (!ownsWizardLeave(intent.token)) return;
			if (!result.ok) {
				this.leaveFailure = result;
				return;
			}
			this.openLeaveToken = undefined;
			this.leaveDialog?.close('leave');
			resolveWizardLeave(intent.token, true);
		} finally {
			this.leavingModel = false;
		}
	}

	private renderLeaveDialog(): TemplateResult {
		const t = this.translations.value;
		const pending = this.leaveFailure?.pending;
		const busy = this.leavingModel || Boolean(pending);
		const message = pending
			? t.leavePending
			: this.leaveFailure?.code === 'busy' || this.leaveFailure?.code === 'remote-training'
				? t.leaveBusy
				: t.leaveError;
		return html` <dialog
			class="confirm-dialog"
			data-confirm="leave-new-model"
			aria-labelledby="leave-new-model-title"
			aria-describedby="leave-new-model-description"
			closedby=${busy ? 'none' : 'closerequest'}
			@cancel=${this.handleLeaveCancel}
			@close=${this.handleNativeLeaveClose}>
			<div class="confirm-header"><h2 id="leave-new-model-title">${t.leaveTitle}</h2></div>
			<div class="confirm-body">
				<p id="leave-new-model-description">${t.leaveDescription}</p>
				${this.leavingModel ? html`<p role="status">${t.leaveWorking}</p>` : nothing}
				${this.leaveFailure ? html`<p role="alert">${message}</p>` : nothing}
			</div>
			<form method="dialog" class="confirm-footer" @submit=${this.stayWithModel}>
				<button class="btn" type="submit" value="stay" data-stay ?disabled=${busy}>
					${t.stay}
				</button>
				<button
					class="btn btn-primary"
					type="button"
					?disabled=${this.leavingModel}
					@click=${this.discardAndLeave}>
					${pending ? t.retrySaving : t.leave}
				</button>
			</form>
		</dialog>`;
	}

	// ==========================================
	// Render Sections
	// ==========================================

	private renderChooseModelSection(
		model: ModelRecord,
		isActive: boolean,
		isCompleted: boolean
	): TemplateResult {
		const appState = this.appStateController.value;
		const resources = this.resourcesController.value;

		// Determine target column type
		let targetType: ColumnType = 'categorical';
		if (appState.target && resources.metadata) {
			const targetCol = resources.metadata.columns.find((c) => c.name === appState.target);
			if (targetCol) {
				targetType = targetCol.type;
			}
		}

		const availableModels = modelsForTarget(targetType);
		const t = this.translations.value;

		let selectedModelName = '';
		if (model.modelId) {
			const entry = SUPERVISED_MODELS.find((e) => e.id === model.modelId);
			selectedModelName = entry ? entry.name : model.modelId;
		}

		return html`
			<li
				class="train-step ${isActive ? 'step-active' : ''} ${!isActive && !isCompleted
					? 'train-step-pending'
					: ''}"
				aria-current=${isActive ? 'step' : nothing}>
				<section class="train-step-panel" aria-labelledby="step-1-title">
					<header class="train-step-header">
						<h2 id="step-1-title" tabindex=${availableModels.length ? '-1' : nothing}>
							${isCompleted && selectedModelName
								? t.chosenHeading({ name: selectedModelName })
								: t.chooseHeading}
						</h2>
						${isCompleted
							? html`
									<span class="train-step-action train-step-status">
										${model.status === 'draft'
											? html`<button
													type="button"
													class="btn reopen-btn"
													aria-label=${t.reopenChoose}
													@click=${() =>
														this.handleReopenClick('choose-model')}>
													${t.edit}
												</button>`
											: nothing}
										<span class="visually-hidden">${t.completed}</span>
										${completedStepIcon}
									</span>
								`
							: nothing}
					</header>

					<div class="train-step-content" ?hidden=${!isActive}>
						${isCompleted && !isActive
							? html`
									<div class="completed-summary">
										<p>Selected model: <strong>${selectedModelName}</strong></p>
									</div>
								`
							: html`
									<p>
										Choose which machine learning model to train on your
										dataset.
									</p>

									${availableModels.length === 0
										? html`
												<div class="no-model-notice">
													<h3>
														${this.translations.value.noModelHeading}
													</h3>
													<p>${this.translations.value.noModelText}</p>
													<a href="/target"
														>${this.translations.value.noModelLink}</a
													>
												</div>
											`
										: nothing}
									${availableModels.length &&
									resources.status === 'ready' &&
									resources.metadata
										? html`
												<ul class="cards-grid" role="list">
													${repeat(
														availableModels,
														(entry) => entry.id,
														(entry) => {
															const isLogistic =
																entry.id === 'logistic-regression';
															return html`
																<li>
																	<app-model-card
																		model-id=${entry.id}
																		type=${entry.taskType}
																		.name=${isLogistic
																			? t.logisticCardTitle
																			: entry.name}
																		.description=${isLogistic
																			? t.logisticCardDescription
																			: entry.description}
																		.selected=${model.modelId ===
																		entry.id}
																		@app-model-description-open=${this
																			.handleModelDescriptionOpen}
																		@app-model-select=${this
																			.handleModelSelect}>
																		<img
																			slot="image"
																			src=${MODEL_ART[
																				entry.id
																			]}
																			alt=""
																			width="360"
																			height="216" />
																	</app-model-card>
																</li>
															`;
														}
													)}
												</ul>
											`
										: availableModels.length
											? html`
													${resources.status === 'error'
														? html` <p role="alert">
																	${t.trainingSetupError}
																</p>
																<button
																	type="button"
																	class="btn"
																	@click=${this
																		.handleTrainingSetupRetry}>
																	${t.retryTrainingSetup}
																</button>`
														: html`<p role="status">
																${t.trainingSetupLoading}
															</p>`}
												`
											: nothing}
									${this.renderWizardNotice(model, 1)}
								`}
					</div>
				</section>
			</li>
		`;
	}

	private renderSelectFeaturesSection(
		model: ModelRecord,
		isActive: boolean,
		isCompleted: boolean
	): TemplateResult {
		const appState = this.appStateController.value;
		const resources = this.resourcesController.value;
		const metadata = resources.metadata;
		const dataset = appState.dataset;
		const t = this.translations.value;
		if (!isActive && !isCompleted)
			return this.renderPendingSection(
				t.featuresHeading,
				'step-2-title',
				'select-features',
				0,
				2
			);

		let featureRows: FeatureRow[] = [];
		if (metadata && appState.target) {
			featureRows = buildFeatureRows(metadata, appState.target, resources.descriptor);
		}

		return html`
			<li
				class="train-step ${isActive ? 'step-active' : ''} ${!isActive && !isCompleted
					? 'train-step-pending'
					: ''}"
				aria-current=${isActive ? 'step' : nothing}>
				<section class="train-step-panel" aria-labelledby="step-2-title">
					<header class="train-step-header">
						<h2 id="step-2-title" tabindex="-1">
							${!isCompleted
								? t.featuresHeading
								: model.features.length === 1
									? t.oneFeatureHeading
									: t.featuresSelectedHeading({
											count: $format.get().number(model.features.length)
										})}
							${isActive
								? html`<a href="/help/select-features" class="help-link"
										>${t.featuresHelp}</a
									>`
								: nothing}
						</h2>
						${isCompleted
							? html`
									<span class="train-step-action train-step-status">
										${model.status === 'draft'
											? html`<button
													type="button"
													class="btn reopen-btn"
													aria-label=${t.reopenFeatures}
													@click=${() =>
														this.handleReopenClick('select-features')}>
													${t.edit}
												</button>`
											: nothing}
										<span class="visually-hidden">${t.completed}</span>
										${completedStepIcon}
									</span>
								`
							: nothing}
					</header>

					<div class="train-step-content" ?hidden=${!isActive}>
						${isCompleted && !isActive
							? html`
									<div class="completed-summary">
										<p>
											Selected features (${model.features.length}):
											<strong>${model.features.join(', ')}</strong>
										</p>
									</div>
								`
							: html`
									<form
										id="features-form"
										@submit=${(e: Event) => e.preventDefault()}>
										<fieldset>
											<legend>Features to include in model training</legend>

											<div class="features-table-container">
												<table class="table">
													<caption>
														Features for ${dataset?.name ?? 'dataset'}
													</caption>
													<thead>
														<tr>
															<th
																scope="col"
																class="table-checkbox-col">
																Include
															</th>
															<th scope="col">Feature Name</th>
															<th scope="col">Type</th>
															<th scope="col">Notes</th>
														</tr>
													</thead>
													<tbody>
														${featureRows.map((row) => {
															const formattedType =
																row.type.charAt(0).toUpperCase() +
																row.type.slice(1);
															const isChecked =
																model.features.includes(row.name);

															const inputId = `feature-${row.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`;

															return html`
																<tr>
																	<td class="table-checkbox-col">
																		${row.isTarget
																			? html`<span
																					class="badge chiclet chiclet-teal"
																					>Target</span
																				>`
																			: html`
																					<input
																						type="checkbox"
																						id="${inputId}"
																						?disabled=${!row.eligible}
																						.checked=${isChecked}
																						aria-label="Include ${row.name}"
																						@change=${() =>
																							this.handleFeatureToggle(
																								row.name
																							)} />
																				`}
																	</td>
																	<th scope="row">
																		<label for="${inputId}">
																			${row.name}
																		</label>
																	</th>
																	<td>
																		<code
																			>${formattedType}</code
																		>
																	</td>
																	<td>
																		${row.reasonCodes.length > 0
																			? html`
																					<ul
																						class="notes-list">
																						${row.reasonCodes.map(
																							(
																								code
																							) =>
																								html`<li>
																									${formatFeatureNote(
																										code
																									)}
																								</li>`
																						)}
																					</ul>
																				`
																			: nothing}
																	</td>
																</tr>
															`;
														})}
													</tbody>
												</table>
											</div>

											<div class="section-actions">
												<button
													type="button"
													class="btn btn-primary"
													?disabled=${model.features.length === 0}
													@click=${this.handleContinueSelectFeatures}>
													Continue
												</button>
												${model.features.length === 0
													? html`<p class="validation-hint">
															Select at least one feature to continue.
														</p>`
													: nothing}
											</div>
										</fieldset>
									</form>
								`}
						${isActive ? this.renderWizardNotice(model, 2) : nothing}
					</div>
				</section>
			</li>
		`;
	}

	private labelsCache: {
		translations: unknown;
		modelId: string;
		labels: ConfigurationLabels;
	} | null = null;

	private configurationLabels(document: ModelDocument): ConfigurationLabels {
		const translations = this.translations.value;
		if (
			this.labelsCache &&
			this.labelsCache.translations === translations &&
			this.labelsCache.modelId === document.id
		) {
			return this.labelsCache.labels;
		}
		const labels = buildConfigurationLabels(
			{
				text: translations as unknown as Record<string, string>,
				reset: translations.reset,
				removeLayer: translations.removeLayer,
				layerSize: translations.layerSize,
				exactValue: translations.exactValue
			},
			document
		);
		this.labelsCache = { translations, modelId: document.id, labels };
		return labels;
	}

	/** Number of target classes: distinct categories, or 2 for a boolean target. */
	private targetClassCount(): number {
		const appState = this.appStateController.value;
		const metadata = this.resourcesController.value.metadata;
		const column = metadata?.columns.find((c) => c.name === appState.target);
		if (column?.type === 'boolean') return 2;
		if (column?.type === 'categorical') return column.distinctCount;
		return 0;
	}

	private handleConfigurationChange(event: CustomEvent<ModelConfigurationChangeDetail>): void {
		setHyperparameters(this.modelNum, event.detail.config);
	}

	private handleConfigurationContinue(
		event: CustomEvent<ModelConfigurationContinueDetail>
	): void {
		const model = this.currentModel;
		if (!model || !model.modelId || !isClassifierId(model.modelId)) return;
		void this.saveWizardStep(3, {
			section: 'configure-model',
			config: event.detail.config,
			strategy: this.targetClassCount() > 2 ? MULTICLASS_STRATEGY[model.modelId] : null
		});
	}

	private renderConfigureModelSection(
		model: ModelRecord,
		isActive: boolean,
		isCompleted: boolean
	): TemplateResult {
		const t = this.translations.value;
		const modelId = model.modelId;
		if ((!isActive && !isCompleted) || !modelId || !isClassifierId(modelId)) {
			return this.renderPendingSection(
				'3. Configure Model',
				'step-3-title',
				'configure-model',
				0,
				3
			);
		}
		const document = getModelDocument(modelId);
		const classCount = this.targetClassCount();
		return html`
			<li
				class="train-step ${isActive ? 'step-active' : ''}"
				aria-current=${isActive ? 'step' : nothing}>
				<section class="train-step-panel" aria-labelledby="step-3-title">
					<header class="train-step-header">
						<h2 id="step-3-title" tabindex="-1">
							${isCompleted ? t.configuredHeading : t.configureHeading}
							${isActive
								? html`<a href="/help/configure-model" class="help-link"
										>${t.helpLink}</a
									>`
								: nothing}
						</h2>
						${isCompleted
							? html`
									<span class="train-step-action train-step-status">
										${model.status === 'draft'
											? html`<button
													type="button"
													class="btn reopen-btn"
													aria-label=${t.reopenConfigure}
													@click=${() =>
														this.handleReopenClick('configure-model')}>
													${t.edit}
												</button>`
											: nothing}
										<span class="visually-hidden">${t.completed}</span>
										${completedStepIcon}
									</span>
								`
							: nothing}
					</header>
					<div class="train-step-content" ?hidden=${!isActive}>
						${isActive
							? html`<app-model-configuration
									.document=${document}
									.value=${model.hyperparameters}
									.context=${{
										rowCount:
											this.appStateController.value.dataset?.rowCount ?? 0,
										classCount
									}}
									.multiclass=${classCount > 2
										? MULTICLASS_STRATEGY[modelId]
										: null}
									.disabled=${model.status !== 'draft'}
									.labels=${this.configurationLabels(document)}
									@app-model-configuration-change=${this
										.handleConfigurationChange}
									@app-model-configuration-continue=${this
										.handleConfigurationContinue}>
								</app-model-configuration>`
							: nothing}
						${isActive ? this.renderWizardNotice(model, 3) : nothing}
					</div>
				</section>
			</li>
		`;
	}

	private trainingSetupLabels(): TrainingSetupLabels {
		const t = this.translations.value;
		return {
			formLabel: t.trainingSetupForm,
			strategyLabel: t.strategyLabel,
			strategyOneShot: t.strategyOneShot,
			strategyCrossValidation: t.strategyCrossValidation,
			oneShotDefinition: t.oneShotDefinition,
			crossValidationDefinition: t.crossValidationDefinition,
			strategyHelpLinkText: t.learnMore,
			strategyHelpHref: TRAINING_SETUP_HELP_PATH,
			oneShotNote: t.oneShotNote,
			foldsLabel: t.foldsLabel,
			foldsExactValueLabel: t.foldsExactValueLabel,
			foldsHelp: t.foldsHelp,
			matrixCaption: t.matrixCaption,
			matrixRunHeader: t.matrixRunHeader,
			matrixTrainingCell: t.matrixTrainingCell,
			matrixValidationCell: t.matrixValidationCell,
			legendLabel: t.legendLabel,
			legendTraining: t.legendTraining,
			legendValidation: t.legendValidation,
			foldSummary: t.foldSummary,
			formatPercent: (percent) =>
				$format.get().number(percent / 100, { style: 'percent', maximumFractionDigits: 1 }),
			foldErrorInvalidNumber: t.foldErrorInvalidNumber,
			foldErrorRange: (min, max) => t.foldErrorRange({ min, max }),
			submitButton: t.trainModel
		};
	}

	private currentTrainingSetupFromEvent(
		event: CustomEvent<{ readonly setup: unknown }>
	): ValidationMethodology | null {
		const route = $route.get();
		const child = this.trainingSetupChild;
		if (
			route.kind !== 'workflow' ||
			getEffectiveModelNum(route) !== this.modelNum ||
			!child?.element.isConnected ||
			child.element !== event.currentTarget
		)
			return null;

		const appState = $appState.get();
		const model = appState.models.find((entry) => entry.num === this.modelNum);
		if (
			!model ||
			model.status !== 'draft' ||
			getActiveStep(model) !== 4 ||
			child.key !== trainingSetupKey(appState, model.num)
		)
			return null;

		const resource = selectTrainingSetupResource(appState, $datasetResources.get());
		if (resource.kind !== 'ready' || resource.bounds.blocked) return null;

		const setup = event.detail?.setup;
		if (
			!setup ||
			typeof setup !== 'object' ||
			Array.isArray(setup) ||
			!('type' in setup) ||
			!('randomState' in setup) ||
			setup.randomState !== FIXED_TRAINING_RANDOM_STATE
		)
			return null;

		if (setup.type === 'one_shot') {
			return 'testRatio' in setup && setup.testRatio === FIXED_ONE_SHOT_TEST_RATIO
				? { ...DEFAULT_ONE_SHOT_SETUP }
				: null;
		}
		if (
			setup.type === 'nested_cv' &&
			'outerFolds' in setup &&
			'innerFolds' in setup &&
			typeof setup.outerFolds === 'number' &&
			setup.outerFolds === setup.innerFolds &&
			validateFoldCount(setup.outerFolds, resource.bounds.maxFolds) === null
		) {
			return createCrossValidationSetup(setup.outerFolds);
		}
		return null;
	}

	private handleTrainingSetupChange(event: CustomEvent<{ readonly setup: unknown }>): void {
		const setup = this.currentTrainingSetupFromEvent(event);
		if (setup) setTrainingSetup(this.modelNum, setup);
	}

	private trainingNoticeKey(model: ModelRecord): string {
		return JSON.stringify([
			trainingSetupKey(this.appStateController.value, model.num),
			model.createdAt,
			this.appStateController.value.comparisonContextEpoch
		]);
	}

	private isCurrentTrainingRoute(key: string): boolean {
		const route = $route.get();
		const model = this.currentModel;
		return (
			this.isConnected &&
			route.kind === 'workflow' &&
			getEffectiveModelNum(route) === this.modelNum &&
			Boolean(model && this.trainingNoticeKey(model) === key)
		);
	}

	private async focusTrainingHeading(key: string, step: 5 | 6): Promise<void> {
		await this.updateComplete;
		if (this.isCurrentTrainingRoute(key)) {
			this.renderRoot
				.querySelector<HTMLElement>(`.step-active #step-${step}-title`)
				?.focus({ preventScroll: true });
		}
	}

	private async handleTrainingSetupSubmit(
		event: CustomEvent<{ readonly setup: unknown }>
	): Promise<void> {
		const setup = this.currentTrainingSetupFromEvent(event);
		const model = this.currentModel;
		const service = getTrainingService();
		if (!setup || !model || service.activeIdentity(model.num)) return;
		const key = this.trainingNoticeKey(model);
		const blockedStart = this.publication.value;
		if (
			blockedStart?.kind === 'start' &&
			blockedStart.identity &&
			belongsToModel(blockedStart.identity, this.appStateController.value, model)
		)
			return;
		if (!setTrainingSetup(model.num, setup)) return;
		const advance = this.beginWizardAdvance(4);
		if (!advance) return;

		this.trainingNotice = undefined;
		const started = service.start(model.num);
		advance.runId = service.activeIdentity(model.num)?.runId;
		const result = await started;
		if (this.wizardAdvance === advance && !advance.advancing) this.wizardAdvance = undefined;
		if (!result.ok && this.ownsWizardAdvance(advance)) {
			this.trainingNotice = { key, code: result.code, pending: result.pending };
		}
	}

	private trainingFailureMessage(code: string | undefined): string {
		const t = this.translations.value;
		switch (code) {
			case 'environment-not-supported':
				return t.trainingRuntimeUnavailable;
			case 'cancelled':
			case 'TRAINING_CANCELLED':
				return t.trainingCancelled;
			case 'TRAINING_INTERRUPTED_BY_RELOAD':
				return t.trainingInterrupted;
			case 'invalid-request':
			case 'invalid-options':
			case 'invalid-dimensions':
			case 'numerical-failure':
				return t.trainingPartitionRejected;
			case 'saving-failed':
			case 'storage-unavailable':
				return t.trainingStorageUnavailable;
			case 'busy':
			case 'remote-training':
			case 'conflict':
				return t.trainingBusy;
			default:
				return t.trainingFailed;
		}
	}

	private trainingProgressMessage(code: string): string {
		const t = this.translations.value;
		switch (code) {
			case 'queued':
				return t.trainingQueued;
			case 'loading-data':
				return t.trainingLoading;
			case 'initializing':
				return t.trainingInitialising;
			case 'training':
			case 'fitting':
				return t.trainingFitting;
			case 'transforming':
				return t.trainingTransforming;
			case 'tuning':
				return t.trainingTuning;
			case 'evaluating':
				return t.trainingEvaluating;
			case 'finalizing':
				return t.trainingFinalising;
			case 'cross-validation':
				return t.trainingCrossValidation;
			case 'refitting':
				return t.trainingRefitStart;
			case 'saving':
				return t.trainingSaving;
			case 'completed':
				return t.trainingComplete;
			default:
				return t.trainingPreparing;
		}
	}

	private formatTrainingLogEntry(entry: TrainingLogEntry): string {
		const t = this.translations.value;
		const number = $format.get().number;
		const { message } = entry;
		switch (message.key) {
			case 'phase':
				return this.trainingProgressMessage(message.phase);
			case 'fold-start':
				return t.trainingFoldStart({
					fold: number(message.fold),
					folds: number(message.folds)
				});
			case 'fold-complete':
				return t.trainingFoldComplete({ fold: number(message.fold) });
			case 'warning':
				return message.code === 'worker-retried'
					? t.trainingWorkerRetried
					: t.trainingReducedPerformance;
			case 'refit-start':
				return t.trainingRefitStart;
			case 'refit-complete':
				return t.trainingRefitComplete;
			case 'cancelled':
				return t.trainingCancelled;
			case 'failed':
				return t.trainingFailed;
			default:
				return this.trainingProgressMessage(message.key);
		}
	}

	private updateTrainingAnnouncement(session: TrainingSession | undefined): void {
		const previous = this.logWatermark;
		const latest = session?.logEntries.at(-1);
		if (!session) {
			this.logWatermark = null;
			this.announcement = '';
		} else if (previous?.runId !== session.identity.runId) {
			this.logWatermark = { runId: session.identity.runId, id: latest?.id ?? 0 };
			this.announcement = '';
		} else if (latest && latest.id > previous.id) {
			this.logWatermark = { runId: session.identity.runId, id: latest.id };
			this.announcement = this.formatTrainingLogEntry(latest);
		}
	}

	private async handlePublicationRetry(
		model: ModelRecord,
		identity?: TrainingRunIdentity
	): Promise<void> {
		if (this.retryingPublication || !this.isCurrentTrainingRoute(this.trainingNoticeKey(model)))
			return;
		const key = this.trainingNoticeKey(model);
		this.retryingPublication = true;
		try {
			const resultIdentity =
				this.provisionalBinding && !identity && this.verifiedProvisional
					? provisionalResultIdentity(this.provisionalBinding)
					: null;
			const result = resultIdentity
				? await promoteProvisionalResult(resultIdentity, true)
				: await getTrainingService().retry(identity);
			if (!this.isCurrentTrainingRoute(key)) return;
			if (result.ok) {
				this.trainingNotice = undefined;
				const current = this.currentModel;
				if (current?.completedSteps.includes('results'))
					await this.focusTrainingHeading(key, 6);
			} else if ('missingSavedResult' in result) {
				this.resultReadFailed = true;
			} else {
				this.trainingNotice = { key, code: result.code, pending: result.pending };
			}
		} finally {
			this.retryingPublication = false;
		}
	}

	private async handleViewResults(model: ModelRecord, session: TrainingSession): Promise<void> {
		if (this.showingResults || !this.isCurrentTrainingRoute(this.trainingNoticeKey(model)))
			return;
		const key = this.trainingNoticeKey(model);
		this.showingResults = true;
		try {
			const result = this.provisionalBinding
				? await promoteProvisionalResult(session.identity)
				: await getTrainingService().viewResults(session.identity);
			if (!this.isCurrentTrainingRoute(key)) return;
			if (result.ok) {
				if (!this.provisionalBinding) await this.focusTrainingHeading(key, 6);
			} else if ('missingSavedResult' in result) this.resultReadFailed = true;
			else this.trainingNotice = { key, code: result.code, pending: result.pending };
		} finally {
			this.showingResults = false;
		}
	}

	private handleLogToggle(
		model: ModelRecord,
		event: CustomEvent<{ readonly open: boolean }>
	): void {
		if (
			this.isCurrentTrainingRoute(this.trainingNoticeKey(model)) &&
			setTrainingLogOpen(model.num, event.detail.open)
		) {
			flushNow();
		}
	}

	private renderTrainingNotice(
		model: ModelRecord,
		message: string,
		retry: boolean,
		identity?: TrainingRunIdentity
	): TemplateResult {
		return html`
			<div class="notification notification-alert">
				<p class="notification-text" role="alert">${message}</p>
				${retry
					? html` <button
							type="button"
							class="btn"
							?disabled=${this.retryingPublication}
							@click=${() => this.handlePublicationRetry(model, identity)}>
							${this.translations.value.retrySaving}
						</button>`
					: nothing}
			</div>
		`;
	}

	private renderStoppedNotice(model: ModelRecord): TemplateResult | typeof nothing {
		const pending = this.publication.value;
		if (
			pending?.kind === 'start' &&
			pending.identity &&
			belongsToModel(pending.identity, this.appStateController.value, model)
		) {
			return this.renderTrainingNotice(
				model,
				this.translations.value.trainingPendingStart,
				true,
				pending.identity
			);
		}
		const notice =
			this.trainingNotice?.key === this.trainingNoticeKey(model)
				? this.trainingNotice
				: undefined;
		const savedReason = model.error?.details ?? model.error?.code;
		const code = (notice?.pending ? savedReason : undefined) ?? notice?.code ?? savedReason;
		return code
			? this.renderTrainingNotice(model, this.trainingFailureMessage(code), false)
			: nothing;
	}

	private handleTrainingSetupRetry(): void {
		const datasetId = $appState.get().dataset?.id;
		if (datasetId) this.loadPromise = loadDatasetResources(datasetId);
	}

	private handleTrainingSetupReopen(): void {
		this.handleReopenClick('configure-training');
	}

	private handleCancelTraining(event: Event, identity: TrainingRunIdentity): void {
		const model = this.currentModel;
		const service = getTrainingService();
		const owned = model && service.activeIdentity(model.num);
		if (
			!model ||
			!owned ||
			!sameTrainingRun(owned, identity) ||
			!this.isCurrentTrainingRoute(this.trainingNoticeKey(model))
		)
			return;
		(event.currentTarget as HTMLButtonElement).focus({ preventScroll: true });
		void service.cancel(model.num);
	}

	private async retryStoppedTraining(model: ModelRecord): Promise<void> {
		const service = getTrainingService();
		const key = this.trainingNoticeKey(model);
		if (
			this.retryingTraining ||
			service.activeIdentity(model.num) ||
			!this.isCurrentTrainingRoute(key)
		)
			return;
		const recovery = { key, entryId: getWorkflowEntryId() };
		this.displayedRun = undefined;
		this.stoppedRecovery = recovery;
		this.trainingNotice = undefined;
		this.retryingTraining = true;
		try {
			const result = await service.start(model.num);
			if (!result.ok && this.stoppedRecovery === recovery)
				this.trainingNotice = { key, code: result.code, pending: result.pending };
		} finally {
			this.retryingTraining = false;
		}
	}

	private async editStoppedTraining(model: ModelRecord): Promise<void> {
		const key = this.trainingNoticeKey(model);
		if (this.retryingTraining || !this.isCurrentTrainingRoute(key)) return;
		this.displayedRun = undefined;
		this.stoppedRecovery = undefined;
		this.restoreSubmitFocus = null;
		this.requestUpdate();
		await this.updateComplete;
		if (this.isCurrentTrainingRoute(key))
			this.renderRoot
				.querySelector<HTMLElement>('.step-active #step-4-title')
				?.focus({ preventScroll: true });
	}

	private handleTrainingSetupFocus(event: FocusEvent): void {
		if ((event.currentTarget as AppTrainingSetup).restoreFocus) {
			this.restoreSubmitFocus = null;
		}
	}

	private renderTrainingSetupForm(model: ModelRecord): TemplateResult {
		const t = this.translations.value;
		const resource = this.trainingSetupResource.value;
		if (resource.kind === 'loading')
			return html`<p role="status">${t.trainingSetupLoading}</p>`;
		if (resource.kind === 'target-missing') {
			return html`<p>
				${t.trainingSetupTargetMissing} <a href="/target">${t.trainingSetupChooseTarget}</a>
			</p>`;
		}
		if (resource.kind !== 'ready') {
			return html`
				<p role="alert">
					${resource.kind === 'malformed-stats'
						? t.trainingSetupMalformedStats
						: t.trainingSetupError}
				</p>
				<button type="button" class="btn" @click=${this.handleTrainingSetupRetry}>
					${t.retryTrainingSetup}
				</button>
			`;
		}

		const key = trainingSetupKey(this.appStateController.value, model.num);
		const stopped = this.restoreSubmitFocus && getTrainingSession(this.restoreSubmitFocus);
		const restoreFocus =
			stopped?.status === 'failed' ||
			stopped?.status === 'cancelled' ||
			stopped?.status === 'stopped-pending' ||
			(stopped?.status === 'publication-pending' && this.publication.value?.kind === 'start');
		return html`
			${keyed(
				key,
				html`
					<app-training-setup
						${ref((element) => {
							if (element) this.trainingSetupChild = { element, key };
							else if (this.trainingSetupChild?.key === key)
								this.trainingSetupChild = null;
						})}
						.value=${model.trainingSetup}
						.restoreFocus=${restoreFocus}
						.maxFolds=${resource.bounds.maxFolds}
						.blockedReason=${resource.bounds.blocked ? t.trainingSetupBlocked : ''}
						.labels=${this.trainingSetupLabels()}
						@focusin=${this.handleTrainingSetupFocus}
						@app-training-setup-change=${this.handleTrainingSetupChange}
						@app-training-setup-submit=${this.handleTrainingSetupSubmit}>
					</app-training-setup>
				`
			)}
			${resource.bounds.blocked
				? html`<p><a href="/target">${t.trainingSetupChooseTarget}</a></p>`
				: nothing}
		`;
	}

	private renderTrainingSetupSection(
		model: ModelRecord,
		isActive: boolean,
		isCompleted: boolean
	): TemplateResult {
		const t = this.translations.value;
		if (!isActive && !isCompleted) {
			return this.renderPendingSection(
				t.trainingSetupHeading,
				'step-4-title',
				'configure-training',
				0,
				4
			);
		}

		const editable = model.status === 'draft';
		const showForm = isActive && editable && !isCompleted;
		const summary = model.trainingSetup
			? formatTrainingSetupSummary(model.trainingSetup, {
					oneShot: t.oneShotSummary,
					crossValidation: (folds) => t.crossValidationSummary({ folds })
				})
			: t.trainingSetupNotConfigured;
		const strategy =
			model.trainingSetup?.type === 'nested_cv'
				? t.crossValidationHeading({
						folds: $format.get().number(model.trainingSetup.outerFolds)
					})
				: t.oneShotHeading;
		return html`
			<li
				class="train-step ${isActive ? 'step-active' : ''}"
				aria-current=${isActive ? 'step' : nothing}>
				<section class="train-step-panel" aria-labelledby="step-4-title">
					<header class="train-step-header">
						<h2 id="step-4-title" tabindex="-1">
							${showForm
								? t.trainingSetupHeading
								: t.completedTrainingSetup({ summary: strategy })}
							${showForm
								? html`<a href=${TRAINING_SETUP_HELP_PATH} class="help-link"
										>${t.trainingSetupHelp}</a
									>`
								: nothing}
						</h2>
						${isCompleted
							? html`
									<span class="train-step-action train-step-status">
										${editable
											? html`
													<button
														type="button"
														class="btn reopen-btn"
														aria-label=${t.reopenTrainingSetup}
														@click=${this.handleTrainingSetupReopen}>
														${t.edit}
													</button>
												`
											: nothing}
										<span class="visually-hidden">${t.completed}</span>
										${completedStepIcon}
									</span>
								`
							: nothing}
					</header>
					<div class="train-step-content" ?hidden=${!showForm}>
						${showForm
							? html`${this.renderStoppedNotice(model)}${this.renderTrainingSetupForm(
									model
								)}`
							: html`
									<div class="completed-summary">
										<p>
											${t.selectedTrainingSetup} <strong>${summary}</strong>
										</p>
									</div>
								`}
					</div>
				</section>
			</li>
		`;
	}

	private renderTrainingSection(
		model: ModelRecord,
		isActive: boolean,
		session: TrainingSession | undefined,
		stopped = false
	): TemplateResult {
		const t = this.translations.value;
		if (!isActive && model.status !== 'trained') {
			return this.renderPendingSection(t.trainingHeading, 'step-5-title', 'training', 0, 5);
		}

		const complete =
			model.status === 'trained' &&
			session?.status === 'complete' &&
			(!this.provisionalBinding || this.verifiedProvisional);
		const viewed = !this.provisionalBinding && model.completedSteps.includes('results');
		const pending = this.publication.value;
		const pendingRun = pending?.identity && pending.identity.runId === session?.identity.runId;
		const pendingStart =
			stopped &&
			pending?.kind === 'start' &&
			pending.identity &&
			belongsToModel(pending.identity, this.appStateController.value, model)
				? pending.identity
				: undefined;
		const stoppedPending = session?.status === 'stopped-pending';
		const awaitingRun = session?.status === 'publication-pending' || stoppedPending;
		const acknowledgedStop = stopped && this.stoppedSession(model) !== undefined;
		const notice =
			!acknowledgedStop && this.trainingNotice?.key === this.trainingNoticeKey(model)
				? this.trainingNotice
				: undefined;
		const viewingPending = notice?.pending === 'recover' && pending?.kind === 'recover';
		const owner = Boolean(
			session &&
			getTrainingService().activeIdentity(model.num)?.runId === session.identity.runId
		);
		const cancelling = session?.status === 'cancelling';
		const cancelVisible = (owner && !complete && session?.status !== 'saving') || awaitingRun;
		const remote = !session && model.status === 'training';
		const entries = session?.logEntries ?? [];
		const rawProgress: TrainingProgress = session?.progress ?? {
			percent: null,
			stage: 'preparing',
			phase: null,
			statusMessage: 'preparing'
		};
		const latest = entries.at(-1);
		const status = stopped
			? t.trainingStopped
			: remote
				? t.trainingRemote
				: cancelling
					? t.trainingCancelling
					: complete
						? t.trainingComplete
						: awaitingRun || session?.status === 'saving'
							? t.trainingSaving
							: latest
								? this.formatTrainingLogEntry(latest)
								: this.trainingProgressMessage(rawProgress.statusMessage);
		const duration =
			complete && model.durationMs !== null
				? t.trainingElapsed({
						seconds: $format.get().number(model.durationMs / 1000, {
							style: 'unit',
							unit: 'second',
							maximumFractionDigits: 1
						})
					})
				: '';
		const percent = complete
			? 100
			: rawProgress.percent === null
				? null
				: Math.min(99, rawProgress.percent);
		const heading = complete
			? t.trainingCompleteHeading
			: stopped
				? t.trainingStoppedHeading
				: t.trainingActiveHeading;
		const stoppedReason = this.trainingFailureMessage(
			model.error?.details ?? model.error?.code
		);

		return html`
			<li
				class="train-step ${isActive ? 'step-active' : ''}"
				aria-current=${isActive ? 'step' : nothing}>
				<section
					class="train-step-panel"
					aria-labelledby="step-5-title"
					data-testid="training-step">
					<header class="train-step-header">
						<h2 id="step-5-title" tabindex="-1">${heading}</h2>
						<span class="train-step-action train-step-status">
							${cancelVisible && !stopped
								? html`<button
										type="button"
										class="btn"
										?disabled=${awaitingRun}
										aria-disabled=${cancelling ? 'true' : nothing}
										@click=${(event: Event) =>
											!cancelling &&
											session &&
											this.handleCancelTraining(event, session.identity)}>
										${t.cancelTraining}
									</button>`
								: nothing}
							${stopped
								? nothing
								: viewed
									? html` <span class="visually-hidden">${t.completed}</span
											>${completedStepIcon}`
									: html`<button
											type="button"
											class=${complete ? 'btn btn-primary' : 'btn'}
											?disabled=${!complete ||
											this.showingResults ||
											viewingPending}
											@click=${() =>
												session && this.handleViewResults(model, session)}>
											${t.viewResults}
										</button>`}
						</span>
					</header>
					<div class="train-step-content">
						<app-training-progress
							.progress=${{ ...rawProgress, percent, statusMessage: status }}
							.variant=${complete ? 'complete' : stopped ? 'stopped' : 'active'}
							.logEntries=${entries}
							.logOpen=${model.ui.trainingLogOpen ?? false}
							.announcement=${this.announcement}
							.durationText=${duration}
							.labels=${{
								progress: t.trainingProgress,
								waiting: t.waitingToTrain,
								formatEntry: (entry: TrainingLogEntry) =>
									this.formatTrainingLogEntry(entry)
							}}
							@app-training-log-toggle=${(
								event: CustomEvent<{ readonly open: boolean }>
							) => this.handleLogToggle(model, event)}>
						</app-training-progress>
						${stopped
							? html` ${pendingStart
										? this.renderTrainingNotice(
												model,
												t.trainingPendingStart,
												true,
												pendingStart
											)
										: notice
											? this.renderTrainingNotice(
													model,
													this.trainingFailureMessage(notice.code),
													false
												)
											: html`<p class="notification notification-alert">
													${stoppedReason}
												</p>`}
									<div class="section-actions stopped-actions">
										<button
											type="button"
											class="btn btn-primary"
											data-stopped-retry
											?disabled=${this.retryingTraining ||
											Boolean(pendingStart)}
											@click=${() => this.retryStoppedTraining(model)}>
											${t.trainModel}
										</button>
										<button
											type="button"
											class="btn"
											?disabled=${this.retryingTraining ||
											Boolean(pendingStart)}
											@click=${() => this.editStoppedTraining(model)}>
											${t.reopenTrainingSetup}
										</button>
									</div>`
							: stoppedPending || (awaitingRun && pendingRun)
								? this.renderTrainingNotice(
										model,
										stoppedPending
											? t.trainingPendingStop
											: t.trainingPendingResult,
										true,
										session?.identity
									)
								: viewingPending
									? this.renderTrainingNotice(
											model,
											t.trainingPendingResultsView,
											true
										)
									: this.resultReadFailed && !complete
										? this.renderTrainingNotice(
												model,
												t.trainingResultUnavailable,
												false
											)
										: notice && complete
											? this.renderTrainingNotice(
													model,
													this.trainingFailureMessage(notice.code),
													false
												)
											: nothing}
					</div>
				</section>
			</li>
		`;
	}

	/** Section 6: the shared results once the acknowledged trained model's results are shown. */
	private renderResultsSection(model: ModelRecord, activeStep: number): TemplateResult {
		const t = this.translations.value;
		if (
			this.provisionalBinding ||
			model.status !== 'trained' ||
			!model.completedSteps.includes('results')
		) {
			return this.renderPendingSection(
				t.resultsHeading,
				'step-6-title',
				'results',
				activeStep,
				6
			);
		}
		const isActive = activeStep === 6;
		return html`
			<li
				class="train-step ${isActive ? 'step-active' : ''}"
				aria-current=${isActive ? 'step' : nothing}>
				<section class="train-step-panel" aria-labelledby="step-6-title">
					<header class="train-step-header">
						<h2 id="step-6-title" tabindex="-1">${t.resultsHeading}</h2>
					</header>
					<div class="train-step-content" data-testid="results-step">
						<app-model-results model-num=${model.num}></app-model-results>
					</div>
				</section>
			</li>
		`;
	}

	private renderPendingSection(
		title: string,
		stepId: string,
		stepKey: ModelSectionId,
		activeStep: number,
		stepIndex: number
	): TemplateResult {
		const isActive = activeStep === stepIndex;

		return html`
			<li
				class="train-step ${isActive ? 'step-active' : ''} train-step-pending"
				aria-current=${isActive ? 'step' : nothing}>
				<section class="train-step-panel" aria-labelledby="${stepId}">
					<header class="train-step-header">
						<h2 id="${stepId}" tabindex=${stepKey === 'results' ? '-1' : nothing}>
							${title}
						</h2>
					</header>
					<div class="train-step-content" ?hidden=${!isActive}>
						<p class="pending-notice">Not available yet.</p>
					</div>
				</section>
			</li>
		`;
	}

	override render(): TemplateResult {
		const appState = this.appStateController.value;
		const model = this.currentModel;

		if (!model) {
			return html`
				<div class="page-header">
					<h1 tabindex="-1">Model Not Found</h1>
					<p class="description">The requested model could not be found.</p>
				</div>
				<section class="page-body" data-testid="model-not-found">
					<div class="notification notification-alert">
						<p class="notification-text">
							Model ${this.modelNum} does not exist.
							<a href="/models">Back to Models</a>
						</p>
					</div>
				</section>
				${this.renderLeaveDialog()}
			`;
		}

		const session = displaySession(this.trainingSessions.value, appState, model);
		if (this.numberedRoute && model.status === 'trained') {
			const t = this.translations.value;
			const num = $format.get().number(model.num);
			const name = savedModelName(model) ?? t.savedModelFallback({ num });
			const colour =
				modelSwatchAssignments(appState).colours.get(model.num) ?? MODEL_COLORS[0];
			return html`
				<header class="page-header">
					<h1 tabindex="-1" class="model-results">
						<span class="swatch swatch-large swatch-${colour}">${num}</span>
						<span class="step-model-name">${t.savedResultsHeading({ name })}</span>
					</h1>
				</header>
				<article class="page-body" data-testid="results-step">
					<app-model-results
						model-num=${model.num}
						.headingLevel=${2}></app-model-results>
				</article>
			`;
		}
		if (this.provisionalBinding && model.status === 'trained' && this.resultReadFailed) {
			const t = this.translations.value;
			const num = $format.get().number(model.num);
			return html`
				<header class="page-header">
					<h1 tabindex="-1">${t.savedModelFallback({ num })}</h1>
				</header>
				<section class="page-body" data-testid="provisional-route">
					<p class="notification notification-alert" role="status">
						${t.trainingResultUnavailable}
					</p>
					<a href="/models">${t.backToModels}</a>
				</section>
				${this.renderLeaveDialog()}
			`;
		}
		const pending =
			this.wizardNotice?.operationId &&
			this.wizardNotice.key === this.trainingNoticeKey(model)
				? this.wizardNotice
				: undefined;
		const wizard = this.wizardAdvance?.model ?? pending?.model ?? model;
		const stoppedSession = this.stoppedSession(model);
		const stopped =
			model.status === 'draft' &&
			(Boolean(stoppedSession) ||
				this.stoppedRecovery?.key === this.trainingNoticeKey(model));
		const activeStep =
			this.wizardAdvance?.from ??
			pending?.step ??
			(stopped || (this.provisionalBinding && model.status === 'trained')
				? 5
				: getActiveStep(model));
		const isStep1Completed = wizard.completedSteps.includes('choose-model');
		const isStep2Completed = wizard.completedSteps.includes('select-features');
		const isStep3Completed = wizard.completedSteps.includes('configure-model');
		const isStep4Completed = wizard.completedSteps.includes('configure-training');

		return html`
			<div class="page-header">
				<h1 tabindex="-1">Model ${model.num}</h1>
				<p class="description">
					Configure architecture and features for Model ${model.num}.
				</p>
			</div>

			<section class="page-body" data-testid="model-builder">
				${wizard.completedSteps.length > 0 ? wizardIconSprite : nothing}
				<ol class="train-model" aria-label="Model training steps">
					${this.renderChooseModelSection(wizard, activeStep === 1, isStep1Completed)}
					${this.renderSelectFeaturesSection(wizard, activeStep === 2, isStep2Completed)}
					${this.renderConfigureModelSection(wizard, activeStep === 3, isStep3Completed)}
					${this.renderTrainingSetupSection(wizard, activeStep === 4, isStep4Completed)}
					${this.renderTrainingSection(
						wizard,
						activeStep === 5,
						stoppedSession ?? session,
						stopped
					)}
					${this.renderResultsSection(wizard, activeStep)}
				</ol>
			</section>

			<!-- Embedded Description Dialog -->
			<app-model-description-dialog
				?open=${this.dialogOpen}
				.heading=${this.dialogHeading}
				.content=${this.dialogContent}
				.fallback=${this.dialogFallback}
				.status=${this.dialogStatus}
				.labels=${{
					close: 'Close',
					retry: 'Retry',
					status: 'Loading model description…'
				}}
				@app-model-description-close=${this.handleDescriptionClose}
				@app-model-description-retry=${this.handleDescriptionRetry}>
			</app-model-description-dialog>

			<!-- Reopen Confirmation Dialog -->
			<dialog
				class="confirm-dialog"
				data-confirm="reopen-section"
				aria-labelledby="confirm-reopen-title"
				@close=${this.handleNativeReopenClose}>
				<div class="confirm-header">
					<h2 id="confirm-reopen-title">Confirm Reopening Section</h2>
				</div>
				<div class="confirm-body">
					<p>
						Reopening this section will clear downstream completed steps. Your
						selections will be kept.
					</p>
					<p>Are you sure you want to edit this section?</p>
				</div>
				<div class="confirm-footer">
					<button type="button" class="btn" @click=${this.handleCancelReopen}>
						Cancel
					</button>
					<button
						type="button"
						class="btn btn-primary"
						@click=${this.handleConfirmReopen}>
						Edit Section
					</button>
				</div>
			</dialog>
			${this.renderLeaveDialog()}
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'app-model-builder-view': AppModelBuilderView;
	}
}
