import type { TrainingOptionsFor } from 'web-ml';
import type { ScaleConfig } from '../../common/parameter-scale';
import type { HyperparameterValue, MulticlassStrategy } from '../../types/state';
import type { ClassifierId } from './model-catalogue';
import type { ModelOptionContext } from './model-options';

/** Option values resolved from defaults and overrides, `undefined` when `web-ml` derives them. */
export type EffectiveOptions = Readonly<Record<string, HyperparameterValue | undefined>>;

/** Valid domain of a numeric option. */
export interface NumberDomain {
	/** Smallest valid value. */
	readonly min?: number;
	/** When `true`, `min` itself is invalid. */
	readonly minExclusive?: boolean;
	/** Largest valid value; `'rowCount'` uses the dataset row count. */
	readonly max?: number | 'rowCount';
	/** Requires a whole number. */
	readonly integer?: boolean;
	/** Message key shown when a value is outside the domain. */
	readonly messageKey: string;
}

/** A note rendered with a field, optionally only while a condition holds. */
export interface PolicyNote {
	/** Message key, resolved per model and option by the builder. */
	readonly key: string;
	/** Shows the note only when this returns `true`. */
	readonly when?: (effective: EffectiveOptions) => boolean;
}

interface PolicyBase {
	/** Glossary term keys that the description may wrap in `<abbr>`. */
	readonly terms?: readonly string[];
	/** Dependency and explanatory notes. */
	readonly notes?: readonly PolicyNote[];
	/** The option is rendered and emitted only while this returns `true` (default: always). */
	readonly activeWhen?: (effective: EffectiveOptions) => boolean;
}

/** A scale that may depend on the dataset. */
export type PolicyScale = ScaleConfig | ((context: ModelOptionContext) => ScaleConfig);

/** How one `web-ml` option is presented and validated. */
export type OptionPolicy =
	| (PolicyBase & {
			/** Native select over the JSON enum. */
			readonly kind: 'select';
			/** Enum values that are unavailable for the current options (rendered `disabled`). */
			readonly disabledChoices?: (effective: EffectiveOptions) => readonly string[];
	  })
	| (PolicyBase & { readonly kind: 'checkbox' })
	| (PolicyBase & {
			/** Synchronised range + number pair. */
			readonly kind: 'range';
			readonly scale: PolicyScale;
			readonly domain: NumberDomain;
	  })
	| (PolicyBase & {
			/** Number input with a Reset button and no slider. */
			readonly kind: 'number-reset';
			readonly domain: NumberDomain;
			/** `true` when an empty input is valid and omits the option (`randomState`). */
			readonly blankIsOmitted?: boolean;
	  })
	| (PolicyBase & {
			/** `null` versus a numeric value, chosen by a mode select. */
			readonly kind: 'nullable-mode';
			readonly domain: NumberDomain;
			readonly scale?: PolicyScale;
			/** Value used when the user switches to the value mode. */
			readonly startValue: number;
	  })
	| (PolicyBase & {
			/** `'scale'`, `'auto'` or a numeric value. */
			readonly kind: 'gamma-mode';
			readonly domain: NumberDomain;
			readonly scale: PolicyScale;
			readonly startValue: number;
	  })
	| (PolicyBase & { readonly kind: 'layers' })
	| (PolicyBase & { readonly kind: 'class-weight' })
	| (PolicyBase & { readonly kind: 'fixed' })
	| (PolicyBase & { readonly kind: 'hidden' })
	| (PolicyBase & {
			/** Alias of another option; merged into `target` and never emitted. */
			readonly kind: 'alias';
			readonly target: string;
	  });

/** Multiclass strategy `web-ml` applies to each classifier. */
export const MULTICLASS_STRATEGY: Readonly<Record<ClassifierId, MulticlassStrategy>> = {
	'logistic-regression': 'one-vs-rest',
	'support-vector-classifier': 'one-vs-one',
	'mlp-classifier': 'native',
	'decision-tree-classifier': 'native',
	'k-neighbors-classifier': 'native',
	'gaussian-nb': 'native',
	'multinomial-nb': 'native',
	'bernoulli-nb': 'native'
};

