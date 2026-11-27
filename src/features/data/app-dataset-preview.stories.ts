import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect } from 'storybook/test';
import type { DatasetMetadata } from '../../types/dataset';
import type { VirtualTableColumn } from '../../components/ui-virtual-table';
import './app-dataset-preview';
import type { PreviewLabels } from './app-dataset-preview';

const labels: PreviewLabels = {
	heading: (name) => `${name} Preview`,
	datasheet: 'Datasheet',
	changeDataset: 'Change Dataset',
	loadingDescription: 'Loading dataset…',
	rowsColumns: (rows, columns) => `${rows.toLocaleString('en')} rows | ${columns} columns`,
	rowLimitNotice: (limit, total) =>
		`Previewing the first ${limit.toLocaleString('en')} of ${total.toLocaleString('en')} rows. All rows are used for training.`,
	empty: 'No rows to preview.',
	retry: 'Retry',
	errorMessage: 'The preview could not be loaded.',
	unsupported: ', not used for training',
	progressLabel: 'Loading progress'
};

const columns: readonly VirtualTableColumn[] = [
	{ key: 'age', label: 'Age', sublabel: 'age', kind: 'numeric', contentChars: 4 },
	{
		key: 'species',
		label: 'Species',
		sublabel: 'species',
		kind: 'categorical',
		contentChars: 10
	},
	{
		key: 'seen',
		label: 'Last seen',
		sublabel: 'seen',
		kind: 'temporal',
		unsupported: true,
		contentChars: 10
	},
	{ key: 'notes', label: 'Notes', sublabel: 'notes', kind: 'text', unsupported: true }
];

function metadata(name: string, rowCount: number): DatasetMetadata {
	return {
		id: 'story',
		name,
		source: 'sample',
		sampleId: 'story',
		rowCount,
		byteLength: 0,
		createdAt: 0,
		delimiter: ',',
		columns: columns.map((column) => ({
			name: column.key,
			type: 'numeric',
			count: 0,
			missingCount: 0,
			missingTokens: {},
			invalidCount: 0,
			invalidExamples: [],
			min: 0,
			max: 0,
			mean: 0,
			median: 0,
			integer: true,
			identifierHint: false,
			format: { prefix: '', suffix: '', thousandsSeparator: false },
			histogram: { start: 0, width: 1, counts: [] }
		})),
		paddedRowCount: 0,
		skippedRows: { count: 0, rowNumbers: [] }
	};
}

const rows = Array.from({ length: 60 }, (_, index) => [
	String(20 + (index % 40)),
	['Setosa', 'Versicolor', 'Virginica'][index % 3]!,
	`2024-02-${String((index % 27) + 1).padStart(2, '0')}`,
	`Observation ${index + 1}`
]);

function preview(
	options: {
		name?: string;
		rowCount?: number;
		datasheet?: boolean;
		error?: string | null;
		dir?: 'ltr' | 'rtl';
	} = {}
) {
	const name = options.name ?? 'Iris Flower Species';
	const rowCount = options.rowCount ?? 150;
	return html`<app-dataset-preview
		dir=${options.dir ?? 'ltr'}
		.metadata=${metadata(name, rowCount)}
		.datasetName=${name}
		.columns=${columns}
		.window=${{ startIndex: 0, rows }}
		.labels=${labels}
		.datasheetAvailable=${options.datasheet ?? true}
		.error=${options.error ?? null}></app-dataset-preview>`;
}

/** Usage guidance for the dataset preview. */
const meta = {
	title: 'Data/Dataset preview',
	component: 'app-dataset-preview',
	parameters: {
		layout: 'fullscreen',
		docs: {
			description: {
				component:
					'Do: let the document scroll the table, pass columns built from the metadata, show Datasheet only for samples and keep Change Dataset red. Don’t: add segment controls, a Go to row box or a status box, or place the table inside a padded wrapper.'
			}
		}
	},
	render: () => preview()
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** A sample dataset: heading, Datasheet and Change Dataset, and the table. */
export const Ready: Story = {
	play: async ({ canvasElement }) => {
		const host = canvasElement.querySelector('app-dataset-preview')!;
		await host.updateComplete;
		await expect(host.shadowRoot!.querySelector('h1')).toHaveTextContent(
			'Iris Flower Species Preview'
		);
		await expect(host.shadowRoot!.querySelector('.btn-red')).toHaveTextContent(
			'Change Dataset'
		);
	}
};

/** Metadata or rows failed: an alert with Retry above the table. */
export const ErrorState: Story = { render: () => preview({ error: 'Controlled failure' }) };

/** No rows: a plain message instead of the table. */
export const Empty: Story = { render: () => preview({ rowCount: 0 }) };

/** More rows than a browser can lay out: the notice states the limit. */
export const RowLimitNotice: Story = { render: () => preview({ rowCount: 2_000_000 }) };

/** An uploaded dataset has no datasheet. */
export const UploadedDataset: Story = {
	render: () => preview({ name: 'my-upload', datasheet: false })
};

/** A long dataset name wraps in the header. */
export const LongLabel: Story = {
	render: () =>
		preview({
			name: 'A very long dataset name that keeps going so the heading has to wrap onto more than one line'
		})
};

/** Right-to-left layout. */
export const Rtl: Story = { render: () => preview({ dir: 'rtl' }) };
