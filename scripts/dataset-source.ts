import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import Papa from 'papaparse';
import { unzipSync } from 'fflate';
import type {
	AuthoredDatasetDescriptor,
	BuildCsvSource,
	RemoteCsvSource
} from '../src/types/sample-dataset';

type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
const buildUrls = new Set([
	'https://archive.ics.uci.edu/ml/machine-learning-databases/adult/adult.data',
	'https://archive.ics.uci.edu/ml/machine-learning-databases/00222/bank.zip',
	'https://archive.ics.uci.edu/static/public/17/data.csv',
	'https://www.openml.org/data/get_csv/31/credit-g.csv',
	'https://archive.ics.uci.edu/static/public/45/data.csv',
	'https://archive.ics.uci.edu/static/public/53/data.csv',
	'https://archive.ics.uci.edu/static/public/697/data.csv',
	'https://raw.githubusercontent.com/vincentarelbundock/Rdatasets/cc03c29690889dbe83089f5206e2422db8c3f71f/csv/datasets/Titanic.csv'
]);
const directUrls = new Set([
	'https://raw.githubusercontent.com/propublica/compas-analysis/bafff5da3f2e45eca6c2d5055faad269defd135a/compas-scores-two-years.csv',
	'https://raw.githubusercontent.com/allisonhorst/palmerpenguins/156daa4301838d9fdcc5b018b29b9149bf975552/inst/extdata/penguins.csv',
	'https://huggingface.co/datasets/scikit-learn/credit-card-clients/resolve/f809522649eaf948ad40a11ed575c4bb4d4460c1/UCI_Credit_Card.csv'
]);
const transforms = new Set([
	'identity',
	'adult-training',
	'bank-full-zip',
	'german-credit-quotes',
	'strip-utf8-bom',
	'titanic-inquiry-counts'
]);
const digest = (bytes: Uint8Array) => new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
/** Validate the source metadata before any network access. */
export function validateSource(
	id: string,
	source: RemoteCsvSource | BuildCsvSource,
	build: boolean
): void {
	if (
		!/^[a-f0-9]{64}$/.test(source.sha256) ||
		!Number.isSafeInteger(source.byteLength) ||
		source.byteLength <= 0
	)
		throw new Error('invalid source digest or length');
	if (build) {
		const spec = source as BuildCsvSource;
		if (
			!buildUrls.has(source.url) ||
			!transforms.has(spec.transform) ||
			!/^[a-f0-9]{64}$/.test(spec.outputSha256) ||
			!Number.isSafeInteger(spec.outputByteLength) ||
			spec.outputByteLength <= 0
		)
			throw new Error('invalid buildSource URL, transform, digest or length');
	} else if (!directUrls.has(source.url))
		throw new Error('remoteSource URL is outside REMOTE_CSV_PREFIXES');
}
function verify(id: string, bytes: Uint8Array, expectedHash: string, expectedLength: number): void {
	const hash = digest(bytes);
	if (bytes.byteLength !== expectedLength)
		throw new Error(
			`${id}: byte length mismatch (expected ${expectedLength}, got ${bytes.byteLength}); expected SHA-256 ${expectedHash}`
		);
	if (hash !== expectedHash)
		throw new Error(`${id}: SHA-256 mismatch (expected ${expectedHash}, got ${hash})`);
}
function allowedFinal(source: string, final: string): boolean {
	if (!final) return true;
	const a = new URL(source),
		b = new URL(final);
	if (a.origin === b.origin && a.pathname === b.pathname) return true;
	return (
		source ===
			'https://huggingface.co/datasets/scikit-learn/credit-card-clients/resolve/f809522649eaf948ad40a11ed575c4bb4d4460c1/UCI_Credit_Card.csv' &&
		b.origin === a.origin &&
		b.pathname ===
			'/api/resolve-cache/datasets/scikit-learn/credit-card-clients/f809522649eaf948ad40a11ed575c4bb4d4460c1/UCI_Credit_Card.csv'
	);
}
/** Acquire pinned bytes, verifying cache and bounded response before atomic publication. */
export async function acquireSource(
	id: string,
	source: RemoteCsvSource,
	cacheDir: string,
	fetchImpl: FetchImpl
): Promise<Uint8Array> {
	const cachePath = path.join(cacheDir, `${source.sha256}.csv`);
	let cached: Uint8Array | undefined;
	try {
		cached = await readFile(cachePath);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
	}
	if (cached) {
		verify(`${id}: ${source.url}`, cached, source.sha256, source.byteLength);
		return cached;
	}
	let response: Response;
	try {
		response = await fetchImpl(source.url, { redirect: 'manual' });
		if (response.status >= 300 && response.status < 400) {
			const location = response.headers.get('location');
			if (!location) throw new Error('redirect missing location');
			const target = new URL(location, source.url).href;
			if (
				!allowedFinal(source.url, target) ||
				new URL(target).pathname === new URL(source.url).pathname
			)
				throw new Error('unexpected redirect');
			response = await fetchImpl(target, { redirect: 'manual' });
			if (
				(response.status >= 300 && response.status < 400) ||
				(response.url && !allowedFinal(source.url, response.url))
			)
				throw new Error('unexpected redirect');
		}
	} catch (error) {
		throw new Error(
			`${id}: could not download ${source.url}; the first build needs network access (${String(error)})`
		);
	}
	if (!response.ok)
		throw new Error(
			`${id}: could not download ${source.url}; the first build needs network access (HTTP ${response.status})`
		);
	if (!allowedFinal(source.url, response.url))
		throw new Error(`${id}: unexpected redirect from ${source.url} to ${response.url}`);
	const reader = response.body?.getReader();
	if (!reader) throw new Error(`${id}: empty response body`);
	const chunks: Uint8Array[] = [];
	let length = 0;
	try {
		for (;;) {
			const part = await reader.read();
			if (part.done) break;
			length += part.value.byteLength;
			if (length > source.byteLength) {
				await reader.cancel();
				throw new Error(
					`${id}: ${source.url} byte length mismatch (expected ${source.byteLength}, got more)`
				);
			}
			chunks.push(part.value);
		}
	} finally {
		reader.releaseLock();
	}
	const bytes = new Uint8Array(length);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.length;
	}
	verify(`${id}: ${source.url}`, bytes, source.sha256, source.byteLength);
	await mkdir(cacheDir, { recursive: true });
	const temp = `${cachePath}.${crypto.randomUUID()}.tmp`;
	try {
		await writeFile(temp, bytes, { flag: 'wx' });
		await rename(temp, cachePath);
	} finally {
		await unlink(temp).catch(() => {});
	}
	return bytes;
}
/** Prepare pinned build inputs without altering modelling data. */
export function prepareSource(
	id: string,
	bytes: Uint8Array,
	descriptor: AuthoredDatasetDescriptor
): Uint8Array {
	const source = descriptor.buildSource!;
	let output: Uint8Array;
	const enc = new TextEncoder();
	const dec = new TextDecoder('utf-8', { fatal: true });
	switch (source.transform) {
		case 'identity':
			output = bytes;
			break;
		case 'strip-utf8-bom':
			if (bytes[0] !== 0xef || bytes[1] !== 0xbb || bytes[2] !== 0xbf)
				throw new Error(`${id}: missing UTF-8 BOM`);
			output = bytes.slice(3);
			break;
		case 'bank-full-zip': {
			let found = 0;
			const files = unzipSync(bytes, {
				filter: (file) => {
					if (file.name !== 'bank-full.csv') return false;
					found++;
					if (file.originalSize !== source.outputByteLength)
						throw new Error('unexpected archive member size');
					return true;
				}
			});
			if (found !== 1 || !files['bank-full.csv'])
				throw new Error('missing or duplicate bank-full.csv');
			output = files['bank-full.csv'];
			break;
		}
		case 'adult-training': {
			const parsed = Papa.parse<string[]>(dec.decode(bytes), { skipEmptyLines: 'greedy' });
			if (parsed.errors.length) throw new Error('invalid adult CSV');
			output = enc.encode(
				Papa.unparse(
					[
						descriptor.columns.map((c) => c.name),
						...parsed.data.map((row) => row.map((cell) => cell.trim()))
					],
					{ newline: '\r\n' }
				) + '\r\n'
			);
			break;
		}
		case 'german-credit-quotes': {
			const parsed = Papa.parse<string[]>(dec.decode(bytes), { skipEmptyLines: 'greedy' });
			if (parsed.errors.length) throw new Error('invalid german CSV');
			output = enc.encode(
				Papa.unparse(
					parsed.data.map((row, i) =>
						i
							? row.map((cell) =>
									cell.startsWith("'") && cell.endsWith("'")
										? cell.slice(1, -1)
										: cell
								)
							: row
					),
					{ newline: '\r\n' }
				) + '\r\n'
			);
			break;
		}
		case 'titanic-inquiry-counts': {
			const parsed = Papa.parse<string[]>(dec.decode(bytes), { skipEmptyLines: 'greedy' });
			if (
				parsed.errors.length ||
				parsed.data[0]?.join(',') !== 'rownames,Class,Sex,Age,Survived,Freq' ||
				parsed.data.length !== 33
			)
				throw new Error('invalid Titanic counts header or rows');
			const seen = new Set<string>();
			const totals = new Map<string, number>();
			const survivors = new Map<string, number>();
			const rows = ['passenger_class,sex,age_group,survived'];
			let total = 0;
			for (const row of parsed.data.slice(1)) {
				const [, cls, sex, age, survived, count] = row;
				const key = [cls, sex, age, survived].join(',');
				if (
					row.length !== 6 ||
					!['1st', '2nd', '3rd', 'Crew'].includes(cls!) ||
					!['Male', 'Female'].includes(sex!) ||
					!['Child', 'Adult'].includes(age!) ||
					!['No', 'Yes'].includes(survived!) ||
					!/^(0|[1-9][0-9]*)$/.test(count!) ||
					seen.has(key)
				)
					throw new Error('invalid Titanic count cell');
				seen.add(key);
				const n = Number(count);
				if (!Number.isSafeInteger(n) || n > 2201) throw new Error('invalid Titanic count');
				total += n;
				totals.set(cls!, (totals.get(cls!) ?? 0) + n);
				if (survived === 'Yes') survivors.set(cls!, (survivors.get(cls!) ?? 0) + n);
			}
			if (
				total !== 2201 ||
				['1st', '2nd', '3rd', 'Crew'].some(
					(c, i) =>
						totals.get(c) !== [325, 285, 706, 885][i] ||
						survivors.get(c) !== [203, 118, 178, 212][i]
				)
			)
				throw new Error('invalid Titanic totals');
			for (const [, cls, sex, age, survived, count] of parsed.data.slice(1))
				for (let i = 0; i < Number(count); i++)
					rows.push(
						`${cls},${sex!.toLowerCase()},${age!.toLowerCase()},${survived === 'Yes' ? '1' : '0'}`
					);
			output = enc.encode(rows.join('\n') + '\n');
			break;
		}
		default:
			throw new Error('invalid transform');
	}
	verify(id, output, source.outputSha256, source.outputByteLength);
	return output;
}
