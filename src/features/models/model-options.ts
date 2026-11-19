import type { HyperparameterValue } from '../../types/state';
import type { ModelDocument, ModelOptionDocument } from '../../types/model-document';
import {
	getOptionPolicy,
	type EffectiveOptions,
	type NumberDomain,
	type OptionPolicy
} from './model-presentation-policy';

/** Dataset facts that bound option values. */
export interface ModelOptionContext {
	/** Number of dataset rows (an upper bound on the training sample count). */
	readonly rowCount: number;
	/** Number of target classes. */
	readonly classCount: number;
}

/** One reason the current options cannot be sent to `web-ml`. */
export interface OptionIssue {
	/** Option the issue belongs to. */
	readonly name: string;
	/** Message key resolved by the form's labels. */
	readonly messageKey: string;
}

/** Result of normalising persisted options for one model. */
export interface NormalisedModelOptions {
	/** Canonical sparse overrides, including options that are currently inactive. */
	readonly overrides: Readonly<Record<string, HyperparameterValue>>;
	/** Defaults (including `defaultBy`) overlaid with overrides. */
	readonly effective: Readonly<Record<string, HyperparameterValue | undefined>>;
	/** Active, valid overrides only, keyed and typed for `web-ml`'s `options`. */
	readonly requestOptions: Readonly<Record<string, HyperparameterValue>>;
	/** Validation issues on active options. */
	readonly issues: readonly OptionIssue[];
}

function isNumberArray(value: unknown): value is number[] {
	return Array.isArray(value) && value.every((item) => typeof item === 'number');
}

/** Strict equality for scalars and element-wise equality for number arrays. */
function optionValueEqual(a: HyperparameterValue | undefined, b: unknown): boolean {
	if (Array.isArray(a)) {
		return isNumberArray(b) && a.length === b.length && a.every((item, i) => item === b[i]);
	}
	return a === b;
}

function cloneValue(value: HyperparameterValue): HyperparameterValue {
	return Array.isArray(value) ? [...value] : value;
}

function defaultFor(
	option: ModelOptionDocument,
	effective: Record<string, HyperparameterValue | undefined>
): HyperparameterValue | undefined {
	if (option.defaultKind === 'fixed') {
		return option.default as HyperparameterValue | undefined;
	}
	if (option.defaultKind === 'conditional' && option.defaultBy) {
		for (const rule of option.defaultBy) {
			const matches = Object.entries(rule.when).every(
				([dependency, expected]) => effective[dependency] === expected
			);
			if (matches) return rule.value as HyperparameterValue;
		}
	}
	return undefined;
}

/**
 * Checks a number against a domain.
 *
 * @param value - Candidate value.
 * @param domain - Valid domain.
 * @param context - Dataset facts for `'rowCount'` bounds.
 * @returns `true` when the value is a finite number inside the domain.
 */
export function numberInDomain(
	value: unknown,
	domain: NumberDomain,
	context: ModelOptionContext
): boolean {
	if (typeof value !== 'number' || !Number.isFinite(value)) return false;
	if (domain.integer && !Number.isInteger(value)) return false;
	if (
		domain.min !== undefined &&
		(domain.minExclusive ? value <= domain.min : value < domain.min)
	) {
		return false;
	}
	if (domain.max !== undefined) {
		const max = domain.max === 'rowCount' ? context.rowCount : domain.max;
		if (value > max) return false;
	}
	return true;
}

/**
 * Validates one effective value for its option.
 *
 * @param policy - Presentation policy of the option.
 * @param option - Document entry of the option.
 * @param value - Effective value.
 * @param context - Dataset facts.
 * @returns A message key when invalid, otherwise `null`.
 */
export function validateOptionValue(
	policy: OptionPolicy,
	option: ModelOptionDocument,
	value: HyperparameterValue,
	context: ModelOptionContext
): string | null {
	switch (policy.kind) {
		case 'select':
			return option.enumValues?.includes(value as string) ? null : 'invalid-choice';
		case 'checkbox':
			return typeof value === 'boolean' ? null : 'invalid-choice';
		case 'range':
		case 'number-reset':
			return numberInDomain(value, policy.domain, context) ? null : policy.domain.messageKey;
		case 'nullable-mode':
			return value === null || numberInDomain(value, policy.domain, context)
				? null
				: policy.domain.messageKey;
		case 'gamma-mode':
			return value === 'scale' ||
				value === 'auto' ||
				numberInDomain(value, policy.domain, context)
				? null
				: policy.domain.messageKey;
		case 'layers':
			return isNumberArray(value) &&
				value.length > 0 &&
				value.every((size) => Number.isInteger(size) && size >= 1)
				? null
				: 'layer-sizes';
		case 'class-weight':
			return value === null || value === 'balanced' ? null : 'invalid-choice';
		default:
			return null;
	}
}

