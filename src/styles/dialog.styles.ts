import { css, type CSSResult } from 'lit';

/**
 * Shared styles for native <dialog> modals and ::backdrop.
 * Follows specification/app-state-and-navigation.md §5.4 and specification/COMPONENTS.md §6.
 */
export const dialogStyles: CSSResult = css`
	dialog {
		box-sizing: border-box;
		margin: auto;
		box-shadow: var(--shadow-deep);
		border: 1px solid var(--stone-200);
		border-radius: 1rem;
		background-color: var(--surface);
		padding: 1.5rem;
		inline-size: min(40rem, calc(100% - 2rem));
		max-inline-size: none;
		max-block-size: calc(100dvh - 2rem);
		overflow: auto;
		overscroll-behavior: contain;
		color: var(--stone-800);
	}

	dialog::backdrop {
		backdrop-filter: blur(4px);
		background-color: var(--backdrop);
		overflow: hidden;
		overscroll-behavior: contain;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-block-end: 1rem;

		h2 {
			margin: 0;
			color: var(--stone-800);
			font-weight: 500;
			font-size: 1.5rem;
		}
	}
`;
