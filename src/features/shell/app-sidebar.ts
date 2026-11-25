import { count, params } from '@nanostores/i18n';
import { StoreController } from '@nanostores/lit';
import { css, html, LitElement, nothing } from 'lit';
import { customElement } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { classMap } from 'lit/directives/class-map.js';
import { $format, i18n } from '../../i18n';
import { $sidebarState } from '../../stores/sidebar.store';
import { chicletStyles } from '../../styles/chiclet.styles';

const messages = i18n('app-sidebar', {
	brand: 'samatā.ml',
	tagline: 'Machine Learning in Your Browser',
	project: 'Project',
	newProject: 'New Project',
	workflow: 'Workflow',
	loadData: 'Load Data',
	setTarget: 'Set Target',
	trainModels: 'Train Models',
	compareResults: 'Compare Results',
	dataset: 'Dataset',
	target: 'Target',
	models: 'Models',
	rows: params<{ formatted: string }>(
		count({ one: '{formatted} row', many: '{formatted} rows' })
	),
	columns: params<{ formatted: string }>(
		count({ one: '{formatted} column', many: '{formatted} columns' })
	),
	model: params<{ num: string }>('Model {num}'),
	training: 'training',
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

/** Connected workflow navigation and read-only dataset, target and model summaries. */
@customElement('app-sidebar')
export class AppSidebar extends LitElement {
	private readonly sidebar = new StoreController(this, $sidebarState);
	private readonly translations = new StoreController(this, messages);
	private readonly formatter = new StoreController(this, $format);

	static override readonly styles = [
		chicletStyles,
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
			.step:has(> .step-link[aria-current]) {
				z-index: 1;
				border-color: var(--blue-700);
			}
			.step:has(> .step-link[aria-current]) > .step-link {
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
			.step-model-link {
				min-inline-size: 0;
				overflow-wrap: anywhere;
			}
			.step-models {
				display: flex;
				flex-direction: column;
				gap: 0.25rem;
				margin: 0;
				padding-inline: 2rem 0.5rem;
				padding-block: 0.25rem 0.5rem;
				list-style: none;
			}
			.step-model-link {
				display: flex;
				position: relative;
				border: 1px solid var(--stone-350);
				border-radius: 0.25rem;
				background-color: var(--stone-100);
				padding-inline: 0.75rem 0.5rem;
				padding-block: 0.5rem;
				color: var(--stone-700);
				text-decoration: none;
			}
			.step-model-link[aria-current] {
				border-color: var(--blue-700);
				background-color: var(--surface);
				color: var(--blue-700);
			}
			.step-link:hover,
			.step-model-link:hover {
				border-color: var(--stone-900);
				background-color: var(--surface);
				color: var(--stone-900);
			}
			a:focus-visible {
				outline: 2px solid var(--focus-ring);
				outline-offset: -2px;
			}
			.dot {
				position: absolute;
				transform: translateY(-50%);
				inset-block-start: 50%;
				inset-inline-end: 0.75rem;
				border-radius: 50%;
				inline-size: 0.625rem;
				block-size: 0.625rem;
				color: var(--blue-700);
			}
			.dot::before {
				position: absolute;
				transform: scale(1);
				inset: 0;
				border-radius: inherit;
				background: currentColor;
				content: '';
			}
			.trained {
				margin-inline-start: auto;
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
			@keyframes pulse-core {
				0%,
				100% {
					transform: scale(1);
				}
				50% {
					transform: scale(0.85);
				}
			}
			@keyframes pulse-ring {
				0% {
					transform: scale(1);
					opacity: 0.6;
				}
				70% {
					transform: scale(2.5);
					opacity: 0;
				}
				100% {
					opacity: 0;
				}
			}
			@media (prefers-reduced-motion: no-preference) {
				.step-link,
				.step-model-link {
					transition:
						background-color 500ms ease,
						border-color 500ms ease,
						color 500ms ease;
				}
				.dot::before {
					animation: pulse-core 1500ms ease-in-out infinite;
				}
				.dot::after {
					position: absolute;
					transform: scale(1);
					opacity: 0;
					animation: pulse-ring 1500ms ease-out infinite;
					inset: 0;
					border: 0.25rem solid currentColor;
					border-radius: inherit;
					content: '';
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
		`
	];

	override render() {
		const state = this.sidebar.value;
		const t = this.translations.value;
		const format = this.formatter.value;
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
						</a>
					</li>
					<li class="step">
						<a
							class="step-link"
							href="/target"
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
						</a>
					</li>
					<li class="step">
						<a
							class="step-link"
							href="/models"
							aria-current=${state.current.models ?? nothing}>
							<span class="step-num">3</span
							><span
								class=${classMap({
									'step-label-small': state.models.length > 0,
									'step-label': state.models.length === 0
								})}
								>${state.models.length ? t.models : t.trainModels}</span
							>
						</a>
						${state.models.length
							? html`<ul class="step-models">
									${repeat(
										state.models,
										(model) => model.num,
										(model) =>
											html`<li class="step-model">
												<a
													class="step-model-link"
													href="/models/${model.num}"
													aria-current=${model.current ?? nothing}>
													${t.model({ num: format.number(model.num) })}
													${model.status === 'training'
														? html`<span
																	class="dot"
																	aria-hidden="true"></span
																><span class="visually-hidden">
																	${t.training}</span
																>`
														: model.status === 'trained'
															? html`<span
																		class="trained"
																		aria-hidden="true"
																		>✓</span
																	><span class="visually-hidden">
																		${t.trained}</span
																	>`
															: nothing}
												</a>
											</li>`
									)}
								</ul>`
							: nothing}
					</li>
					<li class="step">
						<a
							class="step-link"
							href="/results"
							aria-current=${state.current.results ?? nothing}
							><span class="step-num">4</span
							><span class="step-label">${t.compareResults}</span></a
						>
					</li>
				</ol>
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
