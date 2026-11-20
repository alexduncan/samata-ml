import { installTrainingWorker, type TrainingWorkerScope } from './training-worker';

declare const WEB_ML_RUNTIME_URL: string;
declare const WEB_ML_RUNTIME_REVISION: string;

installTrainingWorker(
	self as unknown as TrainingWorkerScope,
	() => import(WEB_ML_RUNTIME_URL),
	WEB_ML_RUNTIME_REVISION
);
