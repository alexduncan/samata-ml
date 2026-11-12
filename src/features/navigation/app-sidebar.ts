import { StoreController } from '@nanostores/lit';
import { css, html, LitElement } from 'lit';
import { customElement } from 'lit/decorators.js';
import { $route } from '../../router/router';
import { $appState } from '../../stores/app.store';

/**
 * Connected sidebar navigation component.
 * Displays the 4-step ML workflow, model sub-links, and footer links.
 * Follows specification/app-state-and-navigation.md §2 and §4.4.
 */
@customElement('app-sidebar')
export class AppSidebar extends LitElement {
	private readonly appState = new StoreController(this, $appState);
	private readonly route = new StoreController(this, $route);

	static override styles = css`
		:host {
			display: flex;
			position: fixed;
			top: 0;
			left: 0;
			flex-direction: column;
			z-index: 10;
			box-sizing: border-box;
			border-right: 1px solid var(--color-border, #e5e7eb);
			background-color: var(--color-surface, #ffffff);
			padding: var(--space-4, 1rem);
			width: var(--sidebar-width, 260px);
			height: 100vh;
			overflow-y: auto;
		}

		.brand {
			margin-bottom: var(--space-4, 1rem);
		}

		h1 {
			margin: 0;
			color: var(--color-primary, #0f172a);
			font-weight: 700;
			font-size: var(--text-lg, 1.25rem);
		}

		.tagline {
			margin: var(--space-1, 0.25rem) 0 0 0;
			color: var(--color-text-muted, #64748b);
			font-size: var(--text-xs, 0.75rem);
		}

		.project {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: var(--space-6, 1.5rem);
			border: 1px solid var(--color-border, #e5e7eb);
			border-radius: var(--radius-md, 6px);
			background-color: var(--color-bg-subtle, #f8fafc);
			padding: var(--space-2, 0.5rem);
			font-size: var(--text-sm, 0.875rem);
		}

		.project-label {
			color: var(--color-text-muted, #64748b);
			font-size: var(--text-xs, 0.75rem);
			letter-spacing: 0.05em;
			text-transform: uppercase;
		}

		.project-name {
			font-weight: 600;
		}

		nav.steps {
			flex: 1;
		}

		ol.steps-list {
			display: flex;
			flex-direction: column;
			gap: var(--space-2, 0.5rem);
			margin: 0;
			padding: 0;
			list-style: none;
		}

		li.step {
			border-radius: var(--radius-md, 6px);
		}

		li.step a {
			display: flex;
			align-items: center;
			gap: var(--space-3, 0.75rem);
			border-radius: var(--radius-md, 6px);
			padding: var(--space-2, 0.5rem) var(--space-3, 0.75rem);
			color: var(--color-text, #1e293b);
			font-weight: 500;
			font-size: var(--text-sm, 0.875rem);
			text-decoration: none;
		}

		li.step a:hover {
			background-color: var(--color-bg-hover, #f1f5f9);
		}

		li.step a[aria-current='page'],
		li.step[aria-current='step'] > a {
			background-color: var(--color-primary-subtle, #e0f2fe);
			color: var(--color-primary, #0284c7);
			font-weight: 600;
		}

		.step-num {
			display: flex;
			justify-content: center;
			align-items: center;
			border-radius: 9999px;
			background-color: var(--color-border, #e2e8f0);
			width: 1.5rem;
			height: 1.5rem;
			color: var(--color-text, #1e293b);
			font-weight: 600;
			font-size: var(--text-xs, 0.75rem);
		}

		li.step[aria-current='step'] .step-num,
		li.step a[aria-current='page'] .step-num {
			background-color: var(--color-primary, #0284c7);
			color: #ffffff;
		}

		.step-summary {
			margin-top: -0.25rem;
			margin-bottom: var(--space-1, 0.25rem);
			margin-left: 2.75rem;
			color: var(--color-text-muted, #64748b);
			font-size: var(--text-xs, 0.75rem);
		}

		ul.model-sublinks {
			display: flex;
			flex-direction: column;
			gap: var(--space-1, 0.25rem);
			margin: var(--space-1, 0.25rem) 0 var(--space-2, 0.5rem) 0;
			padding-left: 2.5rem;
			list-style: none;
		}

		ul.model-sublinks a {
			display: block;
			border-radius: var(--radius-sm, 4px);
			padding: var(--space-1, 0.25rem) var(--space-2, 0.5rem);
			color: var(--color-text-muted, #64748b);
			font-size: var(--text-xs, 0.75rem);
			text-decoration: none;
		}

		ul.model-sublinks a:hover {
			background-color: var(--color-bg-hover, #f1f5f9);
			color: var(--color-text, #1e293b);
		}

		ul.model-sublinks a[aria-current='page'] {
			background-color: var(--color-primary-subtle, #e0f2fe);
			color: var(--color-primary, #0284c7);
			font-weight: 600;
		}

		footer {
			display: flex;
			justify-content: center;
			align-items: center;
			gap: var(--space-2, 0.5rem);
			margin-top: auto;
			border-top: 1px solid var(--color-border, #e5e7eb);
			padding-top: var(--space-4, 1rem);
			color: var(--color-text-muted, #64748b);
			font-size: var(--text-xs, 0.75rem);
		}

		footer a {
			color: var(--color-text-muted, #64748b);
			text-decoration: none;
		}

		footer a:hover {
			color: var(--color-text, #1e293b);
			text-decoration: underline;
		}
	`;

