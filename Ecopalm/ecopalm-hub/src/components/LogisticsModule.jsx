import React, { useState, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { 
  Anchor, Droplet, MapPin, AlertTriangle, ShieldCheck, 
  Clock, Gauge, CheckCircle2, XCircle, Search, Layers,
  BookOpen, ListChecks, Calculator, SlidersHorizontal, 
  Edit3, ChevronDown, ChevronUp, Briefcase, PhoneCall, AlertOctagon,
  Ship, CalendarDays, DollarSign, Globe2
} from 'lucide-react';
import terminalsData from '../data/malaysiaTerminals.json';

const STORAGE_KEY = 'ecopalm.logistics.notes.v1';

// Iconos tácticos para el mapa
const greenPortIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [26, 42],
  iconAnchor: [13, 42],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const redPortIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [22, 36],
  iconAnchor: [11, 36],
  popupAnchor: [1, -30],
  shadowSize: [36, 36]
});

const spainPortIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [26, 42],
  iconAnchor: [13, 42],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const waypointIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [20, 32],
  iconAnchor: [10, 32],
  popupAnchor: [1, -26],
  shadowSize: [30, 30]
});

// Controlador de cámara para animar el mapa al cambiar de vista
function MapController({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, {
      duration: 1.5,
      easeLinearity: 0.25
    });
  }, [center, zoom, map]);
  return null;
}

// Guía de inteligencia táctica por puerto para brokers
const BROKER_PORT_INSIGHTS = {
  'port-klang-westports': {
    focus: 'El hub de salida #1 de Malasia hacia Europa (Róterdam, Huelva, Barcelona). Máxima liquidez de UCO y POME pretratado.',
    calado: 'Aguas profundas (11.5m a 16.0m). Permite buques MR y Handysize sin restricciones de marea.',
    trampa: 'No cargues SBEO bruto aquí (las arcillas abrasivas colapsan las líneas dedicadas de Stolthaven). Si vendes para HVO europeo, Stolthaven es tu garantía.',
    pregunta: '¿Tu carga está asignada a los tanques segregados de Stolthaven o al rack compartido de Mewah/Ecolex?'
  },
  'port-klang-northport': {
    focus: 'Puerto histórico para residuos oleoquímicos de alta acidez (POME crudo, SPO y PFAD). Tarifas de manipulación más competitivas.',
    calado: 'Calado medio (10.5m a 12.0m). Óptimo para buques medianos de hasta 40.000 DWT.',
    trampa: 'Riesgo alto de contaminación con CPO comestible si bombeas UCO por líneas comunes. Exige el Prior Cargo List de los últimos 3 bombeos.',
    pregunta: '¿Fima Bulking emitirá el Certificado de Limpieza de Línea firmado por SGS antes de conectar mangueras?'
  },
  'johor-tanjung-langsat': {
    focus: 'La terminal de máxima gama tecnológica de Malasia para SAF/HVO (Dialog DTL 3) frente a Singapur.',
    calado: 'Excelente (13.5m a 15.0m). Admite buques oceánicos grandes (incluso Aframax/LR2).',
    trampa: 'Tarifas más elevadas, pero nulo riesgo de contaminación cruzada (tuberías 100% aisladas de aceites comestibles y fósiles).',
    pregunta: '¿El bombeo se medirá con los caudalímetros Coriolis certificados de DTL 3 para blindar las cifras de cantidad?'
  },
  'johor-pasir-gudang': {
    focus: 'El mayor parque de almacenamiento del mundo. Conexión directa con extractoras y refinerías del sur.',
    calado: 'Restringido en muelles interiores VO3/VO4 (8.0m a 9.5m). En VO1/VO2 sube a 11.5m - 13.0m.',
    trampa: 'Casi todas las tuberías son multiusuario. Obligatorio exigir First-Foot Sample analizado en laboratorio antes del bombeo masivo.',
    pregunta: '¿La línea asignada requiere pigging previo y quién asume la factura del soplado con nitrógeno en el contrato FOB?'
  },
  'penang-port-prai': {
    focus: 'Salida de recolectores de UCO del norte peninsular (Penang, Perak, Kedah).',
    calado: 'Bajo (10.0m a 11.0m). Los buques MR cargan las primeras 5.000 TM aquí como first load port y completan calado al sur.',
    trampa: 'Tubería aérea de 1.2 km sobre el mar. Si el POME se detiene más de 30 min sin calefacción por vapor, se solidifica y tapona el tubo.',
    pregunta: '¿El buque quimiquero completará carga en Port Klang o Pasir Gudang tras salir de Penang?'
  },
  'kuantan-port': {
    focus: 'Costa Este. Territorio natural de salida para POME, SPO y SBEO de las plantaciones de Pahang.',
    calado: 'Medio (11.2m a 12.2m).',
    trampa: 'Apenas hay volumen de UCO aquí; es un puerto dominado casi en su totalidad por residuos de extractora de palma.',
    pregunta: '¿El rack común de FGV/KPC tiene activo el acompañamiento de vapor continuo a 60°C antes de iniciar bombeo?'
  },
  'bintulu-port': {
    focus: 'El gigante de Sarawak (Borneo). Volúmenes masivos de POME y SPO de grandes plantaciones.',
    calado: 'Profundo (13.5m a 14.0m). Permite buques MR cargados al 100% rumbo al Canal de Suez.',
    trampa: 'Flete marítimo y lejanía: solo compensa si cierras contratos con las grandes extractoras de Borneo Oriental.',
    pregunta: '¿El lote de POME sale por las líneas revestidas para ácidos o por las líneas sin recubrir con trampas de sedimentos?'
  },
  'lahad-datu-poic': {
    focus: 'Sabah (Borneo). Máxima concentración de extractoras del país. Precios de compra en origen más baratos.',
    calado: 'Puerto de aguas ultraprofundas (16.0m a 20.0m). Sin límites de calado para buques quimiqueros.',
    trampa: 'Requiere flete marítimo más largo. Disponen de intercambiador central con compresor de 14 bar para limpieza inmediata.',
    pregunta: '¿El vendedor tiene el Tank Storage Receipt (TSR) verificado directamente en los tanques de POIC Bulk Terminal?'
  },
  'lumut-port-perak': {
    focus: 'Oportunidad de arbitraje. Flete terrestre nulo para las extractoras de Perak.',
    calado: 'Medio (10.0m - 12.0m). Perfecto para first-load port.',
    trampa: 'Menos disponibilidad de quimiqueros parcel tankers comparado con Port Klang.',
    pregunta: '¿El precio FOB Lumut compensa el extra-flete marítimo del armador por hacer una escala adicional?'
  },
  'johor-pengerang-deepwater': {
    focus: 'El epicentro SAF/HVO. Conexión directa a las grandes biorrefinerías y blending transfronterizo.',
    calado: 'Aguas ultraprofundas (16.0m - 24.0m). Sin restricciones físicas.',
    trampa: 'Estándares de calidad draconianos. Cualquier humedad libre o traza mineral paralizará el bombeo.',
    pregunta: '¿Los tanques de origen están 100% aislados de la terminal de hidrocarburos fósiles?'
  },
  'kemaman-port': {
    focus: 'Válvula de escape cuando Kuantan colapsa por congestión en temporada alta.',
    calado: 'Profundo (11.0m - 14.0m).',
    trampa: 'Prioridad de atraque para industria petroquímica. Riesgo de demurrage si el buque debe esperar fondeado.',
    pregunta: '¿El operador garantiza la ventana de atraque (berthing window) por escrito?'
  },
  'sabah-kunak-tawau': {
    focus: 'Origen ultra-competitivo para POME de las plantaciones del sureste de Sabah.',
    calado: 'Medio a bajo (9.5m - 12.5m).',
    trampa: 'Tuberías de acero al carbono muy compartidas con CPO alimentario. Alto riesgo de contaminación de esteroles.',
    pregunta: '¿Puedes demostrar mediante fotos de los strainers que la línea fue limpiada antes del bombeo?'
  }
};

