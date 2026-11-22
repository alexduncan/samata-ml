import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, userEvent, within } from 'storybook/test';
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
				component: 'Do: wait for the saved change. Don’t repeat a committed deletion.'
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
