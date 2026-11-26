import { html } from 'lit';
import type { Meta, StoryObj } from '@storybook/web-components-vite';
import './app-upload-dataset-dialog';

type UploadArgs = { busy: boolean; error: string | null };

const meta = {
	title: 'Data/Upload dataset dialog',
	component: 'app-upload-dataset-dialog',
	render: ({ busy, error }) =>
		html`<app-upload-dataset-dialog
			.open=${true}
			.busy=${busy}
			.error=${error}></app-upload-dataset-dialog>`,
	args: { busy: false, error: null as string | null }
} satisfies Meta<UploadArgs>;
export default meta;
type Story = StoryObj<UploadArgs>;

/** The file picker is available while idle. */
export const Idle: Story = {};
/** Progress has its own labelled Cancel control. */
export const InProgress: Story = { args: { busy: true } };
/** A read error remains within the content area. */
export const ReadError: Story = {
	args: { error: 'This CSV could not be read. Check the file and try again.' }
};
