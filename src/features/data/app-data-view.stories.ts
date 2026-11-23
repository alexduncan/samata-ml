import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, userEvent, within } from 'storybook/test';
import { resetSampleDatasetCache } from './sample-datasets';
import { seedTrainingConfirmation } from '../../../.storybook/fixtures/training-confirmation';
import './app-data-view';

const meta = {
	title: 'Data/Change dataset',
	component: 'app-data-view',
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		a11y: { test: 'error' },
		docs: {
			description: {
				component:
					'Do: keep source notices near direct-download cards and retain labelled actions. Do wait for the saved change. Don’t show a download notice for bundled samples or repeat a committed deletion.'
			}
		}
	},
	render: () => html`<app-data-view></app-data-view>`
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** A committed dataset removal asks for publication-only retry. */
export const PublicationPending: Story = {
	beforeEach: () =>
		seedTrainingConfirmation({
			discardDataset: async () => ({
				ok: false,
				code: 'storage-unavailable',
				pending: 'discard'
			})
		}),
	play: async ({ canvasElement }) => {
		const view = canvasElement.querySelector('app-data-view')!;
		await view.updateComplete;
		view.shadowRoot!.querySelector('app-dataset-preview')!.dispatchEvent(
			new CustomEvent('app-preview-change-dataset')
		);
		await view.updateComplete;
		const dialog = view.shadowRoot!.querySelector<HTMLDialogElement>(
			'dialog.change-dataset-modal'
		)!;
		await userEvent.click(within(dialog).getByRole('button', { name: 'Change Dataset' }));
		await expect(
			await within(dialog).findByRole('button', { name: 'Retry saving' })
		).toBeVisible();
	}
};

const catalogueFixture =
	(origin: 'bundled' | 'remote', long = false, rtl = false) =>
	() => {
		const previous = globalThis.fetch;
		resetSampleDatasetCache();
		const name = long
			? 'A sample with a deliberately extended name to exercise wrapping at narrow widths'
			: 'Example sample';
		const fixture = {
			version: 1,
			entries: [
				{
					id: 'example',
					name,
					tagline: long
						? 'A longer description explaining the educational sample and its direct download in a constrained layout.'
						: 'A sample dataset.',
					domain: 'biology',
					difficulty: 'beginner',
					tags: [],
					taskTypes: ['binary-classification'],
					license: 'CC0-1.0',
					csvOrigin: origin,
					stats: {
						rowCount: 150,
						columnCount: 4,
						fileSizeBytes: 20,
						sha256: '0'.repeat(64),
						hasMissingValues: false
					},
					descriptorUrl: '/datasets/example/descriptor.json?v=123456789abc'
				}
			]
		};
		globalThis.fetch = Object.assign(
			async () =>
				new Response(JSON.stringify(fixture), {
					headers: { 'content-type': 'application/json' }
				}),
			{ preconnect: async () => {} }
		) as typeof fetch;
		if (rtl) document.documentElement.dir = 'rtl';
		return () => {
			globalThis.fetch = previous;
			resetSampleDatasetCache();
		};
	};
const checkNotice =
	(origin: 'bundled' | 'remote') =>
	async ({ canvasElement }: { canvasElement: HTMLElement }) => {
		const view = canvasElement.querySelector('app-data-view')!;
		await view.whenSettled();
		const notice = view.shadowRoot!.querySelector('.remote-notice');
		if (origin === 'remote')
			await expect(notice).toHaveTextContent(
				'Downloaded from the source when loaded. Internet connection required.'
			);
		else await expect(notice).toBeNull();
	};
/** A same-origin sample has no remote notice. */
export const BundledSample: Story = {
	beforeEach: catalogueFixture('bundled'),
	play: checkNotice('bundled')
};
/** A direct sample explains its network dependency. */
export const DirectSample: Story = {
	beforeEach: catalogueFixture('remote'),
	play: checkNotice('remote')
};
/** Long text fits the same card and notice layout. */
export const LongLabel: Story = {
	beforeEach: catalogueFixture('remote', true),
	play: checkNotice('remote')
};
/** The direct notice inherits right-to-left direction. */
export const RTL: Story = {
	beforeEach: catalogueFixture('remote', true, true),
	play: checkNotice('remote')
};
