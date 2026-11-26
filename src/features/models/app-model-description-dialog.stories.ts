import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { ModelDescriptionStatus } from './app-model-description-dialog';
import './app-model-description-dialog';

type DescriptionArgs = { heading: string; status: ModelDescriptionStatus };

const meta = {
	title: 'Models/Model description dialog',
	component: 'app-model-description-dialog',
	render: ({ heading, status }) => {
		const fragment = document.createDocumentFragment();
		const paragraph = document.createElement('p');
		paragraph.textContent = 'A supervised model for classification.';
		fragment.append(paragraph);
		return html`<app-model-description-dialog
			.open=${true}
			.heading=${heading}
			.status=${status}
			.content=${fragment}
			.fallback=${paragraph.textContent}></app-model-description-dialog>`;
	},
	args: { heading: 'Logistic Regression', status: 'ready' as ModelDescriptionStatus }
} satisfies Meta<DescriptionArgs>;
export default meta;
type Story = StoryObj<DescriptionArgs>;

/** Authored description and close actions in the shared layout. */
export const Ready: Story = {};
/** A missing article leaves the summary and the Close button available. */
export const MissingArticle: Story = { args: { status: 'missing' } };
/** The status message and Retry button stay below a wrapped title. */
export const LoadError: Story = {
	args: {
		heading: 'A model description with a long heading and a recoverable article load error',
		status: 'error'
	}
};
