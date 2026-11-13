#!/usr/bin/env bash
# Deterministic boundary checks. Prints paths, never possible secret contents.
set -euo pipefail
cd "$(dirname "$0")/.."
node - "$@" <<'NODE'
'use strict';
const fs = require('fs');
const path = require('path');
const requested = process.argv.slice(2);
const rules = ['R1', 'R2', 'R3', 'R4'];
if (requested.some(id => !rules.includes(id))) {
  console.error('Unknown rule. Use R1, R2, R3, R4 or no arguments.');
  process.exit(2);
}
const selected = new Set(requested.length ? requested : rules);
const files = [];
function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git'].includes(item.name)) continue;
    const name = path.join(dir, item.name);
    if (item.isDirectory()) walk(name);
    else if (item.isFile()) files.push(name);
  }
}
walk('miniprogram');
let failed = false;
function report(id, file, reason) {
  if (!selected.has(id)) return;
  failed = true;
  console.error(`[${id}] ${file}: ${reason}`);
}
for (const file of files) {
  const ext = path.extname(file).toLowerCase();
  if (['.html', '.htm', '.vue', '.jsx', '.tsx'].includes(ext)) {
    report('R4', file, 'Only native mini-program pages are permitted.');
  }
  if (!['.js', '.json', '.wxml', '.wxss'].includes(ext)) continue;
  const source = fs.readFileSync(file, 'utf8');
  if (/\b(api_?key|app_?secret|secret_?key|secret_?id)\b["']?\s*[:=]|\bsk-[A-Za-z0-9_-]{16,}|\bAKID[A-Za-z0-9]{12,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/i.test(source)) {
    report('R1', file, 'Client-side provider secret field or key marker found.');
  }
  if (/\bwx\s*\.\s*cloud\s*\.\s*database\s*\(/.test(source)) {
    report('R2', file, 'Direct client cloud database access is forbidden.');
  }
  if (file.startsWith(path.join('miniprogram', 'pages') + path.sep) && /\bwx\s*\.\s*(?:setStorage|removeStorage|clearStorage)(?:Sync)?\s*\(/.test(source)) {
    report('R3', file, 'Page storage mutations must go through repository.');
  }
}
if (failed) process.exit(1);
console.log(`Project boundaries passed (${[...selected].join(', ')}).`);
NODE
