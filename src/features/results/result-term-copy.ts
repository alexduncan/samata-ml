/** Plain-English result definitions and the surfaces that show them, in display order. */
export const RESULT_TERM_COPY = {
	'held-out-rows': {
		term: 'Held-out rows',
		definition: 'Rows left out of training for the model that made those predictions.',
		surface: 'both'
	},
	'balanced-accuracy': {
		term: 'Balanced accuracy',
		definition:
			'Find the share of rows correctly predicted within each class, then average those shares so each class counts equally.',
		surface: 'both'
	},
	'mean-across-folds': {
		term: 'Mean across folds',
		definition: 'Score each held-out fold separately, then average the fold scores.',
		surface: 'cross-validation'
	},
	'pooled-score': {
		term: 'Pooled held-out score',
		definition:
			'Put the held-out predictions together, then calculate one score from the combined predictions.',
		surface: 'comparison'
	},
	accuracy: {
		term: 'Accuracy',
		definition: 'The share of rows for which the model predicted the correct class.',
		surface: 'both'
	},
	baseline: {
		term: 'Baseline',
		definition: 'A reference score for judging how much the model improves on a simple rule.',
		surface: 'both'
	},
	'most-frequent-class': {
		term: 'Most frequent class',
		definition: 'The baseline that always picks the commonest answer.',
		surface: 'both'
	},
	'random-by-class-share': {
		term: 'Random guesses by class share',
		definition: 'The baseline that guesses according to how common each class is.',
		surface: 'both'
	},
	'percentage-point': {
		term: 'Percentage point',
		definition:
			'A unit for the difference between percentages, such as the five points from 75% to 80%.',
		surface: 'both'
	},
	'train-test-gap': {
		term: 'Train–test gap',
		definition:
			'Training balanced accuracy minus held-out balanced accuracy for the same split. For Cross-Validation, average those differences across folds.',
		surface: 'both'
	},
	'standard-deviation': {
		term: 'Standard deviation',
		definition: 'Describes how far fold scores tend to spread around their mean.',
		surface: 'both'
	},
	'interquartile-range': {
		term: 'Interquartile range',
		definition: 'The width of the middle half of the fold scores.',
		surface: 'both'
	},
	precision: {
		term: 'Precision',
		definition: 'Of the rows predicted to be in a class, the share that really belong to it.',
		surface: 'both'
	},
	recall: {
		term: 'Recall',
		definition: 'Of the rows that actually belong to a class, the share that the model found.',
		surface: 'both'
	},
	f1: {
		term: 'F1',
		definition: 'Combines precision and recall into one score that drops when either is low.',
		surface: 'both'
	},
	'macro-f1': {
		term: 'Macro-F1',
		definition: 'Averages F1 equally across classes.',
		surface: 'both'
	},
	mcc: {
		term: 'MCC',
		definition:
			'A score for how closely predicted and actual classes agree across correct predictions and errors. Higher values indicate stronger agreement.',
		expansion: 'Matthews correlation coefficient',
		surface: 'both'
	},
	'roc-auc': {
		term: 'ROC-AUC',
		definition:
			'Summarises how well the model ranks members of a class ahead of other rows across possible cutoffs.',
		expansion: 'Area under the receiver operating characteristic curve',
		surface: 'both'
	},
	'average-precision': {
		term: 'Average precision',
		definition:
			"Summarises how precise the model's predictions are as the score cutoff changes and it finds more members of a class.",
		surface: 'both'
	},
	'log-loss': {
		term: 'Log loss',
		definition:
			'Measures how much chance the model gave to the answers that actually happened. Confident wrong answers increase the loss sharply.',
		surface: 'both'
	},
	'brier-score': {
		term: 'Brier score',
		definition:
			"Measures squared gaps between the model's predicted chances and what happened. Smaller gaps give a lower score.",
		surface: 'both'
	},
	calibration: {
		term: 'Calibration',
		definition: 'Checks whether predicted chances match how often the events happen.',
		surface: 'both'
	},
	ece: {
		term: 'ECE',
		definition:
			'Averages the gaps between predicted chances and observed outcomes across groups of predictions, giving larger groups more weight.',
		expansion: 'Expected calibration error',
		surface: 'both'
	},
	'true-class': {
		term: 'True class',
		definition: 'The recorded answer for a row.',
		surface: 'both'
	},
	'predicted-class': {
		term: 'Predicted class',
		definition: "The model's answer for a row.",
		surface: 'both'
	},
	'confusion-matrix': {
		term: 'Confusion matrix',
		definition: 'A table that counts each pairing of recorded and predicted answers.',
		surface: 'both'
	},
	'positive-class': {
		term: 'Positive class',
		definition: 'The category treated as the yes answer in a two-category check.',
		surface: 'both'
	},
	'false-positive': {
		term: 'False positive',
		definition: 'Predicting the positive answer when the actual answer is negative.',
		surface: 'both'
	},
	'false-negative': {
		term: 'False negative',
		definition: 'Missing the positive answer when it is present.',
		surface: 'both'
	},
	'error-rate': {
		term: 'Error rate',
		definition:
			'The share of predictions that are wrong. For a specific class, count the errors among rows that actually belong to that class.',
		surface: 'comparison'
	},
	'probability-threshold': {
		term: 'Probability threshold',
		definition:
			'The cutoff that turns a predicted chance into a yes-or-no decision for the positive class.',
		surface: 'binary'
	},
	'practical-equivalence': {
		term: 'Practical equivalence',
		definition:
			'Differences inside the chosen range are treated as small enough to count as similar.',
		surface: 'comparison'
	},
	'equivalence-width': {
		term: 'Equivalence width',
		definition:
			'The range on each side of zero. For example, one percentage point allows a difference of up to one point in either direction.',
		surface: 'comparison'
	},
	'equivalence-probability': {
		term: 'Equivalence probability',
		definition:
			'The estimated chance that the expected balanced-accuracy difference between the two models lies inside the chosen range, based on their paired evaluation.',
		surface: 'comparison'
	},
	'instance-agreement': {
		term: 'Instance agreement',
		definition:
			'Groups the same held-out rows by how many of the selected models got each row right.',
		surface: 'comparison'
	},
	'fit-time': {
		term: 'Fit time',
		definition: 'Time spent training the model.',
		surface: 'both'
	},
	'fit-and-score-time': {
		term: 'Fit + score across folds',
		definition: 'Time spent training and evaluating the folds.',
		surface: 'both'
	}
} as const satisfies Readonly<
	Record<
		string,
		{
			term: string;
			definition: string;
			expansion?: string;
			surface: 'both' | 'single' | 'comparison' | 'cross-validation' | 'binary';
		}
	>
>;
