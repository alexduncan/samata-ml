import { css, type CSSResult } from 'lit';

/**
 * Shared native text-button (.btn, .btn-primary, .btn-red) and icon-button (.btn-icon) styles.
 * Follows specification/components/button.md §5.
 */
export const buttonStyles: CSSResult = css`
	.btn {
		cursor: pointer;
		border: 1.5px solid var(--stone-300);
		border-radius: 0.5rem;
		border-block-end-width: 3px;
		background-color: var(--stone-50);
		padding: 0.5rem;
		color: var(--stone-700);
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

		/* Destructive or discarding actions only. */
		&.btn-red {
			border-color: var(--red-700);
			background-color: var(--surface);
			color: var(--red-700);

			&:hover:not(:disabled) {
				background-color: var(--red-100);
			}
		}
	}

	.btn-icon {
		cursor: pointer;
		border: none;
		border-radius: 0.5rem;
		background-color: var(--stone-200);
		padding: 0.5rem;
		color: var(--stone-900);
		line-height: 0;
		font-family: inherit;

		> svg {
			display: block;
			inline-size: 1.5rem;
			block-size: 1.5rem;
		}

		&:hover {
			background-color: var(--stone-300);
		}
		&:focus-visible {
			outline: 2px solid var(--focus-ring);
			outline-offset: 2px;
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
