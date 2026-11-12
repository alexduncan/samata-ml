import m from 'mithril';
import { Steps } from '../partials/steps';

/**
 * Master layout component that wraps every view.
 * It is responsible for the consistent shell around the application,
 * including the Header, Branding, and the main Steps Navigation.
 */
export const Layout = (component: m.Component): m.Component => {
	return {
		view() {
			if (DEBUG) console.log('LayoutView');
			return [
				m('header', [
					m('hgroup', [m('h1', 'WebML'), m('h2', 'Machine Learning in your Browser')]),
					m(Steps)
				]),
				m('main', m(component))
			];
		}
	};
};
