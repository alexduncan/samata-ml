import { count, params } from '@nanostores/i18n';
import { StoreController } from '@nanostores/lit';
import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { customElement } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { $format, i18n } from '../../i18n';
import { $appState, setComparisonUi } from '../../stores/app.store';
import { $canCompare } from '../../stores/predicates';
import { comparisonOwner, ownedComparisonResults } from '../../stores/comparison-preferences';
import {
	$comparison,
	$ropeAnalysis,
	clearRopeAnalysis,
	loadComparisonResults,
	requestComparisonAnalysis,
	retryComparisonAnalysis,
	retryComparisonResults,
	selectComparisonGroup,
	selectComparisonModels
} from '../../stores/comparison.store';
import { pageHeaderStyles } from '../../styles/page-header.styles';
import { notificationStyles } from '../../styles/notification.styles';
import { buttonStyles } from '../../styles/button.styles';
import type { ComparisonColumn } from '../../types/state';
import type {
	ComparisonRowView,
	ComparisonColumnView,
	ComparisonSortChangeDetail
} from './app-comparison-table';
import type {
	ComparisonGroupChangeDetail,
	ComparisonSelectionChangeDetail,
	GroupOptionView
} from './app-comparison-controls';
import type { ModelPairChangeDetail } from './app-model-pair-picker';
import type { ConfusionDeltaFilterChangeDetail } from './app-confusion-delta';
import type { RopeWidthChangeDetail } from './app-rope-bar';
import {
	buildFoldStripView,
	createResultsFormatters,
	type FoldSeries,
	type BaselineMark
} from './results-view-model';
import './app-comparison-controls';
import './app-comparison-table';
import './app-model-pair-picker';
import './app-fold-strip';
import './app-class-error-bars';
import './app-confusion-delta';
import './app-rope-bar';
import './app-instance-agreement';

