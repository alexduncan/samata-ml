import { html } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, userEvent, within } from 'storybook/test';

function renderDialog(longContent = false, rtl = false) {
	const dialog = createRef<HTMLDialogElement>();
	return html`<button class="btn" type="button" @click=${() => dialog.value?.showModal()}>
			Open dialog
		</button>
		<dialog ${ref(dialog)} aria-labelledby="dialog-story-title">
			<header class="modal-header">
				<h2 id="dialog-story-title">
					${rtl ? 'معلومات مجموعة البيانات' : 'Dataset information'}
				</h2>
			</header>
			<p>
				${rtl
					? 'راجع معلومات مجموعة البيانات قبل المتابعة.'
					: longContent
						? 'Review this dataset information before continuing. '.repeat(200)
						: 'Review the dataset information before continuing.'}
			</p>
			<form method="dialog">
				<button class="btn btn-primary" type="submit" value="close" autofocus>
					${rtl ? 'إغلاق' : 'Close dialog'}
				</button>
			</form>
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
					'Do: name a native dialog with its h2, open it with showModal(), and use native dismissal. Don’t: add dialog roles, a focus trap, an Escape handler or an unconditional display rule.'
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

/** Named native modal with a native close form. */
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
