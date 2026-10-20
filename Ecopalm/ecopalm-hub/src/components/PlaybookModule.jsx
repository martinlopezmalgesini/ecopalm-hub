import React, { useEffect, useMemo, useState } from 'react';
import { fetchUserNotes, upsertUserNote, fetchPlaybookProgress, updatePlaybookProgress } from '../services/cloudSync';
import {
  BookOpen, Search, AlertTriangle, ChevronDown, ChevronUp, CheckCircle, Layers,
  Target, GraduationCap, Calculator, Link2, RotateCcw, ListChecks, Edit3, Save
} from 'lucide-react';
import bible from '../data/brokerBible.json';
import CostStackCalculator from './CostStackCalculator';
import {
  loadProgress, saveProgress, searchEntries, buildLearningPath,
  CONFIDENCE, LEVEL_LABEL, reviewCard, dueCards,
} from './playbookUtils';

const TABS = [
  { id: 'library', label: 'Biblioteca', icon: BookOpen },
  { id: 'stages', label: 'Etapas', icon: Layers },
  { id: 'scenarios', label: 'Escenarios', icon: Target },
  { id: 'learn', label: 'Aprender', icon: GraduationCap },
  { id: 'calculator', label: 'Calculadora', icon: Calculator },
];

const sectorLabel = Object.fromEntries(bible.sectors.map((s) => [s.id, s.label]));
const stageById = Object.fromEntries(bible.stages.map((s) => [s.id, s]));
const entryById = Object.fromEntries(bible.entries.map((e) => [e.id, e]));
const learningPath = buildLearningPath(bible.entries, bible.stages);

function Badge({ children, className = '' }) {
  return <span className={`inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${className}`}>{children}</span>;
}

function RelatedChips({ ids, onOpen }) {
  if (!ids || ids.length === 0) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <Link2 size={14} className="text-slate-400" />
      {ids.map((id) => entryById[id] && (
        <button key={id} onClick={() => onOpen(id)} className="text-xs px-2 py-1 rounded-full bg-slate-100 hover:bg-emerald-100 text-slate-600 hover:text-emerald-800 transition-colors">
          {entryById[id].title}
        </button>
      ))}
    </div>
  );
}

