import { css } from 'lit';

/** Static workflow cue and its document-level arrival effect. */
export const workflowDotStyles = css`
	a:has(> .dot) {
		position: relative;
		padding-inline-end: 2rem;
	}
	.dot,
	.workflow-dot-burst {
		border-radius: 50%;
		background-color: var(--blue-700);
		inline-size: 0.625rem;
		block-size: 0.625rem;
		pointer-events: none;
		@media (forced-colors: active) {
			background-color: LinkText;
			forced-color-adjust: none;
		}
	}
	.dot {
		position: absolute;
		transform: translateY(-50%);
		inset-block-start: 50%;
		inset-inline-end: 0.75rem;
	}
	.workflow-dot-burst {
		position: fixed;
		translate: -50% -50%;
		z-index: 101;
		@media (prefers-reduced-motion: no-preference) {
			animation: workflow-dot-arrival 2000ms ease-out;
		}
	}
	@keyframes workflow-dot-arrival {
		from {
			transform: scale(1);
			opacity: 1;
		}
		to {
			transform: scale(30);
			opacity: 0;
		}
	}
`;
