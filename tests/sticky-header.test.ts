import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { observeStickyHeader } from '../src/common/sticky-header';

type Callback = (entries: ResizeObserverEntry[]) => void;

interface FakeObserver {
	readonly callback: Callback;
	readonly target: Element | null;
	disconnected: boolean;
}

const globals = globalThis as unknown as {
	ResizeObserver: unknown;
};
const windowStub = window as unknown as { matchMedia: unknown };

let observers: FakeObserver[] = [];
let shortViewport = false;
let mediaListeners: Array<() => void> = [];
let originalObserver: unknown;
let originalMatchMedia: unknown;

function installStubs(): void {
	observers = [];
	mediaListeners = [];
	shortViewport = false;
	originalObserver = globals.ResizeObserver;
	originalMatchMedia = windowStub.matchMedia;
	globals.ResizeObserver = class {
		private readonly record: FakeObserver;
		constructor(callback: Callback) {
			this.record = { callback, target: null, disconnected: false };
			observers.push(this.record);
		}
		observe(target: Element): void {
			(this.record as { target: Element | null }).target = target;
		}
		disconnect(): void {
			this.record.disconnected = true;
		}
	};
	windowStub.matchMedia = () => ({
		get matches() {
			return shortViewport;
		},
		addEventListener: (_type: string, listener: () => void) => mediaListeners.push(listener),
		removeEventListener: (_type: string, listener: () => void) => {
			mediaListeners = mediaListeners.filter((item) => item !== listener);
		}
	});
}

function makeHeader(height: number): HTMLElement {
	const header = document.createElement('header');
	header.getBoundingClientRect = () => ({ height }) as DOMRect;
	return header;
}

function resize(observer: FakeObserver, blockSize: number): void {
	observer.callback([
		{ borderBoxSize: [{ blockSize, inlineSize: 0 }] } as unknown as ResizeObserverEntry
	]);
}

function property(): string {
	return document.documentElement.style.getPropertyValue('--page-header-block-size');
}

describe('observeStickyHeader (STICKY-HDR-1)', () => {
	beforeEach(installStubs);
	afterEach(() => {
		globals.ResizeObserver = originalObserver;
		windowStub.matchMedia = originalMatchMedia;
		document.documentElement.style.removeProperty('--page-header-block-size');
	});

	test('writes the observed block size and reports it to the callback', () => {
		const sizes: number[] = [];
		const dispose = observeStickyHeader(makeHeader(96), {
			onBlockSize: (px) => sizes.push(px)
		});
		expect(property()).toBe('96px');
		resize(observers[0]!, 120);
		expect(property()).toBe('120px');
		expect(sizes).toEqual([96, 120]);
		dispose();
	});

	test('writes 0px while the short-viewport query matches and recovers when it stops', () => {
		const dispose = observeStickyHeader(makeHeader(96));
		shortViewport = true;
		for (const listener of mediaListeners) listener();
		expect(property()).toBe('0px');
		resize(observers[0]!, 130);
		expect(property()).toBe('0px');
		shortViewport = false;
		for (const listener of mediaListeners) listener();
		expect(property()).toBe('96px');
		dispose();
	});

	test('dispose stops observing and resets to 0px when still the owner', () => {
		const dispose = observeStickyHeader(makeHeader(80));
		expect(property()).toBe('80px');
		dispose();
		expect(observers[0]!.disconnected).toBe(true);
		expect(mediaListeners).toHaveLength(0);
		expect(property()).toBe('0px');
	});

	test('a later observation keeps its value when the first is disposed', () => {
		const first = observeStickyHeader(makeHeader(80));
		const second = observeStickyHeader(makeHeader(64));
		expect(property()).toBe('64px');
		resize(observers[0]!, 90);
		expect(property()).toBe('64px');
		first();
		expect(property()).toBe('64px');
		second();
		expect(property()).toBe('0px');
	});
});
