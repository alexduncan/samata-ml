import '../../../src/features/results/app-rope-bar';
import '../../../src/features/results/app-instance-agreement';

const root = document.getElementById('column')!;
const rope = document.createElement('app-rope-bar');
rope.result = { probabilityLower: 0.333, probabilityEquivalent: 0.333, probabilityHigher: 0.334 };
rope.status = 'ready';
rope.caption = {
	title: 'Practical equivalence',
	takeaway: 'Model A and Model B compared within 0.01.'
};
rope.labels = {
	width: 'Equivalence width',
	invalidWidth: 'Enter a value from 0.001 to 0.1.',
	aHigher: 'A higher',
	equivalent: 'Equivalent',
	bHigher: 'B higher',
	loading: 'Analysing',
	unavailable: 'Cross-validation folds are required.',
	error: 'Analysis failed.',
	retry: 'Retry',
	outcome: 'Outcome',
	probability: 'Probability',
	showData: 'Show data table'
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
	bucket: (count) => `${count} correct`
};
agreement.formatCount = String;
root.append(rope, agreement);
Object.assign(window, { summaryFixture: true });
