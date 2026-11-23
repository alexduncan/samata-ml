import { atom, type ReadableAtom } from 'nanostores';
import type { ParsedRoute } from '../../types/routes';
import type { WorkerFailureCode } from '../release/worker-failures';

/** Umami Cloud website identifier configured for `beta.samata.ml`. */
export const UMAMI_WEBSITE_ID = 'e13bc119-a1c5-448e-b1ab-0203b71df348';

/** Public hostname where beta telemetry is permitted to run. */
export const BETA_HOSTNAME = 'beta.samata.ml';

/** Hosted Umami Cloud script URL loaded on accepted beta sessions. */
export const UMAMI_SCRIPT_URL = 'https://cloud.umami.is/script.js';

/** Canonical workflow page paths permitted in Umami telemetry payloads. */
export type BetaPagePath = '/' | '/data' | '/target' | '/models' | '/results';

/** Fixed workflow and onboarding event names permitted in beta telemetry. */
export type BetaEventName =
	| 'beta_get_started'
	| 'sample_dataset_selected'
	| 'custom_dataset_uploaded'
	| 'training_started'
	| 'training_completed'
	| 'training_failed';

/** Fixed exception categories mapped to `beta_error_<snake_case>` event names. */
export type BetaExceptionCode = 'window-error' | 'unhandled-rejection' | WorkerFailureCode;

const BETA_PAGE_PATHS = new Set<string>(['/', '/data', '/target', '/models', '/results']);
const ALLOWED_EVENT_NAMES = new Set<string>([
	'beta_get_started',
	'sample_dataset_selected',
	'custom_dataset_uploaded',
	'training_started',
	'training_completed',
	'training_failed',
	'beta_error_window_error',
	'beta_error_unhandled_rejection',
	'beta_error_storage_worker_error',
	'beta_error_storage_worker_protocol_error',
	'beta_error_training_worker_startup_failed',
	'beta_error_training_worker_crashed',
	'beta_error_training_worker_protocol_error',
	'beta_error_analysis_worker_failed'
]);

const SCREEN_PATTERN = /^\d{1,5}x\d{1,5}$/;
const LANGUAGE_PATTERN = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{1,8}){0,3}$/;

interface UmamiTracker {
	track: (
		arg:
			| string
			| Record<string, unknown>
			| ((props: Record<string, unknown>) => Record<string, unknown>)
	) => unknown;
}

/**
 * Returns true when running inside a beta-telemetry production build on `beta.samata.ml`.
 *
 * @returns Whether the runtime deployment permits beta telemetry.
 */
export function isBetaTelemetryDeployment(): boolean {
	return (
		BETA_TELEMETRY_ENABLED &&
		typeof location !== 'undefined' &&
		location.hostname === BETA_HOSTNAME
	);
}

const $betaDeploymentWritable = atom<boolean>(isBetaTelemetryDeployment());

/**
 * Reactive UI flag indicating whether the beta telemetry disclosure should be presented.
 *
 * Defaults to {@link isBetaTelemetryDeployment}; tests and Storybook stories may override via
 * {@link setBetaDeploymentForTests} without enabling live tracker loading.
 */
export const $betaDeployment: ReadableAtom<boolean> = $betaDeploymentWritable;

/**
 * Overrides {@link $betaDeployment} for unit tests and Storybook stories only.
 *
 * @param value - Whether the welcome modal should render in beta disclosure mode.
 */
export function setBetaDeploymentForTests(value: boolean): void {
	$betaDeploymentWritable.set(value);
}

let acceptanceChecker: (() => boolean) | null = null;
let scriptAppended = false;
let scriptReady = false;
let scriptFailed = false;
let currentPath: BetaPagePath = '/';
let lastSentPageviewPath: BetaPagePath | null = null;
let pendingInitialPageview: BetaPagePath | null = null;
let pendingGetStarted = false;
const reportedExceptions = new Set<BetaExceptionCode>();
const failedRunIds = new Set<string>();

function isAccepted(): boolean {
	try {
		return Boolean(acceptanceChecker?.());
	} catch {
		return false;
	}
}

function canTrack(): boolean {
	return isBetaTelemetryDeployment() && isAccepted() && !scriptFailed;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		return false;
	}
	const proto = Object.getPrototypeOf(value) as object | null;
	return proto === Object.prototype || proto === null;
}

