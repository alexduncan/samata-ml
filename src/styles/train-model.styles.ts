import { css, type CSSResult } from 'lit';

/**
 * Shared styles for model training step accordion panels.
 * Follows specification/mockups/ui-scaffold/css/train-model.css and specification/plans/step-3-train-models-overview-and-setup.md.
 */
export const trainModelStyles: CSSResult = css`
	.train-model {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.train-step {
		border: 1px solid var(--stone-300);
		background-color: var(--stone-100);
	}

	.train-step + .train-step {
		margin-block-start: -1px;
	}

	.train-step:first-child {
		border-start-start-radius: 0.5rem;
		border-start-end-radius: 0.5rem;
	}

	.train-step:last-child {
		border-end-start-radius: 0.5rem;
		border-end-end-radius: 0.5rem;
	}

	.train-step-panel {
		border-radius: 0.5rem;
	}

	.train-step-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.train-step-header h2 {
		flex: 1 1 auto;
		margin: 0;
		padding-inline: 1rem;
		padding-block: 0.75rem;
		color: var(--stone-700);
		font-weight: 500;
		font-size: 1.125rem;
	}

	.train-step-header .train-step-action {
		margin-inline: 0.875rem;
		margin-block: 0.75rem;
	}

	.train-step-header .train-step-status {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--green-700);
	}

	.train-step-content {
		padding: 1rem;
	}

	.train-step.train-step-pending {
		color: var(--stone-500);
	}

	.train-step[aria-current='step'] {
		position: relative;
		z-index: 1;
		border-color: var(--stone-500);
		background-color: var(--surface);
	}

	.train-step[aria-current='step'] .train-step-header {
		border-block-end: 1px solid var(--stone-300);
	}

	.train-step[aria-current='step'] .train-step-header h2 {
		color: var(--stone-900);
		font-size: 1.25rem;
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
`;
