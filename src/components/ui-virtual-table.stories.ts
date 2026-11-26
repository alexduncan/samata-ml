import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect } from 'storybook/test';
import '../../.storybook/fixtures/storybook-virtual-table-host';
import type { VirtualTableColumn } from './ui-virtual-table';

const EVERY_KIND: readonly VirtualTableColumn[] = [
	{ key: 'income', label: 'Annual income', sublabel: 'income', kind: 'numeric', contentChars: 8 },
	{
		key: 'joined',
		label: 'Joined',
		sublabel: 'joined',
		kind: 'temporal',
		unsupported: true,
		contentChars: 10
	},
	{ key: 'member', label: 'Member', kind: 'boolean', contentChars: 5 },
	{ key: 'plan', label: 'Plan', kind: 'categorical', contentChars: 7 },
	{ key: 'notes', label: 'Notes', kind: 'text', unsupported: true }
];

/** Usage guidance for the document-scrolled virtual table. */
const meta = {
	title: 'Components/Virtual table',
	component: 'ui-virtual-table',
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Do: let the document scroll the table, answer ui-virtual-table-range-change with the requested rows, format every cell as text in the consumer, and set --ui-virtual-table-sticky-offset to the height of any sticky header above it. Don’t: wrap it in an element with overflow, give header buttons title or aria-label, pass markup as cell text, or rely on colour alone for unsupported columns.'
			}
		}
	},
	render: () =>
		html`<storybook-virtual-table-host
			.columns=${EVERY_KIND}
			.totalRows=${150}></storybook-virtual-table-host>`
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Populated 150-row table with every column kind, content-based widths and two unsupported columns. */
export const Populated: Story = {
	play: async ({ canvasElement }) => {
		const host = canvasElement.querySelector('storybook-virtual-table-host')!;
		const table = host.shadowRoot!.querySelector('ui-virtual-table')!;
		await table.updateComplete;
		await expect(table.shadowRoot!.querySelector('.table-container')).toHaveAttribute(
			'aria-rowcount',
			'151'
		);
	}
};

/** No rows: header only. */
export const Empty: Story = {
	render: () =>
		html`<storybook-virtual-table-host
			.columns=${EVERY_KIND}
			.totalRows=${0}></storybook-virtual-table-host>`
};

/** Rows requested but not yet supplied: placeholder cells marked busy. */
export const Placeholders: Story = {
	render: () =>
		html`<ui-virtual-table
			.columns=${EVERY_KIND}
			.totalRows=${150}
			.loading=${true}
			label="Loading rows"></ui-virtual-table>`
};

/** Unsupported columns carry a hidden suffix, an icon and a red treatment, never colour alone. */
export const UnsupportedColumn: Story = {
	render: () =>
		html`<storybook-virtual-table-host
			.columns=${EVERY_KIND.filter((column) => column.unsupported)}
			.totalRows=${40}></storybook-virtual-table-host>`
};

/** Display name and raw column name on one line, the raw name in regular weight. */
export const DisplayNameHeaders: Story = {
	render: () =>
		html`<storybook-virtual-table-host
			.columns=${[
				{ key: 'age_cat', label: 'Age category', sublabel: 'age_cat', kind: 'categorical' },
				{ key: 'age', label: 'age', kind: 'numeric' }
			]}
			.totalRows=${40}></storybook-virtual-table-host>`
};

/** Ten million rows: the rail stops at the browser-safe row limit. */
export const Capped: Story = {
	render: () =>
		html`<storybook-virtual-table-host
			.columns=${EVERY_KIND}
			.totalRows=${10_000_000}></storybook-virtual-table-host>`
};

/** A very long display name truncates with an ellipsis; the full text stays in the button's name. */
export const LongLabel: Story = {
	render: () =>
		html`<storybook-virtual-table-host
			.columns=${[
				{
					key: 'long',
					label: 'An exceptionally long display name for one column',
					sublabel: 'an_exceptionally_long_column_name',
					kind: 'text',
					contentChars: 1
				}
			]}
			.totalRows=${40}></storybook-virtual-table-host>`
};

/** Right-to-left document: rows start at the inline start and the icon margin mirrors. */
export const RTL: Story = {
	beforeEach: () => {
		document.documentElement.dir = 'rtl';
		return () => {
			document.documentElement.dir = 'ltr';
		};
	}
};
