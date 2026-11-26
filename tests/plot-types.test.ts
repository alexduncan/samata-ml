import { expect, test } from 'bun:test';
import * as Plot from '@observablehq/plot';

function invalidPlotTypes(): void {
	// @ts-expect-error Plot does not export this member.
	Plot.notAPlotFunction();
	// @ts-expect-error A number is not a Plot function.
	const plot: typeof Plot.plot = 1;
	void plot;
}
void invalidPlotTypes;

test('CHT-FOUND-4: Plot runtime exports remain available', () => {
	expect(typeof Plot.plot).toBe('function');
});
