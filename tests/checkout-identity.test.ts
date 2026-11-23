import { describe, expect, it } from 'bun:test';
import {
	compareCheckoutIdentity,
	createCheckoutIdentityResponse,
	formatCheckoutFailure,
	type CheckoutExpectation,
	type CheckoutIdentity
} from '../scripts/checkout-identity';

const expected: CheckoutExpectation = {
	label: 'app',
	url: 'https://localhost:3000',
	service: 'samata-ml-app',
	root: '/a',
	mode: 'dev',
	trainingRuntimeProbe: true
};
const good: CheckoutIdentity = {
	service: 'samata-ml-app',
	root: '/a',
	servingDir: '/a/dev',
	mode: 'dev',
	trainingRuntimeProbe: true
};

describe('compareCheckoutIdentity', () => {
	it('accepts a matching reply', () => {
		expect(compareCheckoutIdentity(expected, good)).toEqual([]);
	});

	it('reports one problem per mismatch', () => {
		expect(compareCheckoutIdentity(expected, null)).toHaveLength(1);
		expect(compareCheckoutIdentity(expected, '<!doctype html>')).toHaveLength(1);
		expect(compareCheckoutIdentity(expected, { service: 'samata-ml-app' })).toHaveLength(1);
		const other = compareCheckoutIdentity(expected, { ...good, root: '/b' });
		expect(other).toHaveLength(1);
		expect(other[0]).toContain('/a');
		expect(other[0]).toContain('/b');
		expect(
			compareCheckoutIdentity(expected, { ...good, service: 'samata-ml-mockups' })
		).toHaveLength(1);
		expect(compareCheckoutIdentity(expected, { ...good, mode: 'dist' })).toHaveLength(1);
		expect(
			compareCheckoutIdentity(expected, { ...good, trainingRuntimeProbe: false })
		).toHaveLength(1);
	});
});

describe('formatCheckoutFailure', () => {
	it('names URLs, roots, the override and the no-stop rule', () => {
		const problems = compareCheckoutIdentity(expected, { ...good, root: '/b' });
		const text = formatCheckoutFailure([{ expected, problems }]);
		expect(text).toContain('https://localhost:3000');
		expect(text).toContain('/a');
		expect(text).toContain('/b');
		expect(text).toContain('SAMATA_PORT_BASE');
		expect(text).toContain('Never stop or signal a process this session did not start');
	});
});

describe('createCheckoutIdentityResponse', () => {
	it('sends JSON for GET and no body for HEAD', async () => {
		const get = createCheckoutIdentityResponse(good, 'GET');
		expect(get.status).toBe(200);
		expect(get.headers.get('Cache-Control')).toBe('no-store');
		expect(get.headers.get('Content-Type')).toContain('application/json');
		expect(await get.json()).toEqual(good);
		const head = createCheckoutIdentityResponse(good, 'HEAD');
		expect(head.status).toBe(200);
		expect(await head.text()).toBe('');
	});
});
