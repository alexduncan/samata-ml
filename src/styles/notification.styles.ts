import { css, type CSSResult } from 'lit';

/**
 * Shared styles for alert notifications (.notification, .notification.notification-alert).
 * Follows specification/plans/step-2-set-target.md §D4 and visual-design.md.
 */
export const notificationStyles: CSSResult = css`
	.notification {
		display: flex;
		align-items: center;
		margin-block-end: 1rem;
		border-radius: 0.5rem;
		padding-inline: 0.5rem;
		padding-block: 0.25rem;
	}

	.notification .icon {
		margin-inline-end: 0.5rem;
	}

	.notification-alert {
		border: 2px solid var(--amber-600);
		background-color: var(--amber-100);
		color: var(--amber-700);
		font-weight: 500;
	}

	.notification-text {
		margin: 0;
	}

	.notification-text strong {
		font-weight: 700;
	}
`;
