/**
 * pi-auto-commit — Git checkpoint on every turn
 *
 * Stages all changes and creates a commit after each LLM turn.
 * Commit messages include turn number and a summary of what changed.
 * On session shutdown, makes a final checkpoint.
 *
 * Safe: only commits if git repo is detected. Uses --allow-empty
 * so even turns with no file changes get a commit for history.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  let turnCount = 0;
  let isGitRepo = false;

  // Detect git repo
  pi.on("session_start", async (_event, ctx) => {
    try {
      const { code } = await pi.exec("git", ["rev-parse", "--git-dir"]);
      isGitRepo = code === 0;
      if (isGitRepo) {
        ctx.ui.setStatus("auto-commit", "💾 Auto-commit: ON");
      }
    } catch {
      isGitRepo = false;
    }
  });

  // Commit after every turn
  pi.on("turn_end", async (event, ctx) => {
    if (!isGitRepo) return;
    turnCount++;

    try {
      // Stage all changes (tracked + new)
      await pi.exec("git", ["add", "-A"]);

      // Get a summary of what changed
      const { stdout: diff } = await pi.exec("git", [
        "diff",
        "--cached",
        "--stat",
      ]);
      const summary = diff.trim().split("\n").pop() ?? "changes";

      // Get the first meaningful user message as context
      let context = "";
      try {
        const branch = ctx.sessionManager.getBranch();
        const userMsg = branch
          .filter(
            (e: any) =>
              e.type === "message" && e.message?.role === "user"
          )
          .slice(-1)[0];
        if (userMsg?.message?.content) {
          const content = userMsg.message.content;
          if (Array.isArray(content)) {
            context = content
              .filter((c: any) => c.type === "text")
              .map((c: any) => c.text)
              .join(" ")
              .slice(0, 80);
          } else if (typeof content === "string") {
            context = content.slice(0, 80);
          }
        }
      } catch {}

      const msg = context
        ? `pi: turn #${turnCount} — ${context}`
        : `pi: turn #${turnCount} — ${summary}`;

      await pi.exec("git", ["commit", "--allow-empty", "-m", msg]);

      ctx.ui.setStatus("auto-commit", `💾 Committed turn #${turnCount}`);
    } catch (e: any) {
      // Silent — nothing to commit or git error
      ctx.ui.setStatus("auto-commit", "💾 Auto-commit: ON (no changes)");
    }
  });

  // Final commit on shutdown
  pi.on("session_shutdown", async (_event) => {
    if (!isGitRepo) return;
    try {
      await pi.exec("git", ["add", "-A"]);
      await pi.exec("git", [
        "commit",
        "--allow-empty",
        "-m",
        `pi: session end — ${turnCount} turns completed`,
      ]);
    } catch {}
  });
}