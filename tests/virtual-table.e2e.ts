import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

interface FixtureColumn {
	key: string;
	label: string;
	sublabel?: string;
	kind?: string;
	unsupported?: boolean;
	contentChars?: number;
}

interface MountOptions {
	id: string;
	totalRows: number;
	columns?: FixtureColumn[];
	/** Answers range requests with generated `Cell {column}-{index}` rows. */
	respond?: boolean;
}

/** Appends a table to the document body (below the app) and wires optional generated data. */
async function mountTable(page: Page, options: MountOptions): Promise<void> {
	await page.evaluate((opts) => {
		const table = document.createElement('ui-virtual-table') as any;
		table.id = opts.id;
		// Clear the fixed sidebar so header buttons receive pointer events.
		table.style.marginInlineStart = '26rem';
		table.label = `Table ${opts.id}`;
		table.totalRows = opts.totalRows;
		table.columns = opts.columns ?? [
			{ key: 'c0', label: 'Column 0' },
			{ key: 'c1', label: 'Column 1' }
		];
		const keys: string[] = table.columns.map((column: { key: string }) => column.key);
		(window as any).__ranges = (window as any).__ranges ?? [];
		table.addEventListener('ui-virtual-table-range-change', (event: any) => {
			(window as any).__ranges.push(event.detail);
			if (!opts.respond) return;
			const { startIndex, limit } = event.detail;
			table.window = {
				startIndex,
				rows: Array.from({ length: limit }, (_, offset) =>
					keys.map((_key, column) => `Cell ${column}-${startIndex + offset}`)
				)
			};
		});
		document.body.append(table);
	}, options);
	await expect(page.locator(`#${options.id}`)).toBeVisible();
	await settle(page);
}

