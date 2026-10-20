import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import AuthScreen from './components/AuthScreen';
import PlaybookModule from './components/PlaybookModule';
import LogisticsModule from './components/LogisticsModule';
import AgenciesModule from './components/AgenciesModule';

import {
  Activity, BookOpen, Database, Droplet, Globe, LayoutDashboard, 
  Leaf, Menu, Settings, X, TrendingUp, FileText, Map as MapIcon, Ship, 
  ShieldCheck, Search, Plus, MapPin, Anchor, FileCheck, AlertTriangle, 
  Clock, CheckCircle, ChevronRight, FileDigit, RefreshCw, ExternalLink,
  List, Map, Package, ChevronDown, ChevronUp
} from 'lucide-react';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const customMarkerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

export default function App() {
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    // Comprobar sesión activa al cargar la app
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingSession(false);
    });

    // Escuchar cambios en la autenticación (login / logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 1. ESTADOS PRINCIPALES
  const [activeTab, setActiveTab] = useState('providers');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // 2. ESTADOS DE PROVEEDORES Y MAPA
  const [providers, setProviders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('list'); 

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('suppliers_iscc')
        .select('*')
        .order('id', { ascending: true });
      
      if (error) throw error;
      setProviders(data || []);
      
      if (data && data.length > 0 && !selectedProvider) {
        setSelectedProvider(data[0]);
      }
    } catch (error) {
      console.error('Error al descargar de Supabase:', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNavClick = (tab) => {
    setActiveTab(tab);
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  const filteredProviders = providers.filter(p => {
    const term = searchTerm.toLowerCase();
    const matchEmpresa = p.Empresa && p.Empresa.toLowerCase().includes(term);
    const matchMaterias = p.Materias_Primas && p.Materias_Primas.toLowerCase().includes(term);
    
    return matchEmpresa || matchMaterias;
  });

  const renderSidebar = () => (
    <div className={`bg-slate-900 text-slate-300 w-64 min-h-screen flex flex-col transition-transform duration-300 shadow-2xl shrink-0 z-40 absolute md:relative ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
      <div className="p-5 flex items-center justify-between border-b border-slate-800 bg-slate-950">
        <div className="flex items-center gap-2">
          <Leaf className="text-emerald-500" size={24} />
          <span className="text-xl font-bold font-sans text-white tracking-wide">EcoPalm <span className="text-emerald-500">Hub</span></span>
        </div>
        <button className="md:hidden text-slate-400 hover:text-white transition-colors" onClick={() => setIsSidebarOpen(false)}>
          <X size={20} />
        </button>
      </div>

      <div className="overflow-y-auto flex-1 flex flex-col justify-between">
        <nav className="p-4 space-y-1">
          <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-2">Visión General</p>
          <NavItem icon={<LayoutDashboard size={18} />} label="Dashboard" id="dashboard" active={activeTab === 'dashboard'} onClick={() => handleNavClick('dashboard')} />
          
          <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-6">Operativa CRM</p>
          <NavItem icon={<MapIcon size={18} />} label="Proveedores (Malasia)" id="providers" active={activeTab === 'providers'} onClick={() => handleNavClick('providers')} />
          <NavItem icon={<Ship size={18} />} label="Logística & Rutas" id="logistics" active={activeTab === 'logistics'} onClick={() => handleNavClick('logistics')} />
          <NavItem icon={<ShieldCheck size={18} />} label="Agencias (SGS/Customs)" id="agencies" active={activeTab === 'agencies'} onClick={() => handleNavClick('agencies')} />
          
          <p className="px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 mt-6">Inteligencia</p>
          <NavItem icon={<BookOpen size={18} />} label="Blindaje Legal" id="playbook" active={activeTab === 'playbook'} onClick={() => handleNavClick('playbook')} />
        </nav>

        {/* Botón para Cerrar Sesión en el menú lateral */}
        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={() => supabase.auth.signOut()}
            className="w-full text-left px-4 py-2.5 rounded-lg text-xs font-medium text-red-400 hover:bg-slate-800 transition-colors"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    </div>
  );

  const NavItem = ({ icon, label, active, onClick }) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-left ${
        active ? 'bg-emerald-600/20 text-emerald-400 font-medium' : 'hover:bg-slate-800 hover:text-white'
      }`}
    >
      {icon}
      <span className="text-sm">{label}</span>
    </button>
  );

  const renderMapViewContainer = () => {
    const mapProviders = filteredProviders.filter(p => p.Latitud && p.Longitud && !isNaN(parseFloat(p.Latitud)));

    return (
      <div className="flex-1 w-full h-full relative z-0">
        <MapContainer 
          center={[4.2105, 101.9758]}
          zoom={6} 
          className="w-full h-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {mapProviders.map(provider => (
            <Marker 
              key={provider.id} 
              position={[parseFloat(provider.Latitud), parseFloat(provider.Longitud)]}
              icon={customMarkerIcon}
            >
              <Popup className="rounded-xl">
                <div className="p-1 min-w-[200px]">
                  <h3 className="font-bold text-slate-800 mb-1">{provider.Empresa || 'Empresa sin nombre'}</h3>
                  <p className="text-xs text-slate-500 mb-2">ID: #{provider.id}</p>
                  
                  {provider.Suspension_Hasta ? (
                    <span className="inline-block text-[10px] px-2 py-1 rounded text-red-700 bg-red-100 mb-3">
                      Suspendido: {provider.Suspension_Hasta}
                    </span>
                  ) : (
                    <span className="inline-block text-[10px] px-2 py-1 rounded text-emerald-700 bg-emerald-100 mb-3">
                      ISCC Activo
                    </span>
                  )}
                  
                  <button 
                    onClick={() => {
                      setSelectedProvider(provider);
                      setViewMode('list');
                    }}
                    className="w-full bg-emerald-600 text-white py-1.5 rounded text-xs font-semibold hover:bg-emerald-700 transition-colors"
                  >
                    Ver Ficha Completa
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
        
        <div className="absolute bottom-6 left-6 z-[400] bg-white/90 backdrop-blur p-3 rounded-lg shadow-lg border border-slate-200 text-xs">
          <p className="font-bold text-slate-800 mb-1">Proveedores en Mapa</p>
          <p className="text-slate-600">{mapProviders.length} localizados de {filteredProviders.length} filtrados</p>
        </div>
      </div>
    );
  };

  const renderProvidersView = () => (
    <div className="animate-fade-in flex flex-col h-[calc(100vh-4rem)] md:h-screen w-full">
      <div className="p-4 border-b border-slate-200 bg-white z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm shrink-0 w-full">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-800">Directorio ISCC</h2>
            <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full font-bold">{filteredProviders.length}</span>
          </div>
          <button onClick={fetchProviders} className="text-slate-400 hover:text-emerald-600 transition-colors" title="Recargar">
            <RefreshCw size={18} className={isLoading ? "animate-spin" : ""} />
          </button>
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre o producto..." 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 focus:bg-white transition-colors"
            />
          </div>

          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0 w-full md:w-auto">
            <button 
              onClick={() => setViewMode('list')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'list' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <List size={16} /> Lista
            </button>
            <button 
              onClick={() => { setViewMode('map'); }}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'map' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >

<Map size={16} />
Mapa General
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden w-full bg-slate-50 relative">
        {viewMode === 'map' ? (
          renderMapViewContainer()
        ) : (
          <>
            <div className="w-full md:w-80 lg:w-96 border-r border-slate-200 bg-white flex flex-col shrink-0 overflow-hidden">
              {isLoading ? (
                <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
                  <RefreshCw className="animate-spin mr-2" size={16} /> Cargando proveedores...
                </div>
              ) : (
                <div className="overflow-y-auto flex-1 p-2">
                  {filteredProviders.map((provider) => (
                    <button
                      key={provider.id}
                      onClick={() => setSelectedProvider(provider)}
                      className={`w-full text-left p-3 rounded-lg mb-1 border transition-all ${
                        selectedProvider?.id === provider.id 
                          ? 'bg-emerald-50 border-emerald-200 shadow-sm' 
                          : 'border-transparent hover:bg-slate-50 hover:border-slate-200'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div className="min-w-0 pr-2 flex-1">
                          <h3 className={`font-bold text-sm truncate ${selectedProvider?.id === provider.id ? 'text-emerald-800' : 'text-slate-700'}`}>
                            {provider.Empresa || 'Empresa sin nombre'}
                          </h3>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono mt-0.5 shrink-0">#{provider.id}</span>
                      </div>
                      
                      {provider.Materias_Primas && (
                        <div className="flex items-start gap-1.5 mb-2 mt-1">
                          <Droplet size={12} className="text-slate-400 mt-0.5 shrink-0" />
                          <p className="text-xs text-slate-500 truncate" title={provider.Materias_Primas}>
                            {provider.Materias_Primas}
                          </p>
                        </div>
                      )}
                      
                      <div className="flex gap-2 mt-2">
                        {provider.Latitud && (
                          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded">
                            <MapPin size={10} /> Localizado
                          </span>
                        )}
                        
                        {provider.Suspension_Hasta ? (
                          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-red-50 text-red-600 rounded border border-red-100">
                            <AlertTriangle size={10} /> Suspendido
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded border border-emerald-100">
                            <FileCheck size={10} /> ISCC Activo
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                  {filteredProviders.length === 0 && (
                    <div className="text-center p-8 text-slate-400 text-sm">
                      No se encontraron resultados
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50 min-w-0 relative">
              {selectedProvider ? (
                <div className="p-6 md:p-8 max-w-5xl mx-auto">
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                      <div>
                        <h1 className="text-2xl font-bold text-slate-800 mb-2">{selectedProvider.Empresa || 'Empresa sin nombre'}</h1>
                        <div className="flex items-center gap-3 text-sm text-slate-500">
                          <span className="flex items-center gap-1"><FileDigit size={16} /> ID Interno: {selectedProvider.id}</span>
                          {selectedProvider.Country && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1"><Globe size={16} /> {selectedProvider.Country}</span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {selectedProvider.Suspension_Hasta && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg flex items-center gap-2">
                          <AlertTriangle size={20} />
                          <div>
                            <p className="text-xs font-bold uppercase tracking-wider">Certificado Suspendido</p>
                            <p className="text-sm">Hasta: {selectedProvider.Suspension_Hasta}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="border border-slate-100 rounded-xl p-5 bg-white shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                          <MapPin className="text-blue-500" size={20} />
                          <h3 className="font-semibold text-slate-800">Coordenadas Físicas</h3>
                        </div>
                        {selectedProvider.Latitud && selectedProvider.Longitud ? (
                          <div className="space-y-3">
                            <div className="flex justify-between p-2 bg-slate-50 rounded text-sm">
                              <span className="text-slate-500 text-xs">LATITUD</span>
                              <span className="font-mono text-slate-700">{selectedProvider.Latitud}</span>
                            </div>
                            <div className="flex justify-between p-2 bg-slate-50 rounded text-sm">
                              <span className="text-slate-500 text-xs">LONGITUD</span>
                              <span className="font-mono text-slate-700">{selectedProvider.Longitud}</span>
                            </div>
                            <a 
                              href={`https://www.google.com/maps/search/?api=1&query=${selectedProvider.Latitud},${selectedProvider.Longitud}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 w-full flex items-center justify-center gap-2 text-blue-600 bg-blue-50 hover:bg-blue-100 py-2 rounded-lg transition-colors text-sm font-medium"
                            >
                              <ExternalLink size={16} /> Abrir en Google Maps
                            </a>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400 italic">No hay coordenadas disponibles en la base de datos.</p>
                        )}
                      </div>

                      <div className="border border-slate-100 rounded-xl p-5 bg-white shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                          <FileText className="text-amber-500" size={20} />
                          <h3 className="font-semibold text-slate-800">Enlaces Oficiales (ISCC)</h3>
                        </div>
                        <div className="space-y-3">
                          {selectedProvider.Link_Certificado ? (
                            <a href={selectedProvider.Link_Certificado} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors">
                              <span className="flex items-center gap-2 text-sm font-medium"><FileCheck size={18} /> Ver Certificado PDF</span>
                              <ExternalLink size={16} />
                            </a>
                          ) : (
                            <div className="p-3 rounded-lg border border-slate-100 bg-slate-50 text-slate-400 text-sm flex items-center gap-2">
                              <FileCheck size={18} /> Sin enlace al certificado
                            </div>
                          )}

                          {selectedProvider.Link_Auditoria ? (
                            <a href={selectedProvider.Link_Auditoria} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
                              <span className="flex items-center gap-2 text-sm font-medium"><BookOpen size={18} /> Ver Informe de Auditoría</span>
                              <ExternalLink size={16} />
                            </a>
                          ) : (
                            <div className="p-3 rounded-lg border border-slate-100 bg-slate-50 text-slate-400 text-sm flex items-center gap-2">
                              <BookOpen size={18} /> Sin informe de auditoría
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="px-6 pb-6">
                      <div className="border border-slate-100 rounded-xl p-5 bg-white shadow-sm">
                        <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
                          <Database className="text-slate-400" size={20} />
                          <h3 className="font-semibold text-slate-800">Información Adicional de Registro</h3>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                          <div className="md:col-span-2">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Materias Primas Recolectadas</p>
                            <p className="text-sm text-slate-700 bg-slate-50 p-2 rounded">{selectedProvider.Materias_Primas || '-'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Alcance (Scope)</p>
                            <p className="text-sm text-slate-700 bg-slate-50 p-2 rounded">{selectedProvider.Alcance_Scope || '-'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold flex items-center gap-1 text-slate-400 uppercase tracking-wider mb-1">
                              <ShieldCheck size={12} className="text-emerald-500" /> Entidad Certificadora (CB)
                            </p>
                            <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 p-2 rounded font-semibold shadow-sm">
                              {selectedProvider.Certificadora_CB || 'No especificada'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400">
                  <Globe size={48} className="mb-4 text-slate-200" />
                  <p>Selecciona un proveedor de la lista para ver sus detalles</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );

  // 🔒 COMPROBACIONES DE SESIÓN ANTES DE PINTAR LA APP
  if (loadingSession) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-900 text-white text-xs font-mono">
        Cargando plataforma EcoPalm...
      </div>
    );
  }

  if (!session) {
    return <AuthScreen onLoginSuccess={(user) => setSession({ user })} />;
  }

  return (
    <div className="flex min-h-screen bg-slate-100 font-sans overflow-hidden">
      {renderSidebar()}
      
      {!isSidebarOpen && (
        <button 
          className="md:hidden fixed bottom-6 right-6 z-50 bg-emerald-600 text-white p-4 rounded-full shadow-lg"
          onClick={() => setIsSidebarOpen(true)}
        >
          <Menu size={24} />
        </button>
      )}

      <div className="flex-1 flex flex-col w-full min-w-0 h-screen">
        {activeTab === 'providers' && renderProvidersView()}
        {activeTab === 'playbook' && <PlaybookModule />}
        
        {activeTab === 'dashboard' && (
          <div className="flex-1 flex items-center justify-center bg-slate-50 p-8 text-center h-full">
            <div>
              <LayoutDashboard size={64} className="mx-auto text-slate-300 mb-4" />
              <h2 className="text-2xl font-bold text-slate-700 mb-2">Dashboard de Inteligencia</h2>
              <p className="text-slate-500 max-w-md mx-auto">Aquí programaremos los gráficos generales con volúmenes totales por puerto en Malasia.</p>
            </div>
          </div>
        )}
        {activeTab === 'logistics' && <LogisticsModule />}
        {activeTab === 'agencies' && <AgenciesModule />}
      </div>
    </div>
  );
}