/**
 * Umami `data-before-send` allowlist hook rebuilding every event payload from permitted fields only.
 *
 * Rejects non-event types, nested `payload` envelopes, wrong `website` or `hostname`, non-canonical
 * URLs, and unknown event names; drops `referrer`, `title`, `tag`, `id`, `salt`, `data`, and all
 * other unrecognised keys.
 *
 * @param type - Tracker payload envelope type (must be `'event'`).
 * @param payload - Candidate payload object supplied by the Umami tracker.
 * @returns Sanitised payload object or `false` to cancel transmission.
 */
export function samataUmamiBeforeSend(
	type: unknown,
	payload: unknown
): Record<string, unknown> | false {
	if (!isBetaTelemetryDeployment() || !isAccepted() || type !== 'event') {
		return false;
	}
	if (!isPlainObject(payload) || Object.hasOwn(payload, 'payload')) {
		return false;
	}

	const website = payload.website;
	const hostname = payload.hostname;
	const url = payload.url;
	if (
		website !== UMAMI_WEBSITE_ID ||
		hostname !== BETA_HOSTNAME ||
		typeof url !== 'string' ||
		!BETA_PAGE_PATHS.has(url)
	) {
		return false;
	}

	const result: Record<string, unknown> = {
		website,
		hostname,
		url
	};

	if (payload.name !== undefined) {
		if (typeof payload.name !== 'string' || !ALLOWED_EVENT_NAMES.has(payload.name)) {
			return false;
		}
		result.name = payload.name;
	}

	if (typeof payload.screen === 'string' && SCREEN_PATTERN.test(payload.screen)) {
		result.screen = payload.screen;
	}

	if (typeof payload.language === 'string' && LANGUAGE_PATTERN.test(payload.language)) {
		result.language = payload.language;
	}

	return result;
}

function safeUmamiTrack(
	buildPayload: (props: Record<string, unknown>) => Record<string, unknown>
): void {
	try {
		const win = window as unknown as { umami?: UmamiTracker };
		if (typeof win.umami?.track !== 'function') {
			return;
		}
		void Promise.resolve(win.umami.track(buildPayload)).catch(() => {
			// Swallow rejected tracker promises.
		});
	} catch {
		// Telemetry must never throw into app code.
	}
}

function flushQueued(): void {
	if (!scriptReady || !canTrack()) {
		return;
	}
	if (pendingInitialPageview !== null) {
		const path = pendingInitialPageview;
		pendingInitialPageview = null;
		if (lastSentPageviewPath !== path) {
			lastSentPageviewPath = path;
			safeUmamiTrack((props) => ({ ...props, url: path }));
		}
	}
	if (pendingGetStarted) {
		pendingGetStarted = false;
		safeUmamiTrack((props) => ({ ...props, url: currentPath, name: 'beta_get_started' }));
	}
}

/**
 * Maps a parsed application route to its canonical {@link BetaPagePath}, collapsing model-detail
 * routes to `/models` and returning `null` for reserved or unknown routes.
 *
 * @param route - Parsed application route.
 * @returns Canonical path or `null` when silent.
 */
export function toBetaPagePath(route: ParsedRoute): BetaPagePath | null {
	if (route.kind === 'root') {
		return '/';
	}
	if (route.kind === 'workflow') {
		if (
			route.path === '/data' ||
			route.path === '/target' ||
			route.path === '/models' ||
			route.path === '/results'
		) {
			return route.path;
		}
		if (route.modelNum !== undefined || route.path.startsWith('/models/')) {
			return '/models';
		}
	}
	return null;
}

/**
 * Initialises the beta Umami Cloud script when running on the beta origin and accepted by the user.
 *
 * Idempotent: appends at most one `<script defer>` element per document and clears any queued items
 * permanently if script loading fails.
 *
 * @param checkAccepted - Predicate returning whether the user has accepted beta telemetry.
 */
