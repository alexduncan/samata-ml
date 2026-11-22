import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect, fn, waitFor } from 'storybook/test';
import type { TrainingLogEntry } from '../../types/model-result';
import type { AppTrainingProgress } from './app-training-progress';
import './app-training-progress';

type ProgressArgs = Partial<
	Pick<
		AppTrainingProgress,
		'progress' | 'logEntries' | 'logOpen' | 'announcement' | 'durationText' | 'labels'
	>
> & {
	dir?: 'ltr' | 'rtl';
};

const determinate = {
	percent: 36,
	stage: 'fitting',
	phase: 'training',
	statusMessage: 'Fitting the model'
} as const;
const logEntries: readonly TrainingLogEntry[] = [
	{ id: 1, timestamp: 1, level: 'status', message: { key: 'preparing' } },
	{ id: 2, timestamp: 2, level: 'status', message: { key: 'phase', phase: 'training' } }
];

const meta = {
	title: 'Models/Training progress',
	component: 'app-training-progress',
	tags: ['autodocs'],
	parameters: {
		a11y: { test: 'error' },
		docs: {
			description: {
				component:
					'Do supply localised stage text and an ordered log with stable entry identifiers. Use the polite announcement for milestones. Leave the percentage unset until progress is measurable.'
			}
		}
	},
	argTypes: {
		progress: { control: 'object' },
		logEntries: { control: 'object' },
		logOpen: { control: 'boolean' },
		announcement: { control: 'text' },
		durationText: { control: 'text' },
		labels: { control: false },
		dir: { control: 'radio', options: ['ltr', 'rtl'] }
	},
	render: ({ dir = 'ltr', ...args }: ProgressArgs) => {
		const wrapper = document.createElement('div');
		const progress = document.createElement('app-training-progress');
		wrapper.dir = dir;
		Object.assign(progress, args);
		wrapper.append(progress);
		return wrapper;
	}
} satisfies Meta<ProgressArgs>;
export default meta;
type Story = StoryObj<ProgressArgs>;

/** No value attribute is present until measured work has started. */
export const Queued: Story = {
	args: {
		progress: {
			...determinate,
			percent: null,
			stage: 'preparing',
			phase: 'queued',
			statusMessage: 'Waiting for the training worker'
		}
	},
	play: async ({ canvasElement }) => {
		const component = canvasElement.querySelector('app-training-progress')!;
		await component.updateComplete;
		const bars = component.shadowRoot!.querySelectorAll('progress');
		expect(bars).toHaveLength(1);
		expect(bars[0]).toHaveAttribute('max', '100');
		expect(bars[0]).not.toHaveAttribute('value');
	}
};

/** A progress tick leaves the native bar and disclosure controls attached. */
export const Determinate: Story = {
	args: { progress: determinate, logEntries },
	play: async ({ canvasElement }) => {
		const component = canvasElement.querySelector('app-training-progress')!;
		await component.updateComplete;
		const root = component.shadowRoot!;
		const bar = root.querySelector('progress');
		const details = root.querySelector('details');
		expect(details?.firstElementChild?.tagName).toBe('SUMMARY');
		component.progress = { ...determinate, percent: 49 };
		await component.updateComplete;
		expect(root.querySelector('progress')).toBe(bar);
		expect(root.querySelector('details')).toBe(details);
		expect(bar).toHaveAttribute('value', '49');
		expect(root.querySelector('[role=status]')).toBeEmptyDOMElement();
	}
};

/** The learner can open a collapsed log and the owner echoes the persisted preference. */
export const CollapsedLog: Story = {
	args: { progress: determinate, logEntries },
	play: async ({ canvasElement }) => {
		const component = canvasElement.querySelector('app-training-progress')!;
		await component.updateComplete;
		const changed = fn((event: Event) => {
			component.logOpen = (event as CustomEvent<{ open: boolean }>).detail.open;
		});
		component.addEventListener('app-training-log-toggle', changed);
		const details = component.shadowRoot!.querySelector('details')!;
		details.querySelector('summary')!.click();
		await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
		expect(changed).toHaveBeenCalledWith(
			expect.objectContaining({
				detail: { open: true },
				composed: false,
				bubbles: false
			})
		);
		expect(details.open).toBe(true);
	}
};

/** A restored log is visible without announcing history or echoing its preference. */
export const OpenLog: Story = {
	args: { progress: determinate, logEntries, logOpen: true },
	play: async ({ canvasElement }) => {
		const component = canvasElement.querySelector('app-training-progress')!;
		await component.updateComplete;
		const root = component.shadowRoot!;
		expect(root.querySelector('details')?.open).toBe(true);
		expect(root.querySelectorAll('ol li')).toHaveLength(2);
		expect(root.querySelector('[role=status]')).toBeEmptyDOMElement();
	}
};

/** Cross-validation provides chronological fold milestones. */
export const CrossValidation: Story = {
	args: {
		progress: {
			...determinate,
			stage: 'cross-validation',
			phase: null,
			statusMessage: 'Fold 1 complete'
		},
		logEntries: [
			logEntries[0]!,
			{
				id: 2,
				timestamp: 2,
				level: 'status',
				message: { key: 'fold-start', fold: 1, folds: 3 }
			},
			{ id: 3, timestamp: 3, level: 'status', message: { key: 'fold-complete', fold: 1 } }
		],
		logOpen: true,
		announcement: 'Fold 1 complete'
	}
};

/** The last known percentage remains readable while cancellation settles. */
export const Cancelling: Story = {
	args: { progress: { ...determinate, statusMessage: 'Cancelling training' }, logEntries }
};

/** An attempt in another tab still has an accessible status. */
export const Remote: Story = {
	args: { progress: { ...determinate, percent: null, statusMessage: 'Training in another tab' } }
};

/** The bar stays at 95 percent until the model state is published. */
export const PublicationPending: Story = {
	args: {
		progress: { percent: 95, stage: 'saving', phase: null, statusMessage: 'Saving results' },
		logEntries
	}
};

/** Completion shows the elapsed time and the full bar. */
export const Complete: Story = {
	args: {
		progress: {
			percent: 100,
			stage: 'saving',
			phase: null,
			statusMessage: 'Training complete'
		},
		logEntries: [
			...logEntries,
			{ id: 3, timestamp: 3, level: 'status', message: { key: 'completed' } }
		],
		durationText: 'Elapsed time 2.1 sec'
	}
};

/** Long localised status text wraps alongside the full-width native indicator. */
export const LongLabel: Story = {
	args: {
		progress: {
			...determinate,
			statusMessage:
				'Long progress message for a model being trained, evaluated and saved locally before the results become available'
		},
		logEntries,
		logOpen: true
	}
};

/** Native progress and disclosure follow right-to-left direction. */
export const RightToLeft: Story = {
	args: {
		dir: 'rtl',
		progress: { ...determinate, statusMessage: 'جارٍ تدريب النموذج وتقييم النتائج' },
		labels: {
			progress: 'تقدم التدريب',
			waiting: 'في انتظار التدريب',
			formatEntry: () => 'جارٍ تجهيز البيانات لتدريب النموذج'
		},
		logEntries,
		logOpen: true
	}
};
