/**
 * Checkout identity reported by the local dev and mockup servers at
 * `/__checkout`, and the comparison used to detect a server that belongs to
 * another checkout. Runtime-neutral: no imports.
 */

/** Path both local servers answer with their identity. */
export const CHECKOUT_IDENTITY_PATH = '/__checkout';

/** Services that report an identity. */
export type CheckoutService = 'samata-ml-app' | 'samata-ml-mockups';

/** Identity payload of one running server. */
export interface CheckoutIdentity {
	/** Which server answered. */
	readonly service: CheckoutService;
	/** Real path of the checkout root. */
	readonly root: string;
	/** Absolute directory the server reads files from. */
	readonly servingDir: string;
	/** Server mode; null for mockups. */
	readonly mode: 'dev' | 'dist' | null;
	/** Dev app: whether the training runtime probe flag was set at start; otherwise null. */
	readonly trainingRuntimeProbe: boolean | null;
}

/** What a caller expects a server at `url` to report. */
export interface CheckoutExpectation {
	/** Server label used in messages. */
	readonly label: 'app' | 'dist' | 'mockups';
	/** Server base URL. */
	readonly url: string;
	/** Expected service. */
	readonly service: CheckoutService;
	/** Expected checkout root. */
	readonly root: string;
	/** Expected mode, when it matters. */
	readonly mode?: 'dev' | 'dist';
	/** Require the training runtime probe flag. */
	readonly trainingRuntimeProbe?: true;
}

/**
 * Builds the identity response.
 *
 * @param identity - Identity payload.
 * @param method - HTTP method; `HEAD` sends no body.
 * @returns A 200 JSON response with `Cache-Control: no-store`.
 */
export function createCheckoutIdentityResponse(
	identity: CheckoutIdentity,
	method: string
): Response {
	return new Response(method.toUpperCase() === 'HEAD' ? null : JSON.stringify(identity), {
		status: 200,
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Cache-Control': 'no-store'
		}
	});
}

/**
 * Compares a server reply with an expectation.
 *
 * @param expected - Expected identity.
 * @param reply - Parsed reply body (anything).
 * @returns One sentence per problem; empty when the reply matches.
 */
export function compareCheckoutIdentity(expected: CheckoutExpectation, reply: unknown): string[] {
	if (
		typeof reply !== 'object' ||
		reply === null ||
		typeof (reply as { service?: unknown }).service !== 'string' ||
		typeof (reply as { root?: unknown }).root !== 'string'
	) {
		return ['does not report a samata-ml checkout (older samata-ml server or another program)'];
	}
	const actual = reply as {
		service: string;
		root: string;
		mode?: unknown;
		trainingRuntimeProbe?: unknown;
	};
	const problems: string[] = [];
	if (actual.service !== expected.service) {
		problems.push(`reports service ${actual.service}, expected ${expected.service}`);
	}
	if (actual.root !== expected.root) {
		problems.push(`belongs to checkout ${actual.root}, expected ${expected.root}`);
	}
	if (expected.mode && actual.mode !== expected.mode) {
		problems.push(`runs in mode ${String(actual.mode)}, expected ${expected.mode}`);
	}
	if (expected.trainingRuntimeProbe && actual.trainingRuntimeProbe !== true) {
		problems.push('was started without SAMATA_TRAINING_RUNTIME_PROBE=1');
	}
	return problems;
}

/**
 * Formats failed server checks as one message.
 *
 * @param failures - Failed expectations with their problems.
 * @returns A multi-line message with remedies.
 */
export function formatCheckoutFailure(
	failures: readonly { expected: CheckoutExpectation; problems: readonly string[] }[]
): string {
	const lines = ['Test servers do not belong to this checkout or are misconfigured:', ''];
	for (const { expected, problems } of failures) {
		lines.push(`- ${expected.label} server at ${expected.url}:`);
		for (const problem of problems) lines.push(`    ${problem}`);
	}
	lines.push(
		'',
		'Results from another checkout’s server are not evidence about this checkout.',
		'Remedies:',
		'- Stop the server only if this session started it. Never stop or signal a process this session did not start.',
		'- Otherwise set SAMATA_PORT_BASE to an unused port base (1024 to 65533) so this checkout uses its own ports.',
		'- For the app server, restart it with SAMATA_TRAINING_RUNTIME_PROBE=1 if the probe flag is missing.'
	);
	return lines.join('\n');
}
