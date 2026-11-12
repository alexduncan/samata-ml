// Import Lit
import { html, render } from 'lit';

const app = html`<h1>Hello, samatā.ml!</h1>`;
const root = document.getElementById('app');
if (root) {
	render(app, root);
}
