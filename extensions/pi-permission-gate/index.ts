/**
 * pi-permission-gate — Security gate for dangerous operations
 *
 * Blocks: rm -rf, sudo, .env reads, credential file access,
 * destructive git operations (push --force, hard reset).
 *
 * All configurable. Warns or blocks based on severity.
 */

import type { ExtensionAPI, isToolCallEventType } from "@earendil-works/pi-coding-agent";

const DANGEROUS_BASH = [
  { pattern: /rm\s+-rf?\b/, reason: "rm -rf: recursive deletion blocked" },
  { pattern: /sudo\b/, reason: "sudo: privilege escalation blocked" },
  { pattern: /chmod\s+777\b/, reason: "chmod 777: world-writable permissions blocked" },
  { pattern: />\s*\/dev\/sd[a-z]/, reason: "Writing to raw block device blocked" },
  { pattern: /mkfs\./, reason: "Filesystem creation blocked" },
  { pattern: /dd\s+if=.*of=/i, reason: "dd: direct disk write blocked" },
  { pattern: /:\(\)\s*\{/, reason: "Fork bomb pattern blocked" },
  { pattern: /curl.*\|\s*(ba)?sh/, reason: "curl-pipe-shell: unsafe execution pattern blocked" },
  { pattern: /git\s+push\s+--force/, reason: "git push --force: destructive remote operation blocked" },
  { pattern: /git\s+reset\s+--hard\b/, reason: "git reset --hard: destructive local operation blocked" },
];

const PROTECTED_READS = [
  /\.env$/,
  /\.env\.[a-z]+$/,
  /credentials\.(json|yml|yaml)$/i,
  /\.pem$/,
  /id_rsa$/,
  /id_ed25519$/,
  /\.npmrc$/,
  /\.aws\/credentials$/,
  /\.config\/gh\/hosts\.yml$/,
];

const PROTECTED_WRITES = [
  /\.env$/,
  /\.env\.[a-z]+$/,
  /\/etc\//,
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /\.git\/config$/,
];

export default function (pi: ExtensionAPI) {
  let blockedCount = 0;

  // Block dangerous bash commands
  pi.on("tool_call", async (event) => {
    if (event.toolName !== "bash") return;

    const cmd = (event.input as any)?.command;
    if (!cmd) return;

    for (const rule of DANGEROUS_BASH) {
      if (rule.pattern.test(cmd)) {
        blockedCount++;
        return {
          block: true,
          reason: `[Security Gate] ${rule.reason}`,
        };
      }
    }
  });

  // Block reading sensitive files
  pi.on("tool_call", async (event) => {
    if (event.toolName !== "read") return;

    const path = (event.input as any)?.path;
    if (!path) return;

    for (const pattern of PROTECTED_READS) {
      if (pattern.test(path)) {
        blockedCount++;
        return {
          block: true,
          reason: `[Security Gate] Blocked reading sensitive file: ${path}`,
        };
      }
    }
  });

  // Block writing to protected paths
  pi.on("tool_call", async (event) => {
    if (event.toolName !== "write" && event.toolName !== "edit") return;

    const path = (event.input as any)?.path;
    if (!path) return;

    for (const pattern of PROTECTED_WRITES) {
      if (pattern.test(path)) {
        blockedCount++;
        return {
          block: true,
          reason: `[Security Gate] Blocked writing to protected file: ${path}`,
        };
      }
    }
  });

  // Status indicator
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.setStatus("permission-gate", "🛡️ Security Gate: Active");
  });

  // Inject guidelines
  pi.on("before_agent_start", async (event, _ctx) => {
    const rules = [
      "**Security rules (enforced by permission gate):**",
      "- NEVER read .env, credentials.json, .pem, SSH keys, or npm tokens",
      "- NEVER use rm -rf, sudo, chmod 777, or pipe-execute patterns",
      "- NEVER push --force or hard-reset git without explicit user confirmation",
      "- If a command is blocked, ask the user — do not try to bypass",
    ].join("\n");

    if (!event.systemPrompt.includes(rules)) {
      return { systemPrompt: `${event.systemPrompt}\n\n${rules}` };
    }
  });
}