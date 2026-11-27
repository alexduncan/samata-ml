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
	'continue-on-error'?: boolean | string;
}

interface WorkflowConcurrency {
	group?: string;
	'cancel-in-progress'?: boolean | string;
}

interface WorkflowJob {
	name?: string;
	needs?: string[];
	if?: string;
	'continue-on-error'?: boolean | string;
	'runs-on'?: string;
	'timeout-minutes'?: number;
	environment?: string;
	concurrency?: WorkflowConcurrency;
	env?: Record<string, string>;
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
	permissions?: Record<string, string>;
	env?: Record<string, string>;
	jobs: Record<string, WorkflowJob>;
}

const CHECKOUT_PIN = 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1';
const BUN_PIN = 'oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6';
const CHECKSUM_CMD = 'cd vendor/web-ml && sha256sum -c web-ml-0.2.0.tgz.sha256';
const FROZEN_INSTALL_CMD = 'bun install --frozen-lockfile --ignore-scripts';
const WORKFLOW_SEVERITY = "${{ vars.SAMATA_ADVISORY_CHECKS || 'warn' }}";
const BLOCKING_E2E_CMD = 'bun run test:e2e:blocking --project="$PROJECT"';

function isSoftFailure(value: boolean | string | undefined): boolean {
	return value !== undefined && value !== false;
}

