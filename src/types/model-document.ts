import type { ClassifierId } from '../features/models/model-catalogue';

/** Value types a `web-ml` model option can accept, as named by its `valueSchema`. */
export type ModelOptionType =
	| 'number'
	| 'integer'
	| 'string'
	| 'boolean'
	| 'array'
	| 'object'
	| 'null';

/** How a `web-ml` model option obtains its value when the caller omits it. */
export type ModelOptionDefaultKind =
	| 'fixed'
	| 'data-derived'
	| 'conditional'
	| 'random-if-omitted'
	| 'unspecified';

/** One conditional default: `value` applies when every `when` entry equals the effective option. */
export interface ModelOptionDefaultRule {
	/** Option names mapped to the scalar values they must have. */
	readonly when: Readonly<Record<string, string | number | boolean | null>>;
	/** Default used when every `when` entry matches. */
	readonly value: unknown;
}

/** One hyperparameter of a `web-ml` model specification, narrowed from its JSON document. */
export interface ModelOptionDocument {
	/** Option key as passed to `web-ml`. */
	readonly name: string;
	/** Accepted value types, deduplicated in encounter order. */
	readonly types: readonly ModelOptionType[];
	/** Allowed `enum` / `const` values across all schema branches, or `null` when none. */
	readonly enumValues: readonly (string | number | boolean | null)[] | null;
	/** How the default is determined. */
	readonly defaultKind: ModelOptionDefaultKind;
	/** The fixed default; `undefined` unless `defaultKind` is `'fixed'`. */
	readonly default: unknown;
	/** Ordered conditional defaults; non-empty when `defaultKind` is `'conditional'`, otherwise `null`. */
	readonly defaultBy: readonly ModelOptionDefaultRule[] | null;
	/** Name of the option this one is an alias of, or `null`. */
	readonly aliasOf: string | null;
	/** Which of the alias and its target wins when both are present, or `null` without an alias. */
	readonly aliasPrecedence: 'primary-wins' | 'alias-wins' | null;
}

/** A `web-ml` model specification narrowed to the fields samata-ml reads. */
export interface ModelDocument {
	/** Model identifier. */
	readonly id: ClassifierId;
	/** Human-readable model name. */
	readonly name: string;
	/** Hyperparameters in document order. */
	readonly options: readonly ModelOptionDocument[];
}
