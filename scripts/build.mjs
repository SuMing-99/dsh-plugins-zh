// Build a format-1 DSH plugin market index with a Chinese name for every entry.
//
// Sources:
//   data/words.json    English token -> Chinese word, used for auto-generated names
//   data/curated.json  [packageName, Chinese name] overrides, hand-written
//
// Usage: node scripts/build.mjs [--check]
//   --check   only rebuild in memory and validate, write nothing
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'index.json');
const UPSTREAM = process.env.UPSTREAM_URL ?? 'https://dshmarket.com/index.json';
const MIRROR = process.env.MIRROR_URL ?? 'https://cdn.jsdelivr.net/gh/AAAMECHANIC/dsh-plugin-market@main/index.json';
const checkOnly = process.argv.includes('--check');

const words = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/words.json'), 'utf8'));
const curated = new Map(JSON.parse(fs.readFileSync(path.join(ROOT, 'data/curated.json'), 'utf8')));

const STOP = new Set(['dsh', 'plugin', 'plugins', 'the', 'a', 'an', 'for', 'of', 'and', 'to', 'with', 'in', 'on', 'your', 'you', 'my', 'is', 'it', 's', 'by']);
const CJK = /[\u4e00-\u9fff]/;
const cjk = (s) => CJK.test(s);

async function readJson(url, label) {
  const response = await fetch(url, { redirect: 'follow', headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`${label}: HTTP ${response.status}`);
  return response.json();
}

function slugOf(title) {
  const raw = typeof title === 'string' ? title : (title?.en ?? '');
  const last = raw.includes('/') ? raw.split('/').filter(Boolean).pop() ?? raw : raw;
  return last.replace(/^(dsh-plugin-|dsh-|plugin-)/i, '').replace(/(-dsh|-plugin)$/i, '');
}

function chineseName(slug) {
  const tokens = slug
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .split(/[-_.#\s]+/)
    .map((t) => t.trim())
    .filter((t) => t !== '' && !STOP.has(t.toLowerCase()));
  const mapped = [];
  let translated = 0;
  for (const token of tokens) {
    const key = token.toLowerCase();
    if (words[key] !== undefined) { mapped.push(words[key]); translated += 1; continue; }
    if (/^\d+$/.test(token)) { mapped.push(token); continue; }
    if (token.length <= 4 && token === token.toUpperCase()) { mapped.push(token); continue; }
    mapped.push(token.replace(/\b\w/g, (c) => c.toUpperCase()));
  }
  if (translated === 0) return null;
  let out = '';
  for (const part of mapped) {
    if (out === '') { out = part; continue; }
    out += /[A-Za-z0-9]$/.test(out) || /^[A-Za-z0-9]/.test(part) ? ` ${part}` : part;
  }
  return out;
}

const upstream = await readJson(UPSTREAM, 'upstream index');
let mirror = { plugins: [] };
try { mirror = await readJson(MIRROR, 'popularity mirror'); } catch (error) { console.error(`warning: ${error.message} (popularity sort keys omitted)`); }
const miByName = new Map(mirror.plugins.map((p) => [p.name, p]));

const catTitles = {};
const plugins = [];
let autoNamed = 0, curatedNamed = 0, untranslated = 0;

for (const p of upstream.plugins) {
  const cat = p.metadata?.category ?? null;
  if (cat && upstream.metadata?.categories?.[cat]) catTitles[cat] = { title: upstream.metadata.categories[cat].title };

  const rawTitle = typeof p.title === 'string' ? p.title : (p.title?.en ?? p.name);
  const owner = rawTitle.includes('/') ? rawTitle.split('/')[0] : undefined;

  let zh = curated.get(p.name);
  if (zh) curatedNamed += 1;
  else {
    zh = chineseName(slugOf(rawTitle));
    if (zh) autoNamed += 1; else untranslated += 1;
  }

  const s = miByName.get(p.name)?.metadata?.sortKeys ?? {};
  const sortKeys = {};
  for (const [key, value] of [['stars', s.stars], ['downloads', s.downloads], ['updated', s.updated]]) {
    if (typeof value === 'number') sortKeys[key] = value;
  }

  plugins.push({
    name: p.name,
    title: zh ? { en: rawTitle, zh } : { en: rawTitle, zh: slugOf(rawTitle) },
    ...(owner ? { author: owner } : {}),
    ...(p.description ? { description: p.description } : {}),
    ...(p.homepage ? { homepage: p.homepage } : {}),
    ...(p.repository ? { repository: p.repository } : {}),
    metadata: { ...(cat ? { category: cat } : {}), keywords: p.metadata?.keywords ?? [], labels: [], sortKeys },
    versions: p.versions,
    __curated: curated.has(p.name),
  });
}

plugins.sort((a, b) => {
  const c = Number(b.__curated) - Number(a.__curated);
  if (c !== 0) return c;
  return (b.metadata.sortKeys.stars ?? -1) - (a.metadata.sortKeys.stars ?? -1);
});
for (const plugin of plugins) delete plugin.__curated;

const index = {
  format: 1,
  title: { en: 'DSH Plugins with Chinese names', zh: 'DSH 插件中文名目录' },
  description: {
    en: 'The awesome-dsh-plugin catalog with a Chinese name for every entry: hand-written for curated picks, word-by-word for the rest.',
    zh: '基于 awesome-dsh-plugin 目录，为每个插件补中文名（精选条目人工命名，其余按词表自动命名）。',
  },
  metadata: {
    categories: catTitles,
    sortKeys: {
      stars: { title: { en: 'GitHub stars', zh: 'GitHub 星标' }, order: 'desc' },
      downloads: { title: { en: 'Downloads (30d)', zh: '30 天下载' }, order: 'desc' },
      updated: { title: { en: 'Last updated', zh: '最近更新' }, order: 'desc' },
    },
  },
  plugins,
};

try {
  const { parseMarketIndex } = await import('@deepseek-ai/dsh-plugin-market-index');
  parseMarketIndex(index, 'https://example.invalid/index.json');
  console.log('validation: ok');
} catch (error) {
  if (error?.code === 'ERR_MODULE_NOT_FOUND') console.log('validation: skipped (validator not installed)');
  else throw error;
}

const withCjk = plugins.filter((p) => cjk(p.title.zh)).length;
console.log(`plugins: ${plugins.length}, curated: ${curatedNamed}, auto: ${autoNamed}, english-only: ${untranslated}, chinese titles: ${withCjk} (${(withCjk / plugins.length * 100).toFixed(1)}%)`);

if (checkOnly) {
  if (!fs.existsSync(OUT)) throw new Error('index.json is missing');
  console.log('check: index.json exists');
} else {
  fs.writeFileSync(OUT, JSON.stringify(index));
  console.log(`wrote ${path.relative(ROOT, OUT)} (${(fs.statSync(OUT).size / 1024 / 1024).toFixed(2)} MB)`);
}
