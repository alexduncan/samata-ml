import type { ParsedRoute, ReservedPath, WorkflowPath } from '../types/routes';

/**
 * Normalises and parses a URL pathname into a canonical ParsedRoute.
 * Follows specification/app-state-and-navigation.md §3.
 *
 * @param pathname - The URL pathname (e.g. '/data', '/models/1', '/about').
 * @returns The structured route classification.
 */
export function parseRoute(pathname: string): ParsedRoute {
	if (!pathname || pathname === '/') {
		return { kind: 'root' };
	}

	// Normalise away trailing slashes (e.g. '/data/' -> '/data')
	const normalised =
		pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

	if (normalised === '/data') {
		return { kind: 'workflow', path: '/data', section: 1 };
	}

	if (normalised === '/target') {
		return { kind: 'workflow', path: '/target', section: 2 };
	}

	if (normalised === '/models') {
		return { kind: 'workflow', path: '/models', section: 3 };
	}

	if (normalised === '/results') {
		return { kind: 'workflow', path: '/results', section: 4 };
	}

	// Reserved modal routes
	if (
		normalised === '/about' ||
		normalised === '/privacy' ||
		normalised === '/help' ||
		normalised === '/help/configure-model'
	) {
		return { kind: 'reserved', path: normalised as ReservedPath };
	}

	// Model detail routes: /models/{num} where num is a strictly positive integer
	const modelMatch = normalised.match(/^\/models\/([^/]+)$/);
	if (modelMatch && modelMatch[1]) {
		const segment = modelMatch[1];
		// Must be digits only, no leading zeros (positive integer >= 1)
		if (/^[1-9]\d*$/.test(segment)) {
			const modelNum = Number.parseInt(segment, 10);
			return {
				kind: 'workflow',
				path: `/models/${modelNum}` as WorkflowPath,
				section: 3,
				modelNum
			};
		}
		// Invalid model numbers (e.g. 0, -1, 1.5, abc) are unknown routes
		return { kind: 'unknown', path: pathname };
	}

	return { kind: 'unknown', path: pathname };
}
