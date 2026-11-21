import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import '../../../../.storybook/fixtures/plot-host';

const meta = {
	title: 'Results/Plot controller',
	component: 'storybook-plot-host',
	parameters: {
		docs: {
			description: {
				component:
					'Do: render Observable Plot output through the shared controller so it uses resolved chart tokens, inherits typography and reflows with its wrapper. Don’t: import Plot in a chart element or rely on colour alone; every chart also needs a native data table.'
			}
		}
	},
	render: () => html`<storybook-plot-host></storybook-plot-host>`
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Dots drawn with the first chart token on the fixed 0 to 1 domain. */
export const Default: Story = {};
/** The wrapper shrinks to a 320 px column and the chart reflows with it. */
export const Narrow: Story = {
	render: () =>
		html`<div style="inline-size: 20rem"><storybook-plot-host></storybook-plot-host></div>`
};
/** Logical layout under right-to-left direction. */
export const RTL: Story = {
	render: () => html`<div dir="rtl"><storybook-plot-host></storybook-plot-host></div>`
};
