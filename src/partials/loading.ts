import m from 'mithril';

export const Loading: m.Component = {
	view() {
		return m('div', { role: 'status', 'aria-live': 'polite' }, [
			m('div', { id: 'spinner', 'aria-hidden': 'true' }),
			m('span', { class: 'visually-hidden' }, 'Loading...')
		]);
	}
};
