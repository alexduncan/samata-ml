import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import { expect } from 'storybook/test';
import { MODEL_COLORS } from '../types/state';
import { modelSwatchStyles } from './model-swatch.styles';

function luminance(channels: number[]): number {
	const [red, green, blue] = channels.map((value) => {
		const normalized = value / 255;
		return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

function contrast(foreground: string, background: string): number {
	const light = (value: string) => luminance(value.match(/[\d.]+/g)!.map(Number));
	const a = light(foreground);
	const b = light(background);
	return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const meta = {
	title: 'Styles/Model swatches',
	args: { rtl: false },
	beforeEach: () => {
		const previous = document.adoptedStyleSheets;
		const sheet = modelSwatchStyles.styleSheet;
		if (sheet) document.adoptedStyleSheets = [...previous, sheet];
		return () => {
			document.adoptedStyleSheets = previous;
		};
	},
	render: ({ rtl }: { rtl: boolean }) => html`
		<ul dir=${rtl ? 'rtl' : 'ltr'}>
			${MODEL_COLORS.map(
				(colour, index) => html`
					<li>
						<span class="swatch swatch-${colour}">${index + 1}</span>
						<span class="swatch swatch-large swatch-${colour}">${index + 1}</span>
						${rtl ? 'نمونهٔ یک نام طولانی برای مدل آموزش‌دیده' : 'Model name'}
					</li>
				`
			)}
		</ul>
	`
} satisfies Meta<{ rtl: boolean }>;
export default meta;
type Story = StoryObj<{ rtl: boolean }>;

/** Each numbered swatch meets normal-text contrast in both sizes. */
export const AllFills: Story = {
	args: { rtl: false },
	play: ({ canvasElement }) => {
		const swatches = canvasElement.querySelectorAll('.swatch');
		expect(swatches).toHaveLength(MODEL_COLORS.length * 2);
		for (const swatch of swatches) {
			const style = getComputedStyle(swatch);
			expect(contrast(style.color, style.backgroundColor)).toBeGreaterThanOrEqual(4.5);
		}
	}
};

/** The numbered swatches precede long labels in a right-to-left layout. */
export const LongLabelsRTL: Story = { args: { rtl: true } };
