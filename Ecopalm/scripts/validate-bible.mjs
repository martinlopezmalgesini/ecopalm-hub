// Run before every build: node scripts/validate-bible.mjs
import { readFileSync } from 'node:fs';

const path = new URL('../src/data/brokerBible.json', import.meta.url);
const bible = JSON.parse(readFileSync(path, 'utf8'));
const errors = [];
const err = (m) => errors.push(m);

const ids = new Set();
const sectors = new Set(bible.sectors.map((s) => s.id));
const stages = new Set(bible.stages.map((s) => s.id));
const levels = new Set(['foundation', 'core', 'advanced']);
const confs = new Set(['high', 'medium', 'verify']);

for (const e of bible.entries) {
  if (ids.has(e.id)) err(`duplicate id ${e.id}`);
  ids.add(e.id);
  for (const f of ['title', 'in_plain_words', 'in_detail', 'sector', 'stages', 'level', 'confidence'])
    if (!e[f] || (Array.isArray(e[f]) && e[f].length === 0)) err(`${e.id}: missing ${f}`);
  if (!sectors.has(e.sector)) err(`${e.id}: unknown sector ${e.sector}`);
  (e.stages || []).forEach((s) => { if (!stages.has(s)) err(`${e.id}: unknown stage ${s}`); });
  if (!levels.has(e.level)) err(`${e.id}: bad level`);
  if (!confs.has(e.confidence)) err(`${e.id}: bad confidence`);
  if (e.confidence === 'verify' && !e.verify_note) err(`${e.id}: 'verify' entries need a verify_note`);
  if (e.last_verified && !/^\d{4}-\d{2}-\d{2}$/.test(e.last_verified)) err(`${e.id}: bad last_verified`);
  if (/\b[VC]\d{1,2}\b|P-B-P/.test(JSON.stringify(e))) err(`${e.id}: table-style label found`);
}
for (const e of bible.entries) (e.related || []).forEach((r) => { if (!ids.has(r)) err(`${e.id}: related id ${r} does not exist`); });
for (const s of bible.scenarios) {
  if (!stages.has(s.stage) || !sectors.has(s.sector)) err(`${s.id}: bad stage or sector`);
  if (!(s.correct >= 0 && s.correct < s.options.length)) err(`${s.id}: correct index out of range`);
  (s.related || []).forEach((r) => { if (!ids.has(r)) err(`${s.id}: related id ${r} does not exist`); });
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`OK: ${bible.entries.length} entries, ${bible.scenarios.length} scenarios, ${bible.stages.length} stages`);
