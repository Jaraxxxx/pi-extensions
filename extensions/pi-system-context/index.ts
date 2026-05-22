/**
 * pi-system-context — Environment awareness for the LLM
 *
 * Injects system info (OS, shell, git branch, runtime versions)
 * into every prompt so the LLM uses correct conventions without guessing.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

interface SystemInfo {
  os: string;
  shell: string;
  nodeVersion: string;
  gitBranch: string;
  gitStatus: string;
  lastCommit: string;
  home: string;
}

async function gatherInfo(pi: ExtensionAPI): Promise<SystemInfo> {
  const info: SystemInfo = {
    os: process.platform,
    shell: process.env.SHELL ?? process.env.ComSpec ?? "unknown",
    nodeVersion: process.version,
    gitBranch: "unknown",
    gitStatus: "unknown",
    lastCommit: "none",
    home: process.env.HOME ?? process.env.USERPROFILE ?? "/home/user",
  };

  try {
    const { stdout: branch } = await pi.exec("git", [
      "rev-parse",
      "--abbrev-ref",
      "HEAD",
    ]);
    info.gitBranch = branch.trim();
  } catch {}

  try {
    const { stdout: status } = await pi.exec("git", [
      "status",
      "--porcelain",
    ]);
    const lines = status.trim().split("\n").filter(Boolean);
    if (lines.length === 0) {
      info.gitStatus = "clean";
    } else {
      const mod = lines.filter((l) => l.match(/^ [DM]/)).length;
      const unt = lines.filter((l) => l.match(/^\?\?/)).length;
      const stag = lines.filter((l) => l.match(/^[MADRCU]/)).length;
      info.gitStatus = `${mod} mod, ${stag} staged, ${unt} untracked`;
    }
  } catch {}

  try {
    const { stdout: commit } = await pi.exec("git", [
      "log",
      "-1",
      "--oneline",
    ]);
    info.lastCommit = commit.trim();
  } catch {}

  return info;
}

function format(info: SystemInfo): string {
  return [
    `**System environment (auto-detected):**`,
    `- OS: ${info.os}`,
    `- Shell: ${info.shell}`,
    `- Node.js: ${info.nodeVersion}`,
    `- Git branch: \`${info.gitBranch}\` (status: ${info.gitStatus})`,
    `- Last commit: ${info.lastCommit}`,
  ].join("\n");
}

export default function (pi: ExtensionAPI) {
  let systemInfo: SystemInfo | null = null;
  let lastGather = 0;

  async function ensureInfo() {
    const now = Date.now();
    if (!systemInfo || now - lastGather > 30000) {
      systemInfo = await gatherInfo(pi);
      lastGather = now;
    }
    return systemInfo;
  }

  // Inject system context into every prompt
  pi.on("before_agent_start", async (event, _ctx) => {
    const info = await ensureInfo();
    const contextStr = format(info);
    const updated = event.systemPrompt.includes(contextStr)
      ? event.systemPrompt
      : `${event.systemPrompt}\n\n${contextStr}`;
    return { systemPrompt: updated };
  });

  // Show compact version in footer
  pi.on("session_start", async (_event, ctx) => {
    const info = await ensureInfo();
    const short = `${info.os} • git:${info.gitBranch}`;
    ctx.ui.setStatus("system-context", `🖥 ${short}`);
  });

  // Refresh on turn start to catch git changes
  pi.on("turn_start", async () => {
    // Will re-gather on next before_agent_start if >30s
    lastGather = 0;
  });
}