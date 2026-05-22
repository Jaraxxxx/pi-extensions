/**
 * pi-branch-navigator — Session tree visualization
 *
 * Shows the current session tree structure as a widget: current branch,
 * sibling branches, available forks. Makes the session tree visible
 * without needing commands or tools.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

interface TreeInfo {
  totalEntries: number;
  branchEntries: number;
  leafId: string | null;
  forks: number;
  compactions: number;
  labels: string[];
}

function getTreeInfo(ctx: any): TreeInfo {
  const info: TreeInfo = {
    totalEntries: 0,
    branchEntries: 0,
    leafId: null,
    forks: 0,
    compactions: 0,
    labels: [],
  };

  try {
    const all = ctx.sessionManager.getEntries();
    info.totalEntries = all.length;
    info.forks = all.filter((e: any) => e.type === "fork").length;
    info.compactions = all.filter((e: any) => e.type === "compaction").length;

    const branch = ctx.sessionManager.getBranch();
    info.branchEntries = branch.length;
    if (branch.length > 0) {
      info.leafId = branch[branch.length - 1].id;
    }

    // Gather labels from branch entries
    for (const entry of branch) {
      try {
        const label = ctx.sessionManager.getLabel(entry.id);
        if (label) info.labels.push(label);
      } catch {}
    }
  } catch {
    // sessionManager access failed — show minimal info
  }

  return info;
}

export default function (pi: ExtensionAPI) {
  function renderTree(ctx: any): string[] {
    const info = getTreeInfo(ctx);
    const lines: string[] = [];

    lines.push(`🌲 Session Tree:`);
    lines.push(`  Branch: ${info.branchEntries} entries`);

    if (info.compactions > 0) {
      lines.push(`  Compactions: ${info.compactions}`);
    }
    if (info.forks > 0) {
      lines.push(`  Forks: ${info.forks} in tree`);
    }
    if (info.labels.length > 0) {
      lines.push(`  Labels: ${info.labels.join(", ")}`);
    }

    lines.push(`  (use /tree to navigate, /fork to branch)`);
    return lines;
  }

  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.setWidget("branch-navigator", renderTree(ctx));
    ctx.ui.setStatus("branch-nav", `🌲 ${getTreeInfo(ctx).branchEntries} entries`);
  });

  // Refresh after each turn
  pi.on("turn_end", async (_event, ctx) => {
    ctx.ui.setWidget("branch-navigator", renderTree(ctx));
    ctx.ui.setStatus("branch-nav", `🌲 ${getTreeInfo(ctx).branchEntries} entries`);
  });

  // Refresh after compaction
  pi.on("session_compact", async (_event, ctx) => {
    ctx.ui.setWidget("branch-navigator", renderTree(ctx));
  });

  // Refresh after tree navigation
  pi.on("session_tree", async (_event, ctx) => {
    ctx.ui.setWidget("branch-navigator", renderTree(ctx));
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    ctx.ui.setWidget("branch-navigator", undefined);
    ctx.ui.setStatus("branch-nav", undefined);
  });
}