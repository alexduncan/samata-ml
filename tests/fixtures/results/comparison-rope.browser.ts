import '../../../src/features/results/app-rope-bar';
import '../../../src/features/results/app-instance-agreement';

const root = document.getElementById('column')!;
const rope = document.createElement('app-rope-bar');
rope.result = { probabilityLower: 0.333, probabilityEquivalent: 0.333, probabilityHigher: 0.334 };
rope.status = 'ready';
rope.modelA = { num: 1, label: 'Model 1', modelColor: 'amber' };
rope.modelB = { num: 2, label: 'Model 2', modelColor: 'sky' };
rope.caption = {
	title: 'Practical equivalence',
	takeaway: 'Model A and Model B compared within 0.01.'
};
rope.labels = {
	width: 'Equivalence width',
	invalidWidth: 'Enter a value from 0.1 to 10.',
	aHigher: 'A higher',
	equivalent: 'Equivalent',
	bHigher: 'B higher',
	loading: 'Analysing',
	unavailable: 'Cross-validation folds are required.',
	error: 'Analysis failed.',
	retry: 'Retry',
	outcome: 'Outcome',
	probability: 'Probability',
	showData: 'Show data table',
	xAxis: 'Posterior probability (%)',
	frequencyHeading: 'Frequency',
	inHundred: (count) => `${count} in 100`,
	description: (a, b, ap, eq, bp) => `${a} and ${b}: ${ap}, ${eq}, ${bp}.`,
	liveStatus: (status, summary) => `${status}: ${summary}`,
	modelHigher: (label) => `${label} higher`
};
rope.formatPercent = (value) => new Intl.NumberFormat('en-GB', { style: 'percent' }).format(value);
rope.addEventListener('app-rope-width-change', (event) => {
	rope.ropeWidth = (event as CustomEvent<{ ropeWidth: number }>).detail.ropeWidth;
});
const agreement = document.createElement('app-instance-agreement');
agreement.counts = { counts: [4, 7, 12, 27] };
agreement.caption = {
	title: 'Instance agreement',
	takeaway: '4 cases were missed by every model.'
};
agreement.labels = {
	correctModels: 'Correct models',
	rowCount: 'Rows',
	showData: 'Show data table',
	xAxis: (n) => `Models correct (out of ${n})`,
	yAxis: 'Rows',
	shareHeading: 'Share (%)',
	description: (counts) => `Agreement counts: ${counts.join(', ')}.`,
	bucket: (count) => `${count} correct`
};
agreement.formatCount = String;
agreement.formatPercent = (value) =>
	new Intl.NumberFormat('en-GB', { style: 'percent' }).format(value);
root.append(rope, agreement);
Object.assign(window, { summaryFixture: true });
