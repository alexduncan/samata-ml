type Callback<Value> = (lock: Lock | null) => Value | PromiseLike<Value>;
type Waiting = { name: string; mode: LockMode; start(): void };

/** Implements the shared, exclusive and non-waiting lock cases exercised by service races. */
export function createTrainingTestLocks(): LockManager {
	const held: Lock[] = [];
	const waiting: Waiting[] = [];
	const available = (name: string, mode: LockMode) =>
		held.every((lock) => lock.name !== name || (mode === 'shared' && lock.mode === 'shared'));

	function advance(): void {
		for (let index = 0; index < waiting.length; ) {
			const next = waiting[index]!;
			if (
				available(next.name, next.mode) &&
				!waiting.slice(0, index).some((entry) => entry.name === next.name)
			) {
				waiting.splice(index, 1);
				next.start();
			} else index++;
		}
	}

	function request<Value>(name: string, callback: Callback<Value>): Promise<Value>;
	function request<Value>(
		name: string,
		options: LockOptions,
		callback: Callback<Value>
	): Promise<Value>;
	function request<Value>(
		name: string,
		optionsOrCallback: LockOptions | Callback<Value>,
		handler?: Callback<Value>
	): Promise<Value> {
		const options = typeof optionsOrCallback === 'function' ? {} : optionsOrCallback;
		const callback = typeof optionsOrCallback === 'function' ? optionsOrCallback : handler!;
		const mode = options.mode ?? 'exclusive';
		return new Promise<Value>((resolve, reject) => {
			const entry = {
				name,
				mode,
				start() {
					const lock = { name, mode };
					held.push(lock);
					void Promise.resolve()
						.then(() => callback(lock))
						.then(
							(value) => {
								released();
								resolve(value);
							},
							(error: unknown) => {
								released();
								reject(error);
							}
						);
					function released(): void {
						held.splice(held.indexOf(lock), 1);
						advance();
					}
				}
			};
			if (available(name, mode) && !waiting.some((candidate) => candidate.name === name))
				entry.start();
			else if (options.ifAvailable)
				void Promise.resolve()
					.then(() => callback(null))
					.then(resolve, reject);
			else waiting.push(entry);
		});
	}

	return {
		request,
		async query() {
			return {
				held: held.map(({ name, mode }) => ({ name, mode, clientId: 'fixture' })),
				pending: waiting.map(({ name, mode }) => ({ name, mode, clientId: 'fixture' }))
			};
		}
	};
}
