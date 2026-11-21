import { css, type CSSResult } from 'lit';

/**
 * Shared rules for the Section 6 results elements: chart figures, the "Show data table"
 * disclosure and the keyboard-scrollable table region. Follows COMPONENTS.md §6.2.
 */
export const resultsStyles: CSSResult = css`
	:host {
		display: block;
	}

	:host([hidden]) {
		display: none;
	}

	figure {
		margin: 0;
	}

	figcaption {
		margin-block-end: 0.5rem;
	}

	.caption-title {
		display: block;
		font-weight: 600;
	}

	.chart {
		inline-size: 100%;
	}

	details {
		margin-block-start: 0.5rem;
	}

	summary {
		cursor: pointer;
		padding-block: 0.25rem;
	}

	summary:focus-visible,
	.table-region:focus-visible,
	select:focus-visible,
	input:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}

	.table-region {
		max-inline-size: 100%;
		overflow-x: auto;
	}

	.table-region .table {
		inline-size: max-content;
		min-inline-size: 100%;
	}

	caption {
		padding-block: 0.25rem;
		font-weight: 600;
		text-align: start;
	}

	.table td.number,
	.table th.number {
		text-align: end;
	}

	.muted {
		color: var(--stone-700);
	}

	select {
		border: 1px solid var(--stone-600);
		border-radius: 0.25rem;
		background-color: var(--surface);
		padding: 0.25rem 0.5rem;
		max-inline-size: 100%;
		color: var(--stone-900);
		font-size: 1rem;
		font-family: inherit;
	}
`;
