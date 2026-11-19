import type {
	ModelDocument,
	ModelOptionDefaultKind,
	ModelOptionDefaultRule,
	ModelOptionDocument,
	ModelOptionType
} from '../../types/model-document';
import { MODEL_DOCUMENTS, type ClassifierId } from './model-catalogue';

/** Thrown when a bundled `web-ml` model document does not match `schema.json` v1. */
export class ModelDocumentError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ModelDocumentError';
	}
}

type Scalar = string | number | boolean | null;

const FORBIDDEN_KEYS = ['__proto__', 'constructor', 'prototype'] as const;
const OPTION_TYPES: ReadonlySet<string> = new Set<ModelOptionType>([
	'number',
	'integer',
	'string',
	'boolean',
	'array',
	'object',
	'null'
]);
const DEFAULT_KINDS: ReadonlySet<string> = new Set<ModelOptionDefaultKind>([
	'fixed',
	'data-derived',
	'conditional',
	'random-if-omitted',
	'unspecified'
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isScalar(value: unknown): value is Scalar {
	return (
		value === null ||
		typeof value === 'string' ||
		typeof value === 'number' ||
		typeof value === 'boolean'
	);
}

function assertPlainObject(value: unknown, where: string): Record<string, unknown> {
	if (!isPlainObject(value)) {
		throw new ModelDocumentError(`${where} must be an object`);
	}
	for (const key of FORBIDDEN_KEYS) {
		if (Object.hasOwn(value, key)) {
			throw new ModelDocumentError(`${where} contains the forbidden key "${key}"`);
		}
	}
	return value;
}

function inferType(value: Scalar): ModelOptionType {
	if (value === null) return 'null';
	return typeof value as 'string' | 'number' | 'boolean';
}

interface FlattenedSchema {
	types: ModelOptionType[];
	enumValues: Scalar[];
}

function flattenSchema(schema: unknown, where: string, into: FlattenedSchema): void {
	const object = assertPlainObject(schema, where);
	let recognised = false;

	const addType = (type: ModelOptionType): void => {
		if (!into.types.includes(type)) into.types.push(type);
	};
	const addEnum = (value: Scalar): void => {
		addType(inferType(value));
		if (!into.enumValues.includes(value)) into.enumValues.push(value);
	};

	if (Object.hasOwn(object, 'type')) {
		recognised = true;
		const declared = Array.isArray(object.type) ? object.type : [object.type];
		for (const type of declared) {
			if (typeof type !== 'string' || !OPTION_TYPES.has(type)) {
				throw new ModelDocumentError(`${where} has an unknown type`);
			}
			addType(type as ModelOptionType);
		}
	}
	if (Object.hasOwn(object, 'enum')) {
		recognised = true;
		if (!Array.isArray(object.enum) || !object.enum.every(isScalar)) {
			throw new ModelDocumentError(`${where} has an invalid enum`);
		}
		for (const value of object.enum) addEnum(value);
	}
	if (Object.hasOwn(object, 'const')) {
		recognised = true;
		if (!isScalar(object.const)) {
			throw new ModelDocumentError(`${where} has an invalid const`);
		}
		addEnum(object.const);
	}
	if (Object.hasOwn(object, 'oneOf')) {
		recognised = true;
		if (!Array.isArray(object.oneOf) || object.oneOf.length === 0) {
			throw new ModelDocumentError(`${where} has an invalid oneOf`);
		}
		object.oneOf.forEach((branch, index) =>
			flattenSchema(branch, `${where}.oneOf[${index}]`, into)
		);
	}
	if (!recognised) {
		throw new ModelDocumentError(`${where} has neither type, enum, const nor oneOf`);
	}
}

function narrowDefaultBy(value: unknown, where: string): ModelOptionDefaultRule[] {
	if (!Array.isArray(value) || value.length === 0) {
		throw new ModelDocumentError(`${where}.defaultBy must be a non-empty array`);
	}
	return value.map((rule, index) => {
		const ruleWhere = `${where}.defaultBy[${index}]`;
		const object = assertPlainObject(rule, ruleWhere);
		if (!Object.hasOwn(object, 'value')) {
			throw new ModelDocumentError(`${ruleWhere} needs a value`);
		}
		const when = assertPlainObject(object.when, `${ruleWhere}.when`);
		const entries = Object.entries(when);
		if (entries.length === 0 || !entries.every(([, expected]) => isScalar(expected))) {
			throw new ModelDocumentError(`${ruleWhere}.when must hold scalar values`);
		}
		return { when: when as Record<string, Scalar>, value: object.value };
	});
}

function narrowOption(raw: unknown, where: string): ModelOptionDocument {
	const object = assertPlainObject(raw, where);
	if (typeof object.name !== 'string' || object.name === '') {
		throw new ModelDocumentError(`${where}.name must be a non-empty string`);
	}
	const flattened: FlattenedSchema = { types: [], enumValues: [] };
	flattenSchema(object.valueSchema, `${where}.valueSchema`, flattened);

	const defaultKind = object.defaultKind;
	if (typeof defaultKind !== 'string' || !DEFAULT_KINDS.has(defaultKind)) {
		throw new ModelDocumentError(`${where}.defaultKind is invalid`);
	}

	let fixedDefault: unknown = undefined;
	let defaultBy: ModelOptionDefaultRule[] | null = null;
	if (defaultKind === 'fixed') {
		if (!Object.hasOwn(object, 'default')) {
			throw new ModelDocumentError(`${where} is fixed but has no default`);
		}
		fixedDefault = object.default;
	} else if (defaultKind === 'conditional') {
		defaultBy = narrowDefaultBy(object.defaultBy, where);
	}

	let aliasOf: string | null = null;
	let aliasPrecedence: 'primary-wins' | 'alias-wins' | null = null;
	if (typeof object.aliasOf === 'string' && object.aliasOf !== '') {
		aliasOf = object.aliasOf;
		if (object.aliasPrecedence !== 'primary-wins' && object.aliasPrecedence !== 'alias-wins') {
			throw new ModelDocumentError(`${where}.aliasPrecedence is missing or invalid`);
		}
		aliasPrecedence = object.aliasPrecedence;
	}

	return {
		name: object.name,
		types: flattened.types,
		enumValues: flattened.enumValues.length > 0 ? flattened.enumValues : null,
		defaultKind: defaultKind as ModelOptionDefaultKind,
		default: fixedDefault,
		defaultBy,
		aliasOf,
		aliasPrecedence
	};
}

/**
 * Narrows a raw `web-ml` model specification document against `schema.json` v1.
 * Unmodelled metadata (descriptions, notes, examples, `appliesWhen`) is ignored.
 *
 * @param id - Classifier the document describes.
 * @param raw - Parsed JSON document.
 * @returns The typed document.
 * @throws ModelDocumentError when the document does not match the schema or holds a prototype key.
 */
export function narrowModelDocument(id: ClassifierId, raw: unknown): ModelDocument {
	const root = assertPlainObject(raw, `${id} document`);
	if (root.schemaVersion !== 1) {
		throw new ModelDocumentError(`${id} has unsupported schemaVersion`);
	}
	if (typeof root.name !== 'string') {
		throw new ModelDocumentError(`${id}.name must be a string`);
	}
	if (!Array.isArray(root.hyperparameters)) {
		throw new ModelDocumentError(`${id}.hyperparameters must be an array`);
	}
	return {
		id,
		name: root.name,
		options: root.hyperparameters.map((option, index) =>
			narrowOption(option, `${id}.hyperparameters[${index}]`)
		)
	};
}

const cache = new Map<ClassifierId, ModelDocument>();

/**
 * Returns the typed, memoised specification document for a classifier.
 *
 * @param id - Classifier identifier.
 * @returns The narrowed document.
 * @throws ModelDocumentError when the bundled document is invalid.
 */
export function getModelDocument(id: ClassifierId): ModelDocument {
	let document = cache.get(id);
	if (!document) {
		document = narrowModelDocument(id, MODEL_DOCUMENTS[id]);
		cache.set(id, document);
	}
	return document;
}
