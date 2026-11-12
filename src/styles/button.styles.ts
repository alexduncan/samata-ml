import { css, type CSSResult } from 'lit';

/**
 * Shared styles for standard and primary buttons (.btn, .btn-primary).
 * Follows specification/components/button.md §5.4.
 */
export const buttonStyles: CSSResult = css`
	.btn {
		cursor: pointer;
		border: 1.5px solid var(--stone-300);
		border-radius: 0.5rem;
		border-block-end-width: 3px;
		background-color: var(--stone-50);
		padding: 0.5rem;
		color: var(--stone-600);
		font-weight: 500;
		font-size: 1rem;
		font-family: inherit;
		text-align: center;

		&:hover:not(:disabled) {
			border-color: var(--stone-400);
			background-color: var(--stone-200);
			color: var(--stone-700);
		}

		&:focus-visible {
			outline: 2px solid var(--focus-ring);
			outline-offset: 2px;
		}

		&:disabled {
			cursor: not-allowed;
			border-color: var(--stone-200);
			background-color: var(--stone-100);
			color: var(--stone-400);
		}

		&.btn-primary {
			border-color: var(--blue-700);
			background-color: var(--surface);
			color: var(--blue-700);

			&:hover:not(:disabled) {
				background-color: var(--blue-100);
			}
		}
	}

	@media (prefers-reduced-motion: no-preference) {
		.btn {
			transition:
				background-color 500ms ease,
				border-color 500ms ease;
		}
	}
`;
