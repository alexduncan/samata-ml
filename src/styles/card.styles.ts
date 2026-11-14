import { css, type CSSResult } from 'lit';

/**
 * Shared card styles for app-dataset-card and app-model-card.
 * Follows specification/components/card.md §5.4.
 */
export const cardStyles: CSSResult = css`
	:host {
		display: block;
	}

	:host([hidden]) {
		display: none;
	}

	.card {
		--card-padding: 1rem;

		display: flex;
		position: relative;
		flex-direction: column;
		gap: 0.5rem;
		box-sizing: border-box;
		border: 1.5px solid var(--stone-200);
		border-radius: 1rem;
		border-block-end-width: 3px;
		background-color: var(--surface);
		padding-inline: 0;
		padding-block: 0 1rem;
		block-size: 100%;
		overflow: hidden;

		> :not(.card-image):not(.card-type) {
			padding-inline: var(--card-padding);
		}

		.card-image {
			display: block;
			background-color: var(--stone-100);
			inline-size: 100%;
			block-size: auto;
		}

		.card-type {
			position: absolute;
			inset-block-start: 1rem;
			inset-inline-start: 1rem;
		}

		.card-title {
			margin-inline: 0;
			margin-block: 0.25rem 0;
			color: var(--stone-900);
			font-weight: 600;
			font-size: 1.5rem;
			overflow-wrap: anywhere;

			&:first-child {
				margin-block-start: 1rem;
			}
		}

		.card-text {
			margin: 0;
			color: var(--stone-900);
			line-height: 1.5rem;
			overflow-wrap: anywhere;
		}

		.card-stats {
			display: flex;
			flex-wrap: wrap;
			gap: 0.5rem;
			margin-inline: 0;
			margin-block: 0.5rem;

			.stat {
				border-radius: 0.25rem;
				background-color: var(--stone-200);
				padding-inline: 0.375rem;
				padding-block: 0.25rem;
				color: var(--stone-800);
				font-size: 0.875rem;
				font-family: var(--font-mono);
			}
		}

		.card-actions {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
			margin-block-start: auto;
		}
	}

	::slotted(svg) {
		display: block;
		inline-size: 100%;
		block-size: auto;
	}
`;
