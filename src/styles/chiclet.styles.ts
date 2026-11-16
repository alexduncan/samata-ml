import { css, type CSSResult } from 'lit';

/**
 * Shared chiclet badge styles (.chiclet, .chiclet-purple, .chiclet-teal, .chiclet-amber).
 * Follows specification/components/card.md §5.2 and §6.
 */
export const chicletStyles: CSSResult = css`
	.chiclet {
		display: inline;
		border: 1px solid var(--stone-600);
		border-radius: 0.25rem;
		padding-inline: 0.25rem;
		padding-block: 0.125rem;
		color: var(--stone-800);
		font-weight: 500;
		font-size: 0.75rem;
		line-height: normal;
		font-family: inherit;
	}

	.chiclet.chiclet-purple,
	.chiclet.chiclet-teal,
	.chiclet.chiclet-amber {
		display: inline-block;
		border-color: transparent;
		padding-inline-start: 0.375rem;
		letter-spacing: 0.125rem;
		text-transform: uppercase;
	}

	.chiclet.chiclet-purple {
		background-color: var(--purple-700);
		color: var(--surface);
	}

	.chiclet.chiclet-teal {
		background-color: var(--teal-700);
		color: var(--surface);
	}

	.chiclet.chiclet-amber {
		background-color: var(--amber-500);
		color: var(--stone-900);
	}
`;