export function initBetaTelemetry(checkAccepted: () => boolean): void {
	acceptanceChecker = checkAccepted;
	if (
		!BETA_TELEMETRY_ENABLED ||
		!isBetaTelemetryDeployment() ||
		!isAccepted() ||
		scriptAppended ||
		scriptFailed
	) {
		return;
	}
	if (typeof document === 'undefined' || typeof window === 'undefined') {
		return;
	}

	scriptAppended = true;
	const win = window as unknown as Record<string, unknown>;
	win.samataUmamiBeforeSend = samataUmamiBeforeSend;

	try {
		const script = document.createElement('script');
		script.defer = true;
		script.src = UMAMI_SCRIPT_URL;
		script.crossOrigin = 'anonymous';
		script.referrerPolicy = 'no-referrer';
		script.setAttribute('data-website-id', UMAMI_WEBSITE_ID);
		script.setAttribute('data-domains', BETA_HOSTNAME);
		script.setAttribute('data-auto-pageview', 'false');
		script.setAttribute('data-exclude-search', 'true');
		script.setAttribute('data-exclude-hash', 'true');
		script.setAttribute('data-fetch-credentials', 'omit');
		script.setAttribute('data-before-send', 'samataUmamiBeforeSend');

		const markFailed = () => {
			scriptFailed = true;
			scriptReady = false;
			pendingInitialPageview = null;
			pendingGetStarted = false;
		};

		script.addEventListener('error', markFailed);
		script.addEventListener('load', () => {
			if (scriptFailed) return;
			const umamiGlobal = (window as unknown as { umami?: UmamiTracker }).umami;
			if (typeof umamiGlobal?.track !== 'function') {
				markFailed();
				return;
			}
			scriptReady = true;
			flushQueued();
		});

		const parent = document.head ?? document.body ?? document.documentElement;
		parent?.appendChild(script);
	} catch {
		scriptFailed = true;
		pendingInitialPageview = null;
		pendingGetStarted = false;
	}
}

/**
 * Updates the canonical page path from a parsed route and records a pageview when applicable.
 *
 * Reserved and unknown routes leave the current path unchanged and send nothing.
 *
 * @param route - Current parsed route.
 */
export function syncBetaRoute(route: ParsedRoute): void {
	const canonical = toBetaPagePath(route);
	if (canonical === null) {
		return;
	}
	trackBetaPageview(canonical);
}

/**
 * Records one pageview for a canonical {@link BetaPagePath}, suppressing repeated identical paths.
 *
 * @param path - Canonical workflow path.
 */
export function trackBetaPageview(path: BetaPagePath): void {
	currentPath = path;
	if (!canTrack()) {
		return;
	}
	if (lastSentPageviewPath === path) {
		return;
	}
	if (!scriptReady) {
		if (lastSentPageviewPath === null) {
			pendingInitialPageview = path;
		}
		return;
	}
	lastSentPageviewPath = path;
	safeUmamiTrack((props) => ({ ...props, url: path }));
}

/**
 * Records a fixed-name workflow or onboarding event against the current canonical path.
 *
 * Only `beta_get_started` is queued before script readiness; other events before readiness are dropped.
 * `training_failed` is deduplicated per `runId` when supplied.
 *
 * @param name - Allowlisted event name.
 * @param runId - Optional training run identifier used to deduplicate `training_failed`.
 */
export function trackBetaEvent(name: BetaEventName, runId?: string): void {
	if (!canTrack() || !ALLOWED_EVENT_NAMES.has(name)) {
		return;
	}
	if (name === 'training_failed' && runId !== undefined) {
		if (failedRunIds.has(runId)) {
			return;
		}
		failedRunIds.add(runId);
	}
	if (!scriptReady) {
		if (name === 'beta_get_started') {
			pendingGetStarted = true;
		}
		return;
	}
	safeUmamiTrack((props) => ({ ...props, url: currentPath, name }));
}

/**
 * Records a fixed `beta_error_<code_snake_case>` event at most once per error code per document.
 *
 * @param code - Fixed exception or worker failure category.
 */
export function reportBetaException(code: BetaExceptionCode): void {
	if (!canTrack() || !scriptReady) {
		return;
	}
	if (reportedExceptions.has(code)) {
		return;
	}
	const eventName = `beta_error_${code.replace(/-/g, '_')}`;
	if (!ALLOWED_EVENT_NAMES.has(eventName)) {
		return;
	}
	reportedExceptions.add(code);
	safeUmamiTrack((props) => ({ ...props, url: currentPath, name: eventName }));
}

/**
 * Resets all telemetry module state and test overrides (unit tests only).
 */
export function resetBetaTelemetryForTests(): void {
	acceptanceChecker = null;
	scriptAppended = false;
	scriptReady = false;
	scriptFailed = false;
	currentPath = '/';
	lastSentPageviewPath = null;
	pendingInitialPageview = null;
	pendingGetStarted = false;
	reportedExceptions.clear();
	failedRunIds.clear();
	if (typeof window !== 'undefined') {
		delete (window as unknown as Record<string, unknown>).samataUmamiBeforeSend;
	}
	$betaDeploymentWritable.set(isBetaTelemetryDeployment());
}