/** Waits for two animation frames so a scheduled table update and its follow-up have run. */
async function settle(page: Page): Promise<void> {
	await page.evaluate(
		() =>
			new Promise<void>((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
			)
	);
}

/** Row element and geometry facts read inside the page. */
async function geometry(page: Page, id: string) {
	return page.evaluate((tableId) => {
		const table = document.getElementById(tableId)!;
		const root = table.shadowRoot!;
		const body = root.querySelector<HTMLElement>('.table-body')!;
		const rows = [...root.querySelectorAll<HTMLElement>('.table-row')];
		const first = rows[0];
		const rowHeight = first
			? first.getBoundingClientRect().height
			: parseFloat(getComputedStyle(document.documentElement).fontSize) * 2;
		return {
			count: rows.length,
			rowHeight,
			bodyBlockSize: body.getBoundingClientRect().height,
			bodyTop: body.getBoundingClientRect().top + window.scrollY,
			visibleRows: Math.ceil(window.innerHeight / rowHeight) + 1,
			rowIndexes: rows.map((row) => Number(row.getAttribute('aria-rowindex'))),
			ariaRowCount: Number(
				root.querySelector('.table-container')!.getAttribute('aria-rowcount')
			),
			scrollHeight: document.documentElement.scrollHeight
		};
	}, id);
}

test.describe('Virtual Table Component (VTB-AC-1 .. VTB-AC-12)', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/data');
		const getStartedBtn = page.locator('app-welcome-modal button.btn-primary');
		try {
			await getStartedBtn.waitFor({ state: 'visible', timeout: 2000 });
			await getStartedBtn.click();
			await page
				.locator('app-welcome-modal dialog')
				.waitFor({ state: 'hidden', timeout: 2000 });
		} catch {
			// Already dismissed
		}
	});

	test('VTB-AC-1: pool stays within 3 × visibleRows + 1 at start, middle and end; last row renders', async ({
		page
	}) => {
		let index = 0;
		for (const totalRows of [0, 1, 150, 600_000, 10_000_000]) {
			const id = `vtb1-${index++}`;
			await mountTable(page, { id, totalRows, respond: true });
			const start = await geometry(page, id);
			const rendered = start.ariaRowCount - 1;
			expect(rendered).toBeLessThanOrEqual(totalRows);
			if (totalRows === 0) {
				expect(start.count).toBe(0);
				continue;
			}
			if (totalRows < 600_000) expect(rendered).toBe(totalRows);
			expect(start.count).toBeLessThanOrEqual(3 * start.visibleRows + 1);
			for (const fraction of [0, 0.5, 1]) {
				await page.evaluate(
					({ top, height, fraction }) =>
						window.scrollTo(0, top + height * fraction - window.innerHeight * fraction),
					{ top: start.bodyTop, height: start.bodyBlockSize, fraction }
				);
				await settle(page);
				const now = await geometry(page, id);
				expect(now.count).toBeLessThanOrEqual(3 * now.visibleRows + 1);
			}
			await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
			await settle(page);
			const end = await geometry(page, id);
			expect(end.rowIndexes).toContain(rendered + 1);
			await expect(
				page.locator(`#${id} .table-row[aria-rowindex="${rendered + 1}"]`)
			).toBeInViewport();
			await page.evaluate((tableId) => document.getElementById(tableId)!.remove(), id);
		}
	});

	test('VTB-AC-2: rail size, transforms, one-row recycling and ascending DOM order', async ({
		page
	}) => {
		await mountTable(page, { id: 'vtb2', totalRows: 5000, respond: true });
		const base = await geometry(page, 'vtb2');
		expect(Math.abs(base.bodyBlockSize - 5000 * base.rowHeight)).toBeLessThan(1);

		const transforms = () =>
			page.evaluate(() =>
				[
					...document.getElementById('vtb2')!.shadowRoot!.querySelectorAll('.table-row')
				].map((row) => {
					const matrix = new DOMMatrix(getComputedStyle(row).transform);
					return {
						index: Number(row.getAttribute('aria-rowindex')) - 2,
						translate: matrix.f
					};
				})
			);
		const assertAscending = async () => {
			const { rowIndexes } = await geometry(page, 'vtb2');
			expect(rowIndexes).toEqual([...rowIndexes].sort((a, b) => a - b));
			expect(new Set(rowIndexes).size).toBe(rowIndexes.length);
		};

		for (const { index, translate } of await transforms()) {
			expect(Math.abs(translate - index * base.rowHeight)).toBeLessThan(0.5);
		}

		// Move to the middle, then forward by exactly one row.
		await page.evaluate((top) => window.scrollTo(0, top), base.bodyTop + 2000 * base.rowHeight);
		await settle(page);
		await assertAscending();
		await page.evaluate(() => {
			const root = document.getElementById('vtb2')!.shadowRoot!;
			(window as any).__before = [...root.querySelectorAll('.table-row')].map((row) => ({
				row,
				index: row.getAttribute('aria-rowindex'),
				transform: (row as HTMLElement).style.transform
			}));
		});
		await page.evaluate((delta) => window.scrollBy(0, delta), base.rowHeight);
		await settle(page);
		const recycled = await page.evaluate(() => {
			const root = document.getElementById('vtb2')!.shadowRoot!;
			const before: { row: Element; index: string; transform: string }[] = (window as any)
				.__before;
			const after = [...root.querySelectorAll('.table-row')];
			const reused = before.filter(({ row }) => after.includes(row));
			const changed = reused.filter(
				({ row, index }) => row.getAttribute('aria-rowindex') !== index
			);
			const untouched = reused.filter(
				({ row, index, transform }) =>
					row.getAttribute('aria-rowindex') === index &&
					(row as HTMLElement).style.transform === transform
			);
			const positions = untouched.map(({ row }) => after.indexOf(row));
			return {
				added: after.filter((row) => !before.some((entry) => entry.row === row)).length,
				changed: changed.length,
				untouched: untouched.length,
				total: before.length,
				orderPreserved: positions.every(
					(position, step) => step === 0 || position > positions[step - 1]!
				)
			};
		});
		expect(recycled.added).toBe(0);
		expect(recycled.changed).toBe(1);
		expect(recycled.untouched).toBe(recycled.total - 1);
		expect(recycled.orderPreserved).toBe(true);
		await assertAscending();

		// Backwards, then a jump from the middle to the start and to the end.
		await page.evaluate((delta) => window.scrollBy(0, -delta * 3), base.rowHeight);
		await settle(page);
		await assertAscending();
		await page.evaluate(() => window.scrollTo(0, 0));
		await settle(page);
		await assertAscending();
		await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
		await settle(page);
		await assertAscending();

		const snapshot = await page.locator('#vtb2').ariaSnapshot();
		const cellNumbers = [...snapshot.matchAll(/Cell 0-(\d+)/g)].map((match) =>
			Number(match[1])
		);
		expect(cellNumbers.length).toBeGreaterThan(0);
		expect(cellNumbers).toEqual([...cellNumbers].sort((a, b) => a - b));
	});

	test('VTB-AC-3: ten synthetic scroll events schedule one frame and one row update', async ({
		page
	}) => {
		await mountTable(page, { id: 'vtb3', totalRows: 5000 });
		await page.evaluate(() => {
			const original = window.requestAnimationFrame.bind(window);
			(window as any).__frames = 0;
			window.requestAnimationFrame = (callback) => {
				(window as any).__frames++;
				return original(callback);
			};
			(window as any).__batches = 0;
			new MutationObserver(() => (window as any).__batches++).observe(
				document.getElementById('vtb3')!.shadowRoot!.querySelector('.table-body')!,
				{ childList: true, attributes: true, subtree: true, characterData: true }
			);
		});
		await settle(page);
		const framesBefore = await page.evaluate(() => (window as any).__frames);
		const batchesBefore = await page.evaluate(() => (window as any).__batches);
		const scheduled = await page.evaluate(() => {
			window.scrollTo(0, 3000);
			for (let count = 0; count < 10; count++) window.dispatchEvent(new Event('scroll'));
			return (window as any).__frames;
		});
		expect(scheduled - framesBefore).toBe(1);
		await settle(page);
		expect((await page.evaluate(() => (window as any).__batches)) - batchesBefore).toBe(1);
	});

	test('VTB-AC-3: range events deduplicate, stale windows are ignored and markup renders literally', async ({
		page
	}) => {
		await mountTable(page, { id: 'vtb3b', totalRows: 20_000 });
		const ranges = () => page.evaluate(() => (window as any).__ranges.length);
		await page.evaluate(() => ((window as any).__ranges.length = 0));
		await page.evaluate(() => window.scrollBy(0, 1));
		await settle(page);
		const afterJitter = await ranges();
		await page.evaluate(() => window.scrollBy(0, 1));
		await settle(page);
		expect(await ranges()).toBe(afterJitter);

		await page.evaluate(() => {
			const table = document.getElementById('vtb3b') as any;
			table.window = { startIndex: 15_000, rows: [['STALE_VALUE', 'x']] };
		});
		await settle(page);
		expect(await page.locator('#vtb3b').innerText()).not.toContain('STALE_VALUE');

		await page.evaluate(() => {
			const table = document.getElementById('vtb3b') as any;
			table.window = {
				startIndex: 0,
				rows: [['<script>alert(1)</script><b>Bold</b>', 'plain']]
			};
		});
		await settle(page);
		const cell = page.locator('#vtb3b .table-cell').first();
		await expect(cell).toContainText('<script>alert(1)</script><b>Bold</b>');
		expect(await cell.locator('b, script').count()).toBe(0);

		await page.evaluate(() => {
			(window as any).__selected = [];
			document
				.getElementById('vtb3b')!
				.addEventListener('ui-virtual-table-column-select', (event: any) =>
					(window as any).__selected.push(event.detail)
				);
		});
		await page.locator('#vtb3b button[data-col-key="c1"]').click();
		expect(await page.evaluate(() => (window as any).__selected)).toEqual([{ column: 'c1' }]);
	});

	test('VTB-AC-4: row limit follows the measured row height and aria-rowcount counts rendered rows', async ({
		page
	}) => {
		await page.evaluate(() => {
			(window as any).__limits = [];
			const table = document.createElement('ui-virtual-table') as any;
			table.id = 'vtb4';
			table.label = 'Limit';
			table.columns = [{ key: 'c0', label: 'Column 0' }];
			table.totalRows = 10_000_000;
			table.addEventListener('ui-virtual-table-row-limit-change', (event: any) =>
				(window as any).__limits.push(event.detail.rowLimit)
			);
			document.body.append(table);
		});
		await settle(page);
		const start = await geometry(page, 'vtb4');
		const limits = () => page.evaluate(() => (window as any).__limits as number[]);
		expect((await limits())[0]).toBe(Math.floor(16_000_000 / start.rowHeight));
		expect(start.ariaRowCount).toBe((await limits())[0]! + 1);

		await page.evaluate(() => (document.documentElement.style.fontSize = '32px'));
		await expect.poll(async () => (await limits()).length).toBeGreaterThan(1);
		const doubled = await geometry(page, 'vtb4');
		expect((await limits()).at(-1)).toBe(Math.floor(16_000_000 / doubled.rowHeight));
		expect(doubled.rowHeight).toBeGreaterThan(start.rowHeight * 1.9);
		expect(doubled.ariaRowCount).toBe((await limits()).at(-1)! + 1);
		await page.evaluate(() => document.documentElement.style.removeProperty('font-size'));
	});

	test('VTB-AC-5: each kind sets its class, alignment and tabular numbers', async ({ page }) => {
		const kinds = ['numeric', 'temporal', 'boolean', 'categorical', 'text'];
		await mountTable(page, {
			id: 'vtb5',
			totalRows: 3,
			respond: true,
			columns: [
				...kinds.map((kind) => ({ key: kind, label: kind, kind })),
				{ key: 'plain', label: 'plain' }
			]
		});
		const cells = await page.evaluate(() =>
			[
				...document
					.getElementById('vtb5')!
					.shadowRoot!.querySelectorAll('.table-row:first-child .table-cell')
			].map((cell) => {
				const style = getComputedStyle(cell);
				return {
					className: cell.className,
					align: style.textAlign,
					numeric: style.fontVariantNumeric
				};
			})
		);
		const normal = (value: string) => ({ left: 'start', right: 'end' })[value] ?? value;
		const expected = [
			['table-cell-num', 'end', true],
			['table-cell-date', 'start', true],
			['table-cell-boolean', 'center', false],
			['table-cell-categorical', 'center', false],
			['table-cell-text', 'start', false],
			[null, 'start', false]
		] as const;
		expected.forEach(([className, align, tabular], position) => {
			if (className) expect(cells[position]!.className).toContain(className);
			else expect(cells[position]!.className).toBe('table-cell');
			expect(normal(cells[position]!.align)).toBe(align);
			expect(cells[position]!.numeric.includes('tabular-nums')).toBe(tabular);
		});
	});

	test('VTB-AC-6: column tracks follow the content hint and header cells align with body cells', async ({
		page
	}) => {
		await mountTable(page, {
			id: 'vtb6',
			totalRows: 3,
			respond: true,
			columns: [
				{ key: 'a', label: 'A', contentChars: 1 },
				{ key: 'b', label: 'B', contentChars: 10 },
				{ key: 'c', label: 'C', contentChars: 100 },
				{ key: 'd', label: 'D' }
			]
		});
		const widths = await page.evaluate(() => {
			const root = document.getElementById('vtb6')!.shadowRoot!;
			const body = root.querySelector<HTMLElement>('.table-body')!;
			const expectedFor = (css: string) => {
				const probe = document.createElement('div');
				probe.style.cssText = `position:absolute;block-size:1px;inline-size:${css}`;
				body.append(probe);
				const width = probe.getBoundingClientRect().width;
				probe.remove();
				return width;
			};
			const header = [...root.querySelectorAll('.table-header-cell')].map(
				(cell) => cell.getBoundingClientRect().width
			);
			const cells = [...root.querySelectorAll('.table-row:first-child .table-cell')].map(
				(cell) => cell.getBoundingClientRect().width
			);
			return {
				header,
				cells,
				expected: [1, 10, 100].map((chars) =>
					expectedFor(`clamp(6rem, calc(${chars}ch + 1rem), 20rem)`)
				),
				twelveRem: expectedFor('12rem')
			};
		});
		for (let position = 0; position < 3; position++) {
			expect(Math.abs(widths.header[position]! - widths.expected[position]!)).toBeLessThan(1);
		}
		expect(Math.abs(widths.header[3]! - widths.twelveRem)).toBeLessThan(1);
		widths.header.forEach((width, position) =>
			expect(Math.abs(width - widths.cells[position]!)).toBeLessThanOrEqual(1)
		);
		expect(widths.header[0]).toBeLessThan(widths.header[1]!);
		expect(widths.header[1]).toBeLessThan(widths.header[2]!);
	});

	test('VTB-AC-7: unsupported columns are marked in text, icon and colour', async ({ page }) => {
		await mountTable(page, {
			id: 'vtb7',
			totalRows: 3,
			respond: true,
			columns: [
				{
					key: 'age_cat',
					label: 'Age category',
					sublabel: 'age_cat',
					kind: 'categorical',
					unsupported: true
				},
				{ key: 'seen', label: 'seen', kind: 'temporal', unsupported: true },
				{ key: 'age', label: 'Age', sublabel: 'age', kind: 'numeric' }
			]
		});
		await expect(
			page.getByRole('button', { name: 'Age category age_cat, not used for training' })
		).toBeVisible();
		await expect(page.getByRole('button', { name: 'Age age', exact: true })).toBeVisible();
		const facts = await page.evaluate(() => {
			const root = document.getElementById('vtb7')!.shadowRoot!;
			const color = (variable: string, property: 'color' | 'backgroundColor') => {
				const probe = document.createElement('div');
				probe.style[property] = `var(${variable})`;
				document.body.append(probe);
				const value = getComputedStyle(probe)[property];
				probe.remove();
				return value;
			};
			const headers = [...root.querySelectorAll<HTMLElement>('.table-header-cell')];
			const unsupportedCells = [...root.querySelectorAll('.table-row')].map(
				(row) =>
					row.children[0]!.classList.contains('unsupported') &&
					row.children[1]!.classList.contains('unsupported') &&
					!row.children[2]!.classList.contains('unsupported')
			);
			const header = headers[0]!;
			const icon = header.lastElementChild as SVGElement;
			const dateCell = root.querySelector('.table-row .table-cell-date')!;
			return {
				headerClasses: headers.map((cell) => cell.classList.contains('unsupported')),
				lastChildIsIcon: icon.tagName.toLowerCase() === 'svg',
				iconHidden: icon.getAttribute('aria-hidden'),
				iconHref: icon.querySelector('use')!.getAttribute('href'),
				iconAfterButton: header.firstElementChild!.tagName === 'BUTTON',
				headerBackground: getComputedStyle(header).backgroundColor,
				headerColor: getComputedStyle(header).color,
				red100: color('--red-100', 'backgroundColor'),
				red700: color('--red-700', 'color'),
				iconMarginEnd: parseFloat(
					getComputedStyle(icon)[document.dir === 'rtl' ? 'marginLeft' : 'marginRight']
				),
				unsupportedCells,
				cellBackground: getComputedStyle(root.querySelector('.table-row .table-cell')!)
					.backgroundColor,
				dateBackground: getComputedStyle(dateCell).backgroundColor
			};
		});
		expect(facts.headerClasses).toEqual([true, true, false]);
		expect(facts.lastChildIsIcon).toBe(true);
		expect(facts.iconAfterButton).toBe(true);
		expect(facts.iconHidden).toBe('true');
		expect(facts.iconHref).toBe('#alert');
		expect(facts.headerBackground).toBe(facts.red100);
		expect(facts.headerColor).toBe(facts.red700);
		expect(facts.iconMarginEnd).toBe(8);
		expect(facts.unsupportedCells.every(Boolean)).toBe(true);
		expect(facts.cellBackground).toBe(facts.red100);
		// The temporal column is unsupported (red), but never amber.
		expect(facts.dateBackground).toBe(facts.red100);

		await page.evaluate(() => (document.documentElement.dir = 'rtl'));
		const rtlMargin = await page.evaluate(() => {
			const icon = document
				.getElementById('vtb7')!
				.shadowRoot!.querySelector('.table-header-cell.unsupported .icon')!;
			return parseFloat(getComputedStyle(icon).marginLeft);
		});
		expect(rtlMargin).toBe(8);
		await page.evaluate(() => (document.documentElement.dir = 'ltr'));
	});

	test('VTB-AC-8: header labels are single-line, named by their text, and truncate with an ellipsis', async ({
		page
	}) => {
		await mountTable(page, {
			id: 'vtb8',
			totalRows: 3,
			respond: true,
			columns: [
				{
					key: 'long',
					label: 'A very long display name for a column',
					sublabel: 'a_very_long_column_name_indeed',
					contentChars: 1,
					unsupported: true
				},
				{ key: 'plain', label: 'plain' }
			]
		});
		const facts = await page.evaluate(() => {
			const root = document.getElementById('vtb8')!.shadowRoot!;
			const buttons = [...root.querySelectorAll<HTMLButtonElement>('.header-btn')];
			const label = buttons[0]!.querySelector<HTMLElement>('.header-label')!;
			const style = getComputedStyle(label);
			return {
				labels: buttons.map((button) => button.querySelectorAll('.header-label').length),
				lastChild: label.lastElementChild!.className,
				text: buttons.map((button) => button.textContent!.replace(/\s+/g, ' ').trim()),
				truncated: label.scrollWidth > label.clientWidth,
				ellipsis: style.textOverflow,
				nowrap: style.whiteSpace,
				nameWeight: getComputedStyle(label.querySelector('.col-name')!).fontWeight,
				plainWeight: getComputedStyle(buttons[1]!.querySelector('.col-name')!).fontWeight,
				titles: buttons.map(
					(button) => button.hasAttribute('title') || button.hasAttribute('aria-label')
				),
				cell: (() => {
					const cell = root.querySelector('.table-row .table-cell')!;
					return { title: cell.getAttribute('title'), text: cell.textContent };
				})()
			};
		});
		expect(facts.labels).toEqual([1, 1]);
		expect(facts.lastChild).toBe('visually-hidden');
		expect(facts.text[0]).toBe(
			'A very long display name for a column a_very_long_column_name_indeed, not used for training'
		);
		expect(facts.truncated).toBe(true);
		expect(facts.ellipsis).toBe('ellipsis');
		expect(facts.nowrap).toBe('nowrap');
		expect(facts.nameWeight).toBe('400');
		expect(facts.plainWeight).toBe('600');
		expect(facts.titles).toEqual([false, false]);
		expect(facts.cell.title).toBe(facts.cell.text);
		await expect(
			page.getByRole('button', {
				name: 'A very long display name for a column a_very_long_column_name_indeed, not used for training'
			})
		).toBeVisible();
	});

	test('VTB-AC-9: the header sticks at the offset, nothing scrolls internally and no CSP violation occurs', async ({
		page
	}) => {
		await page.evaluate(() => {
			(window as any).__violations = [];
			document.addEventListener('securitypolicyviolation', (event) =>
				(window as any).__violations.push(event.violatedDirective)
			);
		});
		await mountTable(page, { id: 'vtb9', totalRows: 5000, respond: true });
		await page.evaluate(() =>
			document
				.getElementById('vtb9')!
				.style.setProperty('--ui-virtual-table-sticky-offset', '20px')
		);
		const base = await geometry(page, 'vtb9');
		await page.evaluate((top) => window.scrollTo(0, top + 1000), base.bodyTop);
		await settle(page);
		const facts = await page.evaluate(() => {
			const table = document.getElementById('vtb9')!;
			const root = table.shadowRoot!;
			const everything = [...root.querySelectorAll('*')];
			const ancestors: Element[] = [];
			for (let node: Element | null = table; node; node = node.parentElement)
				ancestors.push(node);
			return {
				headerTop: root.querySelector('.table-header')!.getBoundingClientRect().top,
				tabindex: everything.some((element) => element.hasAttribute('tabindex')),
				region: everything.some((element) => element.getAttribute('role') === 'region'),
				ancestorOverflow: ancestors
					.filter((element) => element !== document.documentElement)
					.map((element) => getComputedStyle(element).overflowY)
					.filter((value) => value !== 'visible' && value !== 'clip'),
				containerOverflow: ['.table-container', '.table-header', '.table-body'].map(
					(selector) => getComputedStyle(root.querySelector(selector)!).overflow
				),
				violations: (window as any).__violations as string[]
			};
		});
		expect(Math.abs(facts.headerTop - 20)).toBeLessThanOrEqual(1);
		expect(facts.tabindex).toBe(false);
		expect(facts.region).toBe(false);
		expect(facts.containerOverflow).toEqual(['visible', 'visible', 'visible']);
		expect(facts.violations).toEqual([]);

		const source = readFileSync('src/components/ui-virtual-table.ts', 'utf8');
		expect(source).not.toMatch(/\sstyle=/);
		expect(source).not.toContain('styleMap');
	});

	test('VTB-AC-10: disconnect silences listeners, reconnect restores them, RTL starts at the inline start, axe passes', async ({
		page
	}) => {
		await mountTable(page, { id: 'vtb10', totalRows: 5000, respond: true });
		const ranges = () => page.evaluate(() => (window as any).__ranges.length as number);
		await page.evaluate(() => {
			(window as any).__held = document.getElementById('vtb10');
			(window as any).__held.remove();
		});
		const detached = await ranges();
		await page.evaluate(() => window.scrollTo(0, 4000));
		await page.evaluate(() => window.dispatchEvent(new Event('scroll')));
		await settle(page);
		expect(await ranges()).toBe(detached);

		await page.evaluate(() => document.body.append((window as any).__held));
		await settle(page);
		await page.evaluate(() => window.scrollTo(0, 6000));
		await settle(page);
		expect(await ranges()).toBeGreaterThan(detached);

		await page.evaluate(() => (document.documentElement.dir = 'rtl'));
		await settle(page);
		const alignment = await page.evaluate(() => {
			const root = document.getElementById('vtb10')!.shadowRoot!;
			const container = root.querySelector('.table-container')!.getBoundingClientRect();
			const first = root.querySelector('.table-header-cell')!.getBoundingClientRect();
			return { containerRight: container.right, firstRight: first.right };
		});
		expect(Math.abs(alignment.containerRight - alignment.firstRight)).toBeLessThanOrEqual(2);
		await page.evaluate(() => (document.documentElement.dir = 'ltr'));

		await page.evaluate(() => window.scrollTo(0, 0));
		const results = await new AxeBuilder({ page })
			.include('#vtb10')
			.withTags(AXE_TAGS)
			.analyze();
		expect(results.violations).toEqual([]);
	});

	test('VTB-AC-11: the rail has its final height when updateComplete resolves, without an animation frame', async ({
		page
	}) => {
		const result = await page.evaluate(async () => {
			const original = window.requestAnimationFrame;
			window.requestAnimationFrame = () => 0;
			try {
				const table = document.createElement('ui-virtual-table') as any;
				table.columns = [{ key: 'a', label: 'A' }];
				document.body.append(table);
				await table.updateComplete;
				table.totalRows = 20_000;
				await table.updateComplete;
				const root = table.shadowRoot as ShadowRoot;
				const body = root.querySelector<HTMLElement>('.table-body')!;
				const probe = document.createElement('div');
				probe.className = 'table-row';
				body.append(probe);
				const rowHeight = probe.getBoundingClientRect().height;
				probe.remove();
				const blockSize = body.style.blockSize;
				table.remove();
				return { blockSize, expected: `${20_000 * rowHeight}px` };
			} finally {
				window.requestAnimationFrame = original;
			}
		});
		expect(result.blockSize).toBe(result.expected);
	});

	test('VTB-AC-12: transitional scrollToRow, restoreScroll and position events use the document scroll', async ({
		page
	}) => {
		await mountTable(page, {
			id: 'vtb12',
			totalRows: 2000,
			respond: true,
			columns: Array.from({ length: 30 }, (_, index) => ({
				key: `c${index}`,
				label: `Column ${index}`
			}))
		});
		await page.evaluate(() => {
			(window as any).__positions = [];
			document
				.getElementById('vtb12')!
				.addEventListener('ui-virtual-table-position-change', (event: any) =>
					(window as any).__positions.push(event.detail)
				);
		});
		await page.evaluate(() => (document.getElementById('vtb12') as any).scrollToRow(50, 5, 25));
		const base = await geometry(page, 'vtb12');
		const scroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
		expect(scroll.x).toBe(25);
		expect(Math.abs(scroll.y - (base.bodyTop + 50 * base.rowHeight + 5))).toBeLessThanOrEqual(
			1
		);
		const last = await page.evaluate(() => (window as any).__positions.at(-1));
		expect(last.rowIndex).toBe(50);
		expect(Math.abs(last.offset - 5)).toBeLessThanOrEqual(1);
		expect(last.inlineOffset).toBe(25);

		await page.evaluate(() =>
			(document.getElementById('vtb12') as any).restoreScroll(1234, 40)
		);
		expect(await page.evaluate(() => [window.scrollX, window.scrollY])).toEqual([40, 1234]);
	});
});