function collectWorkflowViolations(rawYaml: string): string[] {
	const violations: string[] = [];
	const workflow = Bun.YAML.parse(rawYaml) as WorkflowFile;

	if (workflow.name !== 'CI') violations.push('Workflow name must be CI');
	if (JSON.stringify(workflow.on?.pull_request?.branches) !== '["main"]') {
		violations.push('pull_request trigger must target main');
	}
	if (JSON.stringify(workflow.on?.push?.branches) !== '["main"]') {
		violations.push('push trigger must target main');
	}
	if (JSON.stringify(workflow.permissions) !== '{"contents":"read"}') {
		violations.push('Root permissions must be { contents: read }');
	}
	if (workflow.env?.WRANGLER_SEND_METRICS !== 'false') {
		violations.push("Root env must set WRANGLER_SEND_METRICS: 'false'");
	}
	if (workflow.env?.SAMATA_ADVISORY_CHECKS !== WORKFLOW_SEVERITY) {
		violations.push('Root env must inherit advisory severity from the repository variable');
	}

	const usesLines = rawYaml.split(/\r?\n/).filter((line) => /^\s*(?:-\s*)?uses:\s*/.test(line));
	for (const line of usesLines) {
		if (!/@[0-9a-f]{40}\s+#\s*v\d+\.\d+\.\d+\s*$/.test(line)) {
			violations.push(`Unpinned or uncommented action line: ${line.trim()}`);
		}
	}

	for (const [jobId, job] of Object.entries(workflow.jobs ?? {})) {
		if (jobId === 'verify' || jobId === 'e2e') {
			const items = [
				[jobId, job] as const,
				...(job.steps ?? []).map((step) => [`${jobId} step ${step.name}`, step] as const)
			];
			for (const [label, item] of items) {
				if (isSoftFailure(item['continue-on-error'])) {
					violations.push(`${label} must remain blocking`);
				}
				if (item.env && Object.hasOwn(item.env, 'SAMATA_ADVISORY_CHECKS')) {
					violations.push(`${label} must inherit workflow advisory severity`);
				}
			}
		}
		if (job['runs-on'] !== 'ubuntu-24.04') {
			violations.push(`${jobId} must use ubuntu-24.04`);
		}
		for (const step of job.steps ?? []) {
			if (step.uses && !/^[^@]+@[0-9a-f]{40}$/.test(step.uses)) {
				violations.push(`${jobId} step ${step.name ?? step.uses} must be SHA-pinned`);
			}
			if (step.run && step.run.includes('${{')) {
				violations.push(`${jobId} step "${step.name}" interpolates \${{ inside run:`);
			}
		}
		const checkoutStep = job.steps?.[0];
		if (
			checkoutStep?.uses !== CHECKOUT_PIN ||
			checkoutStep.with?.['persist-credentials'] !== false
		) {
			violations.push(
				`${jobId} step 0 must use pinned checkout with persist-credentials: false`
			);
		}
		if (job.steps?.[1]?.run?.trim() !== CHECKSUM_CMD) {
			violations.push(`${jobId} step 1 must verify vendor/web-ml tarball checksum`);
		}
		const bunStep = job.steps?.[2];
		if (bunStep?.uses !== BUN_PIN || bunStep.with?.['bun-version-file'] !== '.bun-version') {
			violations.push(`${jobId} step 2 must use pinned setup-bun with .bun-version`);
		}
		if (job.steps?.[3]?.run?.trim() !== FROZEN_INSTALL_CMD) {
			violations.push(`${jobId} step 3 must run ${FROZEN_INSTALL_CMD}`);
		}
	}

	const verify = workflow.jobs?.verify;
	if (!verify) {
		violations.push('Missing verify job');
	} else {
		if (verify['timeout-minutes'] !== 60) violations.push('verify timeout must be 60');
		if (
			verify.concurrency?.group !== 'verify-${{ github.ref }}' ||
			verify.concurrency?.['cancel-in-progress'] !==
				"${{ github.event_name == 'pull_request' }}"
		) {
			violations.push('verify concurrency mismatch');
		}
		if (verify.steps[0]?.with?.['fetch-depth'] !== 0) {
			violations.push('verify checkout must set fetch-depth: 0');
		}
		const contentStep = verify.steps[4];
		if (
			contentStep?.run?.trim() !== 'bun run content:check' ||
			contentStep.if !== undefined ||
			isSoftFailure(contentStep['continue-on-error']) ||
			isSoftFailure(verify['continue-on-error'])
		) {
			violations.push('verify step 4 must run bun run content:check as a blocking check');
		}
		const formatStep = verify.steps[5];
		if (
			formatStep?.env?.BASE !==
				'${{ github.event.pull_request.base.sha || github.event.before }}' ||
			!formatStep?.run?.includes(
				"git diff --name-only --diff-filter=ACMR -z \"$BASE\" HEAD -- '*.ts' '*.tsx' '*.mjs' '*.cjs' '*.js' '*.jsx' '*.json' '*.jsonc' '*.css' '*.html' '*.yml' '*.yaml' |\n    xargs -0 -r bunx --no-install prettier --check --"
			) ||
			!formatStep?.run?.includes(
				'git diff --name-only --diff-filter=ACMR -z "$BASE" HEAD -- \'*.md\' |\n    xargs -0 -r "$RUNNER_TEMP/dprint/dprint" check --config dprint.json --incremental=false --allow-no-files --'
			) ||
			!formatStep?.run?.includes('gh release download 0.65.0 --repo dprint/dprint') ||
			!formatStep?.run?.includes(
				'gh attestation verify "$dprint_zip" --repo dprint/dprint'
			) ||
			!formatStep?.run?.includes('^0+$')
		) {
			violations.push('verify step 5 must check formatting of changed files via env BASE');
		}
		const verifyRestRuns = verify.steps.slice(6).map((step) => step.run?.trim());
		const expectedRestRuns = [
			'bun run lint',
			'bunx playwright install --with-deps chromium firefox webkit',
			'bun run check',
			'bun run deploy:dry-run',
			'bun run test:stories'
		];
		if (JSON.stringify(verifyRestRuns) !== JSON.stringify(expectedRestRuns)) {
			violations.push(
				`verify steps 6..10 must be ${expectedRestRuns.join(' -> ')}, got ${verifyRestRuns.join(' -> ')}`
			);
		}
		const verifyJson = JSON.stringify(verify);
		if (
			verifyJson.includes('BETA_TELEMETRY_ENABLED') ||
			verifyJson.toLowerCase().includes('umami')
		) {
			violations.push('verify must not reference Umami or BETA_TELEMETRY_ENABLED');
		}
	}

	const e2e = workflow.jobs?.e2e;
	if (!e2e) {
		violations.push('Missing e2e job');
	} else {
		if (JSON.stringify(e2e.needs) !== '["verify"]') {
			violations.push('e2e.needs must equal ["verify"]');
		}
		if (
			e2e.concurrency?.group !== 'e2e-${{ github.ref }}-${{ matrix.project }}' ||
			e2e.concurrency?.['cancel-in-progress'] !== "${{ github.event_name == 'pull_request' }}"
		) {
			violations.push('e2e concurrency mismatch');
		}
		const timeout = e2e['timeout-minutes'];
		if (typeof timeout !== 'number' || timeout < 30 || timeout > 120 || timeout % 10 !== 0) {
			violations.push('e2e timeout must be a multiple of 10 between 30 and 120');
		}
		if (
			e2e.strategy?.['fail-fast'] !== false ||
			JSON.stringify(e2e.strategy?.matrix?.project) !== '["chromium","firefox","webkit"]'
		) {
			violations.push('e2e matrix must use fail-fast: false over chromium, firefox, webkit');
		}
		const installStep = e2e.steps[4];
		if (
			installStep?.env?.PROJECT !== '${{ matrix.project }}' ||
			installStep?.run?.trim() !== 'bunx playwright install --with-deps "$PROJECT"'
		) {
			violations.push('e2e step 4 must install matrix browser via env.PROJECT');
		}
		const runStep = e2e.steps[5];
		if (
			runStep?.env?.PROJECT !== '${{ matrix.project }}' ||
			runStep?.env?.SAMATA_SKIP_KNOWN_FAILURES !== '1' ||
			runStep?.run?.trim() !== BLOCKING_E2E_CMD ||
			runStep?.run?.includes('--grep-invert')
		) {
			violations.push(
				'e2e step 5 must run test:e2e:blocking with env.PROJECT and SAMATA_SKIP_KNOWN_FAILURES=1 without --grep-invert'
			);
		}
	}

	const advisory = workflow.jobs?.advisory;
	if (!advisory) {
		violations.push('Missing advisory job');
	} else {
		if (advisory['continue-on-error'] !== true) {
			violations.push('advisory must have literal continue-on-error: true');
		}
		if (JSON.stringify(advisory.needs) !== '["verify"]') {
			violations.push('advisory.needs must equal ["verify"]');
		}
		if (
			advisory.concurrency?.group !== 'advisory-${{ github.ref }}' ||
			advisory.concurrency?.['cancel-in-progress'] !==
				"${{ github.event_name == 'pull_request' }}"
		) {
			violations.push('advisory concurrency mismatch');
		}
		const timeout = advisory['timeout-minutes'];
		if (typeof timeout !== 'number' || timeout < 30 || timeout > 120 || timeout % 10 !== 0) {
			violations.push('advisory timeout must be a multiple of 10 between 30 and 120');
		}
		const setupSteps = advisory.steps.slice(0, 4);
		if (JSON.stringify(setupSteps) !== JSON.stringify(e2e?.steps.slice(0, 4))) {
			violations.push('advisory setup must match the first four e2e steps');
		}
		if (advisory.steps[4]?.run?.trim() !== 'bunx playwright install --with-deps chromium') {
			violations.push('advisory must install Chromium with system dependencies');
		}
		if (
			advisory.steps[5]?.run?.trim() !== 'bun run test:e2e:advisory' ||
			advisory.steps[5]?.env?.SAMATA_ADVISORY_CHECKS !== 'error'
		) {
			violations.push('advisory must run test:e2e:advisory with severity error');
		}
	}

	const deploy = workflow.jobs?.deploy;
	if (!deploy) {
		violations.push('Missing deploy job');
	} else {
		if (JSON.stringify(deploy.needs) !== '["verify","e2e"]') {
			violations.push('deploy.needs must equal ["verify","e2e"]');
		}
		if (deploy.if !== "github.event_name == 'push' && github.ref == 'refs/heads/main'") {
			violations.push('deploy.if must gate push to main');
		}
		if (deploy['timeout-minutes'] !== 20) violations.push('deploy timeout must be 20');
		if (deploy.environment !== 'cloudflare-beta') {
			violations.push('deploy environment must be cloudflare-beta');
		}
		if (
			deploy.concurrency?.group !== 'cloudflare-deploy-main' ||
			deploy.concurrency?.['cancel-in-progress'] !== false
		) {
			violations.push('deploy concurrency mismatch');
		}
		const deployStep = deploy.steps[4];
		if (
			deployStep?.run?.trim() !== 'bun run deploy' ||
			JSON.stringify(deployStep?.env) !==
				JSON.stringify({
					CLOUDFLARE_API_TOKEN: '${{ secrets.CLOUDFLARE_API_TOKEN }}',
					CLOUDFLARE_ACCOUNT_ID: '${{ secrets.CLOUDFLARE_ACCOUNT_ID }}',
					BETA_TELEMETRY_ENABLED: 'true',
					SAMATA_CRAWLER_POLICY: 'closed'
				})
		) {
			violations.push('deploy step 4 command or env mismatch');
		}
	}

	return violations;
}

