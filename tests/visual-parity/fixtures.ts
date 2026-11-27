import type { Locator, Page } from '@playwright/test';
import { INITIAL_APP_STATE, type ModelRecord, type PersistedAppState } from '../../src/types/state';

/** Sets common Welcome text before measurement, keeping each document's elements and styles. */
export async function setWelcomeParityCopy(lead: Locator, body: Locator): Promise<void> {
	for (const [locator, copy] of [
		[lead, 'Train a model in your browser.'],
		[body, 'Choose a sample dataset to explore how machine learning works.']
	] as const) {
		await locator.evaluate((element, text) => {
			const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
			let replacement: string = text;
			for (let node = walker.nextNode(); node; node = walker.nextNode()) {
				if (node.textContent?.trim()) {
					node.textContent = replacement;
					replacement = '';
				}
			}
		}, copy);
	}
}

/** Deterministic in-memory sidebar states shared by stories and browser assertions. */
export type SidebarFixture = 'empty' | 'dataset' | 'target' | 'models' | 'provisional' | 'long';

function model(num: number, status: ModelRecord['status']): ModelRecord {
	return {
		num,
		createdAt: Date.UTC(2026, 0, 1),
		status,
		modelId: 'logistic-regression',
		modelOptions: {},
		hyperparameters: { mode: 'manual', values: {} },
		features: ['bill_length_mm'],
		multiclass: null,
		trainingSetup: null,
		completedSteps: [],
		progress: null,
		resultRevision: null,
		error: null,
		timings: null,
		durationMs: null,
		metrics: null,
		ui: {}
	};
}

/** Creates a fresh fixture without initialising persistence, resources or workers. */
export function createSidebarFixture(fixture: SidebarFixture): PersistedAppState {
	const state = structuredClone(INITIAL_APP_STATE);
	state.updatedAt = Date.UTC(2026, 0, 1);
	state.onboarding.welcomeDismissed = true;
	if (fixture === 'empty') return state;
	state.dataset = {
		id: 'sidebar-penguins',
		source: 'sample',
		sampleId: 'palmer-penguins',
		name: 'Palmer Penguins',
		rowCount: 344,
		columns: [
			{ name: 'species', type: 'categorical', missingCount: 0 },
			{ name: 'island', type: 'categorical', missingCount: 0 },
			{ name: 'bill_length_mm', type: 'numeric', missingCount: 0 },
			{ name: 'bill_depth_mm', type: 'numeric', missingCount: 0 },
			{ name: 'flipper_length_mm', type: 'numeric', missingCount: 0 },
			{ name: 'body_mass_g', type: 'numeric', missingCount: 0 },
			{ name: 'sex', type: 'categorical', missingCount: 0 },
			{ name: 'year', type: 'numeric', missingCount: 0 },
			{ name: 'individual_id', type: 'text', missingCount: 0 }
		]
	};
	if (fixture === 'dataset') return state;
	state.target = 'species';
	if (fixture === 'target') return state;
	state.models = [
		model(1, 'trained'),
		{
			...model(2, 'trained'),
			modelId: 'decision-tree-classifier',
			modelLabel: 'Decision Tree',
			modelColor: 'blue',
			features: ['bill_length_mm', 'bill_depth_mm']
		},
		model(3, 'training')
	];
	state.newModelNum = 3;
	state.nextModelNum = 4;
	if (fixture === 'long') {
		state.dataset.name =
			'A long dataset name with UnbrokenDatasetNameThatMustWrapWithoutTruncation and additional descriptive words';
		state.dataset.rowCount = 1234567;
		state.models[1]!.modelLabel = 'Long trained model label with UnbrokenModelNameThatMustWrap';
	}
	return state;
}

/** Seeds the existing test atom before the sidebar connects, preventing a live cue transition. */
export async function prepareSidebarFixture(
	page: Page,
	fixture: SidebarFixture,
	reducedMotion: 'reduce' | 'no-preference' = 'reduce'
): Promise<void> {
	await page.emulateMedia({ reducedMotion });
	await page.addInitScript((state) => {
		const define = CustomElementRegistry.prototype.define;
		CustomElementRegistry.prototype.define = function (name, component, options) {
			if (name === 'app-sidebar') {
				const prototype = component.prototype as HTMLElementTagNameMap['app-sidebar'];
				const connect = prototype.connectedCallback;
				let seeded = false;
				prototype.connectedCallback = function () {
					if (!seeded) {
						window.__appState!.set(state);
						seeded = true;
					}
					connect.call(this);
				};
			}
			define.call(this, name, component, options);
		};
	}, createSidebarFixture(fixture));
	const path =
		fixture === 'models'
			? '/models/2'
			: fixture === 'provisional'
				? '/models/new'
				: fixture === 'target'
					? '/target'
					: '/data';
	await page.goto(path);
	await page.locator('app-sidebar').evaluate(async (element) => {
		await (element as HTMLElementTagNameMap['app-sidebar']).updateComplete;
	});
	await page.evaluate(async () => {
		await document.fonts.ready;
	});
	await page.mouse.move(0, 0);
}

/** Normalises reference content and current state only, preserving its CSS and layout structure. */
export async function prepareSidebarReference(
	page: Page,
	fixture: 'empty' | 'models',
	mockupsUrl: string
): Promise<void> {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(
		`${mockupsUrl}/${fixture === 'empty' ? '01-1_select-data.html' : '03-7_train-models-5-results.html'}?clean=1`
	);
	await page.evaluate((populated) => {
		const sidebar = document.querySelector('.sidebar')!;
		if (!populated) {
			sidebar.querySelector('.step:nth-child(2) .step-label')!.textContent = 'Set Target';
			return;
		}
		sidebar.querySelector('.step:nth-child(1) .step-value')!.textContent = 'Palmer Penguins';
		sidebar.querySelector('.step:nth-child(2) .step-value')!.textContent = 'species';
		const counts = sidebar.querySelectorAll('.step:nth-child(1) .chiclet');
		counts[0]!.textContent = '344 rows';
		counts[1]!.textContent = '9 columns';
		sidebar.querySelectorAll('.step').forEach((step) => step.removeAttribute('aria-current'));
		sidebar.querySelector('.step:nth-child(3)')!.setAttribute('aria-current', 'step');
		const list = sidebar.querySelector('.step-models')!;
		const trained = list.querySelectorAll('.step-trained-model');
		trained[0]!.querySelector('.step-model-name')!.textContent = 'Logistic Regression';
		trained[0]!.querySelector('.chiclet')!.textContent = '1 feature';
		trained[1]!.querySelector('.chiclet')!.textContent = '2 features';
		list.querySelectorAll('[aria-current]').forEach((row) =>
			row.removeAttribute('aria-current')
		);
		trained[1]!.setAttribute('aria-current', 'page');
	}, fixture === 'models');
	await page.evaluate(async () => {
		await document.fonts.ready;
	});
	await page.mouse.move(0, 0);
}
