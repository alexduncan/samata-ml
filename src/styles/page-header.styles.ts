import { css, type CSSResult } from 'lit';
import { headingFocusStyles } from './heading-focus.styles';

/** Shared page title, description and native action layout from the base mockup. */
export const pageHeaderStyles: CSSResult = css`
	${headingFocusStyles}

	.page-header {
		display: grid;
		position: sticky;
		grid-template-columns: minmax(0, 1fr) auto;
		grid-template-areas: 'title action' 'description action';
		column-gap: 2rem;
		row-gap: 0.5rem;
		align-items: center;
		z-index: 10;
		box-sizing: border-box;
		inset-block-start: 0;
		background-color: var(--stone-50);
		padding: 1.5rem 2rem;
		inline-size: 100%;

		@media (max-height: 30rem) {
			position: static;
		}

		> h1 {
			grid-area: title;
			margin: 0;
			min-inline-size: 0;
			color: var(--stone-900);
			font-weight: 500;
			font-size: 1.5rem;
			overflow-wrap: anywhere;
		}

		> p {
			grid-area: description;
			margin: 0;
			min-inline-size: 0;
			color: var(--stone-700);
			line-height: 1.75rem;
			overflow-wrap: anywhere;
		}

		> button,
		> a {
			grid-area: action;
			justify-self: end;
			min-inline-size: 0;
			overflow-wrap: anywhere;
		}
	}
`;
