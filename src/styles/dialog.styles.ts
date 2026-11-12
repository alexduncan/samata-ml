import { css, type CSSResult } from 'lit';

/**
 * Shared styles for native <dialog> modals and ::backdrop.
 * Follows specification/app-state-and-navigation.md §5.4 and specification/COMPONENTS.md §6.
 */
export const dialogStyles: CSSResult = css`
	dialog {
		box-sizing: border-box;
		margin: auto;
		border: 1.5px solid var(--stone-200);
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
		background-color: rgb(30 25 22 / 55%);
		overflow: hidden;
		overscroll-behavior: contain;
	}
`;
