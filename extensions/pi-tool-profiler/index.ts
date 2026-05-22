/**
 * pi-tool-profiler — Tool performance metrics
 *
 * Tracks every tool execution: latency, call count, errors.
 * Shows per-tool stats as a widget above the editor.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

interface ToolMetrics {
  name: string;
  calls: number;
  errors: number;
  totalMs: number;
  avgMs: number;
  lastMs: number;
}

export default function (pi: ExtensionAPI) {
  const metrics = new Map<string, ToolMetrics>();
  const activeTimers = new Map<string, number>();

  function ensure(name: string): ToolMetrics {
    if (!metrics.has(name)) {
      metrics.set(name, { name, calls: 0, errors: 0, totalMs: 0, avgMs: 0, lastMs: 0 });
    }
    return metrics.get(name)!;
  }

  pi.on("tool_execution_start", async (event) => {
    activeTimers.set(event.toolCallId, Date.now());
  });

  pi.on("tool_execution_end", async (event, ctx) => {
    const start = activeTimers.get(event.toolCallId);
    activeTimers.delete(event.toolCallId);
    if (!start) return;

    const durationMs = Date.now() - start;
    const m = ensure(event.toolName);
    m.calls++;
    if (event.isError) m.errors++;
    m.totalMs += durationMs;
    m.avgMs = m.totalMs / m.calls;
    m.lastMs = durationMs;

    renderWidget(ctx);
  });

  function renderWidget(ctx: any) {
    const sorted = Array.from(metrics.values())
      .filter((m) => m.calls > 0)
      .sort((a, b) => b.totalMs - a.totalMs)
      .slice(0, 7);

    if (sorted.length === 0) {
      ctx.ui.setWidget("tool-profiler", undefined);
      return;
    }

    const lines = [`⏱ Tool Profiler (turn #...):`];
    for (const m of sorted) {
      const ms = m.lastMs >= 1000
        ? `${(m.lastMs / 1000).toFixed(1)}s`
        : `${m.lastMs}ms`;
      const avg = m.avgMs >= 1000
        ? `${(m.avgMs / 1000).toFixed(1)}s`
        : `${m.avgMs.toFixed(0)}ms`;
      const err = m.errors > 0 ? ` 🔴${m.errors}` : "";
      lines.push(`  ${m.name}: ${m.calls} calls${err} • avg ${avg} • last ${ms}`);
    }
    ctx.ui.setWidget("tool-profiler", lines);
  }

  // Reset per-session
  pi.on("session_start", async (_event, ctx) => {
    metrics.clear();
    activeTimers.clear();
    ctx.ui.setWidget("tool-profiler", undefined);
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    ctx.ui.setWidget("tool-profiler", undefined);
  });
}