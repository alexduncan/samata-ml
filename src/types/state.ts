export interface PipelineState {
	csvData: any[] | null;
	headers: string[];
	targetColumn: string | null;
	selectedFeatures: string[];
	preprocessing: {
		imputeMissing: boolean;
		scaleFeatures: boolean;
	};
	modelType: string | null;
	hyperparameters: Record<string, any>;
	isTraining: boolean;
	results: any | null;
}

export const appState: PipelineState = {
	csvData: null,
	headers: [],
	targetColumn: null,
	selectedFeatures: [],
	preprocessing: { imputeMissing: true, scaleFeatures: true },
	modelType: null,
	hyperparameters: {},
	isTraining: false,
	results: null
};
