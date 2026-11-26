import { atom } from 'nanostores';
import { formatter } from '@nanostores/i18n';
import '../../../src/features/results/app-fold-strip';
import '../../../src/features/results/app-class-error-bars';
import '../../../src/features/results/app-confusion-delta';
import { irisCrossValidation } from './evaluations';
import { englishFoldStripLabels, sampleCaption } from './labels';
import {
	buildFoldStripView,
	createResultsFormatters
} from '../../../src/features/results/results-view-model';

const root = document.getElementById('column')!;
const format = createResultsFormatters({
	number: (value, options) => new Intl.NumberFormat('en-GB', options).format(value)
});
const view = buildFoldStripView(
	irisCrossValidation(),
	{ series: 'Model 1', mostFrequent: 'Most frequent', stratified: 'Stratified' },
	format
);
const fold = document.createElement('app-fold-strip');
fold.labels = englishFoldStripLabels;
fold.caption = sampleCaption;
fold.series = [
	{ ...view.series[0]!, color: 'amber' },
	{ ...view.series[0]!, id: 'second', label: 'Model 2', color: 'blue' }
];
fold.baselines = view.baselines;
fold.formatPercent = format.percent;

const bars = document.createElement('app-class-error-bars');
bars.caption = { title: 'Class errors', takeaway: 'Compare errors by class.' };
bars.labels = {
	class: 'Class',
	model: 'Model',
	errorRate: 'Error rate',
	unavailable: 'Unavailable',
	showData: 'Show data table',
	xAxis: 'Error rate (%, lower is better)',
	yAxis: 'Class and model',
	errorCountHeading: 'Errors',
	errorCountCell: (errors, total) => `${errors} of ${total}`,
	legendLabel: 'Models',
	description: () => 'Class error rates and counts.'
};
bars.rows = [
	{
		classIndex: 0,
		label: 'Adélie',
		models: [
			{
				num: 1,
				label: 'Model 1',
				modelColor: 'amber',
				errorRate: 0.1,
				errorCount: 1,
				support: 10
			},
			{
				num: 2,
				label: 'Model 2',
				modelColor: 'sky',
				errorRate: 0.2,
				errorCount: 2,
				support: 10
			}
		]
	}
];
bars.formatPercent = format.percent;

const locale = atom('en-GB');
const numberFormat = formatter(locale);
const delta = document.createElement('app-confusion-delta');
delta.delta = {
	labelA: 'Model 1',
	labelB: 'Model 2',
	labels: ['Adélie', 'Gentoo'],
	counts: [0, 1234, -1234, 0],
	shownClassIndices: [0, 1],
	largest: { trueIndex: 0, predictedIndex: 1, count: 1234 }
};
const renderLocale = () => {
	const current = numberFormat.get();
	const signed = (count: number) =>
		current.number(count, {
			signDisplay: 'exceptZero',
			maximumFractionDigits: 0,
			useGrouping: true
		});
	delta.formatSignedCount = signed;
	delta.labels = {
		caption: 'Confusion differences',
		filter: 'True class',
		allClasses: 'Default classes',
		trueClass: 'True class',
		predictedClass: 'Predicted class',
		correct: 'correct',
		takeaway: `Adélie as Gentoo: ${signed(1234)}`,
		filterStatus: (label) => `Showing ${label ?? 'all classes'}.`
	};
};
locale.listen(renderLocale);
renderLocale();
root.append(fold, bars, delta);
Object.assign(window, { summaryFixture: { setLocale: (value: string) => locale.set(value) } });
