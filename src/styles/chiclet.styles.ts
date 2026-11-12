import { css, type CSSResult } from 'lit';

/**
 * Shared chiclet badge styles (.chiclet, .chiclet-purple, .chiclet-teal, .chiclet-amber).
 * Follows specification/components/card.md §5.2 and §6.
 */
export const chicletStyles: CSSResult = css`
	.chiclet {
		display: inline-block;
		border: 1px solid var(--stone-400);
		border-radius: 0.25rem;
		padding-inline: 0.375rem;
		padding-block: 0.125rem;
		color: var(--stone-800);
		font-weight: 500;
		font-size: 0.75rem;
		line-height: 1rem;
		font-family: var(--font-mono);
		text-align: center;
		white-space: nowrap;
	}

	.chiclet.chiclet-purple {
		border-color: transparent;
		background-color: var(--purple-700);
		color: var(--surface);
	}

	.chiclet.chiclet-teal {
		border-color: transparent;
		background-color: var(--teal-700);
		color: var(--surface);
	}

	.chiclet.chiclet-amber {
		border-color: transparent;
		background-color: var(--amber-500);
		color: var(--stone-900);
	}
`;
