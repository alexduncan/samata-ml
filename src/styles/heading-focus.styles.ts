import { css } from 'lit';

/** Shared outline for keyboard-focused page headings in the document and component roots. */
export const headingFocusStyles = css`
	.page-header > h1:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}
`;
