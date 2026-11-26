import type { ReactiveController, ReactiveControllerHost } from 'lit';
import * as Plot from '@observablehq/plot';

/** Chart and model palette token names defined in `css/root.css`. */
export const CHART_TOKEN_NAMES = [
	'--chart-1',
	'--chart-2',
	'--chart-3',
	'--chart-4',
	'--chart-5',
	'--chart-6',
	'--chart-neutral',
	'--chart-axis',
	'--chart-grid',
	'--surface',
	'--stone-50',
	'--stone-900',
	'--model-swatch-ink',
	'--amber-500',
	'--blue-700',
	'--teal-700',
	'--purple-700',
	'--red-700',
	'--green-800',
	'--pink-700',
	'--sky-600',
	'--olive-700',
	'--neutral-600'
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
	width: number,
	fontSizePx: number,
	measureText: (text: string) => number
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
	private readonly getDescribedBy?: () => string | null;
	private observer: ResizeObserver | null = null;
	private observed: HTMLElement | null = null;
	private sizeProbe: HTMLElement | null = null;
	private textProbe: SVGSVGElement | null = null;
	private renderedProbeWidth = -1;
	private frame = 0;
	private pending = false;
	private waiters: (() => void)[] = [];
	private renderedWidth = -1;

	constructor(
		host: PlotHost,
		getContainer: () => HTMLElement | null,
		render: PlotRenderer,
		getDescribedBy?: () => string | null
	) {
		this.host = host;
		this.getContainer = getContainer;
		this.render = render;
		this.getDescribedBy = getDescribedBy;
		host.addController(this);
	}

	/** Resolves once the pending render, if any, has completed or been abandoned. */
	whenSettled(): Promise<void> {
		if (!this.pending) return Promise.resolve();
		return new Promise((resolve) => this.waiters.push(resolve));
	}

	hostConnected(): void {
		this.observer = new ResizeObserver(() => {
			if (
				this.measure() !== this.renderedWidth ||
				(this.sizeProbe?.clientWidth ?? 0) !== this.renderedProbeWidth
			)
				this.schedule();
		});
		document.fonts.addEventListener('loadingdone', this.onFontsLoaded);
		this.schedule();
	}

	hostUpdated(): void {
		const container = this.getContainer();
		if (container !== this.observed) {
			if (this.observed) this.observer?.unobserve(this.observed);
			this.removeProbes();
			this.observed = container;
			if (container) {
				this.observer?.observe(container);
				this.createProbes(container);
			}
		}
		// Data may have changed even when the width did not.
		this.schedule();
	}

	hostDisconnected(): void {
		document.fonts.removeEventListener('loadingdone', this.onFontsLoaded);
		this.observer?.disconnect();
		this.observer = null;
		this.observed = null;
		this.removeProbes();
		this.renderedProbeWidth = -1;
		if (this.frame) cancelAnimationFrame(this.frame);
		this.frame = 0;
		this.renderedWidth = -1;
		this.settle();
	}

	private measure(): number {
		return this.getContainer()?.clientWidth ?? 0;
	}

	private readonly onFontsLoaded = (): void => this.schedule();

	private createProbes(container: HTMLElement): void {
		const size = document.createElement('span');
		size.dataset.plotProbe = '';
		Object.assign(size.style, {
			inlineSize: '1rem',
			blockSize: '0',
			position: 'absolute',
			visibility: 'hidden',
			pointerEvents: 'none'
		});
		container.append(size);
		this.sizeProbe = size;
		this.observer?.observe(size);
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('data-plot-probe', '');
		const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
		Object.assign(svg.style, {
			position: 'absolute',
			visibility: 'hidden',
			pointerEvents: 'none',
			fontFamily: 'inherit',
			fontSize: 'max(12px, 0.75rem)'
		});
		svg.setAttribute('aria-hidden', 'true');
		svg.append(text);
		container.append(svg);
		this.textProbe = svg;
	}

	private removeProbes(): void {
		if (this.sizeProbe) this.observer?.unobserve(this.sizeProbe);
		this.sizeProbe?.remove();
		this.textProbe?.remove();
		this.sizeProbe = null;
		this.textProbe = null;
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
			if (!this.textProbe) this.createProbes(container);
			const textProbe = this.textProbe!.querySelector('text')!;
			const measureText = (text: string): number => {
				textProbe.textContent = text;
				return textProbe.getComputedTextLength();
			};
			const chart = this.render(
				Plot,
				this.resolveTokens(),
				width,
				parseFloat(getComputedStyle(this.host).fontSize) || 16,
				measureText
			);
			if (chart) {
				this.normalise(chart);
				chart.style.fontFamily = 'inherit';
				chart.style.maxInlineSize = '100%';
				chart.style.fontSize = 'max(12px, 0.75rem)';
				for (const child of [...container.children])
					if (child !== this.sizeProbe && child !== this.textProbe) child.remove();
				container.prepend(chart);
			} else {
				for (const child of [...container.children])
					if (child !== this.sizeProbe && child !== this.textProbe) child.remove();
			}
			this.renderedWidth = width;
			this.renderedProbeWidth = this.sizeProbe?.clientWidth ?? 0;
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
		const description = this.getDescribedBy?.();
		if (description) root.setAttribute('aria-describedby', description);
		for (const node of root.querySelectorAll('[aria-label]'))
			node.removeAttribute('aria-label');
		for (const group of root.querySelectorAll('g')) group.setAttribute('aria-hidden', 'true');
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
