import type { BaseTrainingAlgorithm } from 'web-ml';
import indexJson from 'web-ml/model-specifications';

import bernoulliNb from 'web-ml/model-specifications/bernoulli-nb';
import decisionTreeClassifier from 'web-ml/model-specifications/decision-tree-classifier';
import gaussianNb from 'web-ml/model-specifications/gaussian-nb';
import kNeighborsClassifier from 'web-ml/model-specifications/k-neighbors-classifier';
import logisticRegression from 'web-ml/model-specifications/logistic-regression';
import mlpClassifier from 'web-ml/model-specifications/mlp-classifier';
import multinomialNb from 'web-ml/model-specifications/multinomial-nb';
import supportVectorClassifier from 'web-ml/model-specifications/support-vector-classifier';
import type { ColumnType } from '../../types/state';

/** Identifiers of the eight `web-ml` classifiers that samata-ml can configure and train. */
export type ClassifierId = Extract<
	BaseTrainingAlgorithm,
	| 'logistic-regression'
	| 'mlp-classifier'
	| 'decision-tree-classifier'
	| 'k-neighbors-classifier'
	| 'gaussian-nb'
	| 'multinomial-nb'
	| 'bernoulli-nb'
	| 'support-vector-classifier'
>;

/**
 * Supervised model entry in the catalogue adapter.
 */
export interface ModelCatalogueEntry {
	/** Unique model identifier from web-ml. */
	id: ClassifierId;
	/** Human-readable model name from web-ml specification. */
	name: string;
	/** Supervised task type. Only classification is available until regression is implemented. */
	taskType: 'classification';
	/** Plain text description from per-model JSON specification. */
	description: string;
}

/**
 * Statically bundled `web-ml` model specification documents for the eight classifiers,
 * keyed by model identifier. Narrow them with `getModelDocument`.
 */
export const MODEL_DOCUMENTS: Readonly<Record<ClassifierId, unknown>> = {
	'bernoulli-nb': bernoulliNb,
	'decision-tree-classifier': decisionTreeClassifier,
	'gaussian-nb': gaussianNb,
	'k-neighbors-classifier': kNeighborsClassifier,
	'logistic-regression': logisticRegression,
	'mlp-classifier': mlpClassifier,
	'multinomial-nb': multinomialNb,
	'support-vector-classifier': supportVectorClassifier
};

/**
 * Reports whether a persisted model identifier names an available classifier.
 *
 * @param id - Candidate identifier.
 * @returns `true` when the identifier is one of the eight classifier ids.
 */
export function isClassifierId(id: string): id is ClassifierId {
	return Object.hasOwn(MODEL_DOCUMENTS, id);
}

/** The eight classifiers in library index order. */
export const SUPERVISED_MODELS: readonly ModelCatalogueEntry[] = indexJson.models
	.filter((m) => m.taskType === 'classification' && isClassifierId(m.id))
	.map((m) => {
		const id = m.id as ClassifierId;
		const document = MODEL_DOCUMENTS[id] as { description?: string };
		return {
			id,
			name: m.name,
			taskType: 'classification' as const,
			description: document.description ?? ''
		};
	});

/**
 * Returns available supervised models for the given target column type,
 * preserving library index order.
 *
 * @param type - Target column type.
 * @returns The eight classifiers for categorical and boolean targets; an empty list otherwise.
 */
export function modelsForTarget(type: ColumnType): readonly ModelCatalogueEntry[] {
	if (type === 'categorical' || type === 'boolean') {
		return SUPERVISED_MODELS;
	}
	return [];
}
