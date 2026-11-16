import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { $appState } from '../../stores/app.store';
import { $route } from '../../router/router';
import { parseRoute } from '../../router/route-parser';
import { createSidebarFixture, type SidebarFixture } from '../../../tests/visual-parity/fixtures';
import './app-sidebar';

const prepare =
	(fixture: SidebarFixture, rtl = false) =>
	() => {
		$appState.set(createSidebarFixture(fixture));
		$route.set(
			parseRoute(
				fixture === 'models' ? '/models/2' : fixture === 'target' ? '/target' : '/data'
			)
		);
		if (rtl) document.documentElement.dir = 'rtl';
	};
const meta = {
	title: 'Shell/Sidebar',
	component: 'app-sidebar',
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Do: use ordinary Tab-order workflow links and retain current-page context. Dataset, target and model summaries come from the application stores. Don’t: nest model links inside the workflow link or add menu keyboard behaviour.'
			}
		}
	},
	render: () => html`<app-sidebar></app-sidebar>`
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Four workflow choices before data selection. */
export const Empty: Story = { beforeEach: prepare('empty') };
/** Dataset summary with grouped counts and plural messages. */
export const DatasetLoaded: Story = { beforeEach: prepare('dataset') };
/** Target name and type alongside the loaded dataset. */
export const TargetSet: Story = { beforeEach: prepare('target') };
/** Draft, training and trained models, with the second model current. */
export const Models: Story = { beforeEach: prepare('models') };
/** Unbroken long values and a large grouped row count. */
export const LongLabel: Story = { beforeEach: prepare('long') };
/** Logical layout inheriting right-to-left document direction. */
export const RTL: Story = { beforeEach: prepare('models', true) };