const messages = i18n('app-results-view', {
	title: 'Compare Results',
	description: 'Compare performance metrics across trained models.',
	blocked: 'Train at least two models to compare their results.',
	modelsLink: 'Go to Models',
	loading: 'Loading model results…',
	different: 'These models were evaluated on different rows and cannot be compared together.',
	legacy: 'This model was trained before detailed results were saved. Train it again to compare it.',
	lost: 'The saved results are no longer available. Train this model again.',
	error: 'The saved results could not be read.',
	retry: 'Retry',
	group: 'Evaluation group',
	models: 'Models to compare',
	limit: 'Select up to eight models.',
	groupCv: params<{ n: string }>(
		count({ one: 'Cross-validation: {n} model', many: 'Cross-validation: {n} models' })
	),
	groupShot: params<{ n: string }>(
		count({ one: 'One-Shot: {n} model', many: 'One-Shot: {n} models' })
	),
	groupSingle: params<{ group: string }>('{group} — another model is needed'),
	groupInconsistent: params<{ group: string }>(
		'{group} — stored evaluation data is inconsistent'
	),
	model: params<{ n: string }>('Model {n}'),
	needSelection: 'Select at least two models to compare.',
	table: 'Comparison of held-out results',
	modelColumn: 'Model',
	baseline: 'Baseline',
	unavailable: 'Unavailable',
	mostFrequent: 'Most frequent class',
	stratified: 'Random by class share',
	baselineMismatch:
		'A baseline is unavailable because its saved reports differ across these models.',
	balancedAccuracy: 'Balanced accuracy',
	macroF1: 'Macro-F1',
	mcc: 'MCC',
	accuracy: 'Accuracy',
	rocAuc: 'ROC-AUC',
	averagePrecision: 'Average precision',
	logLoss: 'Log loss (lower is better)',
	brier: 'Brier score (lower is better)',
	ece: 'ECE (lower is better)',
	gap: 'Train–test gap',
	sd: 'Standard deviation',
	iqr: 'Interquartile range',
	falsePositives: 'False positives (lower is better)',
	falseNegatives: 'False negatives (lower is better)',
	errors: 'Errors (lower is better)',
	fitDuration: 'Fit time',
	cvDuration: 'Fit + score across folds',
	showData: 'Show data table',
	foldTitle: 'Balanced accuracy across partitions',
	foldTakeaway: 'Each dot is a held-out partition; lines connect matching partitions.',
	foldTable: 'Held-out balanced accuracy by partition',
	series: 'Model',
	partition: params<{ n: string }>('Partition {n}'),
	score: 'Balanced accuracy',
	time: 'Time',
	mean: 'Mean',
	standardDeviation: 'Standard deviation',
	classTitle: 'Errors by class',
	classTakeaway: 'Compare the share of held-out rows misclassified in each class.',
	class: 'Class',
	errorRate: 'Error rate',
	modelA: 'Model A',
	modelB: 'Model B',
	swap: 'Swap models A and B',
	order: params<{ a: string; b: string }>('Model A is {a}; Model B is {b}.'),
	confusion: 'Confusion differences',
	filter: 'True class',
	allClasses: 'Default classes',
	trueClass: 'True class',
	predictedClass: 'Predicted class',
	correct: 'correct',
	noDifferences: 'No differences',
	difference: params<{ actual: string; predicted: string; value: string }>(
		'{actual} predicted as {predicted}: {value}.'
	),
	ropeTitle: 'Practical equivalence',
	ropeWidth: 'Equivalence width',
	ropeInvalid: 'Enter a value from 0.001 to 0.1 in steps of 0.001.',
	aHigher: 'A higher',
	equivalent: 'Practically equivalent',
	bHigher: 'B higher',
	ropeLoading: 'Analysing paired folds…',
	ropeUnavailable: 'At least two cross-validation folds are required.',
	ropeError: 'The comparison could not be analysed.',
	outcome: 'Outcome',
	probability: 'Probability',
	ropeTakeaway: params<{ a: string; b: string; width: string; folds: string }>(
		'{a} and {b} are compared over {folds} folds with a practical-equivalence width of {width}.'
	),
	agreementTitle: 'Instance agreement',
	agreementTakeaway: params<{ n: string }>(
		count({
			one: '{n} row was missed by every model.',
			many: '{n} rows were missed by every model.'
		})
	),
	correctModels: 'Correct models',
	rowCount: 'Rows',
	bucket: params<{ n: string }>(count({ one: '{n} model correct', many: '{n} models correct' })),
	noWinner: 'There is no automatic winner. Compare the measures and their trade-offs.'
});

type ComparisonData = ReturnType<typeof $comparison.get>;
interface Views {
	groups: GroupOptionView[];
	models: { num: number; label: string }[];
	rows: ComparisonRowView[];
	baselines: ComparisonRowView[];
	columns: ComparisonColumnView[];
	series: FoldSeries[];
	marks: BaselineMark[];
}

/** Connected comparison route. */
@customElement('app-results-view')
export class AppResultsView extends LitElement {
	static override styles = [
		pageHeaderStyles,
		notificationStyles,
		buttonStyles,
		css`
			:host {
				display: block;
			}
			:host([hidden]) {
				display: none;
			}
			section + section {
				margin-block-start: 1rem;
			}
			.rope-section {
				min-block-size: 18rem;
			}
		`
	];
	private readonly app = new StoreController(this, $appState);
	private readonly canCompare = new StoreController(this, $canCompare);
	private readonly comparison = new StoreController(this, $comparison);
	private readonly analysis = new StoreController(this, $ropeAnalysis);
	private readonly format = new StoreController(this, $format);
	private readonly text = new StoreController(this, messages);
	private views: Views = {
		groups: [],
		models: [],
		rows: [],
		baselines: [],
		columns: [],
		series: [],
		marks: []
	};
	private waiters = new Set<() => void>();
	private analysisKey = '';