const calculatePumpingTime = (rateString, volume) => {
  const vol = parseFloat(volume) || 0;
  if (!vol || !rateString) return '-';
  const matches = rateString.match(/\d+/g);
  if (!matches || matches.length === 0) return '-';
  const nums = matches.map(Number);
  if (nums.length >= 2) {
    const minRate = Math.min(nums[0], nums[1]);
    const maxRate = Math.max(nums[0], nums[1]);
    return `${(vol / maxRate).toFixed(1)} h - ${(vol / minRate).toFixed(1)} h`;
  }
  return `${(vol / nums[0]).toFixed(1)} h`;
};

// Extractor de número (para usar en el simulador de Demurrage)
const extractMinRate = (rateString) => {
  const matches = rateString.match(/\d+/g);
  if (!matches || matches.length === 0) return 300;
  return Math.min(...matches.map(Number));
};

export default function LogisticsModule() {
  const [activeTab, setActiveTab] = useState('ports'); // 'ports' | 'checklist' | 'laws' | 'calculator' | 'demurrage'
  const [selectedProduct, setSelectedProduct] = useState('ALL');
  const [orderVolume, setOrderVolume] = useState('0');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [onlyStainless, setOnlyStainless] = useState(false);
  const [activePortFilter, setActivePortFilter] = useState('ALL');

  // Estado para controlar la vista de rutas marítimas globales
  const [showGlobalRoutes, setShowGlobalRoutes] = useState(false);

  // Estado persistente de notas (localStorage)
  const [notes, setNotes] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const [savingKey, setSavingKey] = useState(null);
  const [expandedPipelines, setExpandedPipelines] = useState({});

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch (err) {
      console.error('Error guardando notas en localStorage:', err);
    }
  }, [notes]);

  const handleUpdateNote = (id, text) => {
    setNotes(prev => ({ ...prev, [id]: text }));
    setSavingKey(id);
    setTimeout(() => setSavingKey(null), 1500);
  };

  const togglePipelineSpecs = (id) => {
    setExpandedPipelines(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // ----------------------------------------------------
  // ESTADOS: CALCULADORAS Y SIMULADORES (FOB & Demurrage)
  // ----------------------------------------------------
  const [calcValues, setCalcValues] = useState({
    storageUsd: '6.50',
    throughputUsd: '3.20',
    heatingUsd: '1.80',
    piggingFixedUsd: '1500'
  });

  const handleCalcChange = (e) => {
    setCalcValues({ ...calcValues, [e.target.name]: e.target.value });
  };

  const [demurrageCalc, setDemurrageCalc] = useState({
    pumpingRate: '350', // TM/h garantizadas por terminal
    turnTimeHours: '6', // Tiempo gracia tras NOR
    demurrageRatePerDay: '22000', // Tarifa diaria USD
    actualHoursUsed: '32' // Tiempo real que tardó el bombeo
  });

  const handleDemurrageChange = (e) => {
    setDemurrageCalc({ ...demurrageCalc, [e.target.name]: e.target.value });
  };

  const demurrageResults = useMemo(() => {
    const vol = parseFloat(orderVolume) || 5000;
    const rate = parseFloat(demurrageCalc.pumpingRate) || 350;
    const turn = parseFloat(demurrageCalc.turnTimeHours) || 6;
    const rateUsdDay = parseFloat(demurrageCalc.demurrageRatePerDay) || 22000;
    const actualHours = parseFloat(demurrageCalc.actualHoursUsed) || 0;

    const laytimeAllowed = (vol / rate) + turn; // horas totales permitidas
    const excessHours = actualHours - laytimeAllowed;
    
    let penalty = 0;
    let type = 'OK';
    if (excessHours > 0) {
        penalty = (excessHours / 24) * rateUsdDay;
        type = 'DEMURRAGE';
    } else if (excessHours < 0) {
        // Despatch es habitualmente la mitad del demurrage
        penalty = (Math.abs(excessHours) / 24) * (rateUsdDay / 2);
        type = 'DESPATCH';
    }

    return {
        laytimeAllowed: laytimeAllowed.toFixed(1),
        excessHours: excessHours > 0 ? excessHours.toFixed(1) : 0,
        penaltyAmount: penalty,
        type: type
    };
  }, [orderVolume, demurrageCalc]);


  // Motor de búsqueda multidimensional: Filtra puertos, guías y tuberías a la vez
  const evaluatedPorts = useMemo(() => {
    const term = searchKeyword.trim().toLowerCase();

    return terminalsData.ports.map((port) => {
      const cheat = BROKER_PORT_INSIGHTS[port.id] || {};
      
      const portSearchString = `${port.name} ${port.region} ${port.draft} ${port.description} ${cheat.focus || ''} ${cheat.trampa || ''} ${cheat.pregunta || ''}`.toLowerCase();
      const portMatchesTerm = !term || portSearchString.includes(term);

      const validPipelines = port.pipelines.filter((pipe) => {
        const matchesProduct = selectedProduct === 'ALL' || pipe.allowed.includes(selectedProduct);
        const matchesStainless = !onlyStainless || pipe.specs.toLowerCase().includes('inoxidable') || pipe.specs.includes('SS3');
        const pipeSearchString = `${pipe.id} ${pipe.operator} ${pipe.route} ${pipe.specs} ${pipe.restrictions}`.toLowerCase();
        const pipeMatchesTerm = !term || portMatchesTerm || pipeSearchString.includes(term);

        return matchesProduct && matchesStainless && pipeMatchesTerm;
      });

      const isCompatible = validPipelines.length > 0;
      const isVisible = (activePortFilter === 'ALL' || activePortFilter === port.id) && (portMatchesTerm || isCompatible);

      return {
        ...port,
        cheat,
        validPipelines,
        isCompatible,
        isVisible
      };
    });
  }, [selectedProduct, searchKeyword, onlyStainless, activePortFilter]);

  const visiblePorts = useMemo(() => {
    return evaluatedPorts.filter(p => p.isVisible);
  }, [evaluatedPorts]);

  const compatiblePortsCount = evaluatedPorts.filter(p => p.isCompatible).length;
  const totalViablePipelinesCount = evaluatedPorts.reduce((acc, p) => acc + p.validPipelines.length, 0);

  const estimatedTotal = useMemo(() => {
    const vol = parseFloat(orderVolume) || 0;
    const storage = parseFloat(calcValues.storageUsd) || 0;
    const throughput = parseFloat(calcValues.throughputUsd) || 0;
    const heating = parseFloat(calcValues.heatingUsd) || 0;
    const pigging = parseFloat(calcValues.piggingFixedUsd) || 0;
    return vol * (storage + throughput + heating) + pigging;
  }, [orderVolume, calcValues]);

  // Coordenadas dinámicas de la cámara del mapa
  const mapCenter = showGlobalRoutes ? [20.0, 45.0] : [4.5, 109.0];
  const mapZoom = showGlobalRoutes ? 3 : 6;

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 overflow-hidden font-sans">
      
      {/* 1. BARRA SUPERIOR DE BÚSQUEDA INTEGRADA */}
      <div className="p-4 md:px-6 bg-white border-b border-slate-200 shadow-sm shrink-0 z-10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Anchor className="text-emerald-600" size={24} />
              Operaciones Marítimas y Logística
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Puertos autorizados, cálculos de Demurrage y viabilidad de tuberías de carga para exportación.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Producto */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <Droplet size={14} className="text-emerald-600 ml-1" />
              <span className="text-[11px] font-bold text-slate-600">Fluido:</span>
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-emerald-500"
              >
                <option value="ALL">Todos los fluidos</option>
                {terminalsData.materials.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* Tonelaje */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <span className="text-[11px] font-bold text-slate-600 ml-1">Lote:</span>
              <input
                type="number"
                step="500"
                value={orderVolume}
                onChange={(e) => setOrderVolume(e.target.value)}
                className="w-20 text-xs font-bold text-slate-800 bg-white border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:border-emerald-500 font-mono text-right"
              />
              <span className="text-xs text-slate-500 font-bold pr-1">TM</span>
            </div>

            {/* Buscador de texto unificado */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2 text-slate-400" size={13} />
              <input
                type="text"
                placeholder="Busca puerto o tubería..."
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                className="pl-7 pr-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:border-emerald-500 w-48 transition-all"
              />
            </div>

            {/* Filtro Acero Inoxidable */}
            <button
              onClick={() => setOnlyStainless(!onlyStainless)}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all flex items-center gap-1 ${
                onlyStainless 
                  ? 'bg-blue-600 text-white border-blue-600' 
                  : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
              }`}
              title="Filtra solo tuberías de Acero Inoxidable (SS304/SS316) sin riesgo de metales disueltos"
            >
              <SlidersHorizontal size={12} />
              Solo Inox (SS)
            </button>
          </div>
        </div>

        {/* Resumen inferior con accesos rápidos */}
        <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-medium text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Puertos Operativos: <strong>{compatiblePortsCount} de {evaluatedPorts.length}</strong>
            </span>
            <span className="text-slate-300">|</span>
            <span className="font-medium text-slate-700">
              Tuberías Válidas: <strong className="text-emerald-700 font-mono font-bold">{totalViablePipelinesCount}</strong>
            </span>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto">
            <button
              onClick={() => setActivePortFilter('ALL')}
              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                activePortFilter === 'ALL' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              Toda Malasia
            </button>
            {evaluatedPorts.map(p => (
              <button
                key={p.id}
                onClick={() => setActivePortFilter(p.id)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all whitespace-nowrap ${
                  activePortFilter === p.id 
                    ? 'bg-slate-800 text-white' 
                    : p.isCompatible 
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                    : 'bg-slate-100 text-slate-400 opacity-60'
                }`}
              >
                {p.name.split(' (')[0]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. PANTALLA DIVIDIDA */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        
        {/* MAPA TÁCTICO */}
        <div className="w-full md:w-5/12 h-64 md:h-full border-r border-slate-200 relative shrink-0">
          <MapContainer center={mapCenter} zoom={mapZoom} className="w-full h-full">
            <MapController center={mapCenter} zoom={mapZoom} />
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {/* MARCADORES DE PUERTOS MALAYOS */}
            {evaluatedPorts.map((port) => (
              <Marker
                key={port.id}
                position={[port.lat, port.lng]}
                icon={port.isCompatible ? greenPortIcon : redPortIcon}
                eventHandlers={{ click: () => { 
                  setActivePortFilter(port.id); 
                  setActiveTab('ports'); 
                  setShowGlobalRoutes(false); // Zoom in al puerto al hacer clic
                }}}
              >
                <Popup>
                  <div className="p-1 min-w-[190px]">
                    <h3 className="font-bold text-slate-900 text-sm">{port.name}</h3>
                    <p className="text-[11px] text-slate-500 mb-1">{port.region}</p>
                    <p className="text-xs mb-2">
                      {port.isCompatible ? (
                        <span className="text-emerald-700 font-bold">🟢 {port.validPipelines.length} líneas autorizadas</span>
                      ) : (
                        <span className="text-red-600 font-bold">🔴 Sin líneas para {selectedProduct}</span>
                      )}
                    </p>
                    <button
                      onClick={() => { 
                        setActivePortFilter(port.id); 
                        setActiveTab('ports'); 
                        setShowGlobalRoutes(false);
                      }}
                      className="w-full bg-slate-800 text-white text-[11px] py-1 rounded font-bold hover:bg-emerald-600 transition-colors"
                    >
                      Ver Ficha del Puerto
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* RUTAS Y MARCADORES GLOBALES (SÓLO SI ESTÁ ACTIVADO) */}
            {showGlobalRoutes && terminalsData.spanish_ports && (
              <>
                {/* Puertos Españoles */}
                {terminalsData.spanish_ports.map(sp => (
                  <Marker key={sp.id} position={[sp.lat, sp.lng]} icon={spainPortIcon}>
                    <Popup>
                      <div className="p-1 min-w-[200px]">
                        <h3 className="font-bold text-blue-900 text-sm">{sp.name}</h3>
                        <p className="text-[11px] text-slate-500 mb-1">{sp.region}</p>
                        <p className="text-xs mt-1 text-slate-700">{sp.desc}</p>
                      </div>
                    </Popup>
                  </Marker>
                ))}

                {/* Puntos de Riesgo / Waypoints */}
                {terminalsData.waypoints.map(wp => (
                  <Marker key={wp.id} position={[wp.lat, wp.lng]} icon={waypointIcon}>
                    <Popup>
                      <div className="p-1 min-w-[190px]">
                        <h3 className="font-bold text-amber-900 text-sm">{wp.name}</h3>
                        <p className="text-xs text-red-600 font-medium mt-1 pt-1 border-t border-red-100">⚠️ Riesgo: {wp.risk}</p>
                      </div>
                    </Popup>
                  </Marker>
                ))}

                {/* Rutas Troncales (Suez y Cabo) */}
                <Polyline positions={terminalsData.maritime_routes.suez.path} color={terminalsData.maritime_routes.suez.color} weight={3} opacity={0.8} />
                <Polyline positions={terminalsData.maritime_routes.cape.path} color={terminalsData.maritime_routes.cape.color} weight={3} opacity={0.8} />

                {/* Líneas de Alimentación (Feeder Lines) desde Malasia */}
                {evaluatedPorts.map(port => {
                  const path = port.lng > 110 
                    ? [[port.lat, port.lng], [1.2, 103.5], [5.6, 97.8]] 
                    : [[port.lat, port.lng], [5.6, 97.8]];
                  
                  return (
                    <Polyline 
                      key={`feeder-${port.id}`} 
                      positions={path} 
                      color={port.isCompatible ? "#10b981" : "#94a3b8"} 
                      weight={1.5} 
                      dashArray="4 4" 
                      opacity={0.6} 
                    />
                  );
                })}
              </>
            )}
          </MapContainer>

          {/* BOTÓN FLOTANTE PARA ACTIVAR RUTAS */}
          <div className="absolute bottom-6 left-6 z-[400]">
            <button 
              onClick={() => setShowGlobalRoutes(!showGlobalRoutes)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg font-bold text-xs transition-all ${
                showGlobalRoutes ? 'bg-slate-800 text-white border border-slate-700' : 'bg-white text-slate-800 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Globe2 size={16} className={showGlobalRoutes ? 'text-emerald-400' : 'text-blue-600'} />
              {showGlobalRoutes ? 'Ocultar Rutas Oceánicas' : 'Ver Rutas a España'}
            </button>
          </div>
        </div>

        {/* CONSOLA DERECHA */}
        <div className="flex-1 h-full overflow-y-auto bg-slate-50 flex flex-col">
          
          {/* Pestañas Superiores Ampliadas */}
          <div className="bg-white border-b border-slate-200 px-6 pt-3 flex gap-4 shrink-0 overflow-x-auto">
            <button
              onClick={() => setActiveTab('ports')}
              className={`pb-2.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
                activeTab === 'ports' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Briefcase size={15} />
              Puertos & Operativa ({visiblePorts.length})
            </button>
            <button
              onClick={() => setActiveTab('checklist')}
              className={`pb-2.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
                activeTab === 'checklist' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <ListChecks size={15} />
              Checklist de Carga
            </button>
            <button
              onClick={() => setActiveTab('demurrage')}
              className={`pb-2.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
                activeTab === 'demurrage' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Ship size={15} />
              Contratos & Demurrage
            </button>
            <button
              onClick={() => setActiveTab('calculator')}
              className={`pb-2.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
                activeTab === 'calculator' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Calculator size={15} />
              Costes FOB
            </button>
            <button
              onClick={() => setActiveTab('laws')}
              className={`pb-2.5 text-xs font-bold border-b-2 flex items-center gap-1.5 transition-all whitespace-nowrap ${
                activeTab === 'laws' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <BookOpen size={15} />
              Leyes Técnicas
            </button>
          </div>

          <div className="p-4 md:p-6 flex-1">
            
            {/* PESTAÑA 1: PUERTOS CON GUÍA Y TUBERÍAS ANIDADAS */}
            {activeTab === 'ports' && (
              <div className="space-y-6 max-w-4xl mx-auto">
                {visiblePorts.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-slate-400">
                    <XCircle className="mx-auto mb-2 text-red-400" size={32} />
                    <p className="font-bold text-slate-700">No se encontraron puertos con los criterios de búsqueda</p>
                    <p className="text-xs mt-1">Prueba a buscar otro puerto o cambiar la materia prima.</p>
                  </div>
                ) : (
                  visiblePorts.map((port) => {
                    const portNoteKey = `port-${port.id}`;
                    const portNote = notes[portNoteKey] || '';
                    const isSavingPort = savingKey === portNoteKey;

                    return (
                      <div
                        key={port.id}
                        className={`bg-white border rounded-xl shadow-sm transition-all overflow-hidden ${
                          port.isCompatible ? 'border-slate-200 hover:border-emerald-400' : 'border-red-200 bg-red-50/10'
                        }`}
                      >
                        {/* Cabecera del Puerto */}
                        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                                  port.isCompatible 
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
                                    : 'bg-red-100 text-red-800 border-red-200'
                                }`}>
                                  {port.isCompatible ? `🟢 ${port.validPipelines.length} Tuberías Aptas` : `🔴 Sin Tuberías para ${selectedProduct}`}
                                </span>
                                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase">
                                  {port.region}
                                </span>
                              </div>
                              <h2 className="text-lg font-bold text-slate-900">{port.name}</h2>
                            </div>

                            <div className="sm:text-right bg-white p-2.5 rounded-lg border border-slate-200 text-xs shrink-0">
                              <span className="text-slate-400 font-bold block text-[10px] uppercase">Calado Máximo</span>
                              <span className="font-bold text-slate-700">{port.draft}</span>
                              <span className="text-[10px] text-slate-400 block mt-0.5">{port.berths}</span>
                            </div>
                          </div>

                          {/* GUÍA OPERATIVA DEL BROKER */}
                          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                            <div className="bg-white p-3 rounded-lg border border-slate-200">
                              <span className="font-bold text-slate-800 block mb-1 flex items-center gap-1">
                                <Briefcase size={12} className="text-emerald-600" /> Enfoque Comercial
                              </span>
                              <p className="text-slate-600 leading-relaxed text-[11px]">{port.cheat.focus}</p>
                            </div>
                            <div className="bg-amber-50/80 p-3 rounded-lg border border-amber-200">
                              <span className="font-bold text-amber-900 block mb-1 flex items-center gap-1">
                                <AlertOctagon size={12} className="text-amber-600" /> La Trampa Logística
                              </span>
                              <p className="text-amber-800 leading-relaxed text-[11px]">{port.cheat.trampa}</p>
                            </div>
                            <div className="bg-blue-50/80 p-3 rounded-lg border border-blue-200">
                              <span className="font-bold text-blue-900 block mb-1 flex items-center gap-1">
                                <PhoneCall size={12} className="text-blue-600" /> Pregunta al Proveedor
                              </span>
                              <p className="text-blue-900 font-mono leading-relaxed text-[11px]">{port.cheat.pregunta}</p>
                            </div>
                          </div>
                        </div>

                        {/* TUBERÍAS DEL PUERTO ANIDADAS */}
                        <div className="p-5 space-y-3">
                          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Layers size={13} className="text-slate-500" />
                            Tuberías de Exportación ({port.validPipelines.length})
                          </h3>

                          {port.validPipelines.length === 0 ? (
                            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center">
                              No hay tuberías en este puerto compatibles con <strong className="text-slate-700">{selectedProduct}</strong> o con los filtros activos.
                            </div>
                          ) : (
                            port.validPipelines.map((pipe) => {
                              const pipeKey = `pipe-${pipe.id}`;
                              const pipeNote = notes[pipeKey] || '';
                              const isSavingPipe = savingKey === pipeKey;
                              const isTechOpen = !!expandedPipelines[pipeKey];

                              return (
                                <div key={pipe.id} className="bg-slate-50/60 border border-slate-200 rounded-lg p-4 space-y-2.5 hover:bg-white hover:border-emerald-300 transition-all">
                                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                                    <div>
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-mono font-bold text-slate-600 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                                          {pipe.id}
                                        </span>
                                        <h4 className="text-sm font-bold text-slate-800">{pipe.operator}</h4>
                                      </div>
                                      <p className="text-xs text-slate-600">
                                        <span className="font-semibold text-slate-700">Recorrido:</span> {pipe.route}
                                      </p>
                                    </div>

                                    <div className="sm:text-right bg-white p-2 rounded border border-slate-200 text-xs shrink-0 cursor-pointer hover:bg-emerald-50" title="Haz clic para enviar este caudal a la calculadora de Demurrage" onClick={() => {
                                      setDemurrageCalc(prev => ({...prev, pumpingRate: extractMinRate(pipe.rate).toString()}));
                                      setActiveTab('demurrage');
                                    }}>
                                      <span className="text-[9px] font-bold text-slate-400 uppercase block">Tiempo para {orderVolume} TM</span>
                                      <span className="text-xs font-bold text-emerald-700 font-mono">
                                        {calculatePumpingTime(pipe.rate, orderVolume)}
                                      </span>
                                      <span className="text-[9px] text-slate-500 block">Caudal: {pipe.rate}</span>
                                    </div>
                                  </div>

                                  <div className="bg-amber-50 border border-amber-200 rounded p-2.5 text-xs text-amber-900 flex items-start gap-2">
                                    <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-600" />
                                    <div className="leading-relaxed">
                                      <span className="font-bold">Regla contractual:</span> {pipe.restrictions}
                                    </div>
                                  </div>

                                  <div className="pt-0.5">
                                    <button onClick={() => togglePipelineSpecs(pipeKey)} className="text-[11px] text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1">
                                      {isTechOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                      {isTechOpen ? 'Ocultar ingeniería' : 'Ver datos de ingeniería de la tubería'}
                                    </button>

                                    {isTechOpen && (
                                      <div className="mt-2 p-2.5 bg-white rounded border border-slate-200 text-xs space-y-1">
                                        <p className="text-slate-700 font-mono text-[11px]">
                                          <strong className="text-slate-500 font-sans">ESPECIFICACIÓN:</strong> {pipe.specs}
                                        </p>
                                        <p className="text-slate-600 text-[11px]">
                                          <strong className="text-slate-500">FLUIDOS ADMITIDOS:</strong> {pipe.allowed.join(', ')}
                                        </p>
                                      </div>
                                    )}
                                  </div>

                                  <div className="pt-1">
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="text-[10px] font-bold text-amber-900 flex items-center gap-1">
                                        <Edit3 size={11} className="text-amber-700" /> Nota privada sobre {pipe.id}
                                      </span>
                                      {isSavingPipe && (
                                        <span className="text-[9px] font-bold text-emerald-700 flex items-center gap-1">
                                          <CheckCircle2 size={10} /> Guardado
                                        </span>
                                      )}
                                    </div>
                                    <textarea
                                      value={pipeNote}
                                      onChange={(e) => handleUpdateNote(pipeKey, e.target.value)}
                                      placeholder="Apunta aquí tarifas cotizadas para esta tubería..."
                                      className="w-full p-2 text-xs bg-white border border-amber-200 rounded focus:outline-none focus:border-amber-500 min-h-[45px] text-slate-700 resize-y"
                                    />
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>

                        {/* Bloc de notas general del puerto */}
                        <div className="px-5 pb-5">
                          <div className="bg-amber-50/30 border border-amber-200 rounded-lg p-3">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-bold text-amber-900 flex items-center gap-1">
                                <Edit3 size={12} className="text-amber-700" /> Notas Generales de {port.name}
                              </span>
                              {isSavingPort && (
                                <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                                  <CheckCircle2 size={10} /> Guardado
                                </span>
                              )}
                            </div>
                            <textarea
                              value={portNote}
                              onChange={(e) => handleUpdateNote(portNoteKey, e.target.value)}
                              placeholder={`Contactos de inspectores SGS o agentes en ${port.name.split(' (')[0]}...`}
                              className="w-full p-2 text-xs bg-white border border-amber-200 rounded focus:outline-none focus:border-amber-500 min-h-[50px] text-slate-700 resize-y"
                            />
                          </div>
                        </div>

                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* PESTAÑA NUEVA: CONTRATOS MARÍTIMOS (LAYTIME, LC & DEMURRAGE) */}
            {activeTab === 'demurrage' && (
              <div className="space-y-6 max-w-4xl mx-auto">
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                  <div className="mb-5">
                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                      <Ship size={24} className="text-emerald-600" />
                      Simulador de Contratos: Demurrage y Fechas LC
                    </h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Calcula las penalizaciones por retraso en muelle y los plazos de la Carta de Crédito según la ruta a Europa.
                    </p>
                  </div>

                  {/* Panel 1: Simulador de Demurrage */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mb-6">
                    <h4 className="font-bold text-slate-700 flex items-center gap-2 mb-4">
                      <Gauge size={16} /> 1. Cálculo de Laytime y Penalizaciones (Demurrage / Despatch)
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                      <label className="block">
                        <span className="text-xs font-bold text-slate-600 block mb-1">Volumen (TM)</span>
                        <input type="number" readOnly value={orderVolume} className="w-full p-2 bg-slate-200 border border-slate-300 rounded text-sm text-slate-600 font-mono" />
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold text-slate-600 block mb-1">Caudal Tubería (TM/h)</span>
                        <input type="number" name="pumpingRate" value={demurrageCalc.pumpingRate} onChange={handleDemurrageChange} className="w-full p-2 bg-white border border-slate-300 rounded text-sm font-mono focus:border-emerald-500 focus:outline-none" />
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold text-slate-600 block mb-1">Turn Time (Horas)</span>
                        <input type="number" name="turnTimeHours" value={demurrageCalc.turnTimeHours} onChange={handleDemurrageChange} className="w-full p-2 bg-white border border-slate-300 rounded text-sm font-mono focus:border-emerald-500 focus:outline-none" />
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold text-slate-600 block mb-1">Tarifa Buque (USD/Día)</span>
                        <input type="number" name="demurrageRatePerDay" value={demurrageCalc.demurrageRatePerDay} onChange={handleDemurrageChange} className="w-full p-2 bg-white border border-slate-300 rounded text-sm font-mono focus:border-emerald-500 focus:outline-none" />
                      </label>
                    </div>

                    <div className="border-t border-slate-200 pt-4 flex flex-col md:flex-row items-center gap-4">
                      <div className="flex-1 w-full">
                        <label className="block">
                          <span className="text-xs font-bold text-slate-800 block mb-1">Tiempo REAL empleado en conectar y bombear (Horas):</span>
                          <input type="number" name="actualHoursUsed" value={demurrageCalc.actualHoursUsed} onChange={handleDemurrageChange} className="w-full p-2 bg-amber-50 border border-amber-300 rounded text-lg font-bold font-mono focus:border-amber-500 focus:outline-none" />
                        </label>
                      </div>
                      
                      <div className={`flex-1 w-full p-4 rounded-lg border ${demurrageResults.type === 'DEMURRAGE' ? 'bg-red-50 border-red-200' : demurrageResults.type === 'DESPATCH' ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-100 border-slate-200'}`}>
                        <div className="flex justify-between items-end mb-1">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Tiempo Autorizado (Laytime): {demurrageResults.laytimeAllowed}h</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className={`font-bold ${demurrageResults.type === 'DEMURRAGE' ? 'text-red-700' : demurrageResults.type === 'DESPATCH' ? 'text-emerald-700' : 'text-slate-600'}`}>
                            {demurrageResults.type === 'DEMURRAGE' ? 'MULTA (DEMURRAGE)' : demurrageResults.type === 'DESPATCH' ? 'BONO (DESPATCH 50%)' : 'DENTRO DE PLAZO'}
                          </span>
                          <span className={`text-2xl font-mono font-bold ${demurrageResults.type === 'DEMURRAGE' ? 'text-red-700' : demurrageResults.type === 'DESPATCH' ? 'text-emerald-700' : 'text-slate-600'}`}>
                            {demurrageResults.penaltyAmount > 0 ? `$${demurrageResults.penaltyAmount.toLocaleString('en-US', {maximumFractionDigits:0})}` : '$0'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Panel 2: Rutas a Europa */}
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <div className="p-4 bg-slate-800 text-white flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CalendarDays size={18} className="text-emerald-400" />
                        <h4 className="font-bold">2. Rutas a Europa: Fechas de Presentación en Banco</h4>
                      </div>
                      <button onClick={() => { setShowGlobalRoutes(true); setActiveTab('ports'); }} className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded-lg border border-slate-600 transition-colors">
                        Ver en Mapa
                      </button>
                    </div>
                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="border border-slate-200 rounded p-4">
                        <h5 className="font-bold text-slate-800 mb-2 border-b border-slate-100 pb-2">Ruta Cabo de Buena Esperanza</h5>
                        <p className="text-xs text-slate-600 mb-3">{terminalsData.maritime_routes.cape.desc}</p>
                        <div className="flex justify-between items-center bg-slate-50 p-2 rounded mb-2">
                          <span className="text-xs font-bold text-slate-500">Tiempo de Tránsito:</span>
                          <span className="font-mono text-sm font-bold text-emerald-700">{terminalsData.maritime_routes.cape.transit_days}</span>
                        </div>
                        <div className="bg-amber-50 p-2 rounded text-[10px] text-amber-800 border border-amber-100">
                          <strong>Exigencia LC (Campo 48):</strong> Negociar presentación documental estándar (21 días). El B/L llegará al banco europeo unas 2 semanas antes que el barco.
                        </div>
                      </div>

                      <div className="border border-slate-200 rounded p-4">
                        <h5 className="font-bold text-slate-800 mb-2 border-b border-slate-100 pb-2">Ruta Canal de Suez</h5>
                        <p className="text-xs text-slate-600 mb-3">{terminalsData.maritime_routes.suez.desc}</p>
                        <div className="flex justify-between items-center bg-slate-50 p-2 rounded mb-2">
                          <span className="text-xs font-bold text-slate-500">Tiempo de Tránsito:</span>
                          <span className="font-mono text-sm font-bold text-blue-700">{terminalsData.maritime_routes.suez.transit_days}</span>
                        </div>
                        <div className="bg-red-50 p-2 rounded text-[10px] text-red-800 border border-red-100">
                          <strong>Peligro FOB/CIF:</strong> Ojo al War Risk Premium (Piratería/Ataques). Negociar si el comprador europeo acepta pagar la prima extra del seguro de casco.
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* PESTAÑA CHECKLIST DE BOMBEO */}
            {activeTab === 'checklist' && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm max-w-3xl mx-auto space-y-4">
                <div>
                  <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                    <ListChecks size={20} className="text-emerald-600" />
                    Protocolo Operativo de Carga para {orderVolume} TM
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Checklist táctico que debes monitorizar con el inspector (SGS/Intertek) durante la carga en puerto.
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  {[
                    { title: "1. Verificación ISCC & TSR de la Terminal", desc: "Confirmar que la terminal portuaria tiene alcance ISCC EU activo como Trader with Storage y solicitar confirmación escrita del Tank Storage Receipt (TSR)." },
                    { title: "2. Medición Pre-Loading de Tanques y Buque", desc: "El inspector independiente mide los tanques de tierra (ullage, temperatura, densidad) y expide el Tank Cleanliness Certificate de los tanques del barco (revisando OBQ/ROB)." },
                    { title: "3. Alineación y Pigging Inicial", desc: "Se alinean las válvulas y se lanza un rascador (pig) impulsado con nitrógeno seco para dejar la tubería 100% libre de humedad y de trazas de CPO anterior." },
                    { title: "4. First-Foot Sampling (Prueba Crítica)", desc: "Se bombean las primeras 200-300 TM hasta cubrir el primer pie (30 cm) del tanque del buque. Se frena la bomba. Se toma muestra y solo si el análisis da OK, se autoriza el bombeo masivo." },
                    { title: `5. Bombeo Masivo Continuo`, desc: `Transferencia a régimen nominal manteniendo el Steam-Tracing (calefacción por vapor) activo a 50-60°C para evitar solidificaciones dentro del tubo.` },
                    { title: "6. Line Stripping y Cierre de Figuras", desc: "Soplado final con nitrógeno hacia el buque para vaciar las últimas 15-25 TM de la tubería. Medición final de buque/tierra para emitir los certificados finales de Calidad y Cantidad." }
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs">
                      <CheckCircle2 size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold text-slate-800">{step.title}</p>
                        <p className="text-slate-600 mt-0.5 leading-relaxed">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* PESTAÑA LEYES TÉCNICAS */}
            {activeTab === 'laws' && (
              <div className="space-y-4 max-w-3xl mx-auto">
                <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <h3 className="font-bold text-slate-800 text-sm mb-1 flex items-center gap-2">
                    <ShieldCheck size={18} className="text-emerald-600" />
                    Las 4 Leyes Técnicas para la Selección de Tuberías
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Criterios obligatorios de ingeniería para no incurrir en producto fuera de especificación (Off-Spec).
                  </p>

                  <div className="space-y-3">
                    {terminalsData.technical_rules.map((rule, idx) => (
                      <div key={idx} className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-1.5">
                        <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-mono text-xs">
                            {idx + 1}
                          </span>
                          {rule.rule}
                        </h4>
                        <p className="text-slate-600 leading-relaxed pl-7">{rule.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* PESTAÑA CALCULADORA FOB */}
            {activeTab === 'calculator' && (
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm max-w-3xl mx-auto space-y-5">
                <div>
                  <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                    <DollarSign size={20} className="text-emerald-600" />
                    Simulador de Costes de Manipulación Portuaria (FOB)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Introduce las tarifas cotizadas por la terminal para calcular el coste local de exportación antes del flete oceánico.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="font-bold text-slate-700 block mb-1">Volumen del Lote</span>
                    <span className="font-mono text-base font-bold text-slate-900">{orderVolume} TM</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">(Modificable en la barra superior)</span>
                  </div>

                  <label className="block">
                    <span className="font-bold text-slate-700">Storage Fee (USD/TM)</span>
                    <input type="number" name="storageUsd" value={calcValues.storageUsd} onChange={handleCalcChange} className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 font-mono" />
                  </label>

                  <label className="block">
                    <span className="font-bold text-slate-700">Throughput / Bombeo (USD/TM)</span>
                    <input type="number" name="throughputUsd" value={calcValues.throughputUsd} onChange={handleCalcChange} className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 font-mono" />
                  </label>

                  <label className="block">
                    <span className="font-bold text-slate-700">Vapor / Calentamiento (USD/TM)</span>
                    <input type="number" name="heatingUsd" value={calcValues.heatingUsd} onChange={handleCalcChange} className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 font-mono" />
                  </label>

                  <label className="block md:col-span-2">
                    <span className="font-bold text-slate-700">Pigging, Muestreo y Nitrógeno (Coste Fijo USD)</span>
                    <input type="number" name="piggingFixedUsd" value={calcValues.piggingFixedUsd} onChange={handleCalcChange} className="mt-1 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 font-mono" />
                  </label>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                      Coste Estimado Total de Terminal
                    </span>
                    <p className="text-xs text-emerald-600 mt-0.5">
                      Equivalente a ${(estimatedTotal / (parseFloat(orderVolume) || 1)).toFixed(2)} USD/TM
                    </p>
                  </div>
                  <span className="text-2xl font-mono font-bold text-emerald-800">
                    ${estimatedTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}