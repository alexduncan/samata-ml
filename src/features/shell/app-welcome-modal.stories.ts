import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './app-welcome-modal';

const meta = {
	title: 'Shell/Welcome',
	component: 'app-welcome-modal',
	parameters: {
		docs: {
			description: {
				component:
					'Do: allow native Esc dismissal and persist a deliberate first-visit dismissal. Route-driven hiding leaves onboarding available. Don’t: add a custom focus trap, Esc handler or fallback open attribute.'
			}
		}
	},
	render: () => html`<app-welcome-modal></app-welcome-modal>`
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** First visit with its native modal and primary action. */
export const Open: Story = {};
/** The same onboarding inheriting right-to-left document direction. */
export const RTL: Story = {
	beforeEach: () => {
		document.documentElement.dir = 'rtl';
	}
};
