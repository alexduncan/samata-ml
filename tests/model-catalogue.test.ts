import { describe, expect, it } from 'bun:test';
import {
	SUPERVISED_MODELS,
	isClassifierId,
	type ClassifierId,
	modelsForTarget
} from '../src/features/models/model-catalogue';

describe('Model Catalogue Adapter (MOD-CAT-1)', () => {
	it('MOD-CAT-1: returns the eight classifiers in library index order without regressors, clustering or PCA', () => {
		const expectedClassifiers: ClassifierId[] = [
			'bernoulli-nb',
			'gaussian-nb',
			'multinomial-nb',
			'k-neighbors-classifier',
			'logistic-regression',
			'mlp-classifier',
			'support-vector-classifier',
			'decision-tree-classifier'
		];

		expect(SUPERVISED_MODELS.map((m) => m.id)).toEqual(expectedClassifiers);
		expect(SUPERVISED_MODELS.every((m) => m.taskType === 'classification')).toBe(true);

		expect(modelsForTarget('categorical').map((m) => m.id)).toEqual(expectedClassifiers);
		expect(modelsForTarget('boolean').map((m) => m.id)).toEqual(expectedClassifiers);

		// WML-P1-CAT-1: no other target type has an available model
		expect(modelsForTarget('numeric')).toEqual([]);
		expect(modelsForTarget('text')).toEqual([]);
		expect(modelsForTarget('datetime')).toEqual([]);

		for (const model of SUPERVISED_MODELS) {
			expect(model.id).toBeTruthy();
			expect(model.name).toBeTruthy();
			expect(typeof model.description).toBe('string');
			expect(model.description.length).toBeGreaterThan(0);
		}
	});

	it('recognises only classifier ids', () => {
		expect(isClassifierId('logistic-regression')).toBe(true);
		expect(isClassifierId('linear-regression')).toBe(false);
		expect(isClassifierId('constructor')).toBe(false);
	});
});
