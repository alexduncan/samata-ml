import { css, type CSSResult } from 'lit';

/**
 * Shared styles for tables (.table).
 * Follows specification/plans/step-2-set-target.md §D4 and visual-design.md.
 */
export const tableStyles: CSSResult = css`
	.table {
		border-collapse: collapse;
		inline-size: 100%;

		thead {
			background-color: var(--stone-200);
		}

		th,
		td {
			border: 1px solid var(--stone-300);
			padding-inline: 0.75rem;
			padding-block: 0.5rem;
			text-align: start;

			&:has(input) {
				text-align: center;
			}
		}

		th {
			background-color: var(--stone-100);
			font-weight: 600;
		}

		tr:nth-child(even) {
			background-color: var(--stone-100);
		}

		&.table-compact {
			th,
			td {
				padding-inline: 0.375rem;
				padding-block: 0.25rem;
				font-size: 0.875rem;
			}
		}
	}

	.target-variable {
		background-color: var(--amber-100);
		color: var(--amber-800);
		font-weight: 500;
	}

	.feature-unsupported {
		background-color: var(--red-100);
		color: var(--red-800);
	}

	tr[aria-selected='true'] {
		background-color: var(--blue-100);
		color: var(--blue-800);
	}
`;
