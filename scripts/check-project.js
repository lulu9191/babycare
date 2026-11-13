const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '..');
const mini = path.join(root, 'miniprogram');
function files(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(dir, entry.name)) : [path.join(dir, entry.name)]); }
const errors = [];
for (const file of files(mini)) {
  if (file.endsWith('.json')) {
    try { JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) { errors.push(`${file}: ${error.message}`); }
  }
  if (file.endsWith('.js')) {
    const check = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (check.status !== 0) errors.push(check.stderr);
  }
}
const app = JSON.parse(fs.readFileSync(path.join(mini, 'app.json'), 'utf8'));
let pages = 0;
for (const route of app.pages) {
  for (const ext of ['js', 'json', 'wxml', 'wxss']) if (!fs.existsSync(path.join(mini, route + '.' + ext))) errors.push(`Missing ${route}.${ext}`);
  const script = path.join(mini, route + '.js');
  const template = path.join(mini, route + '.wxml');
  if (!fs.existsSync(script) || !fs.existsSync(template)) continue;
  let definition;
  global.Page = value => { definition = value; };
  global.getApp = () => ({ globalData: {} });
  try { require(script); } catch (error) { errors.push(`${route}: ${error.message}`); continue; }
  if (!definition) { errors.push(`No Page definition: ${route}`); continue; }
  const markup = fs.readFileSync(template, 'utf8');
  const bindings = [...markup.matchAll(/(?:bind|catch)(?::?[\w]+)\s*=\s*["']([\w]+)["']/g)];
  for (const match of bindings) if (typeof definition[match[1]] !== 'function') errors.push(`${route}: missing handler ${match[1]}`);
  const stack = [];
  const cleaned = markup.replace(/<!--[\s\S]*?-->/g, '');
  const tags = [...cleaned.matchAll(/<(\/?)([\w:-]+)((?:[^>"']|"[^"]*"|'[^']*')*)>/g)];
  for (const [, closing, name, attrs] of tags) {
    if (closing) { const top = stack.pop(); if (top !== name) errors.push(`${route}: closing ${name}, expected ${top}`); }
    else if (!/\/\s*$/.test(attrs)) stack.push(name);
  }
  if (stack.length) errors.push(`${route}: unclosed tags ${stack.join(', ')}`);
  pages++;
}
for (const tab of app.tabBar.list) if (!app.pages.includes(tab.pagePath)) errors.push(`Unknown tab ${tab.pagePath}`);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Checked ${pages} pages: JavaScript, JSON, WXML tag balance, event handlers and tab routes.`);
