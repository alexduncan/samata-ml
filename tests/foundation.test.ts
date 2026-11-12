import { describe, expect, it } from 'bun:test';
import { atom, map } from 'nanostores';

describe('foundation test harness', () => {
	it('provides a functioning DOM environment via Happy-DOM', () => {
		expect(typeof document).toBe('object');
		expect(typeof window).toBe('object');

		const element = document.createElement('div');
		element.className = 'test-node';
		element.textContent = 'samatā.ml';
		document.body.appendChild(element);

		const queried = document.querySelector('.test-node');
		expect(queried).not.toBeNull();
		expect(queried?.textContent).toBe('samatā.ml');

		element.remove();
		expect(document.querySelector('.test-node')).toBeNull();
	});

	it('supports Nanostores atom and map reactivity', () => {
		const counter = atom(0);
		const changes: number[] = [];
		const unbind = counter.subscribe((value) => {
			changes.push(value);
		});

		counter.set(1);
		counter.set(2);
		expect(changes).toEqual([0, 1, 2]);
		unbind();

		const profile = map({ name: 'Iris', target: 'species' });
		profile.setKey('target', 'petal_width');
		expect(profile.get()).toEqual({ name: 'Iris', target: 'petal_width' });
	});
});
