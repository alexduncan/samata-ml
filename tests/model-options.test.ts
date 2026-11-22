import { describe, expect, it } from 'bun:test';
import { SUPERVISED_MODELS, type ClassifierId } from '../src/features/models/model-catalogue';
import { getModelDocument } from '../src/features/models/model-documents';
import {
	normaliseModelOptions,
	type ModelOptionContext
} from '../src/features/models/model-options';
import {
	GLOSSARY_TERM_KEYS,
	MODEL_OPTION_POLICY,
	MULTICLASS_STRATEGY
} from '../src/features/models/model-presentation-policy';
import type { HyperparameterValue } from '../src/types/state';

const CONTEXT: ModelOptionContext = { rowCount: 150, classCount: 3 };

function run(
	id: ClassifierId,
	values: Record<string, HyperparameterValue>,
	context: ModelOptionContext = CONTEXT
) {
	return normaliseModelOptions(getModelDocument(id), values, context);
}

describe('model presentation policy (WML-P1-OPT-1)', () => {
	it('WML-P1-OPT-1: has exactly one policy entry per document option and vice versa', () => {
		for (const { id } of SUPERVISED_MODELS) {
			const documentNames = getModelDocument(id)
				.options.map((o) => o.name)
				.sort();
			const policyNames = Object.keys(MODEL_OPTION_POLICY[id]).sort();
			expect(policyNames).toEqual(documentNames);
		}
	});

	it('WML-P1-OPT-1: matches the control kinds in the plan table', () => {
		const lr = MODEL_OPTION_POLICY['logistic-regression'];
		expect(lr.classWeight.kind).toBe('hidden');
		expect(lr.C).toMatchObject({ kind: 'range', scale: { scale: 'logarithmic' } });
		expect(lr.l1Ratio).toMatchObject({ kind: 'range', scale: { scale: 'linear' } });
		expect(lr.maxIter).toMatchObject({ kind: 'range', scale: { scale: 'integer', max: 5000 } });
		expect(lr.nIterations).toEqual({ kind: 'alias', target: 'maxIter' });
		expect(lr.threshold.kind).toBe('fixed');
		expect(MODEL_OPTION_POLICY['support-vector-classifier'].classWeight.kind).toBe(
			'class-weight'
		);
		expect(MODEL_OPTION_POLICY['support-vector-classifier'].gamma.kind).toBe('gamma-mode');
		expect(MODEL_OPTION_POLICY['mlp-classifier'].hiddenLayerSizes.kind).toBe('layers');
		expect(MODEL_OPTION_POLICY['decision-tree-classifier'].maxDepth.kind).toBe('nullable-mode');
		expect(MODEL_OPTION_POLICY['bernoulli-nb'].binarize.kind).toBe('nullable-mode');
		expect(MODEL_OPTION_POLICY['k-neighbors-classifier'].algorithm.kind).toBe('hidden');
	});

	it('WML-P1-OPT-1: only names glossary terms that exist', () => {
		const known = new Set<string>(GLOSSARY_TERM_KEYS);
		for (const id of Object.keys(MODEL_OPTION_POLICY) as ClassifierId[]) {
			for (const policy of Object.values(MODEL_OPTION_POLICY[id]) as { terms?: string[] }[]) {
				for (const term of policy.terms ?? []) expect(known.has(term)).toBe(true);
			}
		}
	});

	it('maps every classifier to a multiclass strategy', () => {
		for (const { id } of SUPERVISED_MODELS) expect(MULTICLASS_STRATEGY[id]).toBeDefined();
		expect(MULTICLASS_STRATEGY['logistic-regression']).toBe('one-vs-rest');
		expect(MULTICLASS_STRATEGY['support-vector-classifier']).toBe('one-vs-one');
		expect(MULTICLASS_STRATEGY['gaussian-nb']).toBe('native');
	});
});

