/**
 * pi-prompt-customizer — Per-project system instructions
 *
 * Loads .pi/guidelines.md from the project root and injects it
 * into every system prompt. One file, per-project behavior.
 *
 * Also supports .pi/rules/ directory for multiple rule files.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync, readdirSync } from "fs";
import { resolve, basename } from "path";

function loadGuidelines(cwd: string): { source: string; content: string }[] {
  const results: { source: string; content: string }[] = [];

  // Single file: .pi/guidelines.md
  const guidelinesPath = resolve(cwd, ".pi", "guidelines.md");
  if (existsSync(guidelinesPath)) {
    try {
      const content = readFileSync(guidelinesPath, "utf-8").trim();
      if (content) {
        results.push({ source: "guidelines.md", content });
      }
    } catch {}
  }

  // Directory: .pi/rules/*.md
  const rulesDir = resolve(cwd, ".pi", "rules");
  if (existsSync(rulesDir)) {
    try {
      const files = readdirSync(rulesDir).filter((f) => f.endsWith(".md"));
      for (const file of files.sort()) {
        const content = readFileSync(resolve(rulesDir, file), "utf-8").trim();
        if (content) {
          results.push({ source: file, content });
        }
      }
    } catch {}
  }

  return results;
}

function formatGuidelines(guidelines: { source: string; content: string }[]): string {
  if (guidelines.length === 0) return "";
  const parts = guidelines.map(
    (g) => `[${g.source}]:\n${g.content}`
  );
  return [
    "**Project-specific guidelines (from .pi/):**",
    ...parts,
    "",
    "**IMPORTANT**: Follow these guidelines. They override defaults for this project.",
  ].join("\n");
}

export default function (pi: ExtensionAPI) {
  let guidelines: { source: string; content: string }[] = [];
  let lastLoad = 0;

  function reload(cwd: string) {
    const now = Date.now();
    if (guidelines.length === 0 || now - lastLoad > 15000) {
      guidelines = loadGuidelines(cwd);
      lastLoad = now;
    }
  }

  pi.on("session_start", async (_event, ctx) => {
    reload(ctx.cwd);

    if (guidelines.length > 0) {
      const names = guidelines.map((g) => g.source).join(", ");
      ctx.ui.setStatus("prompt-customizer", `📋 ${guidelines.length} guideline(s): ${names}`);
      ctx.ui.notify(
        `Loaded ${guidelines.length} project guideline(s): ${names}`,
        "info"
      );
    } else {
      ctx.ui.setStatus("prompt-customizer", "📋 No .pi/guidelines.md found");
    }
  });

  pi.on("before_agent_start", async (event, ctx) => {
    reload(ctx.cwd);
    if (guidelines.length === 0) return;

    const text = formatGuidelines(guidelines);
    if (event.systemPrompt.includes(text)) return;

    return { systemPrompt: `${event.systemPrompt}\n\n${text}` };
  });
}