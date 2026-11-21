import type { ReactiveController, ReactiveControllerHost } from 'lit';
import * as Plot from '@observablehq/plot';

/** The nine chart token names defined in `css/root.css`. */
export const CHART_TOKEN_NAMES = [
	'--chart-1',
	'--chart-2',
	'--chart-3',
	'--chart-4',
	'--chart-5',
	'--chart-6',
	'--chart-neutral',
	'--chart-axis',
	'--chart-grid'
] as const;

/** Name of a chart token. */
export type ChartTokenName = (typeof CHART_TOKEN_NAMES)[number];

/** Chart token values resolved from the host's computed style. */
export type ChartTokens = Readonly<Record<ChartTokenName, string>>;

/** The subset of Observable Plot that chart renderers may use. */
export type ChartLibrary = Pick<
	typeof Plot,
	'plot' | 'barX' | 'dot' | 'rectY' | 'lineY' | 'ruleX' | 'ruleY' | 'text'
>;

/** Builds a detached chart for the measured content width, or null when there is nothing to draw. */
export type PlotRenderer = (
	chart: ChartLibrary,
	tokens: ChartTokens,
	width: number
) => SVGSVGElement | HTMLElement | null;

/** Host that owns the chart wrapper. */
export type PlotHost = ReactiveControllerHost & HTMLElement;

/**
 * Renders an Observable Plot chart into a stable wrapper element inside the host's shadow root.
 *
 * Resizes are coalesced to one animation frame and deduplicated by width. A disconnected or
 * hidden host settles without rendering, so `whenSettled()` never waits on an invisible chart.
 */
export class PlotController implements ReactiveController {
	private readonly host: PlotHost;
	private readonly getContainer: () => HTMLElement | null;
	private readonly render: PlotRenderer;
	private observer: ResizeObserver | null = null;
	private observed: HTMLElement | null = null;
	private frame = 0;
	private pending = false;
	private waiters: (() => void)[] = [];
	private renderedWidth = -1;

	constructor(host: PlotHost, getContainer: () => HTMLElement | null, render: PlotRenderer) {
		this.host = host;
		this.getContainer = getContainer;
		this.render = render;
		host.addController(this);
	}

	/** Resolves once the pending render, if any, has completed or been abandoned. */
	whenSettled(): Promise<void> {
		if (!this.pending) return Promise.resolve();
		return new Promise((resolve) => this.waiters.push(resolve));
	}

	hostConnected(): void {
		this.observer = new ResizeObserver(() => {
			if (this.measure() !== this.renderedWidth) this.schedule();
		});
		this.schedule();
	}

	hostUpdated(): void {
		const container = this.getContainer();
		if (container !== this.observed) {
			if (this.observed) this.observer?.unobserve(this.observed);
			this.observed = container;
			if (container) this.observer?.observe(container);
		}
		// Data may have changed even when the width did not.
		this.schedule();
	}

	hostDisconnected(): void {
		this.observer?.disconnect();
		this.observer = null;
		this.observed = null;
		if (this.frame) cancelAnimationFrame(this.frame);
		this.frame = 0;
		this.renderedWidth = -1;
		this.settle();
	}

	private measure(): number {
		return this.getContainer()?.clientWidth ?? 0;
	}

	private schedule(): void {
		if (!this.host.isConnected) {
			this.settle();
			return;
		}
		this.pending = true;
		if (this.frame) return;
		this.frame = requestAnimationFrame(() => {
			this.frame = 0;
			this.draw();
		});
	}

	private draw(): void {
		const container = this.getContainer();
		const width = this.measure();
		if (!this.host.isConnected || !container || width === 0) {
			this.settle();
			return;
		}
		try {
			const chart = this.render(Plot, this.resolveTokens(), width);
			if (chart) {
				this.normalise(chart);
				chart.style.fontFamily = 'inherit';
				chart.style.maxInlineSize = '100%';
				container.replaceChildren(chart);
			} else {
				container.replaceChildren();
			}
			this.renderedWidth = width;
		} finally {
			this.settle();
		}
	}

	/**
	 * Presents the chart as one image named by the caller's `ariaLabel`. Plot labels each mark
	 * group, which assistive technology cannot use on plain groups (and axe rejects); the
	 * native data table carries the detail instead.
	 */
	private normalise(chart: SVGSVGElement | HTMLElement): void {
		const root = chart instanceof SVGSVGElement ? chart : chart.querySelector('svg');
		if (!root) return;
		for (const node of root.querySelectorAll('[aria-label]'))
			node.removeAttribute('aria-label');
		if (root.hasAttribute('aria-label')) root.setAttribute('role', 'img');
	}

	private resolveTokens(): ChartTokens {
		const style = getComputedStyle(this.host);
		const tokens = {} as Record<ChartTokenName, string>;
		for (const name of CHART_TOKEN_NAMES) tokens[name] = style.getPropertyValue(name).trim();
		return tokens;
	}

	private settle(): void {
		this.pending = false;
		const waiters = this.waiters;
		this.waiters = [];
		for (const resolve of waiters) resolve();
	}
}
