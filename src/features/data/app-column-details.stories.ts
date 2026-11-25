import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import type { BaseColumnStats, CategoricalColumnStats, ColumnStats } from '../../types/dataset';
import type { ColumnDetailsLabels } from './app-column-details';
import './app-column-details';

const base = {
	missingCount: 1,
	missingTokens: { '': 1 },
	invalidCount: 0,
	invalidExamples: []
} satisfies Omit<BaseColumnStats, 'name' | 'type'>;

const categorical = {
	...base,
	name: 'Species',
	type: 'categorical',
	distinctCount: 2,
	categoryCounts: { Setosa: 3, Versicolor: 2 }
} satisfies CategoricalColumnStats;

function inspector(column: ColumnStats, labels?: Partial<ColumnDetailsLabels>, dir = 'ltr') {
	return html`
		<app-column-details
			dir=${dir}
			.column=${column}
			.rowCount=${6}
			.labels=${labels ?? {}}></app-column-details>
	`;
}

const meta = {
	title: 'Data/Column details',
	component: 'app-column-details',
	parameters: {
		docs: {
			description: {
				component:
					'Do provide computed statistics and a total row count. For a localised abbreviation, supply the short label and its expansion. Don’t pair a full frequency label with an abbreviation expansion.'
			}
		}
	}
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default compact categorical frequency header. */
export const Categorical: Story = { render: () => inspector(categorical) };

/** A supplied full header remains plain text. */
export const FullFrequencyLabel: Story = {
	render: () => inspector(categorical, { frequency: 'Occurrences' })
};

/** An abbreviated label with a supplied expansion. */
export const LocalisedAbbreviation: Story = {
	render: () => inspector(categorical, { frequency: 'Häuf.', frequencyExpansion: 'Häufigkeit' })
};

/** Boolean counts keep their own label. */
export const BooleanCounts: Story = {
	render: () =>
		inspector({
			...base,
			name: 'Accepted',
			type: 'boolean',
			trueCount: 3,
			falseCount: 2,
			lexicon: ['true', 'false']
		})
};

/** Numeric summary and histogram. */
export const Numeric: Story = {
	render: () =>
		inspector({
			...base,
			name: 'Measurements',
			type: 'numeric',
			count: 5,
			min: 1,
			max: 4,
			mean: 2.4,
			median: 2,
			integer: true,
			identifierHint: false,
			format: { prefix: '', suffix: '', thousandsSeparator: false },
			histogram: { start: 1, width: 1, counts: [1, 2, 1, 1] }
		})
};

/** Earliest and latest instants, with UTC shown in the labels. */
export const Datetime: Story = {
	render: () =>
		inspector({
			...base,
			name: 'Recorded at',
			type: 'datetime',
			count: 5,
			min: Date.UTC(2026, 0, 1, 9, 30, 15),
			max: Date.UTC(2026, 4, 1, 17, 45, 0),
			precision: 'second',
			format: { kind: 'date', order: 'ISO', orderAssumed: false }
		})
};

/** Earliest and latest calendar dates, with no time and no UTC label. */
export const DateOnly: Story = {
	name: 'Date',
	render: () =>
		inspector({
			...base,
			name: 'Visit date',
			type: 'date',
			count: 5,
			min: Date.UTC(2026, 0, 1),
			max: Date.UTC(2026, 4, 1),
			format: { kind: 'date', order: 'ISO', orderAssumed: false }
		})
};

/** Earliest and latest times of day, with no date and no UTC label. */
export const TimeOfDay: Story = {
	name: 'Time',
	render: () =>
		inspector({
			...base,
			name: 'Opening time',
			type: 'time',
			count: 5,
			min: 32_400_000,
			max: 63_000_000,
			precision: 'minute'
		})
};

/** Text statistics with an identifier hint. */
export const Text: Story = {
	render: () =>
		inspector({
			...base,
			name: 'Reference',
			type: 'text',
			distinctCount: 5,
			identifierHint: true
		})
};

/** A longer full label wraps inside the compact panel. */
export const LongLabel: Story = {
	render: () =>
		inspector(
			{ ...categorical, name: 'Botanical species recorded in the survey' },
			{ frequency: 'Number of occurrences in the data' }
		)
};

/** Inherited right-to-left direction. */
export const RTL: Story = {
	render: () => inspector(categorical, { category: 'الفئة', frequency: 'التكرار' }, 'rtl')
};
