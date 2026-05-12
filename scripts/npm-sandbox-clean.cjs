#!/usr/bin/env node
/**
 * Spawn npm with sandbox-injected legacy env removed so npm 11+ does not warn:
 * "Unknown env config devdir" (e.g. Cursor sets npm_config_devdir for node-gyp).
 *
 * Usage: node scripts/npm-sandbox-clean.cjs install
 *        node scripts/npm-sandbox-clean.cjs run build
 */
"use strict";

const { spawnSync } = require("node:child_process");

const env = { ...process.env };
for (const key of Object.keys(env)) {
  if (key.toLowerCase() === "npm_config_devdir") {
    delete env[key];
  }
}

const isWin = process.platform === "win32";
const npm = isWin ? "npm.cmd" : "npm";
const result = spawnSync(npm, process.argv.slice(2), {
  stdio: "inherit",
  env,
  shell: isWin,
});

process.exit(result.status === null ? 1 : result.status);
