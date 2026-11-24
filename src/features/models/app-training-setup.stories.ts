import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, fn, userEvent } from 'storybook/test';
import type { AppTrainingSetup } from './app-training-setup';
import { createCrossValidationSetup } from './training-setup';
import './app-training-setup';

type SetupArgs = Partial<
	Pick<AppTrainingSetup, 'value' | 'maxFolds' | 'blockedReason' | 'disabled' | 'labels'>
>;

/** Training strategy, fold controls and an accessible partition preview. */
const meta = {
	title: 'Models/Training Setup',
	component: 'app-training-setup',
	tags: ['autodocs'],
	parameters: {
		docs: {
			description: {
				component:
					'Do: provide the target-specific fold limit, translated labels and a reason whenever the target blocks setup. Save the setup from the change or submit event. Don’t hide validation errors or treat the preview as actual row assignments.'
			}
		}
	},
	render: ({
		value = null,
		maxFolds = 10,
		blockedReason = '',
		disabled = false,
		labels
	}: SetupArgs) => {
		const setup = document.createElement('app-training-setup');
		setup.value = value;
		setup.maxFolds = maxFolds;
		setup.blockedReason = blockedReason;
		setup.disabled = disabled;
		if (labels) setup.labels = labels;
		return setup;
	}
} satisfies Meta<SetupArgs>;
export default meta;
type Story = StoryObj<SetupArgs>;

async function getForm(canvasElement: HTMLElement) {
	const setup = canvasElement.querySelector('app-training-setup')!;
	await setup.updateComplete;
	const root = setup.shadowRoot!;
	return { setup, root, form: root.querySelector('form')! };
}

/** WML-P2-COMP-5: One-Shot with a fixed ratio and seed. */
export const OneShot: Story = {
	name: 'WML-P2-COMP-5: OneShot',
	play: async ({ canvasElement }) => {
		const { setup, root, form } = await getForm(canvasElement);
		expect(root.querySelector('select')?.value).toBe('one_shot');
		expect(root.querySelector('#strategy-description')?.textContent).toContain(
			'Train once on one part of the data'
		);
		expect(root.querySelector('#strategy-description .field-dependent')?.textContent).toContain(
			'80%'
		);
		expect(root.querySelector('.fold-matrix')).toBeNull();

		const submit = fn();
		setup.addEventListener('app-training-setup-submit', submit);
		form.requestSubmit();
		expect(submit).toHaveBeenCalledTimes(1);
		expect(submit).toHaveBeenCalledWith(
			expect.objectContaining({
				detail: { setup: { type: 'one_shot', testRatio: 0.2, randomState: 42 } },
				bubbles: false,
				composed: false
			})
		);
	}
};

/** WML-P2-COMP-5: selecting Cross-Validation shows the default folds. */
export const CrossValidation: Story = {
	name: 'WML-P2-COMP-5: CrossValidation',
	play: async ({ canvasElement }) => {
		const { setup, root } = await getForm(canvasElement);
		const change = fn();
		setup.addEventListener('app-training-setup-change', change);
		await userEvent.selectOptions(root.querySelector('select')!, 'nested_cv');
		await setup.updateComplete;
		expect(root.querySelector('#strategy-description')?.textContent).toContain(
			'Divide the data into groups'
		);
		expect(root.querySelector('#strategy-description .field-dependent')).toBeNull();
		expect(change).toHaveBeenCalledTimes(1);
		expect(change).toHaveBeenCalledWith(
			expect.objectContaining({
				detail: { setup: createCrossValidationSetup(5) },
				bubbles: false,
				composed: false
			})
		);
		expect(root.querySelectorAll('tbody tr')).toHaveLength(5);
		expect(root.querySelectorAll('.fold-validation')).toHaveLength(5);
		expect(root.querySelector('caption')?.textContent?.trim()).toBe(
			'Cross-validation training iterations'
		);
	}
};

/** WML-P2-COMP-5: the smallest fold matrix. */
export const MinFolds: Story = {
	name: 'WML-P2-COMP-5: MinFolds',
	args: { value: createCrossValidationSetup(2), maxFolds: 2 },
	play: async ({ canvasElement }) => {
		const { root } = await getForm(canvasElement);
		expect(root.querySelectorAll('tbody td')).toHaveLength(4);
		expect(root.querySelector<HTMLInputElement>('input[type=range]')?.max).toBe('2');
	}
};

/** WML-P2-COMP-5: the largest supported fold matrix. */
export const MaxFolds: Story = {
	name: 'WML-P2-COMP-5: MaxFolds',
	args: { value: createCrossValidationSetup(10) },
	play: async ({ canvasElement }) => {
		const { root } = await getForm(canvasElement);
		expect(root.querySelectorAll('tbody td')).toHaveLength(100);
		expect(root.querySelectorAll('td.fold-training')).toHaveLength(90);
	}
};

