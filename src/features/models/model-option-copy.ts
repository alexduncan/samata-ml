import type { GlossaryTerm } from '../../common/description-segments';
import type { ModelDocument } from '../../types/model-document';
import type { ConfigurationLabels, OptionLabels } from './app-model-configuration';
import { getOptionPolicy, GLOSSARY_TERM_KEYS } from './model-presentation-policy';

/** Option copy: `[label, description]` keyed by option name. */
const OPTIONS: Readonly<Record<string, readonly [string, string]>> = {
	solver: [
		'Solver',
		'The solver is the method used to fit the model. Different solvers suit different data and support different options.'
	],
	penalty: [
		'Penalty',
		'The penalty applies regularisation, which discourages an overly complex model and helps it cope with new data.'
	],
	C: [
		'Regularisation strength (C)',
		'Controls the regularisation strength. Smaller values regularise more strongly and keep the model simpler.'
	],
	l1Ratio: [
		'L1 ratio',
		'How much of the elastic net penalty is L1 rather than L2. 0 is all L2 and 1 is all L1.'
	],
	fitIntercept: [
		'Fit an intercept',
		'Includes an intercept, a constant baseline added to every prediction.'
	],
	learningRate: [
		'Learning rate',
		'The size of each step the solver takes. A smaller learning rate is steadier but slower.'
	],
	maxIter: ['Maximum iterations', 'The most iterations the solver may run before it stops.'],
	tol: [
		'Tolerance',
		'Training stops when improvement between rounds falls below this tolerance. Smaller values are more precise but slower.'
	],
	hiddenLayerSizes: [
		'Hidden layers',
		'Each row is one of the hidden layers and its size is the number of units in it. More layers and units can learn more complex patterns.'
	],
	activation: [
		'Activation function',
		'How each unit transforms its input. The activation function shapes the patterns the network can learn.'
	],
	randomState: [
		'Random seed',
		'A starting number for the random choices made while training. Use the same seed to get the same result again, or leave it blank for a different result each time.'
	],
	criterion: [
		'Criterion',
		'How the tree scores a split. Both measures look at impurity, which is how mixed the classes are.'
	],
	maxDepth: [
		'Maximum depth',
		'Limits how many questions in a row the tree can ask. Unlimited trees can memorise the training data.'
	],
	minSamplesSplit: [
		'Minimum samples to split',
		'The fewest rows a group needs before the tree may split it.'
	],
	minSamplesLeaf: [
		'Minimum samples per leaf',
		'The fewest rows allowed in a final group of the tree.'
	],
	minImpurityDecrease: [
		'Minimum impurity decrease',
		'A split must reduce impurity by at least this much to be kept.'
	],
	nNeighbors: [
		'Number of neighbours',
		'How many of the closest training rows, the neighbours, vote on each prediction.'
	],
	weights: ['Weights', 'Whether closer neighbours count for more when voting.'],
	metric: [
		'Distance metric',
		'The distance metric decides how the distance between rows is measured.'
	],
	p: [
		'Minkowski power (p)',
		'The power used by the Minkowski distance: 1 is Manhattan distance and 2 is Euclidean distance.'
	],
	varSmoothing: [
		'Variance smoothing',
		'A small amount added to every variance so that a feature with no spread cannot break the model. This is a form of smoothing.'
	],
	alpha: [
		'Smoothing (alpha)',
		'The amount of smoothing added to every count so that a value never seen in training is not treated as impossible.'
	],
	forceAlpha: [
		'Force smoothing',
		'Keeps the smoothing amount exactly as set instead of raising it to a tiny minimum.'
	],
	fitPrior: [
		'Learn class priors',
		'Learns how common each class is, the priors, from your data. Turn it off to treat every class as equally likely.'
	],
	binarize: [
		'Binarise',
		'Binarise turns each feature into on or off using a threshold. Disabled assumes the data is already on or off.'
	],
	kernel: [
		'Kernel',
		'The kernel decides what shape of boundary the model can draw between classes.'
	],
	degree: [
		'Polynomial degree',
		'The degree of the polynomial kernel. Higher degrees draw more flexible curves.'
	],
	gamma: [
		'Gamma',
		'Gamma sets how far the influence of a single training row reaches for curved kernels. Scale and Auto work it out from your data.'
	],
	coef0: ['Independent term', 'A constant used by the polynomial and sigmoid kernels.'],
	probability: [
		'Probability estimates',
		'Adds class probability estimates to the predictions. Training takes longer.'
	],
	classWeight: [
		'Class weights',
		'Balanced class weights give rarer classes more influence. None treats every row equally.'
	]
};