describe('.github/workflows/ci.yml', () => {
	const rawYaml = readFileSync(path.resolve('.github/workflows/ci.yml'), 'utf8');

	it('REL-CI-1: satisfies every T7 CI/CD workflow invariant and E1 approved step order', () => {
		expect(collectWorkflowViolations(rawYaml)).toEqual([]);
	});

	it('requires authored Markdown validation to block CI', () => {
		const command = 'run: bun run content:check';
		const failure = 'verify step 4 must run bun run content:check as a blocking check';
		expect(collectWorkflowViolations(rawYaml.replace(command, 'run: echo skip'))).toContain(
			failure
		);
		expect(
			collectWorkflowViolations(
				rawYaml.replace(command, `${command}\n              continue-on-error: true`)
			)
		).toContain(failure);
	});

	it('rejects regressions across pins, checksums, step order, script interpolation, and deploy gates', () => {
		expect(
			collectWorkflowViolations(rawYaml.replace(CHECKOUT_PIN, 'actions/checkout@v4'))
		).not.toEqual([]);
		expect(
			collectWorkflowViolations(
				rawYaml.replace(
					BLOCKING_E2E_CMD,
					'bun run test:e2e:blocking --project=${{ matrix.project }} --grep-invert foo'
				)
			)
		).not.toEqual([]);
		expect(
			collectWorkflowViolations(rawYaml.replace('timeout-minutes: 20', 'timeout-minutes: 30'))
		).not.toEqual([]);
		expect(collectWorkflowViolations(rawYaml.replace(CHECKSUM_CMD, 'echo skip'))).not.toEqual(
			[]
		);
		expect(
			collectWorkflowViolations(
				rawYaml.replace("WRANGLER_SEND_METRICS: 'false'", "WRANGLER_SEND_METRICS: 'true'")
			)
		).not.toEqual([]);
	});

	it('checks advisory job isolation, browser install and severity', () => {
		const cases = [
			[
				'            - e2e\n',
				'            - e2e\n            - advisory\n',
				'deploy.needs must equal ["verify","e2e"]'
			],
			[
				'        continue-on-error: true\n',
				'',
				'advisory must have literal continue-on-error: true'
			],
			[
				'bunx playwright install --with-deps chromium\n',
				'bunx playwright install chromium\n',
				'advisory must install Chromium with system dependencies'
			],
			[
				"SAMATA_ADVISORY_CHECKS: 'error'",
				"SAMATA_ADVISORY_CHECKS: 'warn'",
				'advisory must run test:e2e:advisory with severity error'
			]
		] as const;
		for (const [original, replacement, violation] of cases) {
			const mutated = rawYaml.replace(original, replacement);
			expect(collectWorkflowViolations(mutated)).toContain(violation);
		}
	});

	it('rejects disabled workflow severity and overrides in blocking jobs and steps', () => {
		const severityLine = `    SAMATA_ADVISORY_CHECKS: ${WORKFLOW_SEVERITY}\n`;
		for (const replacement of ['', "    SAMATA_ADVISORY_CHECKS: 'warn'\n"]) {
			const mutated = rawYaml.replace(severityLine, replacement);
			expect(collectWorkflowViolations(mutated)).toContain(
				'Root env must inherit advisory severity from the repository variable'
			);
		}

		for (const [job, step, name] of [
			['verify', 'bun run lint', 'Run TSDoc lint'],
			['e2e', BLOCKING_E2E_CMD, 'Run E2E suite']
		] as const) {
			const jobStart = `    ${job}:\n`;
			const override = "SAMATA_ADVISORY_CHECKS: 'warn'";
			const jobOverride = `${jobStart}        env:\n            ${override}\n`;
			const jobEnv = rawYaml.replace(jobStart, jobOverride);
			expect(collectWorkflowViolations(jobEnv)).toContain(
				`${job} must inherit workflow advisory severity`
			);
			const run = `run: ${step}`;
			const skip = "SAMATA_SKIP_KNOWN_FAILURES: '1'";
			const stepEnv =
				job === 'verify'
					? rawYaml.replace(
							run,
							`${run}\n              env:\n                  ${override}`
						)
					: rawYaml.replace(skip, `${skip}\n                  ${override}`);
			expect(collectWorkflowViolations(stepEnv)).toContain(
				`${job} step ${name} must inherit workflow advisory severity`
			);

			const soft = "${{ github.event_name == 'pull_request' }}";
			const jobFlag = `${jobStart}        continue-on-error: ${soft}\n`;
			const stepFlag = `${run}\n              continue-on-error: true`;
			expect(collectWorkflowViolations(rawYaml.replace(jobStart, jobFlag))).toContain(
				`${job} must remain blocking`
			);
			expect(collectWorkflowViolations(rawYaml.replace(run, stepFlag))).toContain(
				`${job} step ${name} must remain blocking`
			);
		}
	});
});
