import { describe, expect, it } from 'bun:test';
import {
	SUPERVISED_MODELS,
	modelsForTarget,
	type ModelCatalogueEntry
} from '../src/features/models/model-catalogue';

describe('Model Catalogue Adapter (MOD-CAT-1)', () => {
	it('MOD-CAT-1: returns exact supervised IDs, types and order without clustering or PCA', () => {
		// All supervised models must equal exactly 14 models (8 classification + 6 regression)
		expect(SUPERVISED_MODELS).toHaveLength(14);

		const allIds = SUPERVISED_MODELS.map((m) => m.id);
		expect(allIds).not.toContain('k-means');
		expect(allIds).not.toContain('pca');

		// 8 classifiers in exact library index order
		const expectedClassifiers = [
			'bernoulli-nb',
			'gaussian-nb',
			'multinomial-nb',
			'k-neighbors-classifier',
			'logistic-regression',
			'mlp-classifier',
			'support-vector-classifier',
			'decision-tree-classifier'
		];

		const classifiersForCat = modelsForTarget('categorical');
		expect(classifiersForCat.map((m) => m.id)).toEqual(expectedClassifiers);
		expect(classifiersForCat.every((m) => m.taskType === 'classification')).toBe(true);

		const classifiersForBool = modelsForTarget('boolean');
		expect(classifiersForBool.map((m) => m.id)).toEqual(expectedClassifiers);

		// 6 regressors in exact library index order
		const expectedRegressors = [
			'k-neighbors-regressor',
			'linear-regression',
			'polynomial-regression',
			'mlp-regressor',
			'support-vector-regressor',
			'decision-tree-regressor'
		];

		const regressors = modelsForTarget('numeric');
		expect(regressors.map((m) => m.id)).toEqual(expectedRegressors);
		expect(regressors.every((m) => m.taskType === 'regression')).toBe(true);

		// Unsupported target types return empty list
		expect(modelsForTarget('text')).toEqual([]);
		expect(modelsForTarget('datetime')).toEqual([]);

		// Every entry has complete metadata populated from bundling map
		for (const model of SUPERVISED_MODELS) {
			expect(model.id).toBeTruthy();
			expect(model.name).toBeTruthy();
			expect(model.taskType).toMatch(/^(classification|regression)$/);
			expect(typeof model.description).toBe('string');
			expect(model.description.length).toBeGreaterThan(0);
		}
	});
});
