import { css, type CSSResult } from 'lit';

/** Inline contextual Help links in wizard step headings. */
export const helpLinkStyles: CSSResult = css`
	.help-link {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		box-sizing: border-box;
		margin-inline-start: 0.5rem;
		border-radius: 0.375rem;
		padding-inline: 0.75rem;
		padding-block: 0.5rem;
		max-inline-size: 100%;
		color: var(--blue-700);
		font-weight: 400;
		font-size: 0.875rem;
	}

	.help-link:hover {
		background-color: var(--blue-100);
	}

	.help-link:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}
`;
