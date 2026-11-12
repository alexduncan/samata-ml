import m from 'mithril';

export const Steps: m.Component = {
	view() {
		const currentRoute = m.route.get();

		const steps = [
			{ path: '/select-data', num: '1', label: 'Select Data' },
			{ path: '/select-model', num: '2', label: 'Select Model' },
			{ path: '/select-features', num: '3', label: 'Select Features' },
			{ path: '/configure-model', num: '4', label: 'Configure Model' },
			{ path: '/train-model', num: '5', label: 'Train Model' },
			{ path: '/view-results', num: '6', label: 'View Results' }
		];

		return m(
			'nav.steps',
			{ 'aria-label': 'Project Steps' },
			steps.map((step) =>
				m(
					m.route.Link,
					{
						href: step.path,
						'aria-current': currentRoute === step.path ? 'true' : undefined
					},
					[m('small', `${step.num}`), m('span', step.label)]
				)
			)
		);
	}
};