/** Largest `maxIter` the app allows, so a single fit cannot tie up the browser tab. */
export const MAX_ITERATIONS_CAP = 5000;

const POSITIVE: NumberDomain = { min: 0, minExclusive: true, messageKey: 'positive-number' };
const NON_NEGATIVE: NumberDomain = { min: 0, messageKey: 'non-negative-number' };
const FINITE: NumberDomain = { messageKey: 'finite-number' };
const MAX_ITER_DOMAIN: NumberDomain = {
	integer: true,
	min: 1,
	max: MAX_ITERATIONS_CAP,
	messageKey: 'max-iterations'
};
const MAX_ITER_SCALE: ScaleConfig = {
	scale: 'integer',
	min: 1,
	max: MAX_ITERATIONS_CAP,
	step: 1
};
const SEED_DOMAIN: NumberDomain = {
	integer: true,
	min: 0,
	max: 4294967295,
	messageKey: 'seed-range'
};

const adamNotes: readonly PolicyNote[] = [
	{ key: 'adam-fixed-rate', when: (e) => e.solver === 'adam' },
	{ key: 'adam-rate-value', when: (e) => e.solver === 'adam' }
];

/** Glossary term keys that `/help/configure-model` must define. */
export const GLOSSARY_TERM_KEYS = [
	'solver',
	'penalty',
	'regularisation',
	'learning-rate',
	'tolerance',
	'iteration',
	'intercept',
	'class-weight',
	'activation',
	'hidden-layer',
	'seed',
	'impurity',
	'criterion',
	'neighbour',
	'metric',
	'smoothing',
	'prior',
	'binarise',
	'kernel',
	'gamma',
	'probability-estimate'
] as const;

/** A glossary term key used by the presentation policy. */
export type GlossaryTermKey = (typeof GLOSSARY_TERM_KEYS)[number];

/**
 * Presentation policy for every option of the eight classifiers.
 * The `satisfies` clause makes `tsc` reject any key that is not a `web-ml` option.
 */