describe('requestOptions (WML-P1-OPT-2)', () => {
	it('WML-P1-OPT-2: emits learningRate only for the sgd solver', () => {
		expect(
			run('logistic-regression', { solver: 'adam', learningRate: 0.05 }).requestOptions
		).toEqual({});
		expect(
			run('logistic-regression', { solver: 'sgd', learningRate: 0.05 }).requestOptions
		).toEqual({ solver: 'sgd', learningRate: 0.05 });
		for (const solver of ['lbfgs', 'coordinate_descent']) {
			expect(
				run('logistic-regression', { solver, learningRate: 0.05 }).requestOptions
			).toEqual({
				solver
			});
		}
		expect(
			run('mlp-classifier', { solver: 'adam', learningRate: 0.05 }).requestOptions
		).toEqual({});
		expect(run('mlp-classifier', { solver: 'sgd', learningRate: 0.05 }).requestOptions).toEqual(
			{
				solver: 'sgd',
				learningRate: 0.05
			}
		);
		// Inactive overrides are kept for later
		expect(run('logistic-regression', { learningRate: 0.05 }).overrides).toEqual({
			learningRate: 0.05
		});
	});

	it('WML-P1-OPT-2: never emits hidden, fixed, alias or unknown keys', () => {
		const result = run('logistic-regression', {
			classWeight: 'balanced',
			threshold: 0.7,
			multiClass: 'ovr',
			multiLabel: true,
			algorithm: 'brute',
			priors: [0.5, 0.5],
			classPrior: [0.5, 0.5],
			unknown: 1,
			__proto__x: 1
		} as Record<string, HyperparameterValue>);
		expect(result.requestOptions).toEqual({});
		expect(result.overrides).toEqual({});
		expect(run('gaussian-nb', { priors: [1] }).requestOptions).toEqual({});
		expect(run('multinomial-nb', { classPrior: [1] }).overrides).toEqual({});
		const knn = run('k-neighbors-classifier', { algorithm: 'brute', leafSize: 20 });
		expect(knn.overrides).toEqual({});
		expect(knn.requestOptions).toEqual({});
		expect(run('mlp-classifier', { validationFraction: 0.2 }).requestOptions).toEqual({});
	});

	it('WML-P1-OPT-2: keeps SVC classWeight balanced and prunes null as the default', () => {
		expect(
			run('support-vector-classifier', { classWeight: 'balanced' }).requestOptions
		).toEqual({ classWeight: 'balanced' });
		expect(run('support-vector-classifier', { classWeight: null }).requestOptions).toEqual({});
		expect(run('support-vector-classifier', { classWeight: null }).overrides).toEqual({});
	});

	it('WML-P1-OPT-2: resolves the nIterations alias with alias-wins', () => {
		expect(run('logistic-regression', { nIterations: 300 }).requestOptions).toEqual({
			maxIter: 300
		});
		const both = run('logistic-regression', { nIterations: 300, maxIter: 500 });
		expect(both.requestOptions).toEqual({ maxIter: 300 });
		expect(both.overrides).toEqual({ maxIter: 300 });
		expect(run('logistic-regression', { nIterations: 1000 }).overrides).toEqual({});
	});

	it('WML-P1-OPT-2: canonicalises MLP hiddenLayerSizes and prunes the default', () => {
		const scalar = run('mlp-classifier', { hiddenLayerSizes: 64 });
		expect(scalar.overrides).toEqual({ hiddenLayerSizes: [64] });
		expect(scalar.requestOptions).toEqual({ hiddenLayerSizes: [64] });
		expect(run('mlp-classifier', { hiddenLayerSizes: [100] }).overrides).toEqual({});
		expect(run('mlp-classifier', { hiddenLayerSizes: [100, 50] }).requestOptions).toEqual({
			hiddenLayerSizes: [100, 50]
		});
	});

	it('WML-P1-OPT-2: follows dependency rules for l1Ratio, SVC kernel options and KNN p', () => {
		const l1 = run('logistic-regression', { penalty: 'l2', l1Ratio: 0.2 });
		expect(l1.overrides).toEqual({ penalty: 'l2', l1Ratio: 0.2 });
		expect(l1.requestOptions).toEqual({ penalty: 'l2' });
		expect(
			run('logistic-regression', { penalty: 'elasticnet', l1Ratio: 0.2 }).requestOptions
		).toEqual({ penalty: 'elasticnet', l1Ratio: 0.2 });

		const svc = (values: Record<string, HyperparameterValue>) =>
			run('support-vector-classifier', values).requestOptions;
		expect(svc({ degree: 4, coef0: 1, gamma: 0.5 })).toEqual({ gamma: 0.5 });
		expect(svc({ kernel: 'poly', degree: 4, coef0: 1, gamma: 0.5 })).toEqual({
			kernel: 'poly',
			degree: 4,
			coef0: 1,
			gamma: 0.5
		});
		expect(svc({ kernel: 'sigmoid', degree: 4, coef0: 1 })).toEqual({
			kernel: 'sigmoid',
			coef0: 1
		});
		expect(svc({ kernel: 'linear', gamma: 'auto' })).toEqual({ kernel: 'linear' });

		expect(run('k-neighbors-classifier', { p: 3 }).requestOptions).toEqual({ p: 3 });
		expect(run('k-neighbors-classifier', { metric: 'manhattan', p: 3 }).requestOptions).toEqual(
			{
				metric: 'manhattan'
			}
		);
	});
});

