/**
 * pi-project-detector — Stack auto-detection
 *
 * Scans the project root for package.json, Cargo.toml, go.mod, etc.
 * Injects a "Project stack" block into the system prompt so the LLM
 * uses the correct framework conventions, package manager, and idioms.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

interface ProjectStack {
  language: string;
  framework: string;
  buildTool: string;
  packageManager: string;
  runtime: string;
}

function detect(cwd: string): ProjectStack {
  const stack: ProjectStack = {
    language: "unknown",
    framework: "none",
    buildTool: "unknown",
    packageManager: "unknown",
    runtime: "none",
  };

  // Node.js / TypeScript
  if (existsSync(resolve(cwd, "package.json"))) {
    stack.language = "TypeScript/JavaScript";
    stack.runtime = "Node.js";

    try {
      const pkg = JSON.parse(
        readFileSync(resolve(cwd, "package.json"), "utf-8")
      );
      const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

      if (deps.next) stack.framework = `Next.js ${deps.next}`;
      else if (deps.react && deps.vite) stack.framework = "React (Vite)";
      else if (deps.react) stack.framework = "React";
      else if (deps.vue) stack.framework = "Vue";
      else if (deps.svelte) stack.framework = "Svelte";
      else if (deps.astro) stack.framework = "Astro";
      else if (deps.express) stack.framework = "Express";
      else if (deps.fastify) stack.framework = "Fastify";

      if (deps.typescript || pkg.devDependencies?.typescript) {
        stack.language = "TypeScript";
      }

      if (existsSync(resolve(cwd, "pnpm-lock.yaml")))
        stack.packageManager = "pnpm";
      else if (existsSync(resolve(cwd, "yarn.lock")))
        stack.packageManager = "yarn";
      else if (existsSync(resolve(cwd, "bun.lockb")))
        stack.packageManager = "bun";
      else stack.packageManager = "npm";

      if (pkg.scripts?.build) {
        if (pkg.scripts.build.includes("tsc")) stack.buildTool = "tsc";
        else if (pkg.scripts.build.includes("vite")) stack.buildTool = "vite";
        else if (pkg.scripts.build.includes("webpack")) stack.buildTool = "webpack";
        else if (pkg.scripts.build.includes("next"))
          stack.buildTool = "next build";
        else stack.buildTool = "custom";
      }
    } catch {}
  }

  // Rust
  if (existsSync(resolve(cwd, "Cargo.toml"))) {
    stack.language = "Rust";
    stack.buildTool = "cargo";
    stack.runtime = "Rust toolchain";
  }

  // Go
  if (existsSync(resolve(cwd, "go.mod"))) {
    stack.language = "Go";
    stack.buildTool = "go build";
    stack.runtime = "Go toolchain";
  }

  // Python
  if (existsSync(resolve(cwd, "pyproject.toml"))) {
    stack.language = "Python";
    stack.buildTool = "pip/poetry";
    stack.runtime = "Python";
  } else if (existsSync(resolve(cwd, "requirements.txt"))) {
    stack.language = "Python";
    stack.runtime = "Python";
  }

  return stack;
}

function format(stack: ProjectStack): string {
  const parts = [`**Project stack (auto-detected):**`];
  if (stack.framework !== "none")
    parts.push(`- Framework: ${stack.framework}`);
  parts.push(`- Language: ${stack.language}`);
  if (stack.packageManager !== "unknown")
    parts.push(`- Package manager: ${stack.packageManager}`);
  if (stack.buildTool !== "unknown")
    parts.push(`- Build tool: ${stack.buildTool}`);
  parts.push(
    "- **IMPORTANT**: Use the conventions, idioms, and tooling of this stack. Do not use npm for a pnpm project, do not use yarn for a bun project."
  );
  return parts.join("\n");
}

export default function (pi: ExtensionAPI) {
  let stack: ProjectStack | null = null;

  pi.on("session_start", async (_event, ctx) => {
    stack = detect(ctx.cwd);
    const short = stack.framework !== "none"
      ? stack.framework.split(" ")[0]
      : stack.language;
    ctx.ui.setStatus("project", `📦 ${short} • ${stack.packageManager}`);
  });

  pi.on("before_agent_start", async (event, _ctx) => {
    if (!stack) return;
    const contextStr = format(stack);
    if (event.systemPrompt.includes(contextStr)) return;
    return {
      systemPrompt: `${event.systemPrompt}\n\n${contextStr}`,
    };
  });
}