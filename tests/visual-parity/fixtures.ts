import type { Page } from '@playwright/test';
import { INITIAL_APP_STATE, type ModelRecord, type PersistedAppState } from '../../src/types/state';
import { MOCKUPS_URL } from '../../scripts/ports';

/** Deterministic in-memory sidebar states shared by stories and browser assertions. */
export type SidebarFixture = 'empty' | 'dataset' | 'target' | 'models' | 'long';

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
	state.models = [model(1, 'draft'), model(2, 'training'), model(3, 'trained')];
	state.nextModelNum = 4;
	if (fixture === 'long') {
		state.dataset.name =
			'A long dataset name with UnbrokenDatasetNameThatMustWrapWithoutTruncation and additional descriptive words';
		state.dataset.rowCount = 1234567;
	}
	return state;
}

/** Prepares a real mounted app using only the existing test atom and native route links. */
export async function prepareSidebarFixture(page: Page, fixture: SidebarFixture): Promise<void> {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/data');
	await page.locator('app-welcome-modal').evaluate(async (element) => {
		await (element as HTMLElementTagNameMap['app-welcome-modal']).updateComplete;
	});
	const start = page.getByRole('button', { name: 'Get Started', exact: true });
	if (await start.isVisible()) await start.click();
	await page.evaluate((state) => window.__appState!.set(state), createSidebarFixture(fixture));
	const path = fixture === 'models' ? '/models/2' : fixture === 'target' ? '/target' : '/data';
	if (path !== '/data') await page.locator(`app-sidebar a[href="${path}"]`).click();
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
	fixture: 'empty' | 'models'
): Promise<void> {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(
		`${MOCKUPS_URL}/${fixture === 'empty' ? '01-1_select-data.html' : '03-2_train-models-1-choose-model.html'}?clean=1`
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
		const item = list.firstElementChild!;
		for (let num = 1; num <= 3; num++) {
			const next = item.cloneNode(true) as HTMLElement;
			const link = next.querySelector('.step-model-link')!;
			link.textContent = `Model ${num}`;
			if (num === 2) link.setAttribute('aria-current', 'step');
			else link.removeAttribute('aria-current');
			list.append(next);
		}
		item.remove();
	}, fixture === 'models');
	await page.evaluate(async () => {
		await document.fonts.ready;
	});
	await page.mouse.move(0, 0);
}
