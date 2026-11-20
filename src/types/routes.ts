import type { WorkflowPath } from './state';

export type SectionNumber = 1 | 2 | 3 | 4;

/** Exact paths that open content over the current workflow page. */
export type ReservedPath =
	| '/about'
	| '/privacy'
	| '/help'
	| '/help/configure-model'
	| '/help/training-setup';

export type { WorkflowPath } from './state';

/**
 * Union representing the parsed classification of a URL pathname.
 * Follows specification/app-state-and-navigation.md §3.1.
 */
export type ParsedRoute =
	| { kind: 'root' }
	| { kind: 'workflow'; path: WorkflowPath; section: SectionNumber; modelNum?: number }
	| { kind: 'reserved'; path: ReservedPath; underlayPath?: WorkflowPath }
	| { kind: 'unknown'; path: string };

/**
 * State object stored in history.state.
 * Domain state NEVER goes here.
 */
export interface HistoryEntryState {
	v: 1;
	/** Random id so tests and router can tell history entries apart. */
	entryId: string;
	/** Present only on reserved-route entries: the workflow page rendered underneath. */
	underlayPath?: WorkflowPath;
}