	override render() {
		const state = this.appState.value;
		const currentRoute = this.route.value;

		const currentPath = currentRoute.kind === 'workflow' ? currentRoute.path : '';
		const currentSection = currentRoute.kind === 'workflow' ? currentRoute.section : null;

		const isStep1 = currentSection === 1;
		const isStep2 = currentSection === 2;
		const isStep3 = currentSection === 3;
		const isStep4 = currentSection === 4;

		return html`
			<div class="brand">
				<h1>samatā.ml</h1>
				<p class="tagline">Machine Learning in Your Browser</p>
			</div>

			<section class="project" aria-label="Current Project">
				<div>
					<div class="project-label">Project</div>
					<div class="project-name">New Project</div>
				</div>
			</section>

			<nav class="steps" aria-label="Workflow">
				<ol class="steps-list">
					<!-- Step 1: Load Data -->
					<li class="step" ?aria-current=${isStep1 ? 'step' : undefined}>
						<a
							href="/data"
							?aria-current=${currentPath === '/data' ? 'page' : undefined}>
							<span class="step-num">1</span>
							<span class="step-label">Load Data</span>
						</a>
						${state.dataset
							? html`<div class="step-summary">
									${state.dataset.name} (${state.dataset.rowCount} rows,
									${state.dataset.columns.length} cols)
								</div>`
							: ''}
					</li>

					<!-- Step 2: Set Target -->
					<li class="step" ?aria-current=${isStep2 ? 'step' : undefined}>
						<a
							href="/target"
							?aria-current=${currentPath === '/target' ? 'page' : undefined}>
							<span class="step-num">2</span>
							<span class="step-label">Set Target</span>
						</a>
						${state.target
							? html`<div class="step-summary">Target: ${state.target}</div>`
							: ''}
					</li>

					<!-- Step 3: Train Models -->
					<li class="step" ?aria-current=${isStep3 ? 'step' : undefined}>
						<a
							href="/models"
							?aria-current=${currentPath === '/models'
								? 'page'
								: isStep3
									? 'true'
									: undefined}>
							<span class="step-num">3</span>
							<span class="step-label">Train Models</span>
						</a>
						${state.models.length > 0
							? html`
									<ul class="model-sublinks">
										${state.models.map(
											(m) => html`
												<li>
													<a
														href="/models/${m.num}"
														?aria-current=${currentPath ===
														`/models/${m.num}`
															? 'page'
															: undefined}>
														Model
														${m.num}${m.status === 'trained'
															? ' ✓'
															: ''}
													</a>
												</li>
											`
										)}
									</ul>
								`
							: ''}
					</li>

					<!-- Step 4: Compare Results -->
					<li class="step" ?aria-current=${isStep4 ? 'step' : undefined}>
						<a
							href="/results"
							?aria-current=${currentPath === '/results' ? 'page' : undefined}>
							<span class="step-num">4</span>
							<span class="step-label">Compare Results</span>
						</a>
					</li>
				</ol>
			</nav>

			<footer>
				<a href="/about">about</a>
				<span>|</span>
				<a href="/privacy">privacy</a>
				<span>|</span>
				<a href="/help">help</a>
			</footer>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		'app-sidebar': AppSidebar;
	}
}
