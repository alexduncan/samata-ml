import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, userEvent } from 'storybook/test';
import '../../.storybook/fixtures/storybook-hyperparameter-field-host';

/** Usage guidance for the shared hyperparameter field styles. */
const meta = {
	title: 'Primitives/Hyperparameter field',
	parameters: {
		docs: {
			description: {
				component:
					'Do: give every control a native label and link descriptions with aria-describedby. Place a fold matrix inside a named, focusable scroll region. Don’t hide the error reported by aria-invalid or use colour alone for fold roles.'
			}
		}
	},
	render: () => html`<storybook-hyperparameter-field-host></storybook-hyperparameter-field-host>`
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Select, checkbox, range pair, number with Reset, abbreviation, dependent note and error. */
export const Default: Story = {};

/** WML-P1-STYLE-2: computed border and focus outline checks. */
export const FocusAndBorders: Story = {
	play: async ({ canvasElement }) => {
		const host = canvasElement.querySelector('storybook-hyperparameter-field-host')!;
		await host.updateComplete;
		const root = host.shadowRoot!;
		const select = root.querySelector('select')!;
		const checkbox = root.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
		const range = root.querySelector<HTMLInputElement>('input[type="range"]')!;
		const number = root.querySelector<HTMLInputElement>('input[type="number"]')!;

		// WML-P1-STYLE-2: A11Y-07 border on number input and select only. Browsers snap
		// 1.5px to a whole device pixel at 1x, so accept 1px as the snapped value.
		for (const bordered of [number, select]) {
			const style = getComputedStyle(bordered);
			expect(['1.5px', '1px']).toContain(style.borderTopWidth);
			expect(style.borderTopStyle).toBe('solid');
		}
		for (const plain of [range, checkbox]) {
			expect(getComputedStyle(plain).borderTopStyle).not.toBe('solid');
			expect(getComputedStyle(plain).paddingTop).toBe('0px');
		}

		// WML-P1-STYLE-2: A11Y-08 outline after keyboard focus
		const controls = [select, checkbox, range, number];
		await userEvent.keyboard('{Shift}');
		for (const control of controls) {
			// Testing Library cannot tab into a shadow root, so move focus after a key event
			await userEvent.keyboard('{Tab}');
			control.focus();
			expect(root.activeElement).toBe(control);
			expect(getComputedStyle(control).outlineWidth).toBe('2px');
		}
	}
};

/** A long label that wraps inside the grid. */
export const LongLabel: Story = {
	render: () => html`
		<storybook-hyperparameter-field-host
			style="max-width: 20rem"></storybook-hyperparameter-field-host>
	`
};

/** Inherited right-to-left direction. */
export const RTL: Story = {
	beforeEach: () => {
		document.documentElement.dir = 'rtl';
	}
};

async function getMatrixRegion(canvasElement: HTMLElement): Promise<HTMLElement> {
	const host = canvasElement.querySelector('storybook-hyperparameter-field-host')!;
	await host.updateComplete;
	return host.shadowRoot!.querySelector<HTMLElement>('.fold-matrix-scroll')!;
}

/** WML-P2-STYLE-2: a ten-fold matrix scrolls within the preview. */
export const FoldsMatrix: Story = {
	name: 'WML-P2-STYLE-2: ten folds',
	render: () => html`
		<storybook-hyperparameter-field-host
			style="inline-size: 272px; max-inline-size: 100%"
			.folds=${10}></storybook-hyperparameter-field-host>
	`,
	play: async ({ canvasElement }) => {
		const wrapper = await getMatrixRegion(canvasElement);
		expect(wrapper.clientWidth).toBeGreaterThan(0);
		expect(wrapper.scrollWidth).toBeGreaterThan(wrapper.clientWidth);
	}
};

/** WML-P2-STYLE-2: a two-fold matrix fills the preview without overflow. */
export const FoldsMatrixTwo: Story = {
	name: 'WML-P2-STYLE-2: two folds',
	render: () => html`
		<storybook-hyperparameter-field-host
			style="inline-size: 272px; max-inline-size: 100%"
			.folds=${2}></storybook-hyperparameter-field-host>
	`,
	play: async ({ canvasElement }) => {
		const wrapper = await getMatrixRegion(canvasElement);
		expect(wrapper.clientWidth).toBeGreaterThan(0);
		expect(wrapper.scrollWidth).toBe(wrapper.clientWidth);
	}
};

/** WML-P2-STYLE-2: the matrix in right-to-left direction with a long caption. */
export const FoldsMatrixRtlLongLabel: Story = {
	name: 'WML-P2-STYLE-2: right-to-left with a long caption',
	render: () => html`
		<storybook-hyperparameter-field-host
			dir="rtl"
			style="inline-size: 272px; max-inline-size: 100%"
			.folds=${10}
			.matrixCaption=${'Cross-validation training and validation partitions by run'}></storybook-hyperparameter-field-host>
	`
};