	/** Focuses the route heading without waiting for results. */
	async focusHeading(signal: AbortSignal): Promise<void> {
		if (signal.aborted || !this.isConnected) return;
		await this.updateComplete;
		if (!signal.aborted && this.isConnected)
			this.renderRoot
				.querySelector<HTMLElement>('.page-header > h1')
				?.focus({ preventScroll: true });
	}

	/** Waits for the initial resources and currently visible chart renders. */
	async whenSettled(): Promise<void> {
		await this.updateComplete;
		if (!this.isConnected || !this.canCompare.value) return;
		const context = this.app.value;
		const runs = JSON.stringify(
			context.models.map((model) => [
				model.num,
				model.createdAt,
				model.resultRevision,
				model.status
			])
		);
		const superseded = () =>
			!this.isConnected ||
			this.app.value.dataset?.id !== context.dataset?.id ||
			this.app.value.target !== context.target ||
			this.app.value.comparisonContextEpoch !== context.comparisonContextEpoch ||
			JSON.stringify(
				this.app.value.models.map((model) => [
					model.num,
					model.createdAt,
					model.resultRevision,
					model.status
				])
			) !== runs;
		await new Promise<void>((resolve) => {
			const done = () => {
				this.waiters.delete(check);
				resolve();
			};
			const check = () => {
				if (
					superseded() ||
					(!this.comparison.value.unavailableModels.some(
						(item) => item.reason === 'loading'
					) &&
						(!this.comparison.value.pairA ||
							!this.comparison.value.pairB ||
							!['idle', 'loading'].includes(this.analysis.value.status)))
				)
					done();
			};
			this.waiters.add(check);
			check();
		});
		if (superseded()) return;
		await this.updateComplete;
		const charts = this.renderRoot.querySelectorAll<
			HTMLElement & { whenSettled(): Promise<void> }
		>('app-fold-strip, app-class-error-bars, app-rope-bar, app-instance-agreement');
		await Promise.all(Array.from(charts, (chart) => chart.whenSettled()));
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		clearRopeAnalysis();
		this.analysisKey = '';
		for (const check of [...this.waiters]) check();
	}

	override willUpdate(_changed: PropertyValues<this>): void {
		this.views = this.buildViews(this.comparison.value);
	}

	override updated(): void {
		if (this.canCompare.value) {
			void loadComparisonResults();
			const current = this.comparison.value;
			const owner = comparisonOwner(this.app.value);
			if (owner && current.activeGroup && this.app.value.results.ui.fingerprint === null)
				selectComparisonGroup(owner, current.activeGroup.fingerprint);
			const a = current.pairA,
				b = current.pairB;
			const key = JSON.stringify([
				a?.num,
				a?.evaluation.partitionFingerprint,
				this.app.value.models.find((model) => model.num === a?.num)?.resultRevision,
				b?.num,
				b?.evaluation.partitionFingerprint,
				this.app.value.models.find((model) => model.num === b?.num)?.resultRevision,
				this.app.value.results.ui.ropeWidth
			]);
			if (key !== this.analysisKey) {
				this.analysisKey = key;
				requestComparisonAnalysis();
			}
		} else if (this.analysisKey) {
			this.analysisKey = '';
			clearRopeAnalysis();
		}
		for (const check of [...this.waiters]) check();
	}