export const MODEL_OPTION_POLICY = {
	'logistic-regression': {
		solver: {
			kind: 'select',
			terms: ['solver'],
			disabledChoices: (e) =>
				e.penalty === 'l1' || e.penalty === 'elasticnet' ? ['lbfgs'] : [],
			notes: [
				...adamNotes,
				{
					key: 'no-learning-rate',
					when: (e) => e.solver === 'lbfgs' || e.solver === 'coordinate_descent'
				},
				{
					key: 'lbfgs-penalty',
					when: (e) => e.penalty === 'l1' || e.penalty === 'elasticnet'
				}
			]
		},
		penalty: {
			kind: 'select',
			terms: ['penalty', 'regularisation'],
			disabledChoices: (e) => (e.solver === 'lbfgs' ? ['l1', 'elasticnet'] : []),
			notes: [
				{ key: 'lbfgs-penalty', when: (e) => e.solver === 'lbfgs' },
				{ key: 'penalty-c', when: (e) => e.penalty === 'none' },
				{ key: 'penalty-l1-ratio', when: (e) => e.penalty !== 'elasticnet' }
			]
		},
		C: {
			kind: 'range',
			terms: ['regularisation'],
			scale: { scale: 'logarithmic', min: 1e-4, max: 1e4, step: 0.1 },
			domain: POSITIVE,
			activeWhen: (e) => e.penalty !== 'none'
		},
		l1Ratio: {
			kind: 'range',
			terms: ['regularisation'],
			scale: { scale: 'linear', min: 0, max: 1, step: 0.01 },
			domain: { min: 0, max: 1, messageKey: 'unit-interval' },
			activeWhen: (e) => e.penalty === 'elasticnet'
		},
		classWeight: { kind: 'hidden' },
		fitIntercept: { kind: 'checkbox', terms: ['intercept'] },
		learningRate: {
			kind: 'range',
			terms: ['learning-rate'],
			scale: { scale: 'logarithmic', min: 1e-6, max: 1, step: 0.1 },
			domain: POSITIVE,
			activeWhen: (e) => e.solver === 'sgd'
		},
		maxIter: {
			kind: 'range',
			terms: ['iteration'],
			scale: MAX_ITER_SCALE,
			domain: MAX_ITER_DOMAIN,
			notes: [{ key: 'max-iter-cap' }]
		},
		tol: { kind: 'number-reset', terms: ['tolerance'], domain: NON_NEGATIVE },
		multiClass: { kind: 'hidden' },
		multiLabel: { kind: 'hidden' },
		nIterations: { kind: 'alias', target: 'maxIter' },
		threshold: { kind: 'fixed', notes: [{ key: 'fixed-threshold' }] }
	},
	'mlp-classifier': {
		hiddenLayerSizes: { kind: 'layers', terms: ['hidden-layer'] },
		activation: { kind: 'select', terms: ['activation'] },
		solver: {
			kind: 'select',
			terms: ['solver'],
			notes: adamNotes
		},
		learningRate: {
			kind: 'range',
			terms: ['learning-rate'],
			scale: { scale: 'logarithmic', min: 1e-6, max: 1, step: 0.1 },
			domain: POSITIVE,
			activeWhen: (e) => e.solver === 'sgd'
		},
		maxIter: {
			kind: 'range',
			terms: ['iteration'],
			scale: MAX_ITER_SCALE,
			domain: MAX_ITER_DOMAIN,
			notes: [{ key: 'max-iter-cap' }]
		},
		tol: { kind: 'number-reset', terms: ['tolerance'], domain: NON_NEGATIVE },
		randomState: {
			kind: 'number-reset',
			terms: ['seed'],
			domain: SEED_DOMAIN,
			blankIsOmitted: true
		}
	},
	'decision-tree-classifier': {
		criterion: { kind: 'select', terms: ['criterion', 'impurity'] },
		maxDepth: {
			kind: 'nullable-mode',
			scale: { scale: 'integer', min: 1, max: 50, step: 1 },
			domain: { integer: true, min: 1, messageKey: 'integer-min-1' },
			startValue: 10
		},
		minSamplesSplit: {
			kind: 'range',
			scale: { scale: 'integer', min: 2, max: 100, step: 1 },
			domain: { integer: true, min: 2, messageKey: 'integer-min-2' }
		},
		minSamplesLeaf: {
			kind: 'range',
			scale: { scale: 'integer', min: 1, max: 100, step: 1 },
			domain: { integer: true, min: 1, messageKey: 'integer-min-1' }
		},
		minImpurityDecrease: {
			kind: 'number-reset',
			terms: ['impurity'],
			domain: NON_NEGATIVE
		}
	},
	'k-neighbors-classifier': {
		nNeighbors: {
			kind: 'range',
			terms: ['neighbour'],
			scale: (context) => ({
				scale: 'integer',
				min: 1,
				max: Math.max(1, Math.min(50, context.rowCount)),
				step: 1
			}),
			domain: { integer: true, min: 1, max: 'rowCount', messageKey: 'neighbours-range' }
		},
		weights: { kind: 'select' },
		algorithm: { kind: 'hidden' },
		metric: {
			kind: 'select',
			terms: ['metric'],
			notes: [{ key: 'metric-p', when: (e) => e.metric !== 'minkowski' }]
		},
		p: {
			kind: 'number-reset',
			domain: { min: 1, messageKey: 'number-min-1' },
			activeWhen: (e) => e.metric === 'minkowski'
		}
	},
	'gaussian-nb': {
		priors: { kind: 'fixed', terms: ['prior'], notes: [{ key: 'fixed-priors' }] },
		varSmoothing: { kind: 'number-reset', terms: ['smoothing'], domain: NON_NEGATIVE }
	},
	'multinomial-nb': {
		alpha: {
			kind: 'range',
			terms: ['smoothing'],
			scale: { scale: 'logarithmic', min: 1e-4, max: 1e2, step: 0.1 },
			domain: NON_NEGATIVE
		},
		forceAlpha: { kind: 'checkbox', terms: ['smoothing'] },
		fitPrior: { kind: 'checkbox', terms: ['prior'] },
		classPrior: { kind: 'fixed', terms: ['prior'], notes: [{ key: 'fixed-priors' }] }
	},
	'bernoulli-nb': {
		alpha: {
			kind: 'range',
			terms: ['smoothing'],
			scale: { scale: 'logarithmic', min: 1e-4, max: 1e2, step: 0.1 },
			domain: NON_NEGATIVE
		},
		forceAlpha: { kind: 'checkbox', terms: ['smoothing'] },
		binarize: {
			kind: 'nullable-mode',
			terms: ['binarise'],
			domain: FINITE,
			startValue: 0
		},
		fitPrior: { kind: 'checkbox', terms: ['prior'] },
		classPrior: { kind: 'fixed', terms: ['prior'], notes: [{ key: 'fixed-priors' }] }
	},
	'support-vector-classifier': {
		C: {
			kind: 'range',
			terms: ['regularisation'],
			scale: { scale: 'logarithmic', min: 1e-4, max: 1e4, step: 0.1 },
			domain: POSITIVE
		},
		classWeight: { kind: 'class-weight', terms: ['class-weight'] },
		kernel: {
			kind: 'select',
			terms: ['kernel'],
			notes: [
				{ key: 'kernel-degree', when: (e) => e.kernel !== 'poly' },
				{ key: 'kernel-gamma', when: (e) => e.kernel === 'linear' },
				{ key: 'kernel-coef0', when: (e) => e.kernel !== 'poly' && e.kernel !== 'sigmoid' }
			]
		},
		degree: {
			kind: 'range',
			scale: { scale: 'integer', min: 0, max: 10, step: 1 },
			domain: { integer: true, min: 0, messageKey: 'integer-min-0' },
			activeWhen: (e) => e.kernel === 'poly'
		},
		gamma: {
			kind: 'gamma-mode',
			terms: ['gamma'],
			scale: { scale: 'logarithmic', min: 1e-4, max: 1e2, step: 0.1 },
			domain: NON_NEGATIVE,
			startValue: 0.1,
			activeWhen: (e) => e.kernel !== 'linear'
		},
		coef0: {
			kind: 'number-reset',
			domain: FINITE,
			activeWhen: (e) => e.kernel === 'poly' || e.kernel === 'sigmoid'
		},
		tol: { kind: 'number-reset', terms: ['tolerance'], domain: POSITIVE },
		probability: { kind: 'checkbox', terms: ['probability-estimate'] }
	}
} as const satisfies {
	readonly [A in ClassifierId]: {
		readonly [K in keyof TrainingOptionsFor<A> & string]?: OptionPolicy;
	};
};

/**
 * Looks up the presentation policy for one option.
 *
 * @param id - Classifier identifier.
 * @param name - Option name from the model document.
 * @returns The policy, or `undefined` for an option the app does not know.
 */
export function getOptionPolicy(id: ClassifierId, name: string): OptionPolicy | undefined {
	const table = MODEL_OPTION_POLICY[id] as Readonly<Record<string, OptionPolicy | undefined>>;
	return Object.hasOwn(table, name) ? table[name] : undefined;
}

/**
 * Resolves a policy scale, which may depend on the dataset.
 *
 * @param scale - Static or dataset-dependent scale.
 * @param context - Dataset facts.
 * @returns The concrete scale configuration.
 */
export function resolveScale(scale: PolicyScale, context: ModelOptionContext): ScaleConfig {
	return typeof scale === 'function' ? scale(context) : scale;
}
