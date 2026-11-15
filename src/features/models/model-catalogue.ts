import indexJson from 'web-ml/model-specifications';

import bernoulliNb from 'web-ml/model-specifications/bernoulli-nb';
import decisionTreeClassifier from 'web-ml/model-specifications/decision-tree-classifier';
import decisionTreeRegressor from 'web-ml/model-specifications/decision-tree-regressor';
import gaussianNb from 'web-ml/model-specifications/gaussian-nb';
import kMeans from 'web-ml/model-specifications/k-means';
import kNeighborsClassifier from 'web-ml/model-specifications/k-neighbors-classifier';
import kNeighborsRegressor from 'web-ml/model-specifications/k-neighbors-regressor';
import linearRegression from 'web-ml/model-specifications/linear-regression';
import logisticRegression from 'web-ml/model-specifications/logistic-regression';
import mlpClassifier from 'web-ml/model-specifications/mlp-classifier';
import mlpRegressor from 'web-ml/model-specifications/mlp-regressor';
import multinomialNb from 'web-ml/model-specifications/multinomial-nb';
import pca from 'web-ml/model-specifications/pca';
import polynomialRegression from 'web-ml/model-specifications/polynomial-regression';
import supportVectorClassifier from 'web-ml/model-specifications/support-vector-classifier';
import supportVectorRegressor from 'web-ml/model-specifications/support-vector-regressor';
import type { ColumnType } from '../../types/state';

/**
 * Supervised model entry in the catalogue adapter.
 */
export interface ModelCatalogueEntry {
	/** Unique model identifier from web-ml. */
	id: string;
	/** Human-readable model name from web-ml specification. */
	name: string;
	/** Supervised task type: classification or regression. */
	taskType: 'classification' | 'regression';
	/** Plain text description from per-model JSON specification. */
	description: string;
}

/** Static bundling import map validating subpaths against the library index. */
const MODEL_DESCRIPTIONS: Record<string, string> = {
	'bernoulli-nb': bernoulliNb.description,
	'decision-tree-classifier': decisionTreeClassifier.description,
	'decision-tree-regressor': decisionTreeRegressor.description,
	'gaussian-nb': gaussianNb.description,
	'k-means': kMeans.description,
	'k-neighbors-classifier': kNeighborsClassifier.description,
	'k-neighbors-regressor': kNeighborsRegressor.description,
	'linear-regression': linearRegression.description,
	'logistic-regression': logisticRegression.description,
	'mlp-classifier': mlpClassifier.description,
	'mlp-regressor': mlpRegressor.description,
	'multinomial-nb': multinomialNb.description,
	pca: pca.description,
	'polynomial-regression': polynomialRegression.description,
	'support-vector-classifier': supportVectorClassifier.description,
	'support-vector-regressor': supportVectorRegressor.description
};

/** All 14 supervised models in library index order. Excludes clustering and PCA. */
export const SUPERVISED_MODELS: readonly ModelCatalogueEntry[] = indexJson.models
	.filter(
		(
			m
		): m is (typeof indexJson.models)[number] & { taskType: 'classification' | 'regression' } =>
			m.taskType === 'classification' || m.taskType === 'regression'
	)
	.map((m) => ({
		id: m.id,
		name: m.name,
		taskType: m.taskType,
		description: MODEL_DESCRIPTIONS[m.id] ?? ''
	}));

/**
 * Returns available supervised models for the given target column type,
 * preserving library index order.
 *
 * @param type - Target column type.
 * @returns Array of eligible models (classification for categorical/boolean, regression for numeric, empty for text/datetime).
 */
export function modelsForTarget(type: ColumnType): readonly ModelCatalogueEntry[] {
	if (type === 'categorical' || type === 'boolean') {
		return SUPERVISED_MODELS.filter((m) => m.taskType === 'classification');
	}
	if (type === 'numeric') {
		return SUPERVISED_MODELS.filter((m) => m.taskType === 'regression');
	}
	return [];
}
