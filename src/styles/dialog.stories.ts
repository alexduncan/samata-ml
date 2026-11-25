import { html } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, userEvent, within } from 'storybook/test';
import { observeDialogHeader } from '../common/dom/dialog-header';

function renderDialog(longContent = false, rtl = false) {
	const dialog = createRef<HTMLDialogElement>();
	return html`<button
			class="btn"
			type="button"
			@click=${() => {
				const element = dialog.value;
				if (!element) return;
				element.showModal();
				observeDialogHeader(element);
			}}>
			Open dialog
		</button>
		<dialog class="modal" closedby="any" ${ref(dialog)} aria-labelledby="dialog-story-title">
			<header class="modal-header">
				<h2 id="dialog-story-title">
					${rtl ? 'معلومات مجموعة البيانات' : 'Dataset information'}
				</h2>
				<button
					type="button"
					class="btn-icon"
					aria-label=${rtl ? 'إغلاق' : 'Close dialog'}
					@click=${() => dialog.value?.close()}>
					<svg
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						aria-hidden="true"
						focusable="false">
						<path d="M6 6l12 12M18 6 6 18"></path>
					</svg>
				</button>
			</header>
			<div class="modal-content">
				<p>
					${rtl
						? 'راجع معلومات مجموعة البيانات قبل المتابعة.'
						: longContent
							? 'Review this dataset information before continuing. '.repeat(200)
							: 'Review the dataset information before continuing.'}
				</p>
			</div>
		</dialog>`;
}

/** Native modal behaviour using the shared production styles. */
const meta = {
	title: 'Primitives/Dialog',
	parameters: {
		docs: {
			story: { inline: false },
			description: {
				component:
					'Name each native dialog with its h2. Place the dismissal control in the sticky content header and permit backdrop dismissal with closedby="any". Put the safe action first in a confirmation.'
			}
		}
	},
	render: () => renderDialog(),
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole('button', { name: 'Open dialog' }));
		await expect(canvas.getByRole('dialog')).toBeVisible();
	}
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Named content modal with a sticky header. */
export const Default: Story = {};
/** Long content constrained to the viewport. */
export const LongContent: Story = { render: () => renderDialog(true) };
/** Modal labels and layout in inherited right-to-left direction. */
export const RTL: Story = {
	beforeEach: () => {
		document.documentElement.dir = 'rtl';
	},
	render: () => renderDialog(false, true)
};

/** The native confirmation initially focuses Cancel. */
export const Confirmation: Story = {
	render: () => {
		const dialog = createRef<HTMLDialogElement>();
		return html`
			<button type="button" class="btn" @click=${() => dialog.value?.showModal()}>
				Open dialog
			</button>
			<dialog class="confirm-dialog" ${ref(dialog)} aria-labelledby="confirm-story-title">
				<header class="confirm-header">
					<h2 id="confirm-story-title">Confirm change</h2>
				</header>
				<p class="confirm-body">Any configured target or models will be discarded.</p>
				<form method="dialog" class="confirm-footer">
					<button type="submit" class="btn" value="cancel">Cancel</button>
					<button type="submit" class="btn btn-primary" value="confirm">Continue</button>
				</form>
			</dialog>
		`;
	},
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		const open = canvas.getByRole('button', { name: 'Open dialog' });
		await userEvent.click(open);
		const cancel = canvas.getByRole('button', { name: 'Cancel' });
		await expect(cancel).toHaveFocus();
		await userEvent.click(cancel);
		await expect(canvas.queryByRole('dialog')).toBeNull();
		await expect(open).toHaveFocus();
	}
};
