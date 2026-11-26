import { css } from 'lit';

/** Static workflow cue and its reserved slot inside the native link. */
export const workflowDotStyles = css`
	a:has(> .dot) {
		position: relative;
		padding-inline-end: 2rem;
	}
	.dot {
		position: absolute;
		transform: translateY(-50%);
		inset-block-start: 50%;
		inset-inline-end: 0.75rem;
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
`;