/**
 * Canonicalises persisted options and derives what `web-ml` should receive.
 *
 * @param document - Typed `web-ml` model document.
 * @param values - Persisted `HyperparameterConfig.values`.
 * @param context - Dataset facts that bound option values.
 * @returns Sparse overrides, effective values, active request options and validation issues.
 */
export function normaliseModelOptions(
	document: ModelDocument,
	values: Readonly<Record<string, HyperparameterValue>>,
	context: ModelOptionContext
): NormalisedModelOptions {
	const policies = new Map<string, OptionPolicy>();
	for (const option of document.options) {
		const policy = getOptionPolicy(document.id, option.name);
		if (policy) policies.set(option.name, policy);
	}

	// 1. Canonicalise and filter
	const overrides: Record<string, HyperparameterValue> = {};
	for (const key of Object.keys(values)) {
		const policy = policies.get(key);
		if (!policy || policy.kind === 'hidden' || policy.kind === 'fixed') continue;
		const value = values[key];
		if (value === undefined) continue;
		overrides[key] = cloneValue(value);
	}
	for (const option of document.options) {
		const policy = policies.get(option.name);
		if (policy?.kind !== 'alias' || !Object.hasOwn(overrides, option.name)) continue;
		const aliasValue = overrides[option.name]!;
		delete overrides[option.name];
		if (option.aliasPrecedence === 'alias-wins' || !Object.hasOwn(overrides, policy.target)) {
			overrides[policy.target] = aliasValue;
		}
	}
	for (const [name, policy] of policies) {
		const value = overrides[name];
		if (policy.kind === 'layers' && typeof value === 'number') overrides[name] = [value];
	}

	// 2 and 3. Effective values: unconditional defaults first, then conditional ones
	const effective: Record<string, HyperparameterValue | undefined> = {};
	const defaults = new Map<string, HyperparameterValue | undefined>();
	const resolve = (option: ModelOptionDocument): void => {
		const effectiveDefault = defaultFor(option, effective);
		defaults.set(option.name, effectiveDefault);
		effective[option.name] = Object.hasOwn(overrides, option.name)
			? overrides[option.name]
			: effectiveDefault;
	};
	const canonical = document.options.filter((o) => policies.get(o.name)?.kind !== 'alias');
	canonical.filter((o) => o.defaultKind !== 'conditional').forEach(resolve);
	canonical.filter((o) => o.defaultKind === 'conditional').forEach(resolve);

	// 4. Prune overrides equal to the effective default
	for (const option of canonical) {
		const effectiveDefault = defaults.get(option.name);
		if (
			Object.hasOwn(overrides, option.name) &&
			effectiveDefault !== undefined &&
			optionValueEqual(overrides[option.name], effectiveDefault)
		) {
			delete overrides[option.name];
		}
	}

	// 5. Active filtering, validation and cross-option checks
	const requestOptions: Record<string, HyperparameterValue> = {};
	const issues: OptionIssue[] = [];
	const view: EffectiveOptions = effective;
	for (const option of canonical) {
		const policy = policies.get(option.name);
		if (!policy || policy.kind === 'hidden' || policy.kind === 'fixed') continue;
		if (policy.activeWhen && !policy.activeWhen(view)) continue;
		const value = effective[option.name];
		if (value !== undefined) {
			const messageKey = validateOptionValue(policy, option, value, context);
			if (messageKey !== null) {
				issues.push({ name: option.name, messageKey });
				continue;
			}
		}
		if (Object.hasOwn(overrides, option.name)) {
			requestOptions[option.name] = overrides[option.name]!;
		}
	}
	if (
		document.id === 'logistic-regression' &&
		effective.solver === 'lbfgs' &&
		(effective.penalty === 'l1' || effective.penalty === 'elasticnet')
	) {
		issues.push({ name: 'solver', messageKey: 'solver-penalty' });
	}

	return { overrides, effective, requestOptions, issues };
}
