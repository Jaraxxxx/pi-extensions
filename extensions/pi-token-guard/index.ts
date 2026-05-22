/**
 * pi-token-guard — Context usage monitor
 *
 * Shows a live context window bar in the footer with green/yellow/red
 * thresholds. Warns via notification when approaching limits.
 *
 * Uses ONLY events — no tools or commands (works around pi 0.75.4 bug).
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

interface TokenStats {
  contextWindow: number;
  usedTokens: number;
  pct: number;
  perTurn: number[];
}

export default function (pi: ExtensionAPI) {
  const stats: TokenStats = {
    contextWindow: 200000,
    usedTokens: 0,
    pct: 0,
    perTurn: [],
  };

  let warningShown = false;

  // Color logic
  function pctColor(pct: number): "success" | "warning" | "error" | "muted" {
    if (pct >= 90) return "error";
    if (pct >= 75) return "warning";
    if (pct >= 50) return "muted";
    return "success";
  }

  // Progress bar: ████████░░░░
  function bar(pct: number, width: number = 10): string {
    const filled = Math.round((pct / 100) * width);
    const empty = width - filled;
    const color = pctColor(pct);
    const filledCh = color === "error" ? "█" : color === "warning" ? "▓" : "░";
    return `${filledCh.repeat(filled)}${"·".repeat(empty)}`;
  }

  function render(): string {
    const { pct, usedTokens, contextWindow } = stats;
    const usedK = usedTokens > 1000 ? `${(usedTokens / 1000).toFixed(1)}k` : usedTokens;
    const maxK = `${(contextWindow / 1000).toFixed(0)}k`;
    return `📊 ${bar(pct)} ${usedK}/${maxK} (${pct.toFixed(0)}%)`;
  }

  // Detect model context window from model_select
  pi.on("model_select", async (event, ctx) => {
    stats.contextWindow = event.model.contextWindow ?? 200000;
    ctx.ui.setStatus("token-guard", render());
  });

  // Track context usage changes
  pi.on("session_start", async (_event, ctx) => {
    const usage = ctx.getContextUsage();
    if (usage?.tokens) {
      stats.usedTokens = usage.tokens;
      stats.pct = (usage.tokens / stats.contextWindow) * 100;
    }
    ctx.ui.setStatus("token-guard", render());
    warningShown = false;
  });

  pi.on("turn_end", async (_event, ctx) => {
    const usage = ctx.getContextUsage();
    if (usage?.tokens) {
      stats.usedTokens = usage.tokens;
      stats.pct = (usage.tokens / stats.contextWindow) * 100;
      stats.perTurn.push(usage.tokens);
      if (stats.perTurn.length > 20) stats.perTurn.shift();
    }
    ctx.ui.setStatus("token-guard", render());

    // Warning thresholds
    if (stats.pct >= 90 && !warningShown) {
      ctx.ui.notify(
        `🚨 Context at ${stats.pct.toFixed(0)}% — ${stats.contextWindow - stats.usedTokens} tokens remaining. Consider /compact.`,
        "error"
      );
      warningShown = true;
    } else if (stats.pct >= 75 && !warningShown) {
      ctx.ui.notify(
        `⚠️ Context at ${stats.pct.toFixed(0)}% — compaction may help.`,
        "warning"
      );
      warningShown = true;
    } else if (stats.pct < 75) {
      warningShown = false;
    }
  });

  pi.on("message_end", async (event, ctx) => {
    if (event.message.role === "assistant") {
      const usage = ctx.getContextUsage();
      if (usage?.tokens) {
        stats.usedTokens = usage.tokens;
        stats.pct = (usage.tokens / stats.contextWindow) * 100;
        ctx.ui.setStatus("token-guard", render());
      }
    }
  });

  // Clear on compaction — context is freed
  pi.on("session_compact", async (_event, ctx) => {
    const usage = ctx.getContextUsage();
    if (usage?.tokens) {
      stats.usedTokens = usage.tokens;
      stats.pct = (usage.tokens / stats.contextWindow) * 100;
    }
    ctx.ui.setStatus("token-guard", render());
    warningShown = false;
    ctx.ui.notify("🔄 Compaction complete — context freed", "info");
  });

  // Clean up on shutdown
  pi.on("session_shutdown", async (_event, ctx) => {
    ctx.ui.setStatus("token-guard", undefined);
  });
}