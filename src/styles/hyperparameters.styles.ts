import { css, type CSSResult } from 'lit';

/**
 * Shared hyperparameter form styles: the `.field` grid family, `.form-note` and `.field-error`.
 * Ported from `specification/mockups/ui-scaffold/css/hyperparameters.css` (`.field` family and
 * the `max-width: 700px` rule; Phase 2 owns `.field--folds`, `.field-visual` and `.fold-*`)
 * and the `input`/`select` rules of `base.css`, which are scoped under `.field` so ranges,
 * checkboxes and inputs elsewhere keep their look. Adopt in a shadow root only.
 * Deviations: `A11Y-07` (1.5px `--stone-600` border), `A11Y-08` (2px focus outline),
 * `SEM-10` (native `<select>` rendering, no `base-select` or `::picker`),
 * `MODELS-UI-04` (`.form-note` is no longer defined by the mockup CSS).
 */
export const hyperparametersStyles: CSSResult = css`
	.field {
		display: grid;
		grid-template-rows: max-content minmax(0, 1fr);
		grid-template-columns:
			minmax(0, 1fr)
			minmax(0, 1fr);
		grid-template-areas:
			'label description'
			'control description';
		column-gap: 2rem;
		row-gap: 0.5rem;
		align-items: start;
		border-block-end: 1px solid var(--stone-200);
		padding-block: 1.5rem;

		&:first-child {
			padding-block-start: 0;
		}

		&:last-of-type {
			margin-block-end: 1.5rem;
		}

		.field-name {
			grid-area: label;
			font-weight: 600;
		}

		.field-control,
		.field-controls {
			grid-area: control;
			align-self: start;
		}

		/* Single control */
		.field-control {
			box-sizing: border-box;
			width: 100%;
			min-width: 0;
		}

		.field-control[type='checkbox'] {
			align-self: center;
			margin: 0;
			width: 1.25rem;
			height: 1.25rem;
			accent-color: var(--blue-600);
		}

		/* Multiple controls */
		.field-controls {
			display: flex;
			align-items: center;
			gap: 1rem;
			min-width: 0;
		}

		.field-controls > input[type='range'] {
			flex: 1 1 0;
			margin: 0;
			width: 100%;
			min-width: 0;
			accent-color: var(--blue-600);
		}

		.field-controls > input[type='number'] {
			flex: 0 0 7rem;
			box-sizing: border-box;
			width: 7rem;
			min-width: 0;
		}

		/* Numeric input with reset button */
		.field-controls--with-action > input[type='number'] {
			flex: 1 1 0;
		}

		.field-controls--with-action .btn {
			white-space: nowrap;
		}

		/* Descriptions and dependencies */
		.field-description {
			grid-area: description;
			align-self: center;
			color: var(--neutral-600);
			font-size: 0.875rem;
			line-height: 1.5;

			p {
				margin: 0;
				line-height: 1.5rem;
			}

			p + p {
				margin-block-start: 0.5rem;
			}

			.field-error {
				color: var(--red-700);
				font-weight: 600;
			}
		}

		.field-dependent {
			color: var(--neutral-700);
		}

		/* Box rules from base.css, for number inputs and selects only */
		input[type='number'],
		select {
			border: 1.5px solid var(--stone-600);
			border-radius: 0.375rem;
			background-color: var(--stone-100);
			padding-inline: 0.5rem;
			padding-block: 0.375rem;
			color: var(--stone-700);
			font-size: 1.125rem;
			font-family: inherit;
		}

		input[type='number']:focus-visible,
		select:focus-visible {
			border-color: var(--blue-700);
			background-color: var(--stone-50);
			color: var(--stone-900);
		}

		select:hover {
			cursor: pointer;
			border-color: var(--stone-400);
			background-color: var(--stone-200);
			color: var(--stone-900);
		}

		input:focus-visible,
		select:focus-visible,
		button:focus-visible {
			outline: 2px solid var(--focus-ring);
			outline-offset: 2px;
		}
	}

	.form-note {
		color: var(--neutral-600);
		font-size: 0.875rem;
	}

	@media (max-width: 700px) {
		.field {
			grid-template-rows: auto;
			grid-template-columns: minmax(0, 1fr);
			grid-template-areas:
				'label'
				'control'
				'description';
			row-gap: 0.75rem;
		}
	}
`;