	private buildViews(data: ComparisonData): Views {
		const t = this.text.value,
			format = createResultsFormatters(this.format.value);
		const groups = data.groups.map((group) => {
			const n = group.models.length;
			const base =
				group.protocol === 'one_shot'
					? t.groupShot({ n: format.count(n) })(n)
					: t.groupCv({ n: format.count(n) })(n);
			const text =
				group.reason === 'single-model'
					? t.groupSingle({ group: base })
					: group.reason === 'inconsistent'
						? t.groupInconsistent({ group: base })
						: base;
			return {
				fingerprint: group.fingerprint,
				protocol: group.protocol,
				modelCount: n,
				disabled: group.disabled,
				reason: group.reason,
				text
			};
		});
		const name = (num: number) => t.model({ n: format.count(num) });
		const models = (data.activeGroup?.models ?? []).map((model) => ({
			num: model.num,
			label: name(model.num)
		}));
		const selected = (data.activeGroup?.models ?? []).filter((model) =>
			data.selected.includes(model.num)
		);
		const binary = selected[0]?.evaluation.classLabels.length === 2;
		const cv = selected[0]?.evaluation.protocol.kind === 'cross_validation';
		const ids: ComparisonColumn[] = [
			'balancedAccuracy',
			'macroF1',
			'mcc',
			'accuracy',
			'rocAuc',
			'averagePrecision',
			'logLoss',
			'brier',
			'ece',
			'gap',
			'sd',
			'iqr',
			...(binary ? (['falsePositives', 'falseNegatives'] as const) : []),
			'errors',
			'fitDuration'
		];
		const lower = new Set<ComparisonColumn>([
			'logLoss',
			'brier',
			'ece',
			'falsePositives',
			'falseNegatives',
			'errors'
		]);
		const columns = ids.map((id) => ({
			id,
			label: id === 'fitDuration' && cv ? t.cvDuration : t[id],
			lowerIsBetter: lower.has(id)
		}));
		const row = (source: (typeof data.tableRows)[number]): ComparisonRowView => ({
			...source,
			label:
				source.kind === 'baseline'
					? source.id === 'mostFrequent'
						? t.mostFrequent
						: t.stratified
					: name(Number(source.id)),
			metrics: Object.fromEntries(
				Object.entries(source.metrics).map(([key, cell]) => {
					const value = cell.value;
					const text =
						value === null
							? t.unavailable
							: key === 'fitDuration'
								? format.seconds(value)
								: ['falsePositives', 'falseNegatives', 'errors'].includes(key)
									? format.count(value)
									: [
												'mcc',
												'rocAuc',
												'averagePrecision',
												'logLoss',
												'brier',
												'ece'
										  ].includes(key)
										? format.decimal(value)
										: format.percent(value);
					return [key, { ...cell, text }];
				})
			)
		});
		const series: FoldSeries[] = [];
		let marks: BaselineMark[] = [];
		for (const model of selected) {
			const evaluation = {
				...model.evaluation,
				partitions: model.evaluation.partitions.toSorted((a, b) => a.index - b.index)
			};
			const fold = buildFoldStripView(
				evaluation,
				{ series: name(model.num), mostFrequent: t.mostFrequent, stratified: t.stratified },
				format
			);
			series.push({ ...fold.series[0]!, id: String(model.num) });
			if (marks.length === 0)
				marks = fold.baselines.filter(
					(mark) =>
						!data.baselines.mismatched.includes(
							mark.id === 'most-frequent' ? 'mostFrequent' : 'stratified'
						)
				);
		}
		return {
			groups,
			models,
			rows: data.tableRows.map(row),
			baselines: data.baselines.rows.map(row),
			columns,
			series,
			marks
		};
	}

	private groupChanged(event: CustomEvent<ComparisonGroupChangeDetail>): void {
		const owner = comparisonOwner(this.app.value);
		if (owner) selectComparisonGroup(owner, event.detail.fingerprint);
	}
	private selectionChanged(event: CustomEvent<ComparisonSelectionChangeDetail>): void {
		const owner = comparisonOwner(this.app.value);
		if (owner) selectComparisonModels(owner, event.detail.selected);
	}
	private sortChanged(event: CustomEvent<ComparisonSortChangeDetail>): void {
		const owner = comparisonOwner(this.app.value);
		if (owner) setComparisonUi(owner, { sort: event.detail.sort });
	}
	private pairChanged(event: CustomEvent<ModelPairChangeDetail>): void {
		const owner = comparisonOwner(this.app.value);
		if (owner) setComparisonUi(owner, event.detail);
	}
	private filterChanged(event: CustomEvent<ConfusionDeltaFilterChangeDetail>): void {
		const owner = comparisonOwner(this.app.value);
		if (owner) setComparisonUi(owner, event.detail);
	}
	private widthChanged(event: CustomEvent<RopeWidthChangeDetail>): void {
		const owner = comparisonOwner(this.app.value);
		if (owner) setComparisonUi(owner, event.detail);
	}
	private retryAnalysis(): void {
		retryComparisonAnalysis();
	}
	private retryModel(event: Event): void {
		void retryComparisonResults(Number((event.currentTarget as HTMLButtonElement).value));
	}

