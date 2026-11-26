import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { GlobalWindow } from 'happy-dom';
import {
	$betaDeployment,
	BETA_HOSTNAME,
	UMAMI_SCRIPT_URL,
	UMAMI_WEBSITE_ID,
	initBetaTelemetry,
	isBetaTelemetryDeployment,
	reportBetaException,
	resetBetaTelemetryForTests,
	samataUmamiBeforeSend,
	setBetaDeploymentForTests,
	syncBetaRoute,
	trackBetaEvent,
	trackBetaPageview
} from '../src/common/telemetry/telemetry-client';
import type { StorageClient } from '../src/features/data/ingestion/storage-client';
import { IngestionError } from '../src/features/data/ingestion/errors';
import {
	$datasetLoad,
	cancelDatasetLoad,
	setStorageClientForTesting,
	startDatasetLoad
} from '../src/stores/dataset.store';
import { $appState } from '../src/stores/app.store';
import { INITIAL_APP_STATE } from '../src/types/state';
import type { DatasetMetadata } from '../src/types/dataset';
import { openSamataDb } from '../src/common/storage/db';
import {
	createTrainingService,
	setTrainingServiceForTesting
} from '../src/features/models/training/training-service';
import { MemoryStorage } from '../src/stores/persister';
import { installFakeIndexedDB } from './helpers/fake-indexeddb';
import './fixtures/umami-fake-tracker.js';

declare global {
	var installFakeUmami:
		| ((
				scriptElement: HTMLScriptElement,
				send: (body: Record<string, unknown>, headers: Record<string, string>) => unknown
		  ) => void)
		| undefined;
}

interface RecordedSend {
	body: Record<string, unknown>;
	headers: Record<string, string>;
}

const originalFetch = globalThis.fetch;
const originalSendBeacon = globalThis.navigator?.sendBeacon;
const originalUrl = window.location.href;
const originalTelemetryFlag = (globalThis as Record<string, unknown>).BETA_TELEMETRY_ENABLED;
const originalTitle = document.title;

let recordedSends: RecordedSend[] = [];
let networkRequests: string[] = [];
let installTrackerOnLoad = true;
let docLoadListener: ((event: Event) => void) | undefined;
let restoreIndexedDB: (() => void) | undefined;
let db: Awaited<ReturnType<typeof openSamataDb>> | undefined;

function happyDomWindow(): GlobalWindow {
	return window as unknown as GlobalWindow;
}

function setBetaEnv(enabled: boolean, url: string): void {
	(globalThis as Record<string, unknown>).BETA_TELEMETRY_ENABLED = enabled;
	happyDomWindow().happyDOM.setURL(url);
}

beforeEach(async () => {
	restoreIndexedDB = installFakeIndexedDB();
	db = await openSamataDb();
	setTrainingServiceForTesting(
		createTrainingService({ persistence: { storage: new MemoryStorage() } })
	);
	recordedSends = [];
	networkRequests = [];
	installTrackerOnLoad = true;
	document.title = 'Sensitive Dataset: customers_secret.csv';
	happyDomWindow().happyDOM.settings.handleDisabledFileLoadingAsSuccess = true;

	globalThis.fetch = (async (input: RequestInfo | URL) => {
		const url = String(input);
		networkRequests.push(url);
		return new Response('', { status: 204 });
	}) as typeof fetch;
	if (globalThis.navigator) {
		Object.defineProperty(globalThis.navigator, 'sendBeacon', {
			configurable: true,
			writable: true,
			value: (url: string) => {
				networkRequests.push(url);
				return true;
			}
		});
	}

	docLoadListener = (event: Event) => {
		const target = event.target as HTMLElement | null;
		if (
			installTrackerOnLoad &&
			target?.tagName === 'SCRIPT' &&
			target.getAttribute('src') === UMAMI_SCRIPT_URL
		) {
			globalThis.installFakeUmami?.(target as HTMLScriptElement, (body, headers) => {
				recordedSends.push({ body, headers });
			});
		}
	};
	document.addEventListener('load', docLoadListener, true);
	resetBetaTelemetryForTests();
});

