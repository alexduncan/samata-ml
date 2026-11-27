import { css, type CSSResult } from 'lit';

/**
 * Shared rules for results elements, including chart figures, native disclosures and
 * keyboard-scrollable table regions. Follows COMPONENTS.md §6.2.
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

	.chart-sides {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
	}

	.chart-sides > span {
		max-inline-size: 50%;
		overflow-wrap: anywhere;
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

	.chart-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem 1rem;
		padding: 0;
		list-style: none;
	}

	.chart-legend li {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
	}

	.chart-legend .amber {
		outline: 1.5px solid var(--stone-900);
	}

	details > summary,
	button,
	input,
	select {
		min-block-size: 24px;
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

	.terms-disclosure > summary {
		min-block-size: 24px;
	}

	.terms-disclosure dl {
		margin-block: 0.5rem 0;
		overflow-wrap: anywhere;
	}

	.terms-disclosure dd {
		margin-inline-start: 1rem;
	}

	.terms-disclosure dd + dt {
		margin-block-start: 0.5rem;
	}

	.table-region {
		position: relative;
		contain: inline-size;
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
