import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, userEvent, within } from 'storybook/test';
import '../../.storybook/fixtures/storybook-button-host';

/** Usage guidance for the shared native button styles. */
const meta = {
	title: 'Primitives/Button',
	parameters: {
		docs: {
			description: {
				component:
					'Do: use a native button with an explicit type and a concise action label. Use .btn-primary for the main action. Don’t: use a button for navigation or remove the visible keyboard focus outline.'
			}
		}
	},
	render: () => html`<button class="btn" type="button">Datasheet</button>`
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Standard supplementary action. */
export const Default: Story = {};
/** Main action with the primary treatment. */
export const Primary: Story = {
	render: () => html`<button class="btn btn-primary" type="button">Select Dataset</button>`
};
/** Standard and primary actions together. */
export const Pair: Story = {
	render: () =>
		html`<button class="btn" type="button">Datasheet</button>
			<button class="btn btn-primary" type="button">Select Dataset</button>`
};
/** Both variants using native disabled semantics. */
export const Disabled: Story = {
	render: () =>
		html`<button class="btn" type="button" disabled>Datasheet</button>
			<button class="btn btn-primary" type="button" disabled>Select Dataset</button>`
};
/** Sixty-character label in the acceptance criterion's 200px container. */
export const LongLabel: Story = {
	render: () =>
		html`<div style="inline-size: 200px">
			<button class="btn" type="button">
				${'Long button label '.repeat(4).slice(0, 60)}
			</button>
		</div>`
};
/** Both variants in document-level right-to-left direction. */
export const RTL: Story = {
	beforeEach: () => {
		document.documentElement.dir = 'rtl';
	},
	render: () =>
		html`<button class="btn" type="button">اختيار مجموعة البيانات</button>
			<button class="btn btn-primary" type="button">تحميل البيانات</button>`
};
/** Standard-decorator property updates and shared styles in a Lit shadow root. */
export const ShadowHost: Story = {
	render: () => html`<storybook-button-host label="Initial label"></storybook-button-host>`,
	play: async ({ canvasElement }) => {
		const host = canvasElement.querySelector('storybook-button-host')!;
		await host.updateComplete;
		const canvas = within(host.shadowRoot! as unknown as HTMLElement);
		await expect(canvas.getByRole('button', { name: 'Initial label' })).toBeVisible();
		host.label = 'Updated label';
		await host.updateComplete;
		await expect(canvas.getByRole('button', { name: 'Updated label' })).toBeVisible();
		const button = canvas.getByRole('button', { name: /^Updated label$/ });
		await userEvent.click(button);
		await expect(getComputedStyle(button).borderRadius).toBe('8px');
	}
};

/** Named native icon control containing decorative SVG. */
export const Icon: Story = {
	render: () =>
		html`<button class="btn-icon" type="button" aria-label="Close modal">
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="1.5"
				aria-hidden="true"
				focusable="false">
				<line x1="18" y1="6" x2="6" y2="18" />
				<line x1="6" y1="6" x2="18" y2="18" />
			</svg>
		</button>`
};
