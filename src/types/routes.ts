import type { ProvisionalModelContext, ProvisionalModelIdentity, WorkflowPath } from './state';

export type SectionNumber = 1 | 2 | 3 | 4;

/** Exact paths that open content over the current workflow page. */
export type ReservedPath =
	| '/about'
	| '/privacy'
	| '/help'
	| '/help/configure-model'
	| '/help/training-setup';

export type { WorkflowPath } from './state';

/** Provisional route intent or its acknowledged model, keyed by the source history entry. */
export type ProvisionalEntry =
	| { kind: 'pending'; context: ProvisionalModelContext; candidate?: ProvisionalModelIdentity }
	| { kind: 'bound'; identity: ProvisionalModelIdentity };

/** Runtime state of the new-model route. Only the pending or bound identity is durable history. */
export type ProvisionalRouteState =
	| ProvisionalEntry
	| { kind: 'loading'; context: ProvisionalModelContext };

/**
 * Union representing the parsed classification of a URL pathname.
 * Follows specification/app-state-and-navigation.md §3.1.
 */
export type ParsedRoute =
	| { kind: 'root' }
	| {
			kind: 'workflow';
			path: WorkflowPath;
			section: SectionNumber;
			modelNum?: number;
			provisional?: ProvisionalRouteState;
	  }
	| {
			kind: 'reserved';
			path: ReservedPath;
			underlayPath?: WorkflowPath;
			provisional?: ProvisionalRouteState;
	  }
	| { kind: 'unknown'; path: string };

/**
 * State object stored in history.state.
 * Domain state NEVER goes here.
 */
export interface HistoryEntryState {
	v: 1;
	/** Random id so tests and router can tell history entries apart. */
	entryId: string;
	/** The app-owned navigation stack and this entry's reversible position. */
	stackId?: string;
	index?: number;
	/** Reserved routes pushed by this document can close with Back on subsequent visits. */
	modalDocumentId?: string;
	/** Present only on reserved-route entries: the workflow page rendered underneath. */
	underlayPath?: WorkflowPath;
	/** Source of a reserved underlay; its identity can acknowledge while Help is open. */
	underlayEntryId?: string;
	/** Binding for this wizard or for the wizard beneath this reserved route. */
	provisional?: ProvisionalEntry;
}