/** WML-P2-COMP-5: saved count exceeds the current target's limit. */
export const SavedAboveMaximum: Story = {
	name: 'WML-P2-COMP-5: SavedAboveMaximum',
	args: { value: createCrossValidationSetup(5), maxFolds: 4 },
	play: async ({ canvasElement }) => {
		const { setup, root, form } = await getForm(canvasElement);
		const number = root.querySelector<HTMLInputElement>('input[type=number]')!;
		expect(number.value).toBe('5');
		expect(root.querySelector<HTMLInputElement>('input[type=range]')?.value).toBe('4');
		expect(root.querySelectorAll('tbody tr')).toHaveLength(5);
		expect(number.getAttribute('aria-invalid')).toBe('true');
		expect(root.querySelector('[aria-live]')?.textContent).toBe('');

		const submit = fn();
		setup.addEventListener('app-training-setup-submit', submit);
		form.requestSubmit();
		await setup.updateComplete;
		expect(root.activeElement).toBe(number);
		expect(submit).not.toHaveBeenCalled();
	}
};

/** WML-P2-COMP-5: the fold error leaves the previous partition visible. */
export const InvalidFolds: Story = {
	name: 'WML-P2-COMP-5: InvalidFolds',
	args: { value: createCrossValidationSetup(5) },
	play: async ({ canvasElement }) => {
		const { setup, root } = await getForm(canvasElement);
		const number = root.querySelector<HTMLInputElement>('input[type=number]')!;
		const change = fn();
		setup.addEventListener('app-training-setup-change', change);
		number.value = '11';
		number.dispatchEvent(new Event('input'));
		number.dispatchEvent(new FocusEvent('blur'));
		await setup.updateComplete;
		expect(number.value).toBe('11');
		expect(number.getAttribute('aria-invalid')).toBe('true');
		expect(root.querySelector('[aria-live]')?.textContent).toContain('between 2 and 10');
		expect(root.querySelectorAll('tbody tr')).toHaveLength(5);
		expect(root.querySelector('button')?.disabled).toBe(false);
		expect(change).not.toHaveBeenCalled();
	}
};

/** WML-P2-COMP-5: the current target cannot use either strategy. */
export const Blocked: Story = {
	name: 'WML-P2-COMP-5: Blocked',
	args: {
		maxFolds: 0,
		blockedReason: 'Choose a target with at least two labelled rows in each class.'
	},
	play: async ({ canvasElement }) => {
		const { root } = await getForm(canvasElement);
		expect(root.querySelector('[role=alert]')?.textContent).toContain(
			'at least two labelled rows'
		);
		expect(root.querySelector('button')?.getAttribute('aria-describedby')).toBe(
			'training-setup-blocked'
		);
		expect(root.querySelector('select')?.disabled).toBe(true);
		expect(root.querySelector('button')?.disabled).toBe(true);
		expect(root.querySelector('#strategy-description')?.textContent).toContain(
			'Train once on one part of the data'
		);
	}
};

/** WML-P2-COMP-5: every control is read-only during an external operation. */
export const Disabled: Story = {
	name: 'WML-P2-COMP-5: Disabled',
	args: { value: createCrossValidationSetup(5), disabled: true },
	play: async ({ canvasElement }) => {
		const { setup, root, form } = await getForm(canvasElement);
		expect(
			root.querySelectorAll('select:disabled, input:disabled, button:disabled')
		).toHaveLength(4);
		expect(root.querySelector('#strategy-description')?.textContent).toContain(
			'Divide the data into groups'
		);
		const submit = fn();
		setup.addEventListener('app-training-setup-submit', submit);
		form.requestSubmit();
		expect(submit).not.toHaveBeenCalled();
	}
};

/** WML-P2-COMP-5: translated labels have space to wrap. */
export const LongLabel: Story = {
	name: 'WML-P2-COMP-5: LongLabel',
	render: () => {
		const setup = document.createElement('app-training-setup');
		setup.value = createCrossValidationSetup(5);
		setup.style.maxInlineSize = '16rem';
		setup.labels = {
			...setup.labels,
			strategyLabel: 'Training strategy for evaluating the fitted model',
			crossValidationDefinition:
				'Divide your labelled rows into several groups, then train a model and check how it performs several times, setting aside a different group on each check.',
			foldsLabel: 'Number of cross-validation folds for evaluating the fitted model'
		};
		return setup;
	},
	play: async ({ canvasElement }) => {
		const { root } = await getForm(canvasElement);
		const description = root.getElementById('strategy-description')!;
		expect(description.textContent).toContain('Divide your labelled rows into several groups');
		expect(description.scrollWidth).toBeLessThanOrEqual(description.clientWidth + 1);
	}
};

/** WML-P2-COMP-5: field and matrix order in right-to-left direction. */
export const RTL: Story = {
	name: 'WML-P2-COMP-5: RTL',
	render: () => html`
		<app-training-setup dir="rtl" .value=${createCrossValidationSetup(5)}></app-training-setup>
	`,
	play: async ({ canvasElement }) => {
		const { root } = await getForm(canvasElement);
		const description = root.getElementById('strategy-description')!;
		expect(getComputedStyle(description).direction).toBe('rtl');
		expect(description.scrollWidth).toBeLessThanOrEqual(description.clientWidth + 1);
	}
};
