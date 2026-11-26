import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { AppContentDialog } from './app-content-dialog';
import './app-content-dialog';

type ContentDialogArgs = Pick<
	AppContentDialog,
	'open' | 'heading' | 'status' | 'contentLang' | 'contentDir' | 'labels'
> & { longContent?: boolean };

function prose(rtl: boolean, long: boolean): DocumentFragment {
	const fragment = document.createDocumentFragment();
	if (long) {
		for (const label of ['الأول', 'الثاني', 'الثالث']) {
			const paragraph = document.createElement('p');
			paragraph.textContent = 'مراجعة النتائج ومعلومات مجموعة البيانات. '.repeat(18);
			const button = document.createElement('button');
			button.type = 'button';
			button.textContent = label;
			fragment.append(paragraph, button);
		}
		return fragment;
	}
	const paragraph = document.createElement('p');
	paragraph.textContent = rtl
		? 'تتم معالجة البيانات داخل المتصفح.'
		: 'Your dataset and models stay in this browser.';
	fragment.append(paragraph);
	if (rtl) return fragment;
	const heading = document.createElement('h3');
	heading.textContent = 'Stored data';
	const table = document.createElement('table');
	const caption = document.createElement('caption');
	caption.textContent = 'Browser storage';
	const header = document.createElement('thead');
	const headerRow = document.createElement('tr');
	for (const label of ['Store', 'Contents']) {
		const cell = document.createElement('th');
		cell.scope = 'col';
		cell.textContent = label;
		headerRow.append(cell);
	}
	header.append(headerRow);
	const body = document.createElement('tbody');
	const row = document.createElement('tr');
	for (const label of ['IndexedDB', 'Dataset rows']) {
		const cell = document.createElement('td');
		cell.textContent = label;
		row.append(cell);
	}
	body.append(row);
	table.append(caption, header, body);
	fragment.append(heading, table);
	return fragment;
}

const meta = {
	title: 'Shell/Content Dialog',
	component: 'app-content-dialog',
	parameters: {
		docs: {
			description: {
				component:
					'Do: pass a safe DocumentFragment from the content loader and translated labels. The dialog clones the fragment and emits user dismissal without deciding a route. Don’t: pass HTML strings, consume the source fragment or reopen it on a loading-only update. Prose styling remains a human-owned draft.'
			}
		}
	},
	args: {
		open: true,
		heading: 'Privacy Policy',
		status: 'loading' as 'loading' | 'ready' | 'error',
		contentLang: '',
		contentDir: '' as '' | 'ltr' | 'rtl',
		labels: {
			close: 'Close',
			loadError:
				'This content could not be loaded. Check your connection, then close this dialog and try again.'
		}
	},
	render: (args) =>
		html`<app-content-dialog
			.open=${args.open}
			.heading=${args.heading}
			.status=${args.status}
			.content=${args.status === 'ready'
				? prose(args.contentDir === 'rtl', Boolean(args.longContent))
				: null}
			.contentLang=${args.contentLang}
			.contentDir=${args.contentDir}
			.labels=${args.labels}></app-content-dialog>`
} satisfies Meta<ContentDialogArgs>;
export default meta;
type Story = StoryObj<ContentDialogArgs>;

/** Empty, busy body while the loader is pending. */
export const Loading: Story = {};
/** Safe structured prose with correctly scoped table headers. */
export const Ready: Story = { args: { status: 'ready', contentLang: 'en', contentDir: 'ltr' } };
/** A single translated load failure alert. */
export const Error: Story = { args: { status: 'error' } };
/** A long title wraps beside the native icon control. */
export const LongHeading: Story = {
	args: {
		status: 'ready',
		heading:
			'Privacy and browser storage information with a long descriptive heading that wraps beside its close control'
	}
};
/** Ready content supplies its language and right-to-left direction. */
export const RTL: Story = {
	beforeEach: () => {
		document.documentElement.lang = 'ar';
		document.documentElement.dir = 'rtl';
	},
	args: {
		status: 'ready',
		heading: 'خصوصية البيانات',
		contentLang: 'ar',
		contentDir: 'rtl',
		labels: { close: 'إغلاق', loadError: 'تعذّر تحميل المحتوى.' }
	}
};

/** The sticky header leaves the three keyboard controls reachable in long Arabic prose. */
export const LongRtlContent: Story = {
	...RTL,
	args: {
		...RTL.args,
		longContent: true,
		heading: 'معلومات مهمة جداً عن مجموعة البيانات ونتائج التحليل'
	}
};
