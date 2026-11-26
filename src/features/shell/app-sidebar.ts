import { count, params } from '@nanostores/i18n';
import { StoreController } from '@nanostores/lit';
import { css, html, LitElement, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { $format, i18n } from '../../i18n';
import { $sidebarState, createSidebarCueTracker } from '../../stores/sidebar.store';
import { chicletStyles } from '../../styles/chiclet.styles';
import { modelSwatchStyles } from '../../styles/model-swatch.styles';
import { workflowDotStyles } from '../../styles/workflow-dot.styles';

const messages = i18n('app-sidebar', {
	brand: 'samatā.ml',
	tagline: 'Machine Learning in Your Browser',
	project: 'Project',
	newProject: 'New Project',
	workflow: 'Workflow',
	loadData: 'Load Data',
	setTarget: 'Set Target',
	allTrained: 'All Trained Models',
	trainNew: 'Train New Model',
	trainAnother: 'Train Another Model',
	trainingNew: 'Training New Model…',
	suggestedNextStep: 'Suggested next step',
	featureCount: params<{ formatted: string }>(
		count({ one: '{formatted} feature', many: '{formatted} features' })
	),
	compareResults: 'Compare Results',
	dataset: 'Dataset',
	target: 'Target',
	rows: params<{ formatted: string }>(
		count({ one: '{formatted} row', many: '{formatted} rows' })
	),
	columns: params<{ formatted: string }>(
		count({ one: '{formatted} column', many: '{formatted} columns' })
	),
	model: params<{ num: string }>('Model {num}'),
	trained: 'trained',
	numeric: 'Numeric',
	categorical: 'Categorical',
	boolean: 'Boolean',
	date: 'Date',
	time: 'Time',
	datetime: 'Date/time',
	text: 'Text',
	about: 'about',
	privacy: 'privacy',
	help: 'help'
});

const suggestionId = 'workflow-suggestion';

/** Connected workflow navigation and read-only dataset, target and model summaries. */
@customElement('app-sidebar')
export class AppSidebar extends LitElement {
	private readonly sidebar = new StoreController(this, $sidebarState);
	private readonly cueTracker = createSidebarCueTracker();
	private readonly cue = new StoreController(this, this.cueTracker.cue);
	private readonly translations = new StoreController(this, messages);
	private readonly formatter = new StoreController(this, $format);

	static override readonly styles = [
		chicletStyles,
		modelSwatchStyles,
		css`
			:host {
				display: flex;
				position: fixed;
				flex-direction: column;
				z-index: 100;
				inset-block: 0;
				inset-inline-end: auto;
				inset-inline-start: 0;
				box-shadow: var(--shadow-sidebar);
				background-color: var(--stone-150);
				inline-size: var(--sidebar-width);
				min-block-size: 100dvh;
				overflow-y: auto;
			}
			:host([hidden]) {
				display: none;
			}
			.brand {
				margin-inline: 1.25rem;
				margin-block: 1.25rem 0;
				color: var(--stone-900);
				font-weight: 600;
				font-size: 1.75rem;
				line-height: normal;
			}
			.tagline {
				margin-inline: 1.25rem;
				margin-block: 0 1.25rem;
				color: var(--stone-800);
				font-weight: 300;
				font-size: 0.875rem;
				line-height: 1rem;
			}
			.project {
				display: grid;
				grid-template-columns: minmax(0, 1fr) 2.5rem;
				grid-template-areas: 'title button' 'id button';
				margin-inline: 1.25rem;
				margin-block: 0;
				border: 1px solid var(--stone-400);
				border-radius: 0.5rem;
				background-color: var(--stone-200);
				padding-inline: 0.75rem 0.5rem;
				padding-block: 0.5rem;
				min-block-size: 2.5rem;
			}
			.project h2 {
				grid-area: title;
				margin: 0;
				color: var(--stone-900);
				font-weight: 700;
				font-size: 1rem;
				line-height: normal;
			}
			.project-name {
				grid-area: id;
				margin: 0;
				color: var(--stone-900);
			}
			.workflow {
				flex-grow: 1;
				margin-inline: 1.25rem;
				margin-block: 1rem;
			}
			.steps {
				padding: 0;
				list-style-type: none;
				list-style-position: inside;
			}
			.step {
				position: relative;
				border: 1px solid var(--stone-350);
				overflow: hidden;
				font-size: 1rem;
			}
			.step + .step {
				margin-block-start: -1px;
			}
			.step:first-child {
				border-start-start-radius: 0.25rem;
				border-start-end-radius: 0.25rem;
			}
			.step:last-child {
				border-end-start-radius: 0.25rem;
				border-end-end-radius: 0.25rem;
			}
			.step:has(> .step-link[aria-current], > .step-link > .step-link-small[aria-current]) {
				z-index: 1;
				border-color: var(--blue-700);
			}
			.step:has(> .step-link[aria-current], > .step-link > .step-link-small[aria-current])
				> .step-link {
				background-color: var(--surface);
				color: var(--blue-800);
			}
			.step-link {
				display: grid;
				position: relative;
				grid-template-columns: 2rem minmax(0, 1fr);
				grid-template-areas: 'num label chiclets' 'num value chiclets';
				align-items: center;
				color: var(--stone-700);
				font-weight: 500;
				text-decoration: none;
			}
			.step-num {
				grid-area: num;
				align-self: start;
				font-size: 1.125rem;
				line-height: 3rem;
				text-align: center;
			}
			.step-label {
				grid-area: label;
				line-height: 3rem;
			}
			.step-link[aria-current] .step-label {
				font-weight: 600;
			}
			.step-label-small {
				grid-area: label;
				padding-block-start: 0.375rem;
				font-weight: 600;
				font-size: 0.75rem;
			}
			.step-value {
				grid-area: value;
				padding-block-end: 0.375rem;
				font-weight: 400;
			}
			.step-chiclets {
				grid-area: chiclets;
				padding-inline-end: 0.5rem;
			}
			.project-name,
			.step-label,
			.step-label-small,
			.step-value,
			.step-chiclets,
			.step-model-link,
			.step-train-new {
				min-inline-size: 0;
				overflow-wrap: anywhere;
			}
			.step-model-navigation {
				grid-template-areas: 'num label' 'num value';
			}
			.step-link-small {
				grid-area: label;
				padding-block: 0.5rem 0.375rem;
				color: var(--stone-700);
				font-weight: 600;
				font-size: 0.75rem;
			}
			.step-link-small[aria-current] {
				color: var(--blue-800);
			}
			.step-train-new {
				grid-area: value;
				margin-inline-end: 0.5rem;
				margin-block: 0.25rem 0.5rem;
			}
			.step-models {
				display: flex;
				grid-area: value;
				flex-direction: column;
				gap: 0.25rem;
				margin: 0;
				padding-inline: 0 0.5rem;
				padding-block: 0.25rem 0.5rem;
				list-style: none;
			}
			.step-model-link {
				display: flex;
				position: relative;
				flex-wrap: wrap;
				align-items: center;
				gap: 0.375rem;
				border: 1px solid var(--stone-350);
				border-radius: 0.25rem;
				background-color: var(--stone-100);
				padding-inline: 0.75rem 0.5rem;
				padding-block: 0.5rem;
				color: var(--stone-700);
				text-decoration: none;
			}
			.step-trained-model {
				padding-inline-start: 0.5rem;
			}
			.step-model-name {
				flex: 1 1 7rem;
				min-inline-size: 0;
				overflow-wrap: anywhere;
			}
			.step-trained-model .chiclet {
				margin-inline-start: auto;
			}
			.step-model-link[aria-current] {
				border-color: var(--blue-700);
				background-color: var(--surface);
				color: var(--blue-700);
				font-weight: 600;
			}
			a.step-link:hover,
			a.step-model-link:hover,
			a.step-train-new:hover {
				border-color: var(--stone-900);
				background-color: var(--surface);
				color: var(--stone-900);
			}
			a:focus-visible {
				outline: 2px solid var(--focus-ring);
				outline-offset: -2px;
			}
			.visually-hidden {
				position: absolute;
				clip-path: inset(50%);
				margin: -1px;
				border: 0;
				padding: 0;
				inline-size: 1px;
				block-size: 1px;
				overflow: hidden;
				white-space: nowrap;
			}
			footer {
				margin-block-start: auto;
				border-block-start: 1px solid var(--stone-250);
				padding-inline: 1.25rem;
				padding-block: 1rem;
				color: var(--stone-700);
				font-size: 1rem;
				line-height: normal;
			}
			footer a {
				color: var(--stone-800);
				text-decoration: underline;
			}
			footer a:focus-visible {
				outline-offset: 2px;
			}
			@media (prefers-reduced-motion: no-preference) {
				.step-link,
				.step-model-link {
					transition:
						background-color 500ms ease,
						border-color 500ms ease,
						color 500ms ease;
				}
			}
			@media (width < 50rem) {
				:host {
					position: static;
					inset: auto;
					inline-size: auto;
					block-size: auto;
					min-block-size: 0;
				}
				.step-link:has(.step-chiclets) {
					grid-template-columns: 2rem minmax(0, 1fr);
					grid-template-areas: 'num label' 'num value' 'num chiclets';
				}
				.step-chiclets {
					display: flex;
					flex-wrap: wrap;
					gap: 0.25rem;
					padding-block-end: 0.5rem;
				}
			}
		`,
		workflowDotStyles
	];

	override connectedCallback(): void {
		super.connectedCallback();
		this.cueTracker.start();
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		this.cueTracker.stop();
	}

	override render() {
		const state = this.sidebar.value;
		const t = this.translations.value;
		const format = this.formatter.value;
		const cue = this.cue.value;
		const dot = html`<span class="dot" aria-hidden="true"></span>`;
		return html`
			<p class="brand">${t.brand}</p>
			<p class="tagline">${t.tagline}</p>
			<section class="project" aria-label=${t.project}>
				<h2>${t.project}</h2>
				<span class="project-name">${t.newProject}</span>
			</section>
			<nav class="workflow" aria-label=${t.workflow}>
				<ol class="steps">
					<li class="step">
						<a
							class="step-link"
							href="/data"
							aria-describedby=${cue === 'data' ? suggestionId : nothing}
							aria-current=${state.current.data ?? nothing}>
							<span class="step-num">1</span>
							${state.dataset
								? html`<span class="step-label-small">${t.dataset}</span
										><span class="step-value">${state.dataset.name}</span>
										<span class="step-chiclets"
											><span class="chiclet"
												>${t.rows({
													formatted: format.number(state.dataset.rows)
												})(state.dataset.rows)}</span
											>
											<span class="chiclet"
												>${t.columns({
													formatted: format.number(state.dataset.columns)
												})(state.dataset.columns)}</span
											></span
										>`
								: html`<span class="step-label">${t.loadData}</span>`}
							${cue === 'data' ? dot : nothing}
						</a>
					</li>
					<li class="step">
						<a
							class="step-link"
							href="/target"
							aria-describedby=${cue === 'target' ? suggestionId : nothing}
							aria-current=${state.current.target ?? nothing}>
							<span class="step-num">2</span>
							${state.target
								? html`<span class="step-label-small">${t.target}</span
										><span class="step-value">${state.target.name}</span>${state
											.target.type
											? html`<span class="step-chiclets"
													><span class="chiclet"
														>${t[state.target.type]}</span
													></span
												>`
											: nothing}`
								: html`<span class="step-label">${t.setTarget}</span>`}
							${cue === 'target' ? dot : nothing}
						</a>
					</li>
					<li class="step">
						<div class="step-link step-model-navigation">
							<span class="step-num">3</span>
							<a
								href="/models"
								class="step-link-small"
								aria-current=${state.current.models ?? nothing}>
								${t.allTrained}
							</a>
							${state.models.length || state.provisionalVisible
								? html`<ul class="step-models">
										${repeat(
											state.models,
											(model) => model.num,
											(model) => html`
												<li class="step-model">
													<a
														class="step-model-link step-trained-model"
														href="/models/${model.num}"
														aria-current=${model.current ?? nothing}>
														<span class="swatch swatch-${model.colour}"
															>${format.number(model.num)}</span
														>
														<span class="step-model-name">
															${model.name ??
															t.model({
																num: format.number(model.num)
															})}
														</span>
														${model.featureCount === undefined
															? nothing
															: html`<span class="chiclet">
																	${t.featureCount({
																		formatted: format.number(
																			model.featureCount
																		)
																	})(model.featureCount)}
																</span>`}
														<span class="trained" aria-hidden="true"
															>✓</span
														>
														<span class="visually-hidden"
															>${t.trained}</span
														>
													</a>
												</li>
											`
										)}
										${!state.canTrain
											? nothing
											: state.provisionalVisible
												? html`<li class="step-model">
														<span
															class="step-model-link"
															aria-current=${state.current
																.provisional ?? nothing}
															>${t.trainingNew}</span
														>
													</li>`
												: html`<li class="step-model">
														<a
															class="step-model-link"
															href="/models/new"
															aria-describedby=${cue ===
															'train-another'
																? suggestionId
																: nothing}
															>${t.trainAnother}${cue ===
															'train-another'
																? dot
																: nothing}</a
														>
													</li>`}
									</ul>`
								: state.canTrain
									? html`<a
											class="step-train-new"
											href="/models/new"
											aria-describedby=${cue === 'train-new'
												? suggestionId
												: nothing}
											>${t.trainNew}${cue === 'train-new' ? dot : nothing}</a
										>`
									: nothing}
						</div>
					</li>
					<li class="step">
						<a
							class="step-link"
							href="/results"
							aria-describedby=${cue === 'results' ? suggestionId : nothing}
							aria-current=${state.current.results ?? nothing}
							><span class="step-num">4</span
							><span class="step-label">${t.compareResults}</span>${cue === 'results'
								? dot
								: nothing}</a
						>
					</li>
				</ol>
				${cue
					? html`<span id=${suggestionId} class="visually-hidden"
							>${t.suggestedNextStep}</span
						>`
					: nothing}
			</nav>
			<footer>
				<a href="/about">${t.about}</a> <span aria-hidden="true">  |  </span>
				<a href="/privacy">${t.privacy}</a> <span aria-hidden="true">  |  </span>
				<a href="/help">${t.help}</a>
			</footer>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'app-sidebar': AppSidebar;
	}
}
