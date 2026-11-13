import { installWorkerHandler } from './worker-handler';

installWorkerHandler(self as unknown as Parameters<typeof installWorkerHandler>[0]);
