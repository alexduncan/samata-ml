import { describe, expect, it } from 'bun:test';
import { MODEL_DOCUMENTS, SUPERVISED_MODELS } from '../src/features/models/model-catalogue';
import {
	ModelDocumentError,
	getModelDocument,
	narrowModelDocument
} from '../src/features/models/model-documents';

function option(document: ReturnType<typeof getModelDocument>, name: string) {
	const found = document.options.find((o) => o.name === name);
	if (!found) throw new Error(`missing option ${name}`);
	return found;
}

function clone(id: Parameters<typeof getModelDocument>[0]): Record<string, unknown> {
	return JSON.parse(JSON.stringify(MODEL_DOCUMENTS[id])) as Record<string, unknown>;
}

function optionsOf(doc: Record<string, unknown>): Record<string, unknown>[] {
	return doc.hyperparameters as Record<string, unknown>[];
}

describe('getModelDocument (WML-P1-DOC-1)', () => {
	it('narrows every classifier document and memoises the result', () => {
		for (const entry of SUPERVISED_MODELS) {
			const document = getModelDocument(entry.id);
			const raw = MODEL_DOCUMENTS[entry.id] as { hyperparameters: unknown[] };
			expect(document.id).toBe(entry.id);
			expect(document.options).toHaveLength(raw.hyperparameters.length);
			expect(getModelDocument(entry.id)).toBe(document);
		}
	});

	it('models Logistic Regression threshold, alias and conditional defaults', () => {
		const lr = getModelDocument('logistic-regression');
		expect(option(lr, 'threshold')).toMatchObject({ defaultKind: 'fixed', default: 0.5 });
		expect(option(lr, 'nIterations')).toMatchObject({
			aliasOf: 'maxIter',
			aliasPrecedence: 'alias-wins'
		});
		expect(option(lr, 'maxIter').aliasOf).toBeNull();
		for (const name of ['learningRate', 'tol']) {
			const o = option(lr, name);
			expect(o.defaultKind).toBe('conditional');
			expect(o.defaultBy?.length).toBeGreaterThan(0);
			expect(o.default).toBeUndefined();
		}
		expect(option(lr, 'learningRate').defaultBy?.[0]).toEqual({
			when: { solver: 'sgd' },
			value: 0.01
		});
	});

	it('flattens oneOf schemas into types and enum values', () => {
		const svc = getModelDocument('support-vector-classifier');
		expect(option(svc, 'gamma')).toMatchObject({
			types: ['string', 'number'],
			enumValues: ['scale', 'auto']
		});
		expect(option(svc, 'classWeight')).toMatchObject({
			types: ['string', 'object', 'null'],
			enumValues: ['balanced']
		});
		expect(option(getModelDocument('decision-tree-classifier'), 'maxDepth')).toMatchObject({
			types: ['number', 'null'],
			enumValues: null
		});
	});

	it('marks MLP randomState as random-if-omitted with no default', () => {
		const state = option(getModelDocument('mlp-classifier'), 'randomState');
		expect(state.defaultKind).toBe('random-if-omitted');
		expect(state.default).toBeUndefined();
		expect(state.defaultBy).toBeNull();
	});
});

describe('narrowModelDocument rejections (WML-P1-DOC-1)', () => {
	const id = 'logistic-regression';

	it('rejects schemaVersion 2 and a missing hyperparameters array', () => {
		expect(() => narrowModelDocument(id, { ...clone(id), schemaVersion: 2 })).toThrow(
			ModelDocumentError
		);
		const noOptions = clone(id);
		delete noOptions.hyperparameters;
		expect(() => narrowModelDocument(id, noOptions)).toThrow(ModelDocumentError);
	});

	it('rejects an invalid defaultKind, an empty defaultBy and a missing alias precedence', () => {
		const badKind = clone(id);
		optionsOf(badKind)[0]!.defaultKind = 'sometimes';
		expect(() => narrowModelDocument(id, badKind)).toThrow(ModelDocumentError);

		const emptyBy = clone(id);
		const conditional = optionsOf(emptyBy).find((o) => o.name === 'learningRate')!;
		conditional.defaultBy = [];
		expect(() => narrowModelDocument(id, emptyBy)).toThrow(ModelDocumentError);

		const noPrecedence = clone(id);
		delete optionsOf(noPrecedence).find((o) => o.name === 'nIterations')!.aliasPrecedence;
		expect(() => narrowModelDocument(id, noPrecedence)).toThrow(ModelDocumentError);
	});

	it('rejects an invalid oneOf branch and an unknown type', () => {
		const badBranch = clone('support-vector-classifier');
		optionsOf(badBranch).find((o) => o.name === 'gamma')!.valueSchema = { oneOf: ['number'] };
		expect(() => narrowModelDocument('support-vector-classifier', badBranch)).toThrow(
			ModelDocumentError
		);

		const badType = clone(id);
		optionsOf(badType)[0]!.valueSchema = { type: 'bigint' };
		expect(() => narrowModelDocument(id, badType)).toThrow(ModelDocumentError);
	});

	it('rejects prototype keys at the root, option, valueSchema and defaultBy.when', () => {
		for (const key of ['__proto__', 'constructor', 'prototype']) {
			const atRoot = clone(id);
			Object.defineProperty(atRoot, key, { value: {}, enumerable: true });
			expect(() => narrowModelDocument(id, atRoot)).toThrow(ModelDocumentError);

			const atOption = clone(id);
			Object.defineProperty(optionsOf(atOption)[0]!, key, { value: 1, enumerable: true });
			expect(() => narrowModelDocument(id, atOption)).toThrow(ModelDocumentError);

			const atSchema = clone(id);
			const schema = optionsOf(atSchema)[0]!.valueSchema as Record<string, unknown>;
			Object.defineProperty(schema, key, { value: 1, enumerable: true });
			expect(() => narrowModelDocument(id, atSchema)).toThrow(ModelDocumentError);

			const atWhen = clone(id);
			const rule = (
				optionsOf(atWhen).find((o) => o.name === 'tol')!.defaultBy as {
					when: Record<string, unknown>;
				}[]
			)[0]!;
			Object.defineProperty(rule.when, key, { value: 1, enumerable: true });
			expect(() => narrowModelDocument(id, atWhen)).toThrow(ModelDocumentError);
		}
	});
});