const CHOICES: Readonly<Record<string, { values: Record<string, string>; valueLabel?: string }>> = {
	maxDepth: {
		values: { unlimited: 'Unlimited', limited: 'Limited' },
		valueLabel: 'Maximum depth'
	},
	binarize: {
		values: { disabled: 'Disabled', threshold: 'Threshold' },
		valueLabel: 'Binarise threshold'
	},
	gamma: { values: { scale: 'Scale', auto: 'Auto', value: 'Value' }, valueLabel: 'Gamma value' },
	classWeight: { values: { none: 'None', balanced: 'Balanced' } }
};

const NOTES: Readonly<Record<string, string>> = {
	'adam-fixed-rate': 'Adam uses a fixed learning rate of 0.001. Select SGD to adjust the rate.',
	'adam-rate-value': 'Learning rate: 0.001 (fixed by Adam)',
	'no-learning-rate': 'This solver does not use a learning rate.',
	'lbfgs-penalty': 'L-BFGS supports only no penalty or L2.',
	'penalty-c': 'C applies only when a penalty is chosen.',
	'penalty-l1-ratio': 'L1 ratio applies only to the elastic net penalty.',
	'max-iter-cap': 'Up to 5,000 iterations in this app.',
	'fixed-threshold': 'Decision threshold: 0.5',
	'fixed-priors': 'Class priors: learned from the data',
	'metric-p': 'The power applies only to the Minkowski metric.',
	'kernel-degree': 'Degree applies only to the polynomial kernel.',
	'kernel-gamma': 'Gamma does not apply to the linear kernel.',
	'kernel-coef0': 'The independent term applies only to polynomial and sigmoid kernels.'
};

const ERRORS: Readonly<Record<string, string>> = {
	'invalid-number': 'Enter a valid number.',
	'invalid-choice': 'Choose one of the listed options.',
	'finite-number': 'Enter a valid number.',
	'positive-number': 'Enter a number greater than 0.',
	'non-negative-number': 'Enter a number of 0 or more.',
	'number-min-1': 'Enter a number of 1 or more.',
	'unit-interval': 'Enter a number from 0 to 1.',
	'integer-min-0': 'Enter a whole number of 0 or more.',
	'integer-min-1': 'Enter a whole number of 1 or more.',
	'integer-min-2': 'Enter a whole number of 2 or more.',
	'max-iterations': 'Enter a whole number from 1 to 5,000.',
	'neighbours-range': 'Enter a whole number from 1 up to the number of rows in the dataset.',
	'seed-range': 'Enter a whole number from 0 to 4,294,967,295, or leave it blank.',
	'layer-sizes': 'Enter a whole number of 1 or more for each layer.',
	'solver-penalty':
		'L-BFGS supports only no penalty or L2. Choose a compatible penalty before saving.'
};

/** Glossary term text and explanation per glossary key. */
const TERMS: Readonly<Record<(typeof GLOSSARY_TERM_KEYS)[number], readonly [string, string]>> = {
	solver: ['solver', 'The method a model uses to find its best settings.'],
	penalty: ['penalty', 'A cost for complexity that keeps the model simple.'],
	regularisation: [
		'regularisation',
		'Discouraging complexity so the model copes better with new data.'
	],
	'learning-rate': [
		'learning rate',
		'How big a step the solver takes each time it adjusts the model.'
	],
	tolerance: ['tolerance', 'How small an improvement must be before training stops.'],
	iteration: ['iterations', 'Rounds of adjusting the model.'],
	intercept: ['intercept', 'A constant baseline added to every prediction.'],
	'class-weight': ['class weights', 'How much each class counts when the model learns.'],
	activation: [
		'activation function',
		'The rule a network unit uses to turn its input into an output.'
	],
	'hidden-layer': [
		'hidden layers',
		'Layers of units between the input and the output of a network.'
	],
	seed: ['seed', 'A starting number that makes random choices repeatable.'],
	impurity: ['impurity', 'How mixed the classes are within a group of rows.'],
	criterion: ['criterion', 'The measure a tree uses to score a split.'],
	neighbour: ['neighbours', 'The training rows closest to a new row.'],
	metric: ['distance metric', 'The way distance between rows is measured.'],
	smoothing: [
		'smoothing',
		'Adding a small amount to counts so unseen values are not impossible.'
	],
	prior: ['priors', 'How likely each class is before looking at the features.'],
	binarise: ['Binarise', 'Turn a number into on or off using a threshold.'],
	kernel: ['kernel', 'The function that decides what shape of boundary can be drawn.'],
	gamma: ['Gamma', 'How far the influence of one training row reaches.'],
	'probability-estimate': ['probability estimates', 'The model’s confidence in each class.']
};