// Componente individual de ficha actualizado con Sistema de Notas
function EntryCard({ entry, expanded, onToggle, learned, onToggleLearned, onOpen, note, onSaveNote }) {
  const conf = CONFIDENCE[entry.confidence] || CONFIDENCE.medium;
  
  // Estado local para escribir la nota sin saturar el renderizado general
  const [localNote, setLocalNote] = useState(note || '');
  const [isSaved, setIsSaved] = useState(false);

  // Sincronizar si cambia desde fuera
  useEffect(() => {
    setLocalNote(note || '');
  }, [note]);

  const handleSave = () => {
    onSaveNote(entry.id, localNote);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div id={`entry-${entry.id}`} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden hover:border-emerald-300 transition-colors scroll-mt-4">
      <button type="button" aria-expanded={expanded} onClick={onToggle} className="w-full text-left p-5 flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-2 mb-2">
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100">{sectorLabel[entry.sector]}</Badge>
            <Badge className={conf.className}>Confianza: {conf.label}</Badge>
            <Badge className="bg-slate-50 text-slate-500 border-slate-200">{LEVEL_LABEL[entry.level]}</Badge>
            {learned && <Badge className="bg-emerald-600 text-white border-emerald-600">Aprendido</Badge>}
            {note && !expanded && <Badge className="bg-amber-100 text-amber-800 border-amber-200">Tiene Notas</Badge>}
          </div>
          <h3 className="text-lg font-bold text-slate-800">{entry.title}</h3>
          {!expanded && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{entry.in_plain_words}</p>}
        </div>
        <span className="text-slate-400 mt-1">{expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</span>
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-slate-100 bg-slate-50/50">
          <div className="mt-4">
            <h4 className="text-sm font-bold text-slate-800 mb-1">En palabras simples (aprender)</h4>
            <p className="text-sm text-slate-700 bg-white p-3 rounded border border-slate-200">{entry.in_plain_words}</p>
          </div>
          <div className="mt-4">
            <h4 className="text-sm font-bold text-slate-800 mb-1">En detalle (aplicar)</h4>
            <p className="text-sm text-slate-600 leading-relaxed">{entry.in_detail}</p>
          </div>
          {entry.options_and_variants?.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-bold text-slate-800 mb-1">Opciones y variantes</h4>
              <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
                {entry.options_and_variants.map((o, i) => <li key={i}>{o}</li>)}
              </ul>
            </div>
          )}
          {entry.rules?.length > 0 && (
            <p className="mt-4 text-xs text-slate-500"><span className="font-bold">Normas aplicables:</span> {entry.rules.join('; ')}</p>
          )}
          {entry.risks_and_red_flags?.length > 0 && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="text-sm font-bold text-red-800 flex items-center gap-2 mb-2"><AlertTriangle size={16} /> Red flags y riesgos</h4>
              <ul className="list-disc pl-5 text-sm text-red-700 space-y-1">
                {entry.risks_and_red_flags.map((x, i) => <li key={i}>{x}</li>)}
              </ul>
            </div>
          )}
          {entry.for_a_broker && (
            <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1">Consejo táctico para el broker</h4>
              <p className="text-sm text-emerald-700 font-medium">{entry.for_a_broker}</p>
            </div>
          )}
          {entry.verify_note && (
            <p className="mt-4 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              <span className="font-bold">Nota de verificación:</span> {entry.verify_note}
              {entry.last_verified && <> (última verificación: {entry.last_verified})</>}
            </p>
          )}

          {/* NUEVO MÓDULO DE NOTAS PERSONALES */}
          <div className="mt-6 bg-amber-50/50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Edit3 size={16} className="text-amber-600" />
              <h4 className="text-sm font-bold text-amber-900">Mis Notas y Apuntes</h4>
            </div>
            <textarea
              value={localNote}
              onChange={(e) => setLocalNote(e.target.value)}
              placeholder="Escribe aquí tus observaciones privadas, trucos o recordatorios sobre esta ficha..."
              className="w-full p-3 text-sm bg-white border border-amber-200 rounded-md focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 min-h-[80px] resize-y text-slate-700"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handleSave}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded transition-colors ${
                  isSaved ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                }`}
              >
                {isSaved ? <CheckCircle size={14} /> : <Save size={14} />}
                {isSaved ? 'Guardado en tu navegador' : 'Guardar nota'}
              </button>
            </div>
          </div>

          <RelatedChips ids={entry.related} onOpen={onOpen} />
          
          <div className="mt-5 pt-4 border-t border-slate-200 flex flex-wrap gap-2 items-center">
            {entry.stages.map((s) => <Badge key={s} className="bg-slate-100 text-slate-600 border-slate-200">Etapa {stageById[s].order}</Badge>)}
            <button onClick={onToggleLearned} className={`ml-auto flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-colors ${learned ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-400'}`}>
              <CheckCircle size={15} /> {learned ? 'Marcado como aprendido' : 'Marcar como aprendido'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="text-xs text-slate-500 flex flex-col gap-1 min-w-[9rem]">
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)} className="text-sm text-slate-700 bg-white border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-emerald-500">
        <option value="all">Todos</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}

