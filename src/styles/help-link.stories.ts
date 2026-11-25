import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, userEvent } from 'storybook/test';
import { helpLinkStyles } from './help-link.styles';

type Args = { heading: string; label: string; dir: 'ltr' | 'rtl' };

const meta = {
	title: 'Styles/Help link',
	args: { heading: '2. Select Features', label: 'What are features?', dir: 'ltr' },
	parameters: {
		docs: {
			description: {
				component:
					'Do: place the contextual Help anchor inside the corresponding step heading. Give the link visible text and a reserved article URL. Don’t replace the anchor with a scripted control.'
			}
		}
	},
	beforeEach: () => {
		const previous = document.adoptedStyleSheets;
		const sheet = helpLinkStyles.styleSheet;
		if (sheet) document.adoptedStyleSheets = [...previous, sheet];
		return () => {
			document.adoptedStyleSheets = previous;
		};
	},
	render: ({ heading, label, dir }: Args) => html`
		<h2 dir=${dir}>
			${heading} <a class="help-link" href="/help/select-features">${label}</a>
		</h2>
	`
} satisfies Meta<Args>;
export default meta;
type Story = StoryObj<Args>;

/** The native link has a visible keyboard focus outline and a padded target. */
export const Standard: Story = {
	play: async ({ canvas, args }) => {
		const link = canvas.getByRole('link', { name: args.label });
		await userEvent.tab();
		link.focus();
		expect(link).toHaveFocus();
		expect(getComputedStyle(link).outlineStyle).toBe('solid');
		expect(link.getBoundingClientRect().height).toBeGreaterThanOrEqual(24);
	}
};

/** The heading allows a longer Help question to wrap. */
export const LongLabel: Story = {
	args: { label: 'Which information can I use to make a prediction about a new example?' }
};

/** The gap between the title and link follows right-to-left text. */
export const RTL: Story = {
	args: { dir: 'rtl', heading: '٢. اختيار السمات', label: 'ما السمات التي تساعد في التنبؤ؟' }
};
