import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import {
	CHECKOUT_IDENTITY_PATH,
	compareCheckoutIdentity,
	formatCheckoutFailure,
	type CheckoutExpectation
} from '../scripts/checkout-identity';
import { APP_URL, CHECKOUT_ROOT, DIST_URL, MOCKUPS_URL } from '../scripts/ports';

const TIMEOUT_MS = 5000;

/** Fetches and parses `/__checkout`; resolves to the parsed body or a problem string. */
function fetchIdentity(baseUrl: string): Promise<{ reply: unknown } | { problem: string }> {
	return new Promise((resolve) => {
		const url = new URL(`${baseUrl}${CHECKOUT_IDENTITY_PATH}`);
		const send = url.protocol === 'https:' ? httpsRequest : httpRequest;
		const fail = (error: unknown) =>
			resolve({
				problem: `no reply from ${url.href}: ${error instanceof Error ? error.message : String(error)}`
			});
		const req = send(
			url,
			{ method: 'GET', rejectUnauthorized: false, timeout: TIMEOUT_MS },
			(response) => {
				const chunks: Buffer[] = [];
				response.on('data', (chunk: Buffer) => chunks.push(chunk));
				response.on('error', fail);
				response.on('end', () => {
					try {
						resolve({ reply: JSON.parse(Buffer.concat(chunks).toString('utf8')) });
					} catch {
						resolve({ reply: null });
					}
				});
			}
		);
		req.on('timeout', () => req.destroy(new Error(`timed out after ${TIMEOUT_MS} ms`)));
		req.on('error', fail);
		req.end();
	});
}

/**
 * Playwright global setup: requires every test server to belong to this
 * checkout and to run in the expected mode before any test starts.
 */
export default async function globalSetup(): Promise<void> {
	const expectations: CheckoutExpectation[] = [
		{
			label: 'app',
			url: APP_URL,
			service: 'samata-ml-app',
			root: CHECKOUT_ROOT,
			mode: 'dev',
			trainingRuntimeProbe: true
		},
		{
			label: 'dist',
			url: DIST_URL,
			service: 'samata-ml-app',
			root: CHECKOUT_ROOT,
			mode: 'dist'
		},
		{ label: 'mockups', url: MOCKUPS_URL, service: 'samata-ml-mockups', root: CHECKOUT_ROOT }
	];
	const results = await Promise.all(expectations.map((expected) => fetchIdentity(expected.url)));
	const failures = expectations.flatMap((expected, index) => {
		const result = results[index]!;
		const problems =
			'problem' in result
				? [result.problem]
				: compareCheckoutIdentity(expected, result.reply);
		return problems.length ? [{ expected, problems }] : [];
	});
	if (failures.length) throw new Error(formatCheckoutFailure(failures));
}
