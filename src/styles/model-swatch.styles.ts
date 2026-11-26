import { css } from 'lit';

/** Shared numbered swatches for the sidebar and trained-model heading. */
export const modelSwatchStyles = css`
	.swatch {
		flex: none;
		border-radius: 0.375rem;
		padding-inline: 0.375rem;
		padding-block: 0.125rem 0.0625rem;
		color: var(--surface);
		font-weight: 600;
		font-size: 0.75rem;
		line-height: 1.125rem;
		font-family: var(--font-mono);
	}

	.swatch-large {
		padding-inline: 0.5rem;
		font-size: 1rem;
		line-height: 1.5rem;
	}

	.swatch-amber {
		background-color: var(--amber-500);
		color: var(--model-swatch-ink);
	}
	.swatch-blue {
		background-color: var(--blue-700);
	}
	.swatch-teal {
		background-color: var(--teal-700);
	}
	.swatch-purple {
		background-color: var(--purple-700);
	}
	.swatch-red {
		background-color: var(--red-700);
	}
	.swatch-green {
		background-color: var(--green-800);
	}
	.swatch-pink {
		background-color: var(--pink-700);
	}
	.swatch-sky {
		background-color: var(--sky-600);
		color: var(--model-swatch-ink);
	}
	.swatch-olive {
		background-color: var(--olive-700);
	}
	.swatch-neutral {
		background-color: var(--neutral-600);
	}

	@media (forced-colors: active) {
		.swatch {
			outline: 1px solid CanvasText;
			background-color: Canvas;
			color: CanvasText;
		}
	}
`;
