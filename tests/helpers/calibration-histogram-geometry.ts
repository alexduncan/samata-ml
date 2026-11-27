import { expect, type Locator } from '@playwright/test';

/** Check rendered histogram ticks after enlargement and resize. */
export async function expectHistogramTicksToFit(
	histogram: Locator,
	expectedCounts?: readonly string[]
): Promise<void> {
	await expect
		.poll(() =>
			histogram.evaluate((svg) => {
				const frame = svg.getBoundingClientRect();
				const labels = Array.from(svg.querySelectorAll('text'), (text) => ({
					label: text.textContent?.trim() ?? '',
					bounds: text.getBoundingClientRect()
				}));
				const counts = labels.filter(({ label }) => /^\d[\d,]*$/.test(label));
				// The x-axis labels are percentages, so only y ticks contribute to count spacing.
				const overlaps = counts.flatMap((a, index) =>
					counts.slice(index + 1).flatMap((b) => {
						const verticalOverlap =
							Math.min(a.bounds.bottom, b.bounds.bottom) -
							Math.max(a.bounds.top, b.bounds.top);
						return verticalOverlap > 1 ? [`${a.label} / ${b.label}`] : [];
					})
				);
				return {
					ready:
						counts.length > 1 &&
						Number(svg.getAttribute('width')) ===
							Math.min(svg.parentElement!.clientWidth, 420) &&
						Number.parseFloat(getComputedStyle(svg).fontSize) >= 24,
					counts: counts.map(({ label }) => label),
					clipped: labels
						.filter(
							({ bounds }) =>
								bounds.left < frame.left - 1 ||
								bounds.right > frame.right + 1 ||
								bounds.top < frame.top - 1 ||
								bounds.bottom > frame.bottom + 1
						)
						.map(({ label }) => label),
					overlaps
				};
			})
		)
		.toMatchObject({
			ready: true,
			clipped: [],
			overlaps: [],
			...(expectedCounts ? { counts: expectedCounts } : {})
		});
}
