import type { ColumnType } from './state';

export type TaskType = 'binary-classification' | 'multiclass-classification' | 'regression';
export type DatasetDomain =
	| 'biology'
	| 'healthcare'
	| 'finance'
	| 'criminal-justice'
	| 'social-science'
	| 'marketing';
export type SpdxLicense = 'CC0-1.0' | 'CC-BY-4.0' | 'PDDL-1.0' | 'ODbL-1.0';
/** SPDX no-assertion marker, allowed only for remote datasets that are not redistributed. */
export type DatasetLicense = SpdxLicense | 'NOASSERTION';

/** Commit-pinned upstream CSV fetched on demand instead of being bundled. */
export interface RemoteCsvSource {
	url: string;
	sha256: string;
	byteLength: number;
}

export interface AuthoredColumn {
	name: string;
	displayName: string;
	description: string;
	dataType: ColumnType;
	role: 'feature' | 'identifier';
	sensitive?: boolean;
	unit?: string;
	implicitMissingValues?: (string | number)[];
	valueLabels?: Record<string, string>;
}

export interface TargetCandidate {
	column: string;
	taskType: TaskType;
	positiveClass?: string;
	description: string;
	leakyColumns?: { column: string; reason: string }[];
}

export interface DatasetReference {
	title: string;
	authors?: string[];
	year?: number;
	type: 'seminal-paper' | 'fairness-audit' | 'article' | 'documentation';
	url: string;
	citation?: string;
}

export interface AuthoredDatasetDescriptor {
	id: string;
	name: string;
	tagline: string;
	description: string;
	domain: DatasetDomain;
	difficulty: 'beginner' | 'intermediate' | 'advanced';
	tags: string[];
	missingValueTokens?: string[];
	remoteSource?: RemoteCsvSource;
	modeling: { defaultTarget: string; targetCandidates: TargetCandidate[] };
	columns: AuthoredColumn[];
	provenance: {
		homepageUrl: string;
		sourceRepositoryUrl: string;
		retrievedAt: string;
		license: DatasetLicense;
		licenseUrl: string;
		attribution: string;
		yearPublished: number;
		creators: string[];
		transformations: string[];
	};
	references: DatasetReference[];
	ethicsWarnings?: string[];
}

export interface ComputedDatasetStats {
	rowCount: number;
	columnCount: number;
	fileSizeBytes: number;
	sha256: string;
	hasMissingValues: boolean;
	defaultTargetDistribution?: Record<string, number>;
}

export interface SampleDatasetDescriptor extends Omit<AuthoredDatasetDescriptor, 'columns'> {
	columns: (AuthoredColumn & { missingCount: number })[];
	stats: ComputedDatasetStats;
	files: { csv: string; datasheet: string; csvOrigin: 'bundled' | 'remote' };
}

export interface SampleDatasetSummary {
	id: string;
	name: string;
	tagline: string;
	domain: DatasetDomain;
	difficulty: 'beginner' | 'intermediate' | 'advanced';
	tags: string[];
	taskTypes: TaskType[];
	license: DatasetLicense;
	csvOrigin: 'bundled' | 'remote';
	stats: ComputedDatasetStats;
	descriptorUrl: string;
}

/** The catalogue fetched from `/datasets/index.json`. */
export interface SampleDatasetIndex {
	version: 1;
	entries: SampleDatasetSummary[];
}