/** Section 3 chrome and Section 1 notice strings, plus every configure-model message. */
export const CONFIGURE_MODEL_MESSAGES = {
	formLabel: 'Model settings',
	mode: 'Mode',
	modeHelp: 'Choose how the settings are selected. Manual lets you set each one yourself.',
	manual: 'Manual',
	randomSearch: 'Random Search (advanced)',
	saveContinue: 'Save & Continue',
	addLayer: 'Add layer',
	multiclassNative: 'This model handles more than two classes directly.',
	multiclassOneVsRest: 'More than two classes are handled by fitting one model per class.',
	multiclassOneVsOne:
		'More than two classes are handled by fitting one model per pair of classes.'
} as const;

/** Parameterised message templates that the builder wraps with `params`. */
export const CONFIGURE_MODEL_TEMPLATES = {
	reset: 'Reset {name}',
	removeLayer: 'Remove layer {layer}',
	layerSize: 'Layer {layer} size',
	exactValue: '{name} (exact value)'
} as const;

/** Flat key-value copy for every option, term, note and error, namespaced for the builder's messages. */
export function flatOptionMessages(): Record<string, string> {
	const flat: Record<string, string> = {};
	for (const [name, [label, description]] of Object.entries(OPTIONS)) {
		flat[`opt.${name}.name`] = label;
		flat[`opt.${name}.description`] = description;
	}
	for (const [name, { values, valueLabel }] of Object.entries(CHOICES)) {
		for (const [key, text] of Object.entries(values)) flat[`opt.${name}.choice.${key}`] = text;
		if (valueLabel) flat[`opt.${name}.valueLabel`] = valueLabel;
	}
	for (const [key, text] of Object.entries(NOTES)) flat[`note.${key}`] = text;
	for (const [key, text] of Object.entries(ERRORS)) flat[`error.${key}`] = text;
	for (const [key, [term, title]] of Object.entries(TERMS)) {
		flat[`term.${key}`] = term;
		flat[`termTitle.${key}`] = title;
	}
	return flat;
}

/** Translated chrome and templates needed to build `ConfigurationLabels`. */
export interface ConfigureModelTranslations {
	/** Flat messages from `flatOptionMessages` and `CONFIGURE_MODEL_MESSAGES`. */
	readonly text: Readonly<Record<string, string>>;
	/** Template functions. */
	readonly reset: (params: { name: string }) => string;
	/** Remove-layer template. */
	readonly removeLayer: (params: { layer: number }) => string;
	/** Layer-size template. */
	readonly layerSize: (params: { layer: number }) => string;
	/** Exact-value template. */
	readonly exactValue: (params: { name: string }) => string;
}

/**
 * Builds the typed `labels` object for one model's configuration form.
 *
 * @param t - Translated messages and templates.
 * @param document - Typed model document.
 * @returns Labels for every option the document lists.
 */
export function buildConfigurationLabels(
	t: ConfigureModelTranslations,
	document: ModelDocument
): ConfigurationLabels {
	const text = (key: string): string => t.text[key] ?? '';
	const options: Record<string, OptionLabels> = {};
	for (const option of document.options) {
		const policy = getOptionPolicy(document.id, option.name);
		if (!policy) continue;
		const terms: GlossaryTerm[] = (policy.terms ?? []).map((key) => ({
			term: text(`term.${key}`),
			title: text(`termTitle.${key}`)
		}));
		const notes: Record<string, string> = {};
		for (const note of policy.notes ?? []) notes[note.key] = text(`note.${note.key}`);
		const choiceKeys = Object.keys(CHOICES[option.name]?.values ?? {});
		const labels: OptionLabels = {
			name: text(`opt.${option.name}.name`) || option.name,
			description: text(`opt.${option.name}.description`),
			terms,
			notes
		};
		if (choiceKeys.length > 0) {
			labels.choices = Object.fromEntries(
				choiceKeys.map((key) => [key, text(`opt.${option.name}.choice.${key}`)])
			);
			const valueLabel = text(`opt.${option.name}.valueLabel`);
			if (valueLabel) labels.valueLabel = valueLabel;
		}
		options[option.name] = labels;
	}
	return {
		formLabel: text('formLabel'),
		mode: text('mode'),
		modeHelp: text('modeHelp'),
		manual: text('manual'),
		randomSearch: text('randomSearch'),
		saveContinue: text('saveContinue'),
		reset: (name) => t.reset({ name }),
		addLayer: text('addLayer'),
		removeLayer: (layer) => t.removeLayer({ layer }),
		layerSize: (layer) => t.layerSize({ layer }),
		exactValue: (name) => t.exactValue({ name }),
		errors: Object.fromEntries(Object.keys(ERRORS).map((key) => [key, text(`error.${key}`)])),
		multiclassNotes: {
			native: text('multiclassNative'),
			'one-vs-rest': text('multiclassOneVsRest'),
			'one-vs-one': text('multiclassOneVsOne')
		},
		options
	};
}
