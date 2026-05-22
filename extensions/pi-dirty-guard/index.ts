/**
 * pi-dirty-guard — Git cleanliness watcher
 *
 * Warns when there are uncommitted changes before the LLM edits files.
 * Shows dirty/clean status in footer, injects git status into context.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

interface GitStatus {
  clean: boolean;
  modified: string[];
  untracked: string[];
  staged: string[];
}

async function checkGit(pi: ExtensionAPI): Promise<GitStatus | null> {
  try {
    const { stdout } = await pi.exec("git", ["status", "--porcelain"]);
    const lines = stdout.trim().split("\n").filter(Boolean);

    const modified = lines.filter((l) => l.match(/^ [MADRCU]/)).map((l) => l.slice(3));
    const staged = lines.filter((l) => l.match(/^[MADRCU]/)).map((l) => l.slice(3));
    const untracked = lines.filter((l) => l.match(/^\?\?/)).map((l) => l.slice(3));

    return {
      clean: lines.length === 0,
      modified,
      untracked,
      staged,
    };
  } catch {
    return null; // Not a git repo
  }
}

export default function (pi: ExtensionAPI) {
  let lastStatus: GitStatus | null = null;

  pi.on("session_start", async (_event, ctx) => {
    lastStatus = await checkGit(pi);

    if (!lastStatus) return; // Not a git repo — silent

    if (lastStatus.clean) {
      ctx.ui.setStatus("dirty-guard", "git: Clean");
    } else {
      const total = lastStatus.modified.length + lastStatus.staged.length + lastStatus.untracked.length;
      ctx.ui.setStatus("dirty-guard", `git: ${total} uncommitted changes ⚠️`);
      ctx.ui.notify(
        `⚠️ ${total} uncommitted changes: ${[
          lastStatus.modified.length > 0 && `${lastStatus.modified.length} modified`,
          lastStatus.staged.length > 0 && `${lastStatus.staged.length} staged`,
          lastStatus.untracked.length > 0 && `${lastStatus.untracked.length} untracked`,
        ]
          .filter(Boolean)
          .join(", ")}`,
        "warning"
      );
    }
  });

  // Inject git status into context for every prompt
  pi.on("before_agent_start", async (event, _ctx) => {
    const status = await checkGit(pi);
    if (!status) return;

    if (!status.clean) {
      const dirtyFiles = [
        ...status.modified.map((f) => `  M ${f}`),
        ...status.staged.map((f) => `  A ${f}`),
        ...status.untracked.map((f) => `  ? ${f}`),
      ].join("\n");

      const gitBlock = [
        "**⚠️ Repository has uncommitted changes:**",
        dirtyFiles || "  (none visible)",
        "",
        "**IMPORTANT**: Do NOT commit or stage files unless explicitly asked. The user knows about these changes. Focus only on the requested task.",
      ].join("\n");

      if (!event.systemPrompt.includes(gitBlock)) {
        return { systemPrompt: `${event.systemPrompt}\n\n${gitBlock}` };
      }
    }
  });

  // Refresh after each turn
  pi.on("turn_end", async (_event, ctx) => {
    lastStatus = await checkGit(pi);
    if (!lastStatus) {
      ctx.ui.setStatus("dirty-guard", undefined);
      return;
    }
    if (lastStatus.clean) {
      ctx.ui.setStatus("dirty-guard", "git: Clean");
    } else {
      const total = lastStatus.modified.length + lastStatus.staged.length + lastStatus.untracked.length;
      ctx.ui.setStatus("dirty-guard", `git: ${total} changes ⚠️`);
    }
  });
}