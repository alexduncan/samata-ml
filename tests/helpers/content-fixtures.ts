import { expect, type Locator, type Page } from '@playwright/test';
import type { ContentDomain, ContentIndex, PageEntry } from '../../src/types/content';

/** Serves an index and compiled fragments for page-local, same-origin content requests. */
export async function mockContent<D extends ContentDomain>(
	page: Page,
	index: ContentIndex<D>,
	fragments: Readonly<Record<string, string>>
): Promise<void> {
	const indexPath = `/content/${index.locale}/${index.domain}/index.json`;
	await page.route(
		(url) =>
			url.origin === new URL(page.url()).origin &&
			(url.pathname === indexPath || Object.hasOwn(fragments, url.pathname)),
		async (route) => {
			const { pathname } = new URL(route.request().url());
			if (pathname === indexPath) {
				await route.fulfill({
					contentType: 'application/json; charset=utf-8',
					json: index
				});
			} else {
				await route.fulfill({
					contentType: 'text/html; charset=utf-8',
					body: fragments[pathname]!
				});
			}
		}
	);
}

const articles = {
	about: {
		title: 'Project notes for readers',
		heading: 'How this fixture works',
		body: '<h3 id="fixture-about-detail">Further fixture notes</h3><p>See <a href="https://example.org">external docs</a>.</p>'
	},
	'privacy-policy': {
		title: 'Example privacy notice',
		heading: 'Fixture data handling',
		body: '<p>This is the privacy fixture.</p>'
	},
	help: {
		title: 'A short guide for fixtures',
		heading: 'Fixture workflow',
		body: '<ol><li>Choose input</li><li>Choose an outcome</li><li>Fit a classifier</li><li>Read the scores</li></ol>'
	},
	'select-features': {
		title: 'Example feature selection',
		heading: 'Select the inputs',
		body: '<p>Choose columns for this example.</p>'
	},
	'configure-model': {
		title: 'Example classifier settings',
		heading: 'Adjust the estimator',
		body: '<p>Choose settings for this example.</p>'
	},
	'training-setup': {
		title: 'Example training choices',
		heading: 'Choose a strategy',
		body: '<h3 id="fixture-training-strategies">Example strategies</h3><table><thead><tr><th scope="col">Strategy</th><th scope="col">Benefits</th><th scope="col">Drawbacks</th></tr></thead><tbody><tr><th scope="row">One split</th><td>Runs once</td><td>One test group</td></tr><tr><th scope="row">Several folds</th><td>Uses multiple groups</td><td>Fits several times</td></tr></tbody></table>'
	}
};

/** Reserved page IDs backed by the shared fixtures. */
export type ReservedPageFixture = keyof typeof articles;

/** Path of a reserved page fixture fragment, excluding the version query. */
export function fixtureFragmentPath(id: ReservedPageFixture): string {
	return `/content/en/pages/${id}.html`;
}

const fixtures = (Object.keys(articles) as ReservedPageFixture[]).map((id) => {
	const source = articles[id];
	const pathname = fixtureFragmentPath(id);
	const headingId = `fixture-${id}`;
	const headings: PageEntry['headings'] = [{ id: headingId, text: source.heading, level: 2 }];
	if (id === 'about')
		headings.push({ id: 'fixture-about-detail', text: 'Further fixture notes', level: 3 });
	if (id === 'training-setup')
		headings.push({ id: 'fixture-training-strategies', text: 'Example strategies', level: 3 });
	const entry: PageEntry = {
		id,
		lang: 'en',
		title: source.title,
		description: 'Reserved page test fixture',
		url: `${pathname}?v=0123456789ab`,
		headings
	};
	return {
		entry,
		pathname,
		html: `<h2 id="${headingId}">${source.heading}</h2>${source.body}`
	};
});

/** Installs all reserved page fixtures before navigating to or opening a reserved route. */
export async function mockReservedPages(page: Page): Promise<void> {
	await mockContent(
		page,
		{ version: 1, locale: 'en', domain: 'pages', entries: fixtures.map(({ entry }) => entry) },
		Object.fromEntries(fixtures.map(({ pathname, html }) => [pathname, html]))
	);
}

/** Checks the fixture marker, ready state and accessible name of a native reserved dialog. */
export async function expectFixturePage(dialog: Locator, id: ReservedPageFixture): Promise<void> {
	const title = articles[id].title;
	await expect(dialog).toBeVisible();
	await expect(dialog.locator('#content-dialog-title')).toHaveText(title);
	await expect(dialog).toHaveAttribute('aria-labelledby', 'content-dialog-title');
	await expect(dialog).toHaveAccessibleName(title);
	const body = dialog.locator('.modal-content');
	await expect(body).toHaveAttribute('aria-busy', 'false');
	await expect(body.locator(`#fixture-${id}`)).toBeVisible();
}
