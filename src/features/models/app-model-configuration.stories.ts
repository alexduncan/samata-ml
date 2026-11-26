import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, userEvent } from 'storybook/test';
import type { HyperparameterConfig } from '../../types/state';
import type { ClassifierId } from './model-catalogue';
import { getModelDocument } from './model-documents';
import {
	buildConfigurationLabels,
	CONFIGURE_MODEL_MESSAGES,
	flatOptionMessages
} from './model-option-copy';
import type { ModelOptionContext } from './model-options';
import './app-model-configuration';
import type { AppModelConfiguration } from './app-model-configuration';

const text = { ...flatOptionMessages(), ...CONFIGURE_MODEL_MESSAGES };

function labelsFor(id: ClassifierId) {
	return buildConfigurationLabels(
		{
			text,
			reset: ({ name }) => `Reset ${name}`,
			removeLayer: ({ layer }) => `Remove layer ${layer}`,
			layerSize: ({ layer }) => `Layer ${layer} size`,
			exactValue: ({ name }) => `${name} (exact value)`
		},
		getModelDocument(id)
	);
}

interface Setup {
	id: ClassifierId;
	values?: HyperparameterConfig['values'];
	context?: ModelOptionContext;
	disabled?: boolean;
	multiclass?: 'one-vs-rest' | 'one-vs-one' | 'native' | null;
	style?: string;
}

function form({ id, values = {}, context, disabled = false, multiclass = null, style }: Setup) {
	return html`<app-model-configuration
		style=${style ?? ''}
		.document=${getModelDocument(id)}
		.value=${{ mode: 'manual', values } satisfies HyperparameterConfig}
		.context=${context ?? { rowCount: 150, classCount: 3 }}
		.multiclass=${multiclass}
		.disabled=${disabled}
		.labels=${labelsFor(id)}></app-model-configuration>`;
}

/** Manual hyperparameter form generated from a `web-ml` model document. */
const meta = {
	title: 'Models/Model configuration',
	component: 'app-model-configuration',
	parameters: {
		docs: {
			description: {
				component:
					'Do: pass a typed model document, pre-translated labels with complete field descriptions and the dataset context. Persist the sparse configuration from the change event. Don’t: import stores here, add controls for options the presentation policy hides, or disable Save & Continue to signal validation errors.'
			}
		}
	}
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Logistic Regression with the solver, penalty and notes. */
export const Logistic: Story = {
	render: () => form({ id: 'logistic-regression', multiclass: 'one-vs-rest' }),
	play: async ({ canvasElement }) => {
		const element =
			canvasElement.querySelector<AppModelConfiguration>('app-model-configuration')!;
		await element.updateComplete;
		const description = element.shadowRoot!.getElementById('solver-help')!;
		expect(description.textContent).toContain(
			'The solver is the method used to fit the model.'
		);
		expect(description.querySelector('abbr')).toBeNull();
	}
};
/** The MLP layer editor with two layers. */
export const MlpLayers: Story = {
	render: () => form({ id: 'mlp-classifier', values: { hiddenLayerSizes: [64, 32] } })
};
/** SVC gamma value mode and balanced class weights. */
export const SvcGamma: Story = {
	render: () =>
		form({
			id: 'support-vector-classifier',
			values: { gamma: 0.5, classWeight: 'balanced', kernel: 'poly' }
		})
};
/** Decision tree with a limited maximum depth. */
export const DecisionTreeDepth: Story = {
	render: () => form({ id: 'decision-tree-classifier', values: { maxDepth: 5 } })
};
/** Naive Bayes with its fixed-option notes. */
export const NaiveBayesFixed: Story = {
	render: () => form({ id: 'bernoulli-nb', values: { binarize: 0.5 } })
};
/** Three rows make the default of five neighbours invalid until it is lowered. */
export const KnnSmallDataset: Story = {
	render: () => form({ id: 'k-neighbors-classifier', context: { rowCount: 3, classCount: 2 } }),
	play: async ({ canvasElement }) => {
		const element =
			canvasElement.querySelector<AppModelConfiguration>('app-model-configuration')!;
		await element.updateComplete;
		let continued = 0;
		element.addEventListener('app-model-configuration-continue', () => (continued += 1));
		const root = element.shadowRoot!;
		const submit = root.querySelector<HTMLButtonElement>('button[type="submit"]')!;
		await userEvent.click(submit);
		await element.updateComplete;
		const number = root.querySelector<HTMLInputElement>('#nNeighbors-number')!;
		expect(root.activeElement).toBe(number);
		expect(number.getAttribute('aria-invalid')).toBe('true');
		expect(continued).toBe(0);

		number.value = '3';
		number.dispatchEvent(new Event('input', { bubbles: true }));
		await element.updateComplete;
		await userEvent.click(submit);
		expect(continued).toBe(1);
	}
};
/** A persisted invalid solver and penalty pair shows its error after Save & Continue. */
export const Invalid: Story = {
	render: () => form({ id: 'logistic-regression', values: { solver: 'lbfgs', penalty: 'l1' } }),
	play: async ({ canvasElement }) => {
		const element =
			canvasElement.querySelector<AppModelConfiguration>('app-model-configuration')!;
		await element.updateComplete;
		const root = element.shadowRoot!;
		await userEvent.click(root.querySelector<HTMLButtonElement>('button[type="submit"]')!);
		await element.updateComplete;
		expect(root.querySelector('#solver-error')).not.toBeNull();
	}
};
/** Every control is disabled and no events fire. */
export const Disabled: Story = {
	render: () => form({ id: 'logistic-regression', disabled: true }),
	play: async ({ canvasElement }) => {
		const element =
			canvasElement.querySelector<AppModelConfiguration>('app-model-configuration')!;
		await element.updateComplete;
		const fired: string[] = [];
		element.addEventListener('app-model-configuration-change', () => fired.push('change'));
		element.addEventListener('app-model-configuration-continue', () => fired.push('continue'));
		const root = element.shadowRoot!;
		const controls = [...root.querySelectorAll<HTMLElement>('select, input, button')];
		expect(controls.length).toBeGreaterThan(0);
		for (const control of controls) {
			expect((control as HTMLInputElement).disabled).toBe(true);
		}
		root.querySelector('form')!.requestSubmit();
		const select = root.querySelector<HTMLSelectElement>('select')!;
		select.dispatchEvent(new Event('input', { bubbles: true }));
		select.dispatchEvent(new Event('change', { bubbles: true }));
		const number = root.querySelector<HTMLInputElement>('input[type="number"]')!;
		number.dispatchEvent(new Event('input', { bubbles: true }));
		number.dispatchEvent(new Event('change', { bubbles: true }));
		await element.updateComplete;
		expect(fired).toEqual([]);
	}
};
/** Narrow container where long labels wrap. */
export const LongLabel: Story = {
	render: () => form({ id: 'support-vector-classifier', style: 'max-width: 22rem' })
};
/** Inherited right-to-left direction. */
export const RTL: Story = {
	beforeEach: () => {
		document.documentElement.dir = 'rtl';
	},
	render: () => form({ id: 'logistic-regression' })
};
