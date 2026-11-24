import { html, type TemplateResult } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect } from 'storybook/test';
import type { AppModelCard } from './app-model-card';
import './app-model-card';

type CardArgs = Pick<AppModelCard, 'modelId' | 'name' | 'description' | 'type' | 'selected'>;

function card(
	args: CardArgs,
	artwork = html`
		<img slot="image" src="/assets/logistic-regression.svg" alt="" width="360" height="216" />
	`
): TemplateResult {
	return html`
		<app-model-card
			.modelId=${args.modelId}
			.name=${args.name}
			.description=${args.description}
			.type=${args.type}
			.selected=${args.selected}>
			${artwork}
		</app-model-card>
	`;
}

const inlineArtwork = html`
	<svg slot="image" viewBox="0 0 360 216" aria-hidden="true">
		<path d="M 48 168 L 312 48" stroke="var(--stone-700)" stroke-width="6" />
		<circle cx="115" cy="100" r="6" fill="var(--amber-300)" />
		<circle cx="245" cy="116" r="6" fill="var(--blue-200)" />
	</svg>
`;

function inlineCard(args: CardArgs): TemplateResult {
	return html`<div style="max-inline-size: 360px">${card(args, inlineArtwork)}</div>`;
}

const meta = {
	title: 'Components/Model Card',
	component: 'app-model-card',
	args: {
		modelId: 'logistic-regression',
		name: 'Logistic Regression',
		description: 'Estimates the probability of a class from the features you choose.',
		type: 'classification',
		selected: false
	},
	parameters: {
		docs: {
			description: {
				component:
					'Pass exactly one decorative image to the image slot. Use an img with empty alt text and 5:3 dimensions, or an inline svg with viewBox="0 0 360 216". Use selected to identify the current model choice.'
			}
		}
	},
	render: (args) => html`<div style="max-inline-size: 360px">${card(args)}</div>`
} satisfies Meta<CardArgs>;

export default meta;
type Story = StoryObj<CardArgs>;

/** Unselected classifier with a supplied public SVG. */
export const Classification: Story = {};

/** Regression type with the supported inline SVG slot. */
export const Regression: Story = {
	args: {
		modelId: 'linear-regression',
		name: 'Linear Regression',
		description: 'Predicts a numeric outcome from the features you choose.',
		type: 'regression'
	},
	render: inlineCard
};

/** Clustering type with the supported inline SVG slot. */
export const Clustering: Story = {
	args: {
		modelId: 'k-means',
		name: 'K-Means',
		description: 'Groups similar rows by the features you choose.',
		type: 'clustering'
	},
	render: inlineCard
};

/** Current model choice with a visible marker beside the native button. */
export const Selected: Story = {
	args: { selected: true },
	play: async ({ canvasElement }) => {
		const modelCard = canvasElement.querySelector('app-model-card')!;
		await modelCard.updateComplete;
		const currentButton = modelCard.shadowRoot!.querySelector('button[aria-current="true"]');
		expect(currentButton).toHaveAccessibleName('Select Model: Logistic Regression');
		expect(currentButton?.nextElementSibling).toHaveTextContent('Selected');
		await modelCard.querySelector('img')!.decode();
	}
};

/** A long name and description can wrap in a narrow card. */
export const LongLabel: Story = {
	args: {
		name: 'Logistic Regression with a longer model name for narrow layouts'
	}
};

/** Both actions and the marker fit at a 320px available width. */
export const Narrow: Story = {
	args: { ...LongLabel.args, selected: true },
	render: (args) => html`<div style="max-inline-size: 320px">${card(args)}</div>`
};

/** Both slot forms and current choice in a responsive grid. */
export const Grid: Story = {
	render: (args) => html`
		<div
			style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr)); gap: 1.5rem">
			${card({ ...args, selected: true })}
			${card({ ...args, ...Regression.args }, inlineArtwork)}
		</div>
	`
};

/** A selected card in right-to-left text direction. */
export const RTL: Story = {
	args: {
		name: 'الانحدار اللوجستي',
		description: 'يقدّر احتمال الانتماء إلى فئة بناءً على الخصائص التي تختارها.',
		selected: true
	},
	render: (args) => html`<div dir="rtl" style="max-inline-size: 320px">${card(args)}</div>`
};
