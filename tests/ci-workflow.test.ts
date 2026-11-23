import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

interface WorkflowStep {
	name?: string;
	uses?: string;
	with?: Record<string, unknown>;
	env?: Record<string, string>;
	run?: string;
	if?: string;
}

interface WorkflowJob {
	name?: string;
	needs?: string[];
	if?: string;
	'runs-on'?: string;
	'timeout-minutes'?: number;
	environment?: string;
	strategy?: {
		'fail-fast'?: boolean;
		matrix?: {
			project?: string[];
		};
	};
	steps: WorkflowStep[];
}

interface WorkflowFile {
	name: string;
	on: {
		push?: { branches?: string[] };
		pull_request?: { branches?: string[] };
	};
	jobs: Record<string, WorkflowJob>;
}

describe('.github/workflows/ci.yml', () => {
	const workflow = Bun.YAML.parse(
		readFileSync(path.resolve('.github/workflows/ci.yml'), 'utf8')
	) as WorkflowFile;

	it('triggers on push and pull_request to main', () => {
		expect(workflow.on.push?.branches).toEqual(['main']);
		expect(workflow.on.pull_request?.branches).toEqual(['main']);
	});

	it('configures verify job with pinned Bun, Playwright browsers, lint, check, build, stories, and dry-run deploy', () => {
		const verify = workflow.jobs.verify;
		expect(verify).toBeDefined();
		expect(verify?.['runs-on']).toBe('ubuntu-latest');
		expect(verify?.['timeout-minutes']).toBe(60);

		const bunStep = verify?.steps.find((step) => step.uses?.startsWith('oven-sh/setup-bun'));
		expect(bunStep?.with?.['bun-version-file']).toBe('.bun-version');

		const runs = verify?.steps.map((step) => step.run).filter(Boolean) ?? [];
		expect(runs).toContain('bun install --frozen-lockfile --ignore-scripts');
		expect(runs).toContain('bunx playwright install --with-deps chromium firefox webkit');
		expect(runs).toContain('bun run lint');
		expect(runs).toContain('bun run check');
		expect(runs).toContain('bun run build');
		expect(runs).toContain('bun run test:stories');
		expect(runs).toContain('bun run deploy:dry-run');
	});

	it('configures three-browser E2E matrix with non-fail-fast, known-failure skipping, and bounded timeout', () => {
		const e2e = workflow.jobs.e2e;
		expect(e2e).toBeDefined();
		expect(e2e?.['runs-on']).toBe('ubuntu-latest');
		expect(e2e?.['timeout-minutes']).toBe(30);
		expect(e2e?.['timeout-minutes']).toBeGreaterThanOrEqual(30);
		expect(e2e?.['timeout-minutes']).toBeLessThanOrEqual(120);
		expect(e2e?.strategy?.['fail-fast']).toBe(false);
		expect(e2e?.strategy?.matrix?.project).toEqual(['chromium', 'firefox', 'webkit']);

		const installBrowserStep = e2e?.steps.find((step) =>
			step.run?.includes('playwright install --with-deps')
		);
		expect(installBrowserStep?.run).toContain('${{ matrix.project }}');

		const e2eStep = e2e?.steps.find((step) => step.run?.includes('bun run test:e2e'));
		expect(e2eStep?.env?.SAMATA_SKIP_KNOWN_FAILURES).toBe('1');
		expect(e2eStep?.run).toBe('bun run test:e2e --project=${{ matrix.project }}');
	});

	it('gates beta Cloudflare deployment on push to main and cloudflare-beta environment', () => {
		const deploy = workflow.jobs.deploy;
		expect(deploy).toBeDefined();
		expect(deploy?.needs).toEqual(['verify', 'e2e']);
		expect(deploy?.if).toBe("github.event_name == 'push' && github.ref == 'refs/heads/main'");
		expect(deploy?.environment).toBe('cloudflare-beta');

		const deployStep = deploy?.steps.find((step) => step.run === 'bun run deploy');
		expect(deployStep?.env).toEqual({
			BETA_TELEMETRY_ENABLED: 'true',
			SAMATA_CRAWLER_POLICY: 'closed',
			CLOUDFLARE_API_TOKEN: '${{ secrets.CLOUDFLARE_API_TOKEN }}',
			CLOUDFLARE_ACCOUNT_ID: '${{ secrets.CLOUDFLARE_ACCOUNT_ID }}'
		});
	});
});
