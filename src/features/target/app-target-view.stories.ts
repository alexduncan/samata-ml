import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, userEvent, within } from 'storybook/test';
import { seedTrainingConfirmation } from '../../../.storybook/fixtures/training-confirmation';
import './app-target-view';

const meta = {
	title: 'Target/Change target',
	component: 'app-target-view',
	tags: ['autodocs'],
	parameters: {
		layout: 'fullscreen',
		a11y: { test: 'error' },
		docs: {
			description: {
				component:
					'Do: keep the confirmation open while training holds the dataset. Don’t discard without acknowledgement.'
			}
		}
	},
	render: () => html`<app-target-view></app-target-view>`
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** A shared remote training lock keeps the target confirmation open. */
export const RemoteTraining: Story = {
	beforeEach: () =>
		seedTrainingConfirmation({
			discardTarget: async () => ({ ok: false, code: 'remote-training' })
		}),
	play: async ({ canvasElement }) => {
		const view = canvasElement.querySelector('app-target-view')!;
		await view.updateComplete;
		await userEvent.click(
			view.shadowRoot!.querySelector<HTMLButtonElement>(
				'button[aria-label="Set as Target: island"]'
			)!
		);
		const dialog = view.shadowRoot!.querySelector<HTMLDialogElement>('dialog.confirm-dialog')!;
		expect(view.shadowRoot!.activeElement).toBe(
			within(dialog).getByRole('button', { name: 'Cancel' })
		);
		await expect(dialog.querySelector('.confirm-body .notification-alert')).toBeNull();
		await userEvent.click(within(dialog).getByRole('button', { name: 'Change Target' }));
		await expect(await within(dialog).findByText('Training in another tab')).toBeVisible();
	}
};
