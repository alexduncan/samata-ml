import { html, nothing } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, within } from 'storybook/test';
import { workflowDotStyles } from './workflow-dot.styles';

const meta = {
	title: 'Styles/Workflow cue',
	args: { suggested: true, rtl: false },
	parameters: {
		docs: {
			description: {
				component:
					'Do: associate a description with the suggested native link. Don’t: add a focus stop for the decorative dot or use it as a training status.'
			}
		}
	},
	beforeEach: () => {
		const previous = document.adoptedStyleSheets;
		const sheet = workflowDotStyles.styleSheet;
		if (sheet) document.adoptedStyleSheets = [...previous, sheet];
		return () => {
			document.adoptedStyleSheets = previous;
		};
	},
	render: ({ suggested, rtl }: { suggested: boolean; rtl: boolean }) => html`
		<a
			href="/target"
			dir=${rtl ? 'rtl' : 'ltr'}
			aria-describedby=${suggested ? 'example-suggestion' : nothing}>
			${rtl ? 'اختر عمود الهدف الذي تريد التنبؤ بقيمه' : 'Set Target'}
			${suggested ? html`<span class="dot" aria-hidden="true"></span>` : nothing}
		</a>
		${suggested
			? html`<span id="example-suggestion" hidden>Suggested next step</span>`
			: nothing}
	`
} satisfies Meta<{ suggested: boolean; rtl: boolean }>;
export default meta;
type Story = StoryObj<{ suggested: boolean; rtl: boolean }>;

/** The cue keeps the link name and adds a separate description. */
export const Suggested: Story = {
	play: async ({ canvasElement }) => {
		const link = within(canvasElement).getByRole('link', { name: 'Set Target' });
		await expect(link).toHaveAccessibleDescription('Suggested next step');
		await expect(link.querySelector('.dot')).toBeVisible();
	}
};

/** A destination with no suggestion has no decorative core. */
export const Uncued: Story = { args: { suggested: false } };

/** The core retains its inline-end slot next to a long RTL label. */
export const LongLabelRTL: Story = { args: { rtl: true } };