	override render() {
		const t = this.text.value,
			data = this.comparison.value,
			views = this.views;
		const format = createResultsFormatters(this.format.value),
			ui = ownedComparisonResults(this.app.value, this.app.value).ui;
		const a = data.pairA,
			b = data.pairB;
		const name = (num: number) => t.model({ n: format.count(num) });
		const signed = (value: number) =>
			this.format.value.number(value, {
				signDisplay: 'exceptZero',
				maximumFractionDigits: 0,
				useGrouping: true
			});
		const diff = data.confusionView;
		const takeaway = diff?.largest
			? t.difference({
					actual: diff.labels[diff.largest.trueIndex]!,
					predicted: diff.labels[diff.largest.predictedIndex]!,
					value: signed(diff.largest.count)
				})
			: t.noDifferences;
		const analysis = this.analysis.value;
		const ropeStatus = analysis.status === 'idle' ? 'loading' : analysis.status;
		return html`
			<header class="page-header">
				<h1 tabindex="-1">${t.title}</h1>
				<p>${t.description}</p>
			</header>
			<section class="page-body" data-testid="results-view">
				${!this.canCompare.value
					? html`<p class="notification">
							${t.blocked} <a href="/models">${t.modelsLink}</a>
						</p>`
					: html`
							${data.unavailableModels.some((item) => item.reason === 'loading')
								? html`<p role="status">${t.loading}</p>`
								: nothing}
							${repeat(
								data.unavailableModels.filter((item) => item.reason !== 'loading'),
								(item) => item.num,
								(item) =>
									html` <p>
										${name(item.num)}:
										${item.reason === 'legacy'
											? t.legacy
											: item.reason === 'lost'
												? t.lost
												: t.error}
										${item.reason === 'error'
											? html`<button
													type="button"
													value=${item.num}
													@click=${this.retryModel}>
													${t.retry}
												</button>`
											: html`<a href="/models">${t.modelsLink}</a>`}
									</p>`
							)}
							${!data.activeGroup &&
							!data.unavailableModels.some((item) => item.reason === 'loading')
								? html`<p>${t.different}</p>`
								: nothing}
							${!data.activeGroup && views.groups.length
								? html`<ul>
										${repeat(
											views.groups,
											(group) => group.fingerprint,
											(group) => html`<li>${group.text}</li>`
										)}
									</ul>`
								: nothing}
							${views.groups.length
								? html`<app-comparison-controls
										.groups=${views.groups}
										.fingerprint=${data.activeGroup?.fingerprint ?? null}
										.models=${views.models}
										.selected=${data.selected}
										.labels=${{
											group: t.group,
											models: t.models,
											limit: t.limit
										}}
										@app-comparison-group-change=${this.groupChanged}
										@app-comparison-selection-change=${this
											.selectionChanged}></app-comparison-controls>`
								: nothing}
							${data.activeGroup && data.selected.length < 2
								? html`<p>${t.needSelection}</p>`
								: nothing}
							${a && b
								? html`
										<section>
											<h2>${t.table}</h2>
											<app-comparison-table
												.rows=${views.rows}
												.baselines=${views.baselines}
												.columns=${views.columns}
												.sort=${ui.sort}
												.labels=${{
													caption: t.table,
													model: t.modelColumn,
													baseline: t.baseline,
													unavailable: t.unavailable
												}}
												@app-comparison-sort-change=${this
													.sortChanged}></app-comparison-table>
											${data.baselines.mismatched.length
												? html`<p>${t.baselineMismatch}</p>`
												: nothing}
										</section>
										<section>
											<app-fold-strip
												.series=${views.series}
												.baselines=${views.marks}
												.paired=${true}
												.caption=${{
													title: t.foldTitle,
													takeaway: t.foldTakeaway
												}}
												.formatPercent=${format.percent}
												.labels=${{
													showTable: t.showData,
													tableCaption: t.foldTable,
													series: t.series,
													partition: (n: number) =>
														t.partition({ n: format.count(n) }),
													score: t.score,
													time: t.time,
													mean: t.mean,
													standardDeviation: t.standardDeviation
												}}></app-fold-strip>
										</section>
										<section>
											<app-class-error-bars
												.rows=${data.classErrors.map((row) => ({
													...row,
													models: row.models.map((model) => ({
														...model,
														label: name(model.num)
													}))
												}))}
												.caption=${{
													title: t.classTitle,
													takeaway: t.classTakeaway
												}}
												.formatPercent=${format.percent}
												.labels=${{
													class: t.class,
													model: t.modelColumn,
													errorRate: t.errorRate,
													unavailable: t.unavailable,
													showData: t.showData
												}}></app-class-error-bars>
										</section>
										<section>
											<app-model-pair-picker
												.models=${views.models.filter((model) =>
													data.selected.includes(model.num)
												)}
												.pairA=${a.num}
												.pairB=${b.num}
												.labels=${{
													modelA: t.modelA,
													modelB: t.modelB,
													swap: t.swap,
													order: t.order({
														a: name(a.num),
														b: name(b.num)
													})
												}}
												@app-model-pair-change=${this
													.pairChanged}></app-model-pair-picker>
											<app-confusion-delta
												.delta=${diff}
												.classFilter=${data.classFilter}
												.formatSignedCount=${signed}
												.labels=${{
													caption: t.confusion,
													filter: t.filter,
													allClasses: t.allClasses,
													trueClass: t.trueClass,
													predictedClass: t.predictedClass,
													correct: t.correct,
													takeaway
												}}
												@app-confusion-delta-filter-change=${this
													.filterChanged}></app-confusion-delta>
										</section>
										<section class="rope-section">
											<app-rope-bar
												.result=${analysis.status === 'ready'
													? analysis.result
													: null}
												.status=${ropeStatus}
												.ropeWidth=${ui.ropeWidth}
												.caption=${{
													title: t.ropeTitle,
													takeaway: t.ropeTakeaway({
														a: name(a.num),
														b: name(b.num),
														width: format.decimal(ui.ropeWidth),
														folds: format.count(
															a.evaluation.partitions.length
														)
													})
												}}
												.formatPercent=${format.percent}
												.labels=${{
													width: t.ropeWidth,
													invalidWidth: t.ropeInvalid,
													aHigher: t.aHigher,
													equivalent: t.equivalent,
													bHigher: t.bHigher,
													loading: t.ropeLoading,
													unavailable: t.ropeUnavailable,
													error: t.ropeError,
													retry: t.retry,
													outcome: t.outcome,
													probability: t.probability,
													showData: t.showData
												}}
												@app-rope-width-change=${this.widthChanged}
												@app-rope-retry=${this
													.retryAnalysis}></app-rope-bar>
										</section>
										<section>
											<app-instance-agreement
												.counts=${{ counts: data.agreement }}
												.caption=${{
													title: t.agreementTitle,
													takeaway: t.agreementTakeaway({
														n: format.count(data.agreement[0] ?? 0)
													})(data.agreement[0] ?? 0)
												}}
												.formatCount=${format.count}
												.labels=${{
													correctModels: t.correctModels,
													rowCount: t.rowCount,
													showData: t.showData,
													bucket: (n: number) =>
														t.bucket({ n: format.count(n) })(n)
												}}></app-instance-agreement>
										</section>
										<p>${t.noWinner}</p>
									`
								: nothing}
						`}
			</section>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'app-results-view': AppResultsView;
	}
}
