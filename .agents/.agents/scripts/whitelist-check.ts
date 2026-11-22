#!/usr/bin/env bun
/**
 * Antigravity PreToolUse hook for run_command.
 * Evaluates the requested command against the repository whitelist.
 * Returns {"decision": "allow"} for whitelisted commands,
 * or {"decision": "ask"} for commands requiring manual review.
 */

interface ToolCallInput {
	toolCall?: {
		id?: string;
		name?: string;
		args?: {
			CommandLine?: string;
			BypassSandbox?: boolean;
		};
	};
}

interface HookDecision {
	decision: 'allow' | 'ask' | 'deny';
	reason?: string;
}

async function main() {
	let input = '';
	for await (const chunk of Bun.stdin.stream()) {
		input += Buffer.from(chunk).toString();
	}

	let data: ToolCallInput;
	try {
		data = JSON.parse(input);
	} catch {
		output({ decision: 'ask', reason: 'Invalid hook payload' });
		return;
	}

	const cmd = data.toolCall?.args?.CommandLine?.trim();
	if (!cmd) {
		output({ decision: 'ask', reason: 'Empty command line' });
		return;
	}

	// Disallow dangerous multi-command chaining or subshells
	if (hasDangerousChaining(cmd)) {
		output({ decision: 'ask', reason: 'Command contains shell chaining or substitution' });
		return;
	}

	if (isWhitelisted(cmd)) {
		output({
			decision: 'allow',
			reason: 'Command matches repository whitelist'
		});
	} else {
		output({
			decision: 'ask',
			reason: 'Command not in repository whitelist'
		});
	}
}

function hasDangerousChaining(cmd: string): boolean {
	// Flag command substitution $(...) or `...`
	if (/\$\(/.test(cmd) || /`/.test(cmd)) return true;

	// Flag dangerous chaining with ';' or '&&' or '||' or '|'
	// (Except in standard quoted string arguments where needed, but plain commands shouldn't have unquoted chaining)
	if (/;|&&|\|\||\|/.test(cmd)) return true;

	// Flag dangerous redirection or destructive operations
	if (/>|>>/.test(cmd)) return true;
	if (/\brm\s+(-[a-zA-Z]*r[a-zA-Z]*|-rf|--recursive)\b/.test(cmd)) return true;

	return false;
}

function isWhitelisted(cmd: string): boolean {
	// Whitelist patterns for samata-ml repository
	const WHITELIST_PATTERNS: RegExp[] = [
		// Bun commands
		/^bun\s+run\s+(check|typecheck|build|server|mockups|audit:mockups|format|format:check|test:e2e|storybook|storybook:build|storybook:manifest|test:stories|now|plans:(check|task|review|close|baseline)|git:(sync|land|status|release|tidy))(\s+.*)?$/,
		/^bun\s+run\s+--silent\s+now$/,
		/^bun\s+test(\s+.*)?$/,
		/^bun\s+(install|add|remove)(\s+.*)?$/,

		// Bunx commands
		/^bunx\s+playwright\s+test(\s+.*)?$/,
		/^bunx\s+prettier(\s+.*)?$/,
		/^bunx\s+tsc(\s+.*)?$/,

		// Shared agent-workflow gate scripts (prefer the bun run plans:* and git:* wrappers)
		/^python3\s+"?(\$HOME|~)\/\.agents\/skills\/(create-plan|verify-plan|implement|verify-implementation)\/scripts\/[a-z_]+\.py"?(\s+.*)?$/,

		// Read-only repository inspection commands
		/^git\s+(status|diff|log|branch|rev-parse|show|cherry|merge-base|worktree\s+list)(\s+.*)?$/,
		/^ls(\s+.*)?$/,
		/^cat(\s+.*)?$/,
		/^grep(\s+.*)?$/,
		/^rg(\s+.*)?$/,
		/^find(\s+.*)?$/,
		/^wc(\s+.*)?$/,
		/^head(\s+.*)?$/,
		/^tail(\s+.*)?$/,
		/^sed\s+-n(\s+.*)?$/,
		/^file(\s+.*)?$/,
		/^date(\s+.*)?$/,

		// Safe note cleanup prescribed by plan spec sync
		/^rm\s+specification\/notes\/[a-zA-Z0-9_\-]+\.md$/
	];

	return WHITELIST_PATTERNS.some((pattern) => pattern.test(cmd)) || isSafeGitWrite(cmd);
}

/**
 * Allow the commit workflow in AGENTS.md: `git add` with explicit paths and plain `git commit`.
 * Whole-tree staging (`-A`, `--all`, `-u`, `--update`, `.`), `commit -a` and `--amend` still ask.
 */
function isSafeGitWrite(cmd: string): boolean {
	const add = /^git\s+add\s+(.+)$/.exec(cmd);
	if (add) {
		const args = add[1].trim().split(/\s+/);
		return args.every(
			(arg) =>
				!['-A', '--all', '-u', '--update', '.', '*', '--', ':/'].includes(arg) &&
				!/^-[a-zA-Z]*[Au]/.test(arg)
		);
	}
	const commit = /^git\s+commit(\s+.*)?$/.exec(cmd);
	if (commit) {
		return !/(^|\s)(--amend|--all|-[a-zA-Z]*a[a-zA-Z]*)(\s|=|$)/.test(commit[1] ?? '');
	}
	return false;
}

function output(res: HookDecision) {
	console.log(JSON.stringify(res));
}

main();
