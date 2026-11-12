import path from 'node:path';

/**
 * Shared project paths used by build and server scripts.
 */
export const ROOT_DIR = path.resolve(import.meta.dir, '..');
export const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
export const SRC_DIR = path.join(ROOT_DIR, 'src');
export const CSS_DIR = path.join(ROOT_DIR, 'css');
export const DEV_DIR = path.join(ROOT_DIR, 'dev');
export const DIST_DIR = path.join(ROOT_DIR, 'dist');

/**
 * Directory containing UI scaffold wireframes and preview templates.
 */
export const UI_SCAFFOLD_DIR = path.join(ROOT_DIR, 'specification', 'plans', 'ui-scaffold');
