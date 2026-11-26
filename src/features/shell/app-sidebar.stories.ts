import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, waitFor, within } from 'storybook/test';
import { $appState } from '../../stores/app.store';
import { $route } from '../../router/router';
import { parseRoute } from '../../router/route-parser';
import type { WorkflowPath } from '../../types/state';
import { createSidebarFixture, type SidebarFixture } from '../../../tests/visual-parity/fixtures';
import './app-sidebar';

const prepare =
	(fixture: SidebarFixture, rtl = false, path?: WorkflowPath) =>
	() => {
		const previousState = $appState.get();
		const previousRoute = $route.get();
		const direction = document.documentElement.dir;
		$appState.set(createSidebarFixture(fixture));
		$route.set(
			parseRoute(
				path ??
					(fixture === 'models'
						? '/models/2'
						: fixture === 'provisional'
							? '/models/new'
							: fixture === 'target'
								? '/target'
								: '/data')
			)
		);
		if (rtl) document.documentElement.dir = 'rtl';
		return () => {
			$appState.set(previousState);
			$route.set(previousRoute);
			document.documentElement.dir = direction;
		};
	};
const meta = {
	title: 'Shell/Sidebar',
	component: 'app-sidebar',
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Do: use native workflow links and show one suggested next step after acknowledgement. Keep link names and current-page context. Don’t: move focus or navigate from a cue, nest model links, or replay saved milestones.'
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
/** Trained links with catalogue and saved names, with the second result current. */
export const Models: Story = { beforeEach: prepare('models') };
/** The active provisional wizard has a static current row below the trained links. */
export const Provisional: Story = { beforeEach: prepare('provisional') };
/** Unbroken long values and a large grouped row count. */
export const LongLabel: Story = { beforeEach: prepare('long') };
/** Logical layout inheriting right-to-left document direction. */
export const RTL: Story = { beforeEach: prepare('long', true) };

function suggestion(
	fixture: SidebarFixture,
	path: WorkflowPath,
	name: string | RegExp,
	next?: () => void,
	rtl = false
): Story {
	return {
		beforeEach: prepare(fixture, rtl, path),
		play: async ({ canvasElement }) => {
			const sidebar = canvasElement.querySelector('app-sidebar')!;
			await sidebar.updateComplete;
			next?.();
			await waitFor(async () => {
				const link = within(sidebar.shadowRoot as unknown as HTMLElement).getByRole(
					'link',
					{
						name
					}
				);
				await expect(link).toHaveAccessibleDescription('Suggested next step');
				await expect(link.querySelector('.dot')).toBeVisible();
				await expect(sidebar.shadowRoot!.querySelectorAll('.dot')).toHaveLength(1);
			});
		}
	};
}

/** Load Data is suggested when another view is entered without a dataset. */
export const SuggestLoadData = suggestion('empty', '/target', /Load Data/);

/** Acknowledging a dataset leaves the user on Load Data and suggests Set Target. */
export const SuggestSetTarget = suggestion('empty', '/data', /Set Target/, () => {
	$appState.set(createSidebarFixture('dataset'));
});

/** Acknowledging the target suggests the first training link. */
export const SuggestTrainNew = suggestion('dataset', '/target', 'Train New Model', () => {
	$appState.set(createSidebarFixture('target'));
});

/** A first completed result suggests another training run. */
export const SuggestTrainAnother = suggestion('target', '/models/1', 'Train Another Model', () => {
	const next = createSidebarFixture('models');
	$appState.set({ ...next, models: next.models.slice(0, 1) });
});

/** Two acknowledged results suggest comparison alongside long labels in RTL. */
export const SuggestCompareRTL = suggestion(
	'target',
	'/models/2',
	/Compare Results/,
	() => {
		$appState.set(createSidebarFixture('long'));
	},
	true
);

/** Entering a suggested destination consumes its milestone. */
export const SuggestionConsumed: Story = {
	beforeEach: prepare('dataset', false, '/target'),
	play: async ({ canvasElement }) => {
		const sidebar = canvasElement.querySelector('app-sidebar')!;
		await sidebar.updateComplete;
		$appState.set(createSidebarFixture('target'));
		await sidebar.updateComplete;
		await expect(sidebar.shadowRoot!.querySelector('a.step-train-new .dot')).toBeVisible();
		$route.set(parseRoute('/models/new'));
		await sidebar.updateComplete;
		await expect(sidebar.shadowRoot!.querySelectorAll('.dot')).toHaveLength(0);
	}
};

const manualSuggestions = [
	{ label: 'Load Data', path: '/target', before: 'empty' },
	{ label: 'Set Target', path: '/data', before: 'empty', after: 'dataset' },
	{ label: 'Train New Model', path: '/target', before: 'dataset', after: 'target' },
	{
		label: 'Train Another Model',
		path: '/models/1',
		before: 'target',
		after: 'models',
		trained: 1
	},
	{ label: 'Compare Results', path: '/models/2', before: 'target', after: 'models', trained: 2 }
] as const;

async function replaySuggestion(event: Event, scenario: (typeof manualSuggestions)[number]) {
	const sidebar = (event.currentTarget as HTMLElement)
		.closest('main')!
		.parentElement!.querySelector('app-sidebar')!;
	$appState.set(createSidebarFixture('empty'));
	$route.set(parseRoute('/data'));
	await sidebar.updateComplete;
	$appState.set(createSidebarFixture(scenario.before));
	$route.set(parseRoute(scenario.path));
	if ('after' in scenario) {
		const state = createSidebarFixture(scenario.after);
		if ('trained' in scenario) state.models = state.models.slice(0, scenario.trained);
		$appState.set(state);
	}
}

/** Replay the production sidebar’s cues for native-browser zoom and screen-reader checks. */
export const ManualWorkflowSuggestions: Story = {
	beforeEach: prepare('empty', false, '/target'),
	render: () => html`
		<app-sidebar></app-sidebar>
		<main>
			<h1>Workflow suggestions</h1>
			<p>Replay a cue, then move focus to its sidebar link.</p>
			<ul>
				${manualSuggestions.map(
					(scenario) => html`
						<li>
							<button
								type="button"
								class="btn"
								@click=${(event: Event) => replaySuggestion(event, scenario)}>
								Show ${scenario.label}
							</button>
						</li>
					`
				)}
			</ul>
		</main>
	`
};