describe('validation and defaults (WML-P1-OPT-3)', () => {
	const issueCount = (
		id: ClassifierId,
		values: Record<string, HyperparameterValue>,
		context: ModelOptionContext = CONTEXT
	) => run(id, values, context).issues.length;

	it('WML-P1-OPT-3: flags each out-of-domain active value with one issue', () => {
		const lr = 'logistic-regression';
		expect(issueCount(lr, { penalty: 'l2', C: 0 })).toBe(1);
		expect(issueCount(lr, { penalty: 'l2', C: null })).toBe(1);
		expect(issueCount(lr, { maxIter: 1.5 })).toBe(1);
		expect(issueCount(lr, { maxIter: 5001 })).toBe(1);
		expect(issueCount(lr, { solver: 'lbfgs', penalty: 'l1' })).toBe(1);
		expect(issueCount('multinomial-nb', { alpha: -1 })).toBe(1);
		expect(issueCount('k-neighbors-classifier', { nNeighbors: CONTEXT.rowCount + 1 })).toBe(1);
		expect(issueCount('decision-tree-classifier', { minSamplesSplit: 1 })).toBe(1);
		expect(issueCount('mlp-classifier', { hiddenLayerSizes: [] })).toBe(1);
		expect(issueCount('mlp-classifier', { randomState: -1 })).toBe(1);
		expect(issueCount('mlp-classifier', { randomState: 4294967296 })).toBe(1);
		expect(issueCount('mlp-classifier', { randomState: 1.5 })).toBe(1);
		expect(issueCount('support-vector-classifier', { tol: 0 })).toBe(1);
	});

	it('WML-P1-OPT-3: names the issue option and message key', () => {
		expect(run('logistic-regression', { solver: 'lbfgs', penalty: 'l1' }).issues).toEqual([
			{ name: 'solver', messageKey: 'solver-penalty' }
		]);
		expect(run('mlp-classifier', { randomState: -1 }).issues).toEqual([
			{ name: 'randomState', messageKey: 'seed-range' }
		]);
	});

	it('WML-P1-OPT-3: accepts boundary and null values', () => {
		expect(issueCount('multinomial-nb', { alpha: 0 })).toBe(0);
		expect(issueCount('decision-tree-classifier', { maxDepth: null })).toBe(0);
		expect(issueCount('bernoulli-nb', { binarize: null })).toBe(0);
		expect(issueCount('support-vector-classifier', { gamma: 'auto' })).toBe(0);
		expect(issueCount('support-vector-classifier', { gamma: 0 })).toBe(0);
		expect(issueCount('support-vector-classifier', { C: 1e5 })).toBe(0);
		expect(issueCount('mlp-classifier', { randomState: 0 })).toBe(0);
		expect(issueCount('mlp-classifier', { randomState: 4294967295 })).toBe(0);
	});

	it('WML-P1-OPT-3: validates an invalid default and ignores invalid inactive overrides', () => {
		const small = run('k-neighbors-classifier', {}, { rowCount: 3, classCount: 2 });
		expect(small.issues).toEqual([{ name: 'nNeighbors', messageKey: 'neighbours-range' }]);
		expect(small.requestOptions).toEqual({});
		expect(run('k-neighbors-classifier', {}, { rowCount: 5, classCount: 2 }).issues).toEqual(
			[]
		);
		expect(run('logistic-regression', { penalty: 'l2', l1Ratio: 2 }).issues).toEqual([]);
	});

	it('WML-P1-OPT-3: prunes overrides equal to the effective default, including defaultBy', () => {
		expect(run('logistic-regression', { solver: 'lbfgs', tol: 1e-4 }).overrides).toEqual({
			solver: 'lbfgs'
		});
		expect(run('logistic-regression', { tol: 1e-4 }).overrides).toEqual({ tol: 1e-4 });
		expect(run('logistic-regression', { solver: 'lbfgs', tol: 1e-4 }).effective.tol).toBe(1e-4);
	});

	it('WML-P1-OPT-3: keeps null, false, 0 and absence distinct', () => {
		expect(run('decision-tree-classifier', { maxDepth: 5 }).overrides).toEqual({ maxDepth: 5 });
		expect(run('decision-tree-classifier', { maxDepth: null }).overrides).toEqual({});
		expect(run('bernoulli-nb', { binarize: null }).overrides).toEqual({ binarize: null });
		expect(run('bernoulli-nb', { binarize: 0 }).overrides).toEqual({});
		expect(run('bernoulli-nb', { forceAlpha: false }).overrides).toEqual({ forceAlpha: false });
		expect(run('logistic-regression', { fitIntercept: false }).requestOptions).toEqual({
			fitIntercept: false
		});
		expect(run('mlp-classifier', {}).effective.randomState).toBeUndefined();
		expect(run('mlp-classifier', { randomState: 0 }).requestOptions).toEqual({
			randomState: 0
		});
	});
});
