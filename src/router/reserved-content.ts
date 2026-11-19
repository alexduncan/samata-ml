import type { ReservedPath } from '../types/routes';

/**
 * Maps each reserved overlay route path to its corresponding page identifier in `content/{locale}/pages/`.
 * Kept in router configuration rather than content front matter per app-state-and-navigation §3.
 */
export const RESERVED_CONTENT = {
	'/about': 'about',
	'/privacy': 'privacy-policy',
	'/help': 'help',
	'/help/configure-model': 'configure-model'
} as const satisfies Readonly<Record<ReservedPath, string>>;
