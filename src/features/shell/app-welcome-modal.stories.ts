import { html } from 'lit';
import type { Decorator, Meta, StoryObj } from '@storybook/web-components-vite';
import { expect } from 'storybook/test';
import { setBetaDeploymentForTests } from '../../common/telemetry/telemetry-client';
import { parseRoute } from '../../router/route-parser';
import { $route } from '../../router/router';
import { $appState } from '../../stores/app.store';
import { INITIAL_APP_STATE } from '../../types/state';
import './app-welcome-modal';

const withBetaDeployment: Decorator = (story) => {
	setBetaDeploymentForTests(true);
	return story();
};

const meta = {
	title: 'Shell/Welcome',
	component: 'app-welcome-modal',
	parameters: {
		docs: {
			description: {
				component:
					'Do: allow native Esc dismissal outside the beta gate, show the beta analytics disclosure and privacy link on beta.samata.ml, and persist acceptance on Get Started. Route-driven hiding leaves onboarding available. Don’t: add a custom focus trap or fallback open attribute.'
			}
		}
	},
	beforeEach: () => {
		document.documentElement.dir = 'ltr';
		document.documentElement.style.fontSize = '';
		$appState.set(structuredClone(INITIAL_APP_STATE));
		$route.set(parseRoute('/data'));
		setBetaDeploymentForTests(false);
		return () => {
			document.documentElement.dir = 'ltr';
			document.documentElement.style.fontSize = '';
			setBetaDeploymentForTests(false);
		};
	},
	render: () => html`<app-welcome-modal></app-welcome-modal>`
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** First visit with its native modal and primary action. */
export const Open: Story = {};

/** Beta deployment welcome dialog showing the telemetry disclosure and privacy link. */
export const BetaNotice: Story = {
	decorators: [withBetaDeployment],
	beforeEach: () => {
		setBetaDeploymentForTests(true);
		return () => setBetaDeploymentForTests(false);
	},
	play: async ({ canvasElement }) => {
		const welcome = canvasElement.querySelector('app-welcome-modal')!;
		await welcome.updateComplete;
		const dialog = welcome.shadowRoot!.querySelector('dialog')!;
		await expect(dialog).toHaveAttribute('closedby', 'none');
		const cancel = new Event('cancel', { cancelable: true });
		dialog.dispatchEvent(cancel);
		await expect(cancel.defaultPrevented).toBe(true);
		await expect(dialog).toHaveProperty('open', true);
		await expect($appState.get().onboarding.betaTelemetryAccepted).toBe(false);
	}
};

/** The same onboarding inheriting right-to-left document direction. */
export const RTL: Story = {
	beforeEach: () => {
		document.documentElement.dir = 'rtl';
	}
};

/** Beta notice constrained by enlarged text scaling to verify wrapping and button visibility. */
export const LongNotice: Story = {
	decorators: [withBetaDeployment],
	beforeEach: () => {
		document.documentElement.style.fontSize = '22px';
		setBetaDeploymentForTests(true);
		return () => {
			document.documentElement.style.fontSize = '';
			setBetaDeploymentForTests(false);
		};
	}
};
