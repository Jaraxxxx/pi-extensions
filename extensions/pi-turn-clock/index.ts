/**
 * pi-turn-clock — Session stats in footer
 *
 * Shows elapsed time, turn count, total tokens, and estimated cost.
 * All event-driven — no tools or commands needed.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  let sessionStart = 0;
  let turnCount = 0;
  let totalInput = 0;
  let totalOutput = 0;
  let totalCacheRead = 0;
  let totalCacheWrite = 0;
  let modelCost: { input: number; output: number; cacheRead: number; cacheWrite: number } = {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
  };

  function fmtTime(ms: number): string {
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}m ${sec}s`;
  }

  function fmtTokens(n: number): string {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(0)}k`;
    return String(n);
  }

  function estCost(): number {
    return (
      (totalInput / 1000000) * modelCost.input +
      (totalOutput / 1000000) * modelCost.output +
      (totalCacheRead / 1000000) * modelCost.cacheRead +
      (totalCacheWrite / 1000000) * modelCost.cacheWrite
    );
  }

  function render(): string {
    const elapsed = sessionStart ? fmtTime(Date.now() - sessionStart) : "0s";
    const cost = estCost();
    const costStr = cost > 0 ? `$${cost.toFixed(2)}` : '';
    return `⏳ ${elapsed} • ${turnCount} turns • ${fmtTokens(totalInput)}+${fmtTokens(totalOutput)} tokens ${costStr ? '•' : ''} ${costStr}`;
  }

  pi.on("session_start", async (_event, ctx) => {
    sessionStart = Date.now();
    turnCount = 0;
    totalInput = 0;
    totalOutput = 0;
    totalCacheRead = 0;
    totalCacheWrite = 0;
    ctx.ui.setStatus("turn-clock", render());
  });

  pi.on("model_select", async (event) => {
    modelCost = {
      input: event.model.cost?.input ?? 0,
      output: event.model.cost?.output ?? 0,
      cacheRead: event.model.cost?.cacheRead ?? 0,
      cacheWrite: event.model.cost?.cacheWrite ?? 0,
    };
  });

  pi.on("turn_end", async (event, ctx) => {
    turnCount++;
    ctx.ui.setStatus("turn-clock", render());
  });

  pi.on("message_end", async (event, ctx) => {
    if (event.message.role === "assistant") {
      const usage = (event.message as any).usage;
      if (usage) {
        totalInput += usage.input ?? 0;
        totalOutput += usage.output ?? 0;
        totalCacheRead += usage.cacheRead ?? 0;
        totalCacheWrite += usage.cacheWrite ?? 0;
      }
    }
    ctx.ui.setStatus("turn-clock", render());
  });
}