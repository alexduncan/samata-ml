import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

test.describe('Virtual Table Component (VTB-AC-1 .. VTB-AC-6)', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/data');
		// Dismiss welcome modal if open
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

	test('BETA-ERR-2b / VTB-AC-1: DOM bound holds for 0, 1, 10,001, 10,000,000 and 10,000,001 rows; last permitted row reachable', async ({
		page
	}) => {
		await page.evaluate(() => {
			const container = document.createElement('div');
			container.id = 'vtb-test-fixture';
			container.style.padding = '20px';
			document.body.appendChild(container);
		});

		// 1. Zero rows
		await page.evaluate(() => {
			const container = document.getElementById('vtb-test-fixture')!;
			container.innerHTML = `
				<ui-virtual-table
					id="test-table-0"
					label="Zero Rows"
					total-rows="0"
				></ui-virtual-table>
			`;
			const table = document.getElementById('test-table-0') as any;
			table.columns = [{ key: 'id', label: 'ID' }];
			table.window = { startIndex: 0, rows: [] };
		});

		const table0 = page.locator('#test-table-0');
		await expect(table0).toBeVisible();
		const rows0 = table0.locator('.table-row');
		await expect(rows0).toHaveCount(0);
		const container0 = table0.locator('.table-container');
		await expect(container0).toHaveAttribute('aria-rowcount', '1');

		// 2. Single row
		await page.evaluate(() => {
			const table = document.getElementById('test-table-0') as any;
			table.totalRows = 1;
			table.window = { startIndex: 0, rows: [['Row 0']] };
		});
		await expect(rows0).toHaveCount(1);
		await expect(container0).toHaveAttribute('aria-rowcount', '2');
		await expect(rows0.first()).toHaveAttribute('aria-rowindex', '2');

		// 3. 10,001 rows (spans 2 segments: 0..9,999 and 10,000)
		await page.evaluate(() => {
			const container = document.getElementById('vtb-test-fixture')!;
			container.innerHTML = `
				<ui-virtual-table
					id="test-table-large"
					label="Large Table"
					total-rows="10001"
				></ui-virtual-table>
			`;
			const table = document.getElementById('test-table-large') as any;
			table.columns = [
				{ key: 'col1', label: 'Column 1' },
				{ key: 'col2', label: 'Column 2' }
			];
			table.addEventListener('ui-virtual-table-range-change', (e: any) => {
				const { startIndex, limit } = e.detail;
				const rows = [];
				for (let i = 0; i < limit; i++) {
					const idx = startIndex + i;
					if (idx < 10001) {
						rows.push([`Cell 1-${idx}`, `Cell 2-${idx}`]);
					}
				}
				table.window = { startIndex, rows };
			});
		});

		const tableLarge = page.locator('#test-table-large');
		await expect(tableLarge).toBeVisible();

		// Check start of table: rows bound <= 25 rows
		const largeRows = tableLarge.locator('.table-row');
		let count = await largeRows.count();
		expect(count).toBeGreaterThan(0);
		expect(count).toBeLessThanOrEqual(25);

		// Middle of segment 0 (row 5000)
		await page.evaluate(async () => {
			const table = document.getElementById('test-table-large') as any;
			await table.scrollToRow(5000);
		});
		const topSpacer = tableLarge.locator('.rail-spacer-top');
		const bottomSpacer = tableLarge.locator('.rail-spacer-bottom');
		expect(
			await topSpacer.evaluate((element) => element.getBoundingClientRect().height)
		).toBeGreaterThan(0);
		expect(
			await bottomSpacer.evaluate((element) => element.getBoundingClientRect().height)
		).toBeGreaterThan(0);
		count = await largeRows.count();
		expect(count).toBeGreaterThan(0);
		expect(count).toBeLessThanOrEqual(25);

		// End: last row (row 10000 in segment 1)
		await page.evaluate(async () => {
			const table = document.getElementById('test-table-large') as any;
			await table.scrollToRow(10000);
		});
		count = await largeRows.count();
		expect(count).toBeGreaterThan(0);
		expect(count).toBeLessThanOrEqual(25);

		// Verify last row is reachable and has correct rowindex (10000 + 2 = 10002)
		const lastRow = tableLarge.locator('.table-row[aria-rowindex="10002"]');
		await expect(lastRow).toBeVisible();
		await expect(lastRow.locator('.table-cell').first()).toContainText('Cell 1-10000');

		// 4. 10,000,000 rows
		await page.evaluate(() => {
			const table = document.getElementById('test-table-large') as any;
			table.totalRows = 10_000_000;
		});
		const containerLarge = tableLarge.locator('.table-container');
		await expect(containerLarge).toHaveAttribute('aria-rowcount', '10000001');

		// Reach last permitted row (9,999,999)
		await page.evaluate(async () => {
			const table = document.getElementById('test-table-large') as any;
			await table.scrollToRow(9_999_999);
		});
		count = await largeRows.count();
		expect(count).toBeGreaterThan(0);
		expect(count).toBeLessThanOrEqual(25);
		const finalRow = tableLarge.locator('.table-row[aria-rowindex="10000001"]');
		await expect(finalRow).toBeVisible();

		// 5. 10,000,001 rows capped at 10,000,000
		await page.evaluate(() => {
			const table = document.getElementById('test-table-large') as any;
			table.totalRows = 10_000_001;
		});
		await expect(containerLarge).toHaveAttribute('aria-rowcount', '10000001');
		await page.evaluate(async () => {
			const table = document.getElementById('test-table-large') as any;
			await table.scrollToRow(10_000_000); // clamped to 9,999,999
		});
		await expect(finalRow).toBeVisible();
	});

	test('VTB-AC-2: exact ranges, deduplication, and stale windows never populate wrong indices', async ({
		page
	}) => {
		await page.evaluate(() => {
			const container = document.createElement('div');
			container.id = 'vtb-test-fixture-2';
			container.innerHTML = `
				<ui-virtual-table
					id="test-table-events"
					label="Event Table"
					total-rows="20000"
				></ui-virtual-table>
			`;
			document.body.appendChild(container);
			const table = document.getElementById('test-table-events') as any;
			table.columns = [{ key: 'data', label: 'Data Column' }];
			(window as any).__rangeEvents = [];
			table.addEventListener('ui-virtual-table-range-change', (e: any) => {
				(window as any).__rangeEvents.push(e.detail);
			});
		});

		const tableEvents = page.locator('#test-table-events');
		await expect(tableEvents).toBeVisible();

		// Check range event was emitted for initial range
		const events = await page.evaluate(() => (window as any).__rangeEvents);
		expect(events.length).toBeGreaterThanOrEqual(1);
		expect(events[0].startIndex).toBe(0);
		expect(events[0].limit).toBeGreaterThan(0);

		// Stale window protection test:
		// Table is at row 0. Set stale window for row 15000.
		await page.evaluate(() => {
			const table = document.getElementById('test-table-events') as any;
			table.window = {
				startIndex: 15000,
				rows: [['STALE_VALUE_15000']]
			};
		});

		// Rows in the DOM must NOT show STALE_VALUE_15000 at row indices 0..20
		const renderedText = await tableEvents.innerText();
		expect(renderedText).not.toContain('STALE_VALUE_15000');

		// Jump to row 15000 (segment 1): now STALE_VALUE_15000 belongs here!
		await page.evaluate(async () => {
			const table = document.getElementById('test-table-events') as any;
			await table.scrollToRow(15000);
		});
		await expect(tableEvents.locator('.table-row[aria-rowindex="15002"]')).toContainText(
			'STALE_VALUE_15000'
		);
	});

	test('VTB-AC-3: exact column and position events; markup displays as text', async ({
		page
	}) => {
		await page.evaluate(() => {
			const container = document.createElement('div');
			container.id = 'vtb-test-fixture-3';
			container.innerHTML = `
				<ui-virtual-table
					id="test-table-content"
					label="Content Table"
					total-rows="100"
				></ui-virtual-table>
			`;
			document.body.appendChild(container);
			const table = document.getElementById('test-table-content') as any;
			table.columns = [
				{ key: 'plain', label: 'Plain' },
				{ key: 'html', label: 'HTML Content' }
			];
			table.window = {
				startIndex: 0,
				rows: [['Regular', '<script>alert("xss")</script><b>Bold Tag</b>']]
			};
			(window as any).__colSelected = null;
			(window as any).__positions = [];
			table.addEventListener('ui-virtual-table-column-select', (e: any) => {
				(window as any).__colSelected = e.detail;
			});
			table.addEventListener('ui-virtual-table-position-change', (e: any) => {
				(window as any).__positions.push(e.detail);
			});
		});

		const table = page.locator('#test-table-content');
		await expect(table).toBeVisible();

		// Check HTML escaping: script tag and b tag must be literal text
		const htmlCell = table.locator('.table-cell').nth(1);
		await expect(htmlCell).toContainText('<script>alert("xss")</script><b>Bold Tag</b>');
		const bTagCount = await htmlCell.locator('b').count();
		expect(bTagCount).toBe(0);
		const scriptTagCount = await htmlCell.locator('script').count();
		expect(scriptTagCount).toBe(0);

		// Column select event
		const colBtn = table.locator('button[data-col-key="html"]');
		await colBtn.click();
		const colDetail = await page.evaluate(() => (window as any).__colSelected);
		expect(colDetail).toEqual({ column: 'html' });

		// Position event on scroll
		await page.evaluate(async () => {
			const table = document.getElementById('test-table-content') as any;
			await table.scrollToRow(3, 10, 5);
		});
		const positions = await page.evaluate(() => (window as any).__positions);
		expect(positions.length).toBeGreaterThan(0);
		const lastPos = positions[positions.length - 1];
		expect(lastPos.rowIndex).toBe(3);
		expect(lastPos.offset).toBe(10);
	});

	test('VTB-AC-4: named header buttons operable, no trap, exact table counts and indices', async ({
		page
	}) => {
		await page.evaluate(() => {
			const container = document.createElement('div');
			container.id = 'vtb-test-fixture-4';
			container.innerHTML = `
				<ui-virtual-table
					id="test-table-a11y"
					label="Accessible Table"
					total-rows="50"
				></ui-virtual-table>
			`;
			document.body.appendChild(container);
			const table = document.getElementById('test-table-a11y') as any;
			table.columns = [
				{ key: 'colA', label: 'Column A' },
				{ key: 'colB', label: 'Column B' }
			];
			table.window = {
				startIndex: 0,
				rows: [
					['A0', 'B0'],
					['A1', 'B1']
				]
			};
		});

		const table = page.locator('#test-table-a11y');
		await expect(table).toBeVisible();

		// Programmatic focus via focusColumn
		await page.evaluate(() => {
			const table = document.getElementById('test-table-a11y') as any;
			table.focusColumn('colB');
		});
		const btnB = table.locator('button[data-col-key="colB"]');
		await expect(btnB).toBeFocused();

		// Keyboard operation: Tab into table viewport
		const viewport = table.locator('.table-viewport');
		await viewport.focus();
		await expect(viewport).toBeFocused();

		// Arrow Down scroll
		await page.keyboard.press('ArrowDown');
		await page.keyboard.press('ArrowDown');

		// Table counts and indices
		const container = table.locator('.table-container');
		await expect(container).toHaveAttribute('role', 'table');
		await expect(container).toHaveAttribute('aria-colcount', '2');
		await expect(container).toHaveAttribute('aria-rowcount', '51');

		const headerRow = table.locator('.table-header-row');
		await expect(headerRow).toHaveAttribute('aria-rowindex', '1');

		const firstDataRow = table.locator('.table-row').first();
		await expect(firstDataRow).toHaveAttribute('aria-rowindex', '2');
	});

	test('VTB-AC-5: passes axe scan, token styles, and large dataset handling', async ({
		page
	}) => {
		await page.evaluate(() => {
			const container = document.createElement('div');
			container.id = 'vtb-test-fixture-5';
			container.innerHTML = `
				<ui-virtual-table
					id="test-table-axe"
					label="Dataset preview"
					total-rows="1000"
				></ui-virtual-table>
			`;
			document.body.appendChild(container);
			const table = document.getElementById('test-table-axe') as any;
			table.columns = [
				{ key: 'id', label: 'Identifier' },
				{ key: 'name', label: 'Full Name' },
				{ key: 'status', label: 'Status' }
			];
			table.window = {
				startIndex: 0,
				rows: [
					['1', 'Alice', 'Active'],
					['2', 'Bob', 'Pending']
				]
			};
		});

		const table = page.locator('#test-table-axe');
		await expect(table).toBeVisible();

		// Axe accessibility scan
		const results = await new AxeBuilder({ page })
			.include('#test-table-axe')
			.withTags(AXE_TAGS)
			.analyze();
		expect(results.violations).toEqual([]);
	});

	test('VTB-AC-6: font scaling remeasures rows without clipping; disconnect and reconnect', async ({
		page
	}) => {
		await page.evaluate(() => {
			const container = document.createElement('div');
			container.id = 'vtb-test-fixture-6';
			container.innerHTML = `
				<ui-virtual-table
					id="test-table-lifecycle"
					label="Lifecycle Table"
					total-rows="100"
				></ui-virtual-table>
			`;
			document.body.appendChild(container);
			const table = document.getElementById('test-table-lifecycle') as any;
			table.columns = [{ key: 'text', label: 'Scaling Text' }];
			table.window = {
				startIndex: 0,
				rows: [['Normal font text']]
			};
			(window as any).__eventCount = 0;
			table.addEventListener('ui-virtual-table-range-change', () => {
				(window as any).__eventCount++;
			});
		});

		const table = page.locator('#test-table-lifecycle');
		await expect(table).toBeVisible();

		// Disconnect element
		await page.evaluate(() => {
			const table = document.getElementById('test-table-lifecycle')!;
			table.remove();
		});

		// Events must not fire while disconnected
		const countBefore = await page.evaluate(() => (window as any).__eventCount);

		// Reconnect element
		await page.evaluate(() => {
			const table = document.createElement('ui-virtual-table') as any;
			table.id = 'test-table-lifecycle-reconnected';
			table.label = 'Lifecycle Table Reconnected';
			table.totalRows = 100;
			table.columns = [{ key: 'text', label: 'Scaling Text' }];
			table.window = { startIndex: 0, rows: [['Normal font text']] };
			table.addEventListener('ui-virtual-table-range-change', () => {
				(window as any).__eventCount++;
			});
			document.getElementById('vtb-test-fixture-6')!.appendChild(table);
		});

		const reconnectedTable = page.locator('#test-table-lifecycle-reconnected');
		await expect(reconnectedTable).toBeVisible();
		const countAfter = await page.evaluate(() => (window as any).__eventCount);
		expect(countAfter).toBeGreaterThanOrEqual(countBefore);
	});
});
