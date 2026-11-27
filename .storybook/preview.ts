import type { Preview } from '@storybook/web-components-vite';
import { setCustomElementsManifest } from '@storybook/web-components';
import { action } from 'storybook/actions';
import '../css/style.css';
import { initGlobalStyles } from '../src/styles/global';
import { $appState } from '../src/stores/app.store';
import { INITIAL_APP_STATE } from '../src/types/state';
import { $route } from '../src/router/router';
import { parseRoute } from '../src/router/route-parser';

initGlobalStyles();
const manifests = import.meta.glob('../custom-elements.json', { eager: true, import: 'default' });
const manifest = manifests['../custom-elements.json'];
if (manifest) setCustomElementsManifest(manifest);

const preview: Preview = {
	tags: ['autodocs'],
	parameters: {
		a11y: { test: __SAMATA_STORYBOOK_A11Y_TEST__ },
		docs: { story: { inline: false } }
	},
	beforeEach: ({ canvasElement }) => {
		const previousState = $appState.get();
		const previousRoute = $route.get();
		const root = document.documentElement;
		const previousLang = root.getAttribute('lang');
		const previousDir = root.getAttribute('dir');
		const fixtureState = structuredClone(INITIAL_APP_STATE);
		fixtureState.updatedAt = Date.UTC(2026, 0, 1);
		$appState.set(fixtureState);
		$route.set(parseRoute('/data'));
		root.lang = 'en';
		root.dir = 'ltr';

		const navigate = action('navigate');
		const interceptNavigation = (event: MouseEvent): void => {
			if (
				event.defaultPrevented ||
				event.button !== 0 ||
				event.metaKey ||
				event.ctrlKey ||
				event.shiftKey ||
				event.altKey
			)
				return;
			const anchor = event
				.composedPath()
				.find(
					(node): node is HTMLAnchorElement =>
						'localName' in node &&
						node.localName === 'a' &&
						'namespaceURI' in node &&
						node.namespaceURI === 'http://www.w3.org/1999/xhtml'
				);
			// Read the authored target: Firefox resolves an absent property through
			// the browser test iframe's <base target="_parent">.
			const target = anchor?.getAttribute('target');
			if (
				!anchor ||
				anchor.hasAttribute('download') ||
				(target && target.toLowerCase() !== '_self')
			)
				return;
			const href = anchor.getAttribute('href');
			if (
				!href ||
				href.startsWith('#') ||
				anchor.origin !== location.origin ||
				!['http:', 'https:'].includes(anchor.protocol)
			)
				return;
			event.preventDefault();
			navigate(anchor.pathname + anchor.search + anchor.hash);
		};
		canvasElement.addEventListener('click', interceptNavigation);
		return () => {
			canvasElement.removeEventListener('click', interceptNavigation);
			$appState.set(previousState);
			$route.set(previousRoute);
			if (previousLang === null) root.removeAttribute('lang');
			else root.lang = previousLang;
			if (previousDir === null) root.removeAttribute('dir');
			else root.dir = previousDir;
		};
	}
};

export default preview;
