import React, { useState, useMemo, useEffect } from 'react';
import { 
  ShieldCheck, Search, ExternalLink, AlertTriangle, CheckCircle2, 
  XCircle, Copy, Check, FileText, Building2, Ship, FileCheck, 
  Layers, Briefcase, PhoneCall, SlidersHorizontal, Edit3, 
  AlertOctagon, ListChecks
} from 'lucide-react';
import rawAgenciesData from '../data/agenciesData.json';

const STORAGE_KEY = 'ecopalm.agencies.notes.v1';

// Protección de datos base por si el JSON viene vacío o con estructura parcial
const defaultData = {
  agency_categories: [],
  tiers: {},
  agencies: [],
  casuistry_matrix: [],
  appointment_checklist: []
};

const agenciesData = rawAgenciesData || defaultData;

export default function AgenciesModule() {
  const [activeTab, setActiveTab] = useState('directory'); // 'directory' | 'matrix' | 'validator' | 'checklist'
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedTier, setSelectedTier] = useState('ALL');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Estados del Simulador de Casuísticas FOB vs CIF
  const [simIncoterm, setSimIncoterm] = useState('FOB');
  const [simNominator, setSimNominator] = useState('buyer');
  const [simAgentTier, setSimAgentTier] = useState('tier_1');

  // Estados del Validador de Carta de Crédito (LC)
  const [valProduct, setValProduct] = useState('UCO_HVO');
  const [valSurveyor, setValSurveyor] = useState(agenciesData?.agencies?.[0]?.id || 'ag-sgs-my');

  // Estado persistente de notas privadas (localStorage)
  const [notes, setNotes] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const [savingKey, setSavingKey] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch (err) {
      console.error('Error guardando notas de agencias:', err);
    }
  }, [notes]);

  const handleUpdateNote = (id, text) => {
    setNotes(prev => ({ ...prev, [id]: text }));
    setSavingKey(id);
    setTimeout(() => setSavingKey(null), 1500);
  };

  const copyToClipboard = (id, text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtrado defensivo de agencias
  const filteredAgencies = useMemo(() => {
    const list = agenciesData?.agencies || [];
    const term = searchKeyword.trim().toLowerCase();
    return list.filter(ag => {
      const matchesCat = selectedCategory === 'ALL' || ag.category === selectedCategory;
      const matchesTier = selectedTier === 'ALL' || ag.tier === selectedTier;
      const servicesText = Array.isArray(ag.services) ? ag.services.join(' ') : '';
      const textToSearch = `${ag.name || ''} ${ag.hq || ''} ${servicesText} ${ag.broker_verdict || ''}`.toLowerCase();
      const matchesTerm = !term || textToSearch.includes(term);
      return matchesCat && matchesTier && matchesTerm;
    });
  }, [selectedCategory, selectedTier, searchKeyword]);

  // Evaluación segura de la Casuística FOB vs CIF
  const activeCasuistry = useMemo(() => {
    const list = agenciesData?.casuistry_matrix || [];
    if (list.length === 0) {
      return {
        title: 'Sin datos de casuística',
        status: 'GREEN',
        risk_analysis: 'No se encontraron casuísticas en el archivo de datos.',
        operational_rule: 'Verifica agenciesData.json.',
        spa_clause: 'Standard terms apply.'
      };
    }
    const match = list.find(c => 
      c.incoterm === simIncoterm && 
      c.nominator === simNominator && 
      (c.agent_tier === simAgentTier || (simAgentTier !== 'tier_1' && c.agent_tier !== 'tier_1'))
    );
    return match || list[0];
  }, [simIncoterm, simNominator, simAgentTier]);

  // Evaluación segura del Validador de Inspector para LC
  const surveyorValidation = useMemo(() => {
    const list = agenciesData?.agencies || [];
    const surveyor = list.find(a => a.id === valSurveyor);
    if (!surveyor) return null;

    let status = 'GREEN';
    let message = 'Aceptado universalmente por bancos de primer orden para cobro de LC bajo UCP 600[cite: 6].';
    let advice = 'Incorpora la cláusula exacta en el contrato y en el campo 46A de la LC[cite: 6].';

    if (surveyor.tier === 'tier_2') {
      if (valProduct === 'UCO_HVO') {
        status = 'AMBER';
        message = 'Inspector especializado en biomasa e ISCC, pero no todos los compradores europeos de HVO aceptan su análisis de halógenos/cloro[cite: 6].';
        advice = 'Confirma con el comprador si su refinería autoriza expresamente a este inspector antes de nominarlo.';
      } else {
        status = 'GREEN';
        message = 'Perfectamente apto para este producto según estándares FOSFA[cite: 6].';
        advice = 'Uso recomendado sin reservas para este tipo de residuo.';
      }
    } else if (surveyor.tier === 'tier_3') {
      status = 'RED';
      message = 'ALTO RIESGO: El banco emisor europeo puede rechazar el certificado o exigir un re-análisis en destino.';
      advice = 'Rechaza la designación de este inspector. Exige una firma Tier 1.';
    }

    return { surveyor, status, message, advice };
  }, [valProduct, valSurveyor]);

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 overflow-hidden font-sans">
      
      {/* 1. BARRA SUPERIOR DE CONTROL */}
      <div className="p-4 md:px-6 bg-white border-b border-slate-200 shadow-sm shrink-0 z-10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <ShieldCheck className="text-emerald-600" size={24} />
              Auditoría de Agencias, Surveyors y Aduanas
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Directorio institucional en Malasia, evaluación de riesgos FOB vs CIF y cláusulas contractuales.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filtro Categoría */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <Building2 size={14} className="text-emerald-600 ml-1" />
              <select 
                value={selectedCategory} 
                onChange={(e) => setSelectedCategory(e.target.value)} 
                className="text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-emerald-500"
              >
                <option value="ALL">Todas las Categorías</option>
                {(agenciesData?.agency_categories || []).map(c => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>

            {/* Filtro Tier */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <Layers size={14} className="text-blue-600 ml-1" />
              <select 
                value={selectedTier} 
                onChange={(e) => setSelectedTier(e.target.value)} 
                className="text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-emerald-500"
              >
                <option value="ALL">Todos los Tiers</option>
                <option value="tier_1">Tier 1 (Global Leaders)</option>
                <option value="tier_2">Tier 2 (Especialistas)</option>
                <option value="tier_3">Tier 3 (Locales)</option>
              </select>
            </div>

            {/* Buscador */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2 text-slate-400" size={13} />
              <input
                type="text"
                placeholder="Buscar agencia, servicio..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="pl-7 pr-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:border-emerald-500 w-48 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Pestañas Superiores */}
        <div className="mt-3 pt-2 border-t border-slate-100 flex gap-4 shrink-0 overflow-x-auto text-xs">
          <button 
            onClick={() => setActiveTab('directory')}
            className={`pb-2 font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'directory' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 size={15} /> Directorio de Entidades ({filteredAgencies.length})
          </button>
          
          <button 
            onClick={() => setActiveTab('matrix')}
            className={`pb-2 font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'matrix' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Ship size={15} /> Matriz FOB vs. CIF (Riesgo del Agente)
          </button>

          <button 
            onClick={() => setActiveTab('validator')}
            className={`pb-2 font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'validator' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CheckCircle2 size={15} /> Validador de Carta de Crédito (LC)
          </button>

          <button 
            onClick={() => setActiveTab('checklist')}
            className={`pb-2 font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'checklist' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ListChecks size={15} /> Checklist: Instrucciones al Inspector
          </button>
        </div>
      </div>

      {/* 2. ÁREA DE CONTENIDO */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50">
        
        {/* PESTAÑA 1: DIRECTORIO */}
        {activeTab === 'directory' && (
          <div className="max-w-6xl mx-auto space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAgencies.map((agency) => {
                const noteKey = `ag-${agency.id}`;
                const agencyNote = notes[noteKey] || '';
                const isSaving = savingKey === noteKey;
                const tierInfo = agenciesData?.tiers?.[agency.tier] || { label: agency.tier || 'TIER' };

                return (
                  <div key={agency.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-emerald-300 transition-all flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                          agency.tier === 'tier_1' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          agency.tier === 'tier_2' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {tierInfo?.label ? tierInfo.label.split(':')[0] : 'TIER'}
                        </span>
                        
                        {agency.website && (
                          <a 
                            href={agency.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-slate-400 hover:text-emerald-600 transition-colors flex items-center gap-1 text-xs"
                            title="Abrir web oficial"
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>

                      <h3 className="font-bold text-slate-900 text-base mb-1">{agency.name}</h3>
                      <p className="text-xs text-slate-500 mb-3 flex items-center gap-1">
                        <Building2 size={12} className="text-slate-400" /> Sede: {agency.hq || '-'}
                      </p>

                      <div className="mb-3">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Servicios Portuarios</p>
                        <div className="flex flex-wrap gap-1">
                          {(agency.services || []).map((s, idx) => (
                            <span key={idx} className="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium">
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>

                      {agency.broker_verdict && (
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs mb-3">
                          <span className="font-bold text-slate-700 block mb-1">Veredicto del Broker:</span>
                          <p className="text-slate-600 text-[11px] leading-relaxed">{agency.broker_verdict}</p>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      {agency.contract_clause && (
                        <div className="bg-amber-50/50 p-2 rounded border border-amber-200 text-[11px]">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-amber-900 flex items-center gap-1">
                              <FileText size={11} className="text-amber-700" /> Cláusula Contractual Recomendada
                            </span>
                            <button 
                              onClick={() => copyToClipboard(agency.id, agency.contract_clause)}
                              className="text-amber-800 hover:text-amber-950 font-bold flex items-center gap-1 text-[10px]"
                            >
                              {copiedId === agency.id ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                              {copiedId === agency.id ? '¡Copiada!' : 'Copiar'}
                            </button>
                          </div>
                          <p className="font-mono text-slate-700 text-[10px] italic line-clamp-2">"{agency.contract_clause}"</p>
                        </div>
                      )}

                      <div>
                        <div className="flex justify-between items-center mb-1 text-[10px]">
                          <span className="font-bold text-slate-500 flex items-center gap-1">
                            <Edit3 size={10} /> Mis notas privadas
                          </span>
                          {isSaving && <span className="text-emerald-600 font-bold">Guardado</span>}
                        </div>
                        <input
                          type="text"
                          value={agencyNote}
                          onChange={(e) => handleUpdateNote(noteKey, e.target.value)}
                          placeholder="Contactos directos, tarifas cotizadas..."
                          className="w-full px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded text-slate-700 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* PESTAÑA 2: MATRIZ DE CASUÍSTICAS FOB VS CIF */}
        {activeTab === 'matrix' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-2">
                <Ship className="text-emerald-600" size={22} />
                Simulador de Riesgo Operativo: Designación del Agente Marítimo
              </h2>
              <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                El Incoterm y la parte que nombra a la Agencia Marítima en Malasia determinan quién controla la custodia del 
                <strong> Bill of Lading (B/L)</strong> y la auditoría del reloj de <strong>Demurrage</strong>[cite: 6].
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1.5">1. Incoterm Pactado:</label>
                  <select 
                    value={simIncoterm} 
                    onChange={(e) => {
                      setSimIncoterm(e.target.value);
                      if (e.target.value === 'CIF') setSimNominator('seller');
                      else setSimNominator('buyer');
                    }}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="FOB">FOB (Comprador fleta el barco)</option>
                    <option value="CIF">CIF (Vendedor fleta el barco)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1.5">2. ¿Quién designa el Agente?:</label>
                  <select 
                    value={simNominator} 
                    onChange={(e) => setSimNominator(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                  >
                    {simIncoterm === 'FOB' ? (
                      <>
                        <option value="buyer">Comprador (Charterer's Agent legítimo)</option>
                        <option value="seller">Vendedor / Terminal (Agente Impuesto)</option>
                      </>
                    ) : (
                      <option value="seller">Vendedor (Controla flete y consignación)</option>
                    )}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1.5">3. Calidad de la Agencia:</label>
                  <select 
                    value={simAgentTier} 
                    onChange={(e) => setSimAgentTier(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="tier_1">Tier 1 (Wilhelmsen, GAC, ISS)</option>
                    <option value="tier_2">Tier 2 (Agente Técnico Acreditado)</option>
                    <option value="tier_3">Tier 3 (Agencia Local del Vendedor)</option>
                  </select>
                </div>
              </div>

              {activeCasuistry && (
                <div className={`p-5 rounded-xl border ${
                  activeCasuistry.status === 'GREEN' ? 'bg-emerald-50/70 border-emerald-200' :
                  activeCasuistry.status === 'AMBER' ? 'bg-amber-50/70 border-amber-200' :
                  'bg-red-50/70 border-red-200'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                      activeCasuistry.status === 'GREEN' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                      activeCasuistry.status === 'AMBER' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                      'bg-red-100 text-red-800 border-red-300'
                    }`}>
                      {activeCasuistry.status === 'GREEN' ? '🟢 Riesgo Bajo / Operativa Segura' :
                       activeCasuistry.status === 'AMBER' ? '🟠 Alerta Media / Exige Agente Protector' :
                       '🔴 Alerta Crítica / Peligro de Fraude Documental'}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 text-base mb-2">{activeCasuistry.title}</h3>
                  
                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="font-bold text-slate-800 block mb-0.5">Diagnóstico del Riesgo:</span>
                      <p className="text-slate-700 leading-relaxed">{activeCasuistry.risk_analysis}</p>
                    </div>

                    <div>
                      <span className="font-bold text-slate-800 block mb-0.5">Regla Operativa del Broker:</span>
                      <p className="text-slate-700 leading-relaxed font-medium">{activeCasuistry.operational_rule}</p>
                    </div>

                    {activeCasuistry.spa_clause && (
                      <div className="bg-white p-3 rounded-lg border border-slate-200 mt-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-slate-800 flex items-center gap-1 text-[11px]">
                            <FileText size={12} className="text-emerald-600" /> Cláusula de Protección para el SPA
                          </span>
                          <button 
                            onClick={() => copyToClipboard('cas-clause', activeCasuistry.spa_clause)}
                            className="text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 text-[10px]"
                          >
                            {copiedId === 'cas-clause' ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                            {copiedId === 'cas-clause' ? '¡Copiada!' : 'Copiar Cláusula'}
                          </button>
                        </div>
                        <p className="font-mono text-slate-700 text-xs bg-slate-50 p-2 rounded border border-slate-100">
                          "{activeCasuistry.spa_clause}"
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PESTAÑA 3: VALIDADOR DE CARTA DE CRÉDITO */}
        {activeTab === 'validator' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-2">
                <CheckCircle2 className="text-emerald-600" size={22} />
                Validador de Inspector (Surveyor) para Carta de Crédito UCP 600
              </h2>
              <p className="text-xs text-slate-500 mb-6">
                Comprueba si la agencia de inspección propuesta por el vendedor pasará los filtros de los bancos europeos[cite: 6].
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1.5">Producto & Especificación:</label>
                  <select 
                    value={valProduct} 
                    onChange={(e) => setValProduct(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="UCO_HVO">UCO grado HVO/SAF (Estricto en Metales/Halógenos)</option>
                    <option value="UCO_FAME">UCO para Biodiésel FAME tradicional</option>
                    <option value="POME">POME Oil Anexo IX Parte A (Control Ácido)</option>
                    <option value="SBEO_SPO">SBEO / Sludge Palm Oil (Tierras abrasivas)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1.5">Inspector Propuesto:</label>
                  <select 
                    value={valSurveyor} 
                    onChange={(e) => setValSurveyor(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                  >
                    {(agenciesData?.agencies || []).filter(a => a.category === 'surveyor').map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({(s.tier || '').toUpperCase()})</option>
                    ))}
                  </select>
                </div>
              </div>

              {surveyorValidation && (
                <div className={`p-5 rounded-xl border text-xs space-y-3 ${
                  surveyorValidation.status === 'GREEN' ? 'bg-emerald-50 border-emerald-200' :
                  surveyorValidation.status === 'AMBER' ? 'bg-amber-50 border-amber-200' :
                  'bg-red-50 border-red-200'
                }`}>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm text-slate-800">{surveyorValidation.surveyor.name}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                      surveyorValidation.status === 'GREEN' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                      surveyorValidation.status === 'AMBER' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                      'bg-red-100 text-red-800 border-red-300'
                    }`}>
                      {surveyorValidation.status === 'GREEN' ? 'Aprobado para LC' :
                       surveyorValidation.status === 'AMBER' ? 'Confirmación Requerida' : 'Rechazo Sugerido'}
                    </span>
                  </div>

                  <p className="text-slate-700 leading-relaxed font-medium">{surveyorValidation.message}</p>
                  
                  <div className="bg-white p-3 rounded-lg border border-slate-200">
                    <span className="font-bold text-slate-800 block mb-1">Recomendación Táctica:</span>
                    <p className="text-slate-600">{surveyorValidation.advice}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PESTAÑA 4: CHECKLIST DE INSTRUCCIONES */}
        {activeTab === 'checklist' && (
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-1">
                <ListChecks className="text-emerald-600" size={22} />
                Carta de Nombramiento: Instrucciones Obligatorias para SGS / Intertek
              </h2>
              <p className="text-xs text-slate-500 mb-5">
                Puntos de control pericial indispensables al formalizar el nombramiento del inspector[cite: 6].
              </p>

              <div className="space-y-3">
                {(agenciesData?.appointment_checklist || []).map((item) => (
                  <div key={item.step} className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[11px]">
                        {item.step}
                      </span>
                      <h3 className="font-bold text-slate-800 text-sm">{item.title}</h3>
                    </div>
                    <p className="text-slate-600 pl-7 leading-relaxed">{item.instruction}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}