export default function PlaybookModule() {
  const [tab, setTab] = useState('library');
  
  // SOLUCIÓN AL BORRADO: Inicialización perezosa (() => loadProgress())
  const [progress, setProgress] = useState(() => loadProgress());
  
  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  const [openId, setOpenId] = useState(() => {
    const h = typeof window !== 'undefined' ? window.location.hash : '';
    return h.startsWith('#entry=') ? decodeURIComponent(h.slice(7)) : null;
  });
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ sector: 'all', stage: 'all', level: 'all', confidence: 'all' });
  const setFilter = (k) => (v) => setFilters((f) => ({ ...f, [k]: v }));

  const openEntry = (id) => {
    setTab('library');
    setQuery('');
    setFilters({ sector: 'all', stage: 'all', level: 'all', confidence: 'all' });
    setOpenId(id);
    window.location.hash = `entry=${encodeURIComponent(id)}`;
  };
useEffect(() => {
    async function loadCloudData() {
      // Carga notas privadas del playbook
      const notesData = await fetchUserNotes('playbook');
      setNotes(notesData);

      // Carga progreso de estudio y repaso
      const progressData = await fetchPlaybookProgress();
      setLearnedEntries(progressData.learnedMap);
      setFlashBoxes(progressData.boxesMap);
    }
    loadCloudData();
  }, []);
  useEffect(() => {
    if (tab === 'library' && openId) {
      const el = document.getElementById(`entry-${openId}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [tab, openId]);

  const toggleLearned = (id) => setProgress((p) => ({ ...p, learned: { ...p.learned, [id]: !p.learned[id] } }));
  
  const handleSaveNote = (id, text) => {
    setProgress((p) => ({ 
      ...p, 
      notes: { ...(p.notes || {}), [id]: text } 
    }));
  };
// ─── AL ACTUALIZAR UNA NOTA ───
  const handleNoteChange = (entryId, text) => {
    setNotes(prev => ({ ...prev, [entryId]: text }));
    // Envía el cambio a Supabase de forma asíncrona
    upsertUserNote('playbook', entryId, text); 
  };

  // ─── AL MARCAR UNA FICHA COMO APRENDIDA ───
  const handleToggleLearned = (entryId) => {
    const newState = !learnedEntries[entryId];
    setLearnedEntries(prev => ({ ...prev, [entryId]: newState }));
    // Envía el progreso de estudio a Supabase
    updatePlaybookProgress(entryId, newState, flashBoxes[entryId] || 0); 
  };
  // ---------- Library ----------
  const results = useMemo(() => {
    return searchEntries(bible.entries, query).filter((e) =>
      (filters.sector === 'all' || e.sector === filters.sector) &&
      (filters.stage === 'all' || e.stages.includes(filters.stage)) &&
      (filters.level === 'all' || e.level === filters.level) &&
      (filters.confidence === 'all' || e.confidence === filters.confidence)
    );
  }, [query, filters]);

  const renderLibrary = () => (
    <div className="max-w-5xl mx-auto p-6">
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5 shadow-sm">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
          <input
            type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar reglas, Incoterms, fraudes, documentos..."
            className="w-full pl-10 pr-4 py-2 bg-slate-100 border border-transparent focus:border-emerald-500 focus:bg-white rounded-lg text-sm transition-all"
          />
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          <Select label="Sector" value={filters.sector} onChange={setFilter('sector')} options={bible.sectors.map((s) => [s.id, s.label])} />
          <Select label="Etapa" value={filters.stage} onChange={setFilter('stage')} options={bible.stages.map((s) => [s.id, `${s.order}. ${s.label}`])} />
          <Select label="Nivel" value={filters.level} onChange={setFilter('level')} options={Object.entries(LEVEL_LABEL)} />
          <Select label="Confianza" value={filters.confidence} onChange={setFilter('confidence')} options={Object.entries(CONFIDENCE).map(([k, c]) => [k, c.label])} />
          <span className="ml-auto text-xs text-slate-400">{results.length} de {bible.entries.length} fichas</span>
        </div>
      </div>
      <div className="space-y-3">
        {results.map((e) => (
          <EntryCard 
            key={e.id} 
            entry={e} 
            expanded={openId === e.id}
            onToggle={() => setOpenId(openId === e.id ? null : e.id)}
            learned={!!progress.learned[e.id]} 
            onToggleLearned={() => toggleLearned(e.id)} 
            onOpen={openEntry} 
            note={progress.notes?.[e.id] || ''}
            onSaveNote={handleSaveNote}
          />
        ))}
        {results.length === 0 && <div className="text-center p-12 text-slate-400">No se encontraron resultados.</div>}
      </div>
    </div>
  );

  // ---------- Stages ----------
  const [stageId, setStageId] = useState('stage0');
  const toggleGate = (sid, i) =>
    setProgress((p) => ({ ...p, gates: { ...p.gates, [sid]: { ...(p.gates[sid] || {}), [i]: !(p.gates[sid] || {})[i] } } }));

  const renderStages = () => {
    const st = stageById[stageId];
    const inStage = bible.entries.filter((e) => e.stages.includes(stageId));
    const bySector = bible.sectors.map((s) => [s, inStage.filter((e) => e.sector === s.id)]).filter(([, l]) => l.length);
    const scen = bible.scenarios.filter((s) => s.stage === stageId);
    const done = st.gate.filter((_, i) => (progress.gates[stageId] || {})[i]).length;
    return (
      <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 md:grid-cols-[16rem_1fr] gap-6">
        <ol className="space-y-1">
          {bible.stages.map((s) => (
            <li key={s.id}>
              <button onClick={() => setStageId(s.id)} className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${stageId === s.id ? 'bg-emerald-100 text-emerald-800 font-bold' : 'text-slate-600 hover:bg-slate-200'}`}>
                <span className="text-xs text-slate-400 mr-2">{s.order}</span>{s.label}
              </button>
            </li>
          ))}
        </ol>
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h2 className="text-xl font-bold text-slate-800">Etapa {st.order}: {st.label}</h2>
            <p className="text-sm text-slate-500 mt-1">{st.goal}</p>
            <h3 className="mt-5 text-sm font-bold text-slate-800 flex items-center gap-2"><ListChecks size={16} className="text-emerald-600" /> Puerta de control ({done}/{st.gate.length})</h3>
            <ul className="mt-2 space-y-2">
              {st.gate.map((g, i) => (
                <li key={i}>
                  <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                    <input type="checkbox" className="mt-1" checked={!!(progress.gates[stageId] || {})[i]} onChange={() => toggleGate(stageId, i)} />
                    <span>{g}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-5 bg-red-50 border border-red-200 rounded-lg p-3">
              <h4 className="text-xs font-bold text-red-800 uppercase tracking-wider mb-1">Trampas habituales</h4>
              <ul className="list-disc pl-5 text-sm text-red-700">{st.traps.map((t, i) => <li key={i}>{t}</li>)}</ul>
            </div>
            {scen.length > 0 && (
              <button onClick={() => { setScStage(stageId); setScIndex(0); setScPicked(null); setTab('scenarios'); }} className="mt-4 text-sm px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
                Practicar los {scen.length} escenarios de esta etapa
              </button>
            )}
          </div>
          {bySector.map(([s, list]) => (
            <div key={s.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{s.label}</h3>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-1">
                {list.map((e) => (
                  <li key={e.id}>
                    <button onClick={() => openEntry(e.id)} className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-emerald-50 text-slate-700 flex items-center gap-2">
                      {progress.learned[e.id] && <CheckCircle size={14} className="text-emerald-600 shrink-0" />}
                      <span className="truncate">{e.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ---------- Scenarios ----------
  const [scStage, setScStage] = useState('all');
  const [scIndex, setScIndex] = useState(0);
  const [scPicked, setScPicked] = useState(null);

  const renderScenarios = () => {
    const list = bible.scenarios.filter((s) => scStage === 'all' || s.stage === scStage);
    const sc = list[Math.min(scIndex, Math.max(list.length - 1, 0))];
    const answered = Object.values(progress.scenarios || {});
    const right = answered.filter((a) => a.correct).length;
    const pick = (i) => {
      if (scPicked !== null) return;
      setScPicked(i);
      setProgress((p) => ({ ...p, scenarios: { ...p.scenarios, [sc.id]: { correct: i === sc.correct, at: Date.now() } } }));
    };
    const go = (d) => { setScIndex((i) => Math.max(0, Math.min(list.length - 1, i + d))); setScPicked(null); };
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <Select label="Etapa" value={scStage} onChange={(v) => { setScStage(v); setScIndex(0); setScPicked(null); }} options={bible.stages.map((s) => [s.id, `${s.order}. ${s.label}`])} />
          <span className="ml-auto text-xs text-slate-500">Aciertos globales: {right}/{answered.length} de {bible.scenarios.length}</span>
        </div>
        {!sc ? <p className="text-slate-400">No hay escenarios en esta etapa.</p> : (
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <div className="flex flex-wrap gap-2 mb-2">
              <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100">Etapa {stageById[sc.stage].order}</Badge>
              <Badge className="bg-slate-50 text-slate-500 border-slate-200">{sectorLabel[sc.sector]}</Badge>
              <Badge className="bg-slate-50 text-slate-500 border-slate-200">{LEVEL_LABEL[sc.difficulty] || sc.difficulty}</Badge>
              <span className="ml-auto text-xs text-slate-400">{Math.min(scIndex, list.length - 1) + 1} / {list.length}</span>
            </div>
            <h2 className="text-lg font-bold text-slate-800">{sc.title}</h2>
            <p className="text-sm text-slate-600 mt-2">{sc.situation}</p>
            <p className="text-sm font-semibold text-slate-800 mt-4">{sc.question}</p>
            <div className="mt-3 space-y-2">
              {sc.options.map((o, i) => {
                const picked = scPicked === i;
                const reveal = scPicked !== null;
                const cls = !reveal ? 'border-slate-200 hover:border-emerald-400 bg-white'
                  : i === sc.correct ? 'border-emerald-400 bg-emerald-50'
                  : picked ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white opacity-70';
                return (
                  <button key={i} onClick={() => pick(i)} disabled={reveal} className={`w-full text-left text-sm p-3 rounded-lg border transition-colors ${cls}`}>{o}</button>
                );
              })}
            </div>
            {scPicked !== null && (
              <div className="mt-5 space-y-3">
                <p className={`text-sm font-bold ${scPicked === sc.correct ? 'text-emerald-700' : 'text-red-700'}`}>{scPicked === sc.correct ? 'Correcto' : 'No es esa'}</p>
                <p className="text-sm text-slate-700">{sc.explanation}</p>
                {sc.red_flags.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <h4 className="text-xs font-bold text-red-800 uppercase tracking-wider mb-1">Red flags</h4>
                    <ul className="list-disc pl-5 text-sm text-red-700">{sc.red_flags.map((x, i) => <li key={i}>{x}</li>)}</ul>
                  </div>
                )}
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1">Qué hacer</h4>
                  <ul className="list-disc pl-5 text-sm text-emerald-700">{sc.what_to_do.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </div>
                <RelatedChips ids={sc.related} onOpen={openEntry} />
              </div>
            )}
            <div className="mt-6 flex justify-between">
              <button onClick={() => go(-1)} disabled={scIndex === 0} className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 disabled:opacity-40">Anterior</button>
              <button onClick={() => go(1)} disabled={scIndex >= list.length - 1} className="text-sm px-3 py-1.5 rounded-lg bg-emerald-600 text-white disabled:opacity-40">Siguiente</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ---------- Learn ----------
  const [showBack, setShowBack] = useState(false);
  const renderLearn = () => {
    const total = learningPath.length;
    const learnedCount = learningPath.filter((e) => progress.learned[e.id]).length;
    const next = learningPath.find((e) => !progress.learned[e.id]);
    const due = dueCards(learningPath, progress.learned, progress.flash);
    const card = due[0];
    const grade = (knew) => { setProgress((p) => ({ ...p, flash: reviewCard(p.flash, card.id, knew) })); setShowBack(false); };
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800">Ruta de aprendizaje</h2>
          <p className="text-sm text-slate-500">Fundamentos, núcleo y avanzado, ordenados por la etapa de la operación.</p>
          <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${(learnedCount / total) * 100}%` }} /></div>
          <p className="text-xs text-slate-500 mt-1">{learnedCount} de {total} fichas aprendidas</p>
          {next ? (
            <button onClick={() => openEntry(next.id)} className="mt-4 text-sm px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">Siguiente ficha: {next.title}</button>
          ) : <p className="mt-4 text-sm text-emerald-700 font-semibold">Has recorrido toda la ruta.</p>}
        </div>

        {Object.keys(LEVEL_LABEL).map((lv) => {
          const list = learningPath.filter((e) => e.level === lv);
          const dn = list.filter((e) => progress.learned[e.id]).length;
          return (
            <div key={lv} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex justify-between items-baseline mb-2">
                <h3 className="text-sm font-bold text-slate-800">{LEVEL_LABEL[lv]}</h3>
                <span className="text-xs text-slate-400">{dn}/{list.length}</span>
              </div>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-1">
                {list.map((e) => (
                  <li key={e.id}>
                    <button onClick={() => openEntry(e.id)} className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-emerald-50 text-slate-700 flex items-center gap-2">
                      <CheckCircle size={14} className={progress.learned[e.id] ? 'text-emerald-600 shrink-0' : 'text-slate-200 shrink-0'} />
                      <span className="truncate">{e.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2"><RotateCcw size={16} className="text-emerald-600" /> Repaso espaciado ({due.length} pendientes)</h3>
          {!card ? (
            <p className="text-sm text-slate-500 mt-2">No hay fichas para repasar. Marca fichas como aprendidas y volverán aquí.</p>
          ) : (
            <div className="mt-3">
              <p className="text-base font-bold text-slate-800">{card.title}</p>
              {!showBack ? (
                <button onClick={() => setShowBack(true)} className="mt-3 text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:border-emerald-400">Mostrar respuesta</button>
              ) : (
                <>
                  <p className="mt-3 text-sm text-slate-700 bg-slate-50 p-3 rounded border border-slate-200">{card.in_plain_words}</p>
                  <p className="mt-2 text-sm text-slate-600">{card.in_detail}</p>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => grade(true)} className="text-sm px-3 py-1.5 rounded-lg bg-emerald-600 text-white">Lo sabía</button>
                    <button onClick={() => grade(false)} className="text-sm px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600">Repasar de nuevo</button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 overflow-hidden">
      <div className="px-6 pt-5 border-b border-slate-200 bg-white shadow-sm shrink-0">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <BookOpen className="text-emerald-600" size={28} /> Módulo de Blindaje Legal
          </h1>
          <p className="text-sm text-slate-500 mb-1">Biblia del broker v{bible.meta.version}: {bible.entries.length} fichas, {bible.scenarios.length} escenarios, {bible.stages.length} etapas.</p>
          <p className="text-[11px] text-slate-400 mb-3">{bible.meta.disclaimer}</p>
          <nav className="flex gap-1 overflow-x-auto" aria-label="Secciones del módulo">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}
                className={`flex items-center gap-2 px-4 py-2 text-sm rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${tab === id ? 'border-emerald-600 text-emerald-700 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                <Icon size={16} /> {label}
              </button>
            ))}
          </nav>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {tab === 'library' && renderLibrary()}
        {tab === 'stages' && renderStages()}
        {tab === 'scenarios' && renderScenarios()}
        {tab === 'learn' && renderLearn()}
        {tab === 'calculator' && <CostStackCalculator />}
      </div>
    </div>
  );
}