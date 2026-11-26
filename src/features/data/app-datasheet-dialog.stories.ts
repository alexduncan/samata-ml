import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './app-datasheet-dialog';

type DatasheetArgs = { heading: string; status: 'loading' | 'ready' | 'error'; paragraph: string };

const meta = {
	title: 'Data/Datasheet dialog',
	component: 'app-datasheet-dialog',
	render: ({ heading, status, paragraph }) => {
		const fragment = document.createDocumentFragment();
		const prose = document.createElement('p');
		prose.textContent = paragraph;
		fragment.append(prose);
		return html`<app-datasheet-dialog
			.open=${true}
			.heading=${heading}
			.status=${status}
			.content=${fragment}></app-datasheet-dialog>`;
	},
	args: {
		heading: 'Iris',
		status: 'ready' as 'loading' | 'ready' | 'error',
		paragraph: 'Measurements and species of three types of iris.'
	}
} satisfies Meta<DatasheetArgs>;
export default meta;
type Story = StoryObj<DatasheetArgs>;

/** Ready datasheet inside the shared content modal. */
export const Ready: Story = {};
/** Retry remains available in the content area. */
export const LoadError: Story = { args: { status: 'error' } };
/** The title and dismiss control fit together in RTL. */
export const LongRtlTitle: Story = {
	beforeEach: () => {
		document.documentElement.dir = 'rtl';
	},
	args: { heading: 'معلومات مهمة عن مجموعة البيانات وقياسات أنواع أزهار السوسن' }
};
