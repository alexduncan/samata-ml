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
		scroll-padding-block-start: 0;
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

	dialog.modal:not([data-header-unpinned]) > .modal-header {
		position: sticky;
		z-index: 1;
		/* Pin at the inside border once the dialog's 1.5rem padding scrolls away. */
		inset-block-start: -1.5rem;
		background-color: var(--surface);
	}

	dialog.modal .modal-header h2 {
		min-inline-size: 0;
		overflow-wrap: anywhere;
	}

	dialog.modal .modal-header .btn-icon {
		flex-shrink: 0;
	}

	.modal-header:has(.header-titles) {
		margin-block-end: 1rem;
		border-block-end: 1px solid var(--stone-200);
	}

	.header-titles {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-inline-size: 0;
	}

	.header-titles h2 {
		color: var(--stone-900);
		font-weight: 600;
	}

	.header-subtitle {
		color: var(--stone-700);
		font-weight: 500;
		font-size: 0.875rem;
	}

	.modal-content {
		min-inline-size: 0;
	}

	dialog.confirm-dialog {
		border-width: 1.5px;
		inline-size: min(32rem, calc(100% - 2rem));
	}

	.confirm-header h2 {
		margin: 0;
		color: var(--stone-900);
		font-weight: 600;
		font-size: 1.25rem;
	}

	.confirm-body {
		margin-block: 1rem;
		color: var(--stone-700);
		line-height: 1.5;
	}

	.confirm-body > [role='alert'] {
		color: var(--red-700);
	}

	.confirm-footer {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 0.75rem;
	}
`;
