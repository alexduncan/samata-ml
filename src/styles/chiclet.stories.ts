import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';

/** Supplementary labels using the production chiclet styles. */
const meta = {
	title: 'Primitives/Chiclet',
	parameters: {
		docs: {
			description: {
				component:
					'Do: use a chiclet for a short supplementary label and pair status colour with meaningful text. Don’t: make a chiclet interactive or use colour as the only status information.'
			}
		}
	},
	render: () => html`<span class="chiclet">Numeric</span>`
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Inline default label. */
export const Default: Story = {};
/** Purple solid status label. */
export const Purple: Story = {
	render: () => html`<span class="chiclet chiclet-purple">Draft</span>`
};
/** Teal solid status label. */
export const Teal: Story = {
	render: () => html`<span class="chiclet chiclet-teal">Trained</span>`
};
/** Amber solid label with the approved contrasting text. */
export const Amber: Story = { render: () => html`<span class="chiclet chiclet-amber">Beta</span>` };
/** Wrapping supplementary text. */
export const LongLabel: Story = {
	render: () =>
		html`<span class="chiclet"
			>A long supplementary label that wraps when space is limited</span
		>`
};
/** Default and solid labels with inherited right-to-left direction. */
export const RTL: Story = {
	beforeEach: () => {
		document.documentElement.dir = 'rtl';
	},
	render: () =>
		html`<span class="chiclet">رقمي</span> <span class="chiclet chiclet-teal">مكتمل</span>`
};