afterEach(() => {
	if (docLoadListener) {
		document.removeEventListener('load', docLoadListener, true);
	}
	document.querySelectorAll('script[src*="umami"]').forEach((el) => el.remove());
	delete (globalThis as Record<string, unknown>).umami;
	delete (window as unknown as Record<string, unknown>).umami;
	resetBetaTelemetryForTests();
	setStorageClientForTesting(null);
	setTrainingServiceForTesting();
	db?.close();
	db = undefined;
	restoreIndexedDB?.();
	restoreIndexedDB = undefined;
	$appState.set(INITIAL_APP_STATE);
	(globalThis as Record<string, unknown>).BETA_TELEMETRY_ENABLED = originalTelemetryFlag;
	happyDomWindow().happyDOM.setURL(originalUrl);
	happyDomWindow().happyDOM.settings.handleDisabledFileLoadingAsSuccess = true;
	document.title = originalTitle;
	globalThis.fetch = originalFetch;
	if (globalThis.navigator) {
		Object.defineProperty(globalThis.navigator, 'sendBeacon', {
			configurable: true,
			writable: true,
			value: originalSendBeacon
		});
	}
});

describe('beta Umami telemetry client and privacy allowlist', () => {
	test('REL-TELEM-2 & REL-TELEM-6: gates short of all three conditions append no script and send nothing', () => {
		const scenarios: Array<[boolean, string, boolean]> = [
			[false, 'https://beta.samata.ml/', true],
			[true, 'http://localhost:3000/', true],
			[true, 'https://abc123-samata-ml.workers.dev/', true],
			[true, 'https://beta.samata.ml/', false]
		];

		for (const [flag, url, accepted] of scenarios) {
			setBetaEnv(flag, url);
			resetBetaTelemetryForTests();
			initBetaTelemetry(() => accepted);
			trackBetaPageview('/data');
			trackBetaEvent('beta_get_started');
			reportBetaException('window-error');
			expect(document.querySelectorAll(`script[src="${UMAMI_SCRIPT_URL}"]`)).toHaveLength(0);
			expect(recordedSends).toHaveLength(0);
		}

		// UI preview override never opens the live telemetry gate.
		setBetaEnv(false, 'http://localhost:3000/');
		resetBetaTelemetryForTests();
		setBetaDeploymentForTests(true);
		expect($betaDeployment.get()).toBe(true);
		expect(isBetaTelemetryDeployment()).toBe(false);
		initBetaTelemetry(() => true);
		expect(document.querySelectorAll(`script[src="${UMAMI_SCRIPT_URL}"]`)).toHaveLength(0);
		expect(networkRequests).toHaveLength(0);
	});

	test('REL-TELEM-2: appends at most one script with exact privacy attributes', () => {
		setBetaEnv(true, 'https://beta.samata.ml/');
		resetBetaTelemetryForTests();

		initBetaTelemetry(() => true);
		initBetaTelemetry(() => true);

		const scripts = document.querySelectorAll<HTMLScriptElement>(
			`script[src="${UMAMI_SCRIPT_URL}"]`
		);
		expect(scripts).toHaveLength(1);
		const script = scripts[0]!;
		expect(script.defer).toBe(true);
		expect(script.getAttribute('crossorigin')).toBe('anonymous');
		expect(script.getAttribute('referrerpolicy')).toBe('no-referrer');
		expect(script.getAttribute('data-website-id')).toBe(UMAMI_WEBSITE_ID);
		expect(script.getAttribute('data-domains')).toBe(BETA_HOSTNAME);
		expect(script.getAttribute('data-auto-pageview')).toBe('false');
		expect(script.getAttribute('data-exclude-search')).toBe('true');
		expect(script.getAttribute('data-exclude-hash')).toBe('true');
		expect(script.getAttribute('data-fetch-credentials')).toBe('omit');
		expect(script.getAttribute('data-before-send')).toBe('samataUmamiBeforeSend');

		for (const forbidden of [
			'data-errors',
			'data-performance',
			'data-tag',
			'data-distinct-id',
			'data-release',
			'data-environment'
		]) {
			expect(script.hasAttribute(forbidden)).toBe(false);
		}
		expect(networkRequests).toHaveLength(0);
	});

	test('REL-TELEM-3: before-send allowlist strips identifying properties and rejects invalid types or fields', () => {
		setBetaEnv(true, 'https://beta.samata.ml/');
		resetBetaTelemetryForTests();
		initBetaTelemetry(() => true);

		const sanitised = samataUmamiBeforeSend('event', {
			website: UMAMI_WEBSITE_ID,
			hostname: BETA_HOSTNAME,
			url: '/models',
			screen: '1440x900',
			language: 'en-GB',
			name: 'training_started',
			referrer: 'https://secret.example/customers.csv?token=abc',
			title: 'secret_dataset.csv',
			tag: 'secret-tag',
			id: 'user-123',
			salt: 'fake-salt',
			data: { fileName: 'customers.csv', columns: ['ssn'], rows: 500 },
			extraKey: 'drop-me'
		});
		expect(sanitised).toEqual({
			website: UMAMI_WEBSITE_ID,
			hostname: BETA_HOSTNAME,
			url: '/models',
			screen: '1440x900',
			language: 'en-GB',
			name: 'training_started'
		});

		// Reject identify, performance, error, unknown types, nested envelopes, wrong website/hostname/path/event.
		expect(
			samataUmamiBeforeSend('identify', {
				website: UMAMI_WEBSITE_ID,
				hostname: BETA_HOSTNAME,
				url: '/'
			})
		).toBe(false);
		expect(
			samataUmamiBeforeSend('performance', {
				website: UMAMI_WEBSITE_ID,
				hostname: BETA_HOSTNAME,
				url: '/'
			})
		).toBe(false);
		expect(
			samataUmamiBeforeSend('error', {
				website: UMAMI_WEBSITE_ID,
				hostname: BETA_HOSTNAME,
				url: '/'
			})
		).toBe(false);
		expect(
			samataUmamiBeforeSend('event', {
				website: UMAMI_WEBSITE_ID,
				hostname: BETA_HOSTNAME,
				url: '/',
				payload: { nested: true }
			})
		).toBe(false);
		expect(
			samataUmamiBeforeSend('event', {
				website: 'other-id',
				hostname: BETA_HOSTNAME,
				url: '/'
			})
		).toBe(false);
		expect(
			samataUmamiBeforeSend('event', {
				website: UMAMI_WEBSITE_ID,
				hostname: 'localhost',
				url: '/'
			})
		).toBe(false);
		expect(
			samataUmamiBeforeSend('event', {
				website: UMAMI_WEBSITE_ID,
				hostname: BETA_HOSTNAME,
				url: '/models/3'
			})
		).toBe(false);
		expect(
			samataUmamiBeforeSend('event', {
				website: UMAMI_WEBSITE_ID,
				hostname: BETA_HOSTNAME,
				url: '/data',
				name: 'unknown_event'
			})
		).toBe(false);

		// Invalid optional screen/language are omitted rather than forwarded.
		expect(
			samataUmamiBeforeSend('event', {
				website: UMAMI_WEBSITE_ID,
				hostname: BETA_HOSTNAME,
				url: '/data',
				screen: '1440x900x2',
				language: 'english_us'
			})
		).toEqual({
			website: UMAMI_WEBSITE_ID,
			hostname: BETA_HOSTNAME,
			url: '/data'
		});
	});

	test('REL-TELEM-4: canonicalises pageviews, collapses /models/<n>, silences reserved routes, and strips document query/hash', () => {
		setBetaEnv(true, 'https://beta.samata.ml/models/3?x=1&file=secret.csv#y');
		resetBetaTelemetryForTests();
		initBetaTelemetry(() => true);

		syncBetaRoute({ kind: 'root' });
		syncBetaRoute({ kind: 'root' });
		syncBetaRoute({ kind: 'workflow', path: '/data', section: 1 });
		syncBetaRoute({ kind: 'reserved', path: '/privacy', underlayPath: '/data' });
		syncBetaRoute({ kind: 'workflow', path: '/data', section: 1 });
		syncBetaRoute({ kind: 'workflow', path: '/models/3', section: 3, modelNum: 3 });
		syncBetaRoute({ kind: 'workflow', path: '/models/4', section: 3, modelNum: 4 });
		syncBetaRoute({ kind: 'reserved', path: '/about', underlayPath: '/models/4' });

		trackBetaEvent('training_started');

		const payloads = recordedSends.map(
			(entry) => entry.body.payload as Record<string, unknown>
		);
		expect(payloads.map((p) => ({ url: p.url, name: p.name }))).toEqual([
			{ url: '/', name: undefined },
			{ url: '/data', name: undefined },
			{ url: '/models', name: undefined },
			{ url: '/models', name: 'training_started' }
		]);

		const serialised = JSON.stringify(recordedSends);
		expect(serialised).not.toContain('/models/3');
		expect(serialised).not.toContain('secret.csv');
		expect(serialised).not.toContain('x=1');
		expect(serialised).not.toContain('#y');
		expect(serialised).not.toContain('Sensitive Dataset');
		expect(networkRequests).toHaveLength(0);
	});

	test('REL-TELEM-4: dataset load emits sample or custom event only inside active-controller success', async () => {
		setBetaEnv(true, 'https://beta.samata.ml/data');
		resetBetaTelemetryForTests();
		initBetaTelemetry(() => true);
		syncBetaRoute({ kind: 'workflow', path: '/data', section: 1 });

		const fakeMeta: DatasetMetadata = {
			id: 'ds-1',
			name: 'customers_private.csv',
			source: 'upload',
			sampleId: null,
			rowCount: 10,
			byteLength: 100,
			createdAt: 1,
			delimiter: ',',
			paddedRowCount: 0,
			skippedRows: { count: 0, rowNumbers: [] },
			columns: [
				{
					name: 'secret_feature',
					type: 'numeric',
					missingCount: 0,
					missingTokens: {},
					invalidCount: 0,
					invalidExamples: [],
					count: 10,
					min: 1,
					max: 10,
					mean: 5.5,
					median: 5.5,
					integer: true,
					identifierHint: false,
					format: { prefix: '', suffix: '', thousandsSeparator: false },
					histogram: { start: 0.5, width: 1, counts: [1, 1, 1] }
				}
			]
		};
		let ingestBehavior: 'succeed' | 'fail' | 'hang' = 'succeed';
		const fakeClient: StorageClient = {
			ingest: async (source, options) => {
				if (ingestBehavior === 'fail') {
					throw new IngestionError('READ_FAILED', 'Private error');
				}
				if (ingestBehavior === 'hang') {
					return await new Promise<DatasetMetadata>((_resolve, reject) => {
						options?.signal?.addEventListener('abort', () => {
							reject(
								new IngestionError('CANCELLED', 'Dataset loading was cancelled.')
							);
						});
					});
				}
				const result: DatasetMetadata = {
					...fakeMeta,
					id: source.kind === 'sample' ? `ds-${source.sampleId}` : 'ds-upload',
					source: source.kind === 'sample' ? 'sample' : 'upload',
					sampleId: source.kind === 'sample' ? source.sampleId : null
				};
				await db!.put('metadata', result);
				return result;
			},
			getMetadata: async () => fakeMeta,
			fetchRows: async () => [],
			deleteDatasetsExcept: async () => undefined,
			dispose: () => undefined
		};
		setStorageClientForTesting(fakeClient);

		const firstOk = await startDatasetLoad({
			kind: 'sample',
			sampleId: 'iris'
		});
		expect($datasetLoad.get()).toEqual({ busy: false, progress: null, errorCode: null });
		expect(firstOk).toBe(true);

		expect(
			await startDatasetLoad({
				kind: 'file',
				file: new window.File(['a,b\n1,2'], 'secret_upload.csv') as unknown as File
			})
		).toBe(true);

		ingestBehavior = 'fail';
		expect(
			await startDatasetLoad({
				kind: 'file',
				file: new window.File(['bad'], 'broken.csv') as unknown as File
			})
		).toBe(false);

		ingestBehavior = 'hang';
		const pending = startDatasetLoad({
			kind: 'file',
			file: new window.File(['a'], 'cancelled.csv') as unknown as File
		});
		cancelDatasetLoad();
		expect(await pending).toBe(false);

		const names = recordedSends.map(
			(entry) => (entry.body.payload as Record<string, unknown>).name
		);
		expect(names).toEqual([undefined, 'sample_dataset_selected', 'custom_dataset_uploaded']);
		expect(JSON.stringify(recordedSends)).not.toContain('secret_upload');
		expect(JSON.stringify(recordedSends)).not.toContain('customers_private');
	});

	test('REL-TELEM-4: reports each fixed exception code at most once per document without error details', () => {
		setBetaEnv(true, 'https://beta.samata.ml/target');
		resetBetaTelemetryForTests();
		initBetaTelemetry(() => true);
		syncBetaRoute({ kind: 'workflow', path: '/target', section: 2 });

		reportBetaException('window-error');
		reportBetaException('window-error');
		reportBetaException('unhandled-rejection');
		reportBetaException('storage-worker-error');
		reportBetaException('storage-worker-error');
		reportBetaException('analysis-worker-failed');

		const names = recordedSends.map(
			(entry) => (entry.body.payload as Record<string, unknown>).name
		);
		expect(names).toEqual([
			undefined,
			'beta_error_window_error',
			'beta_error_unhandled_rejection',
			'beta_error_storage_worker_error',
			'beta_error_analysis_worker_failed'
		]);
		expect(networkRequests).toHaveLength(0);
	});

	test('REL-TELEM-5: script error or load without window.umami drops queued events with no retry or throw', () => {
		setBetaEnv(true, 'https://beta.samata.ml/');
		resetBetaTelemetryForTests();

		// 1. Script error event via happy-dom disabled-file error setting
		happyDomWindow().happyDOM.settings.handleDisabledFileLoadingAsSuccess = false;
		trackBetaPageview('/data');
		trackBetaEvent('beta_get_started');
		expect(() => initBetaTelemetry(() => true)).not.toThrow();

		expect(document.querySelectorAll(`script[src="${UMAMI_SCRIPT_URL}"]`)).toHaveLength(1);
		// Retry call after failure must do nothing.
		initBetaTelemetry(() => true);
		expect(document.querySelectorAll(`script[src="${UMAMI_SCRIPT_URL}"]`)).toHaveLength(1);
		expect(recordedSends).toHaveLength(0);

		// 2. Load succeeds without window.umami defined
		document.querySelectorAll('script[src*="umami"]').forEach((el) => el.remove());
		resetBetaTelemetryForTests();
		happyDomWindow().happyDOM.settings.handleDisabledFileLoadingAsSuccess = true;
		installTrackerOnLoad = false;

		trackBetaPageview('/data');
		trackBetaEvent('beta_get_started');
		expect(() => initBetaTelemetry(() => true)).not.toThrow();
		expect(() => trackBetaEvent('training_started')).not.toThrow();
		expect(() => reportBetaException('window-error')).not.toThrow();
		expect(recordedSends).toHaveLength(0);
		expect(networkRequests).toHaveLength(0);
	});
});
