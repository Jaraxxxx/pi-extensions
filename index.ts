/**
 * pi-extensions — Central extension manager
 *
 * One extension to rule them all. Loads all sub-extensions
 * with zero-config, or individually via pi install.
 *
 * Auto-discovers extensions/ subdirs and loads them.
 * Users toggle on/off via /extensions or settings.
 */

import { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as path from "path";
import { readdirSync, existsSync, readFileSync } from "fs";

// --- Sub-extension loader ---

interface SubExtension {
  name: string;
  description: string;
  path: string;
  enabled: boolean;
}

function discoverExtensions(extensionsDir: string): SubExtension[] {
  if (!existsSync(extensionsDir)) return [];
  return readdirSync(extensionsDir, { withFileTypes: true })
    .filter(
      (d) =>
        d.isDirectory() &&
        !d.name.startsWith(".") &&
        !d.name.startsWith("node_modules")
    )
    .filter((d) => existsSync(path.join(extensionsDir, d.name, "index.ts")))
    .map((d) => ({
      name: d.name,
      description: "A pi extension",
      path: path.join(extensionsDir, d.name, "index.ts"),
      enabled: true,
    }));
}

function loadExtensionManifest(ext: SubExtension) {
  const pkgPath = path.join(path.dirname(ext.path), "package.json");
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(
        readFileSync(pkgPath, "utf-8")
      );
      if (pkg.description) ext.description = pkg.description;
    } catch {}
  }
}

export default async function (pi: ExtensionAPI) {
  const extensionsDir = path.join(__dirname, "extensions");
  const subs = discoverExtensions(extensionsDir);

  // Load manifests for descriptions
  for (const sub of subs) {
    loadExtensionManifest(sub);
  }

  // State: which extensions are enabled
  const enabled = new Map<string, boolean>();
  for (const sub of subs) {
    enabled.set(sub.name, true);
  }

  // Restore state from session entries on start
  pi.on("session_start", async (_event, ctx) => {
    const entries = ctx.sessionManager.getEntries();
    for (const entry of entries) {
      if (
        entry.type === "custom" &&
        (entry as any).customType === "pi-extensions-config"
      ) {
        const data = (entry as any).data;
        if (data?.extensions) {
          for (const [name, en] of Object.entries(data.extensions)) {
            enabled.set(name, en as boolean);
          }
        }
      }
    }
  });

  // TODO: re-enable when bug is fixed
  // // Store config
  // pi.appendEntry("pi-extensions-config", {
  //   extensions: Object.fromEntries(enabled),
  // });

  // Status bar: loaded count
  const activeCount = () =>
    Array.from(enabled.values()).filter(Boolean).length;

  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.setStatus(
      "pi-extensions",
      `🧩 ${activeCount()}/${subs.length} extensions`
    );
  });

  // TODO: re-enable commands when bug is fixed
  // pi.registerCommand("extensions", {
  //   description: "Manage pi extensions — list, enable, disable",
  //   handler: async (_args, ctx) => {
  //     const items = subs.map(
  //       (s) => `${enabled.get(s.name) ? "✅" : "⬜"} ${s.name} — ${s.description}`
  //     );
  //     ctx.ui.setWidget("extensions-list", items);
  //     ctx.ui.notify(`${activeCount()}/${subs.length} extensions active`, "info");
  //   },
  // });

  // pi.registerCommand("ext:toggle", {
  //   description: "Toggle an extension on/off — /ext:toggle <name>",
  //   handler: async (args, ctx) => {
  //     const name = args?.trim();
  //     if (!name || !enabled.has(name)) {
  //       ctx.ui.notify(`Unknown extension: "${name}"`, "error");
  //       return;
  //     }
  //     const newState = !enabled.get(name);
  //     enabled.set(name, newState);
  //     ctx.ui.notify(
  //       `${newState ? "✅ Enabled" : "⬜ Disabled"} ${name}`,
  //       "info"
  //     );
  //   },
  // });

  // Widget showing loaded extensions at startup
  pi.on("session_start", async (_event, ctx) => {
    if (subs.length === 0) return;
    const lines = subs
      .filter((s) => enabled.get(s.name))
      .map(
        (s) =>
          `  ${enabled.get(s.name) ? "✅" : "⬜"} ${s.name}${
            s.description ? " — " + s.description : ""
          }`
      );
    ctx.ui.setWidget("extensions-loaded", [
      `🧩 pi-extensions v1.0 (${activeCount()} active):`,
      ...lines,
    ]);
  });

  // Clear widget after 3 seconds
  setTimeout(() => {
    // Will be cleared on next render
  }, 5000);

  // Load all sub-extensions
  for (const sub of subs) {
    if (!enabled.get(sub.name)) continue;
    try {
      const mod = require(sub.path);
      if (typeof mod.default === "function") {
        await mod.default(pi);
      }
    } catch (e: any) {
      console.error(
        `[pi-extensions] Failed to load ${sub.name}:`,
        e.message
      );
    }
  }

  pi.on("session_start", async (_event, ctx) => {
    const msg = subs.length > 0
      ? `Loaded ${activeCount()}/${subs.length} extensions: ${subs.filter(s => enabled.get(s.name)).map(s => s.name.replace("pi-", "")).join(", ")}`
      : "No sub-extensions found in extensions/";
    ctx.ui.notify(msg, "info");
  });
}