// Utilities for the Legal Shield (Blindaje Legal) module.

const STORAGE_KEY = 'ecopalm.playbook.v1';

// Hemos añadido "notes: {}" al estado inicial
export const emptyProgress = () => ({ learned: {}, gates: {}, scenarios: {}, flash: {}, notes: {} });

export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProgress();
    
    const parsed = JSON.parse(raw);
    // Hacemos una fusión segura capa por capa para evitar fallos si hay versiones antiguas guardadas
    return {
      learned: parsed.learned || {},
      gates: parsed.gates || {},
      scenarios: parsed.scenarios || {},
      flash: parsed.flash || {},
      notes: parsed.notes || {}
    };
  } catch {
    return emptyProgress();
  }
}

export function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    console.error("No se pudo guardar el progreso en el localStorage.");
  }
}

export const normalize = (s = '') =>
  String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

export const CONFIDENCE = {
  high: { label: 'Alta', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  medium: { label: 'Media', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  verify: { label: 'Verificar', className: 'bg-red-50 text-red-700 border-red-200' },
};

const LEVEL_RANK = { foundation: 0, core: 1, advanced: 2 };
export const LEVEL_LABEL = { foundation: 'Fundamentos', core: 'Núcleo', advanced: 'Avanzado' };

export function searchEntries(entries, query) {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return entries;
  const scored = [];
  for (const e of entries) {
    const fields = [
      [normalize(e.title), 5],
      [normalize((e.aliases || []).join(' ')), 4],
      [normalize(e.in_plain_words), 3],
      [normalize(e.id), 2],
      [normalize(e.in_detail), 1],
      [normalize((e.options_and_variants || []).join(' ')), 1],
      [normalize((e.risks_and_red_flags || []).join(' ')), 1],
    ];
    let total = 0;
    let allMatch = true;
    for (const t of tokens) {
      let best = 0;
      for (const [text, w] of fields) if (text.includes(t)) best = Math.max(best, w);
      if (best === 0) { allMatch = false; break; }
      total += best;
    }
    if (allMatch) scored.push([total, e]);
  }
  return scored.sort((a, b) => b[0] - a[0]).map(([, e]) => e);
}

export function buildLearningPath(entries, stages) {
  const stageOrder = Object.fromEntries(stages.map((s) => [s.id, s.order]));
  const minStage = (e) => Math.min(...(e.stages || []).map((s) => stageOrder[s] ?? 99), 99);
  return [...entries].sort(
    (a, b) =>
      LEVEL_RANK[a.level] - LEVEL_RANK[b.level] ||
      minStage(a) - minStage(b) ||
      a.title.localeCompare(b.title)
  );
}

const INTERVAL_DAYS = [0, 1, 3, 7];
const DAY = 24 * 60 * 60 * 1000;

export function reviewCard(flash, id, knewIt, now = Date.now()) {
  const prev = flash[id]?.box ?? 0;
  const box = knewIt ? Math.min(prev + 1, 3) : 0;
  return { ...flash, [id]: { box, due: now + INTERVAL_DAYS[box] * DAY } };
}

export function dueCards(pathEntries, learned, flash, now = Date.now()) {
  return pathEntries.filter((e) => learned[e.id] && (flash[e.id]?.due ?? 0) <= now);
}