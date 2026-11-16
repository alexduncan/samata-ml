import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';

/** Page-heading structure using the shared production styles. */
const meta = {
	title: 'Primitives/Page Header',
	parameters: {
		docs: {
			description: {
				component:
					'Do: use one h1 followed by its description and an optional native action. Use tabindex="-1" when navigation focuses the heading. Don’t: add a normal Tab stop or remove the visible focus outline.'
			}
		}
	},
	render: () =>
		html`<header class="page-header">
			<h1 tabindex="-1">Select Data</h1>
			<p>Choose a dataset to explore.</p>
		</header>`
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Page title followed by its description. */
export const TitleAndDescription: Story = {};
/** Page heading with a native primary action. */
export const WithAction: Story = {
	render: () =>
		html`<header class="page-header">
			<h1 tabindex="-1">Select Data</h1>
			<p>Choose a dataset to explore.</p>
			<button class="btn btn-primary" type="button">Upload Dataset</button>
		</header>`
};
/** Long heading and description with a native action. */
export const LongLabel: Story = {
	render: () =>
		html`<header class="page-header">
			<h1 tabindex="-1">
				Explore a dataset with a long descriptive title and choose its classification target
			</h1>
			<p>
				Review column types and summaries before deciding which feature your model should
				predict.
			</p>
			<button class="btn btn-primary" type="button">Choose another dataset</button>
		</header>`
};
/** Heading layout inheriting right-to-left direction. */
export const RTL: Story = {
	beforeEach: () => {
		document.documentElement.dir = 'rtl';
	},
	render: () =>
		html`<header class="page-header">
			<h1 tabindex="-1">اختيار مجموعة البيانات</h1>
			<p>اختر مجموعة بيانات لاستكشافها.</p>
			<button class="btn btn-primary" type="button">تحميل البيانات</button>
		</header>`
};
