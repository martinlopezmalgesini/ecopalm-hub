import React, { useMemo, useState } from 'react';
import { Calculator } from 'lucide-react';

const n = (v) => {
  const x = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(x) ? x : 0;
};
const money = (v) => (Number.isFinite(v) ? v.toFixed(2) : '-');

const GROUPS = [
  {
    title: 'Operación',
    fields: [
      ['volume', 'Volumen (toneladas)', 'p. ej. cargamento mensual'],
      ['target', 'Precio objetivo del comprador (USD/t, base CIF)', 'Referencia ± prima o descuento, ya resuelto'],
      ['sellerAsk', 'Precio que pide el vendedor (USD/t, base FOB)', 'El precio real pedido en origen'],
    ],
  },
  {
    title: 'Costes por tonelada',
    fields: [
      ['freight', 'Flete marítimo (USD/t)', 'Cotización para la ruta, el buque y la fecha'],
      ['insuranceRate', 'Tasa de seguro de carga (% sobre el 110% del valor)', 'Cotización de la aseguradora'],
      ['inspection', 'Inspección y muestreo, carga y descarga (USD/t)', ''],
      ['terminal', 'Terminal, calentamiento y manipulación (USD/t)', ''],
      ['exportInland', 'Despacho de exportación y transporte interior (USD/t)', ''],
      ['pretreat', 'Pretratamiento y ajustes de calidad (USD/t)', ''],
      ['cert', 'Prima de certificación (USD/t)', ''],
    ],
  },
  {
    title: 'Financiación',
    fields: [
      ['lcFeePct', 'Comisiones de la carta de crédito (% del valor)', ''],
      ['interestPct', 'Tipo de interés anual (%)', ''],
      ['days', 'Días con el dinero inmovilizado', ''],
    ],
  },
  {
    title: 'Cadena',
    fields: [
      ['layers', 'Intermediarios entre el productor y tú (número)', 'Sin contarte a ti'],
      ['layerFee', 'Comisión media por intermediario (USD/t)', ''],
    ],
  },
];

export default function CostStackCalculator() {
  const [v, setV] = useState({});
  const set = (k) => (e) => setV((p) => ({ ...p, [k]: e.target.value }));

  const r = useMemo(() => {
    const target = n(v.target);
    const insurance = target * 1.1 * (n(v.insuranceRate) / 100);
    const financing = target * (n(v.lcFeePct) / 100 + (n(v.interestPct) / 100) * (n(v.days) / 360));
    const costs =
      n(v.freight) + insurance + n(v.inspection) + n(v.terminal) + n(v.exportInland) +
      n(v.pretreat) + n(v.cert) + financing;
    const netback = target - costs;
    const pool = netback - n(v.sellerAsk);
    const layersTotal = n(v.layers) * n(v.layerFee);
    const room = pool - layersTotal;
    return { target, insurance, financing, costs, netback, pool, layersTotal, room, total: room * n(v.volume) };
  }, [v]);

  const ready = n(v.target) > 0 && n(v.sellerAsk) > 0;
  let verdict = null;
  if (ready) {
    if (r.pool < 0) verdict = ['red', 'El precio del vendedor supera lo que el comprador puede soportar: la operación no funciona a este precio.'];
    else if (r.room < 0) verdict = ['red', 'Las comisiones de la cadena se comen todo el margen disponible: acorta la cadena o renegocia.'];
    else if (r.pool > n(v.sellerAsk) * 0.25) verdict = ['amber', 'El margen disponible es muy grande frente al precio pedido: pregunta por qué el vendedor pide tan poco (precio cebo, producto no conforme).'];
    else verdict = ['green', 'Los números cuadran. Comprueba cada cifra con cotizaciones reales antes de fiarte.'];
  }
  const tone = { red: 'bg-red-50 border-red-200 text-red-700', amber: 'bg-amber-50 border-amber-200 text-amber-700', green: 'bg-emerald-50 border-emerald-200 text-emerald-700' };

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-8">
      <div className="flex items-center gap-3 mb-2">
        <Calculator className="text-emerald-600" size={26} />
        <h2 className="text-xl font-bold text-slate-800">Calculadora de pila de costes y margen (netback)</h2>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Parte del precio que paga el comprador y resta cada coste para ver lo máximo que puede cobrar el vendedor en origen y cuánto margen
        queda para la cadena. No hay cifras por defecto: usa tus propias cotizaciones.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-5">
          {GROUPS.map((g) => (
            <div key={g.title} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{g.title}</h3>
              <div className="space-y-3">
                {g.fields.map(([key, label, hint]) => (
                  <label key={key} className="block">
                    <span className="text-sm text-slate-700">{label}</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={v[key] ?? ''}
                      onChange={set(key)}
                      placeholder={hint}
                      className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 focus:bg-white"
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Resultado (USD/t)</h3>
            <dl className="text-sm space-y-2">
              {[
                ['Precio objetivo del comprador', r.target],
                ['Seguro de carga', -r.insurance],
                ['Financiación', -r.financing],
                ['Total de costes', -r.costs],
                ['Precio máximo en origen (netback)', r.netback],
                ['Margen sobre el precio pedido', r.pool],
                ['Comisiones de otros intermediarios', -r.layersTotal],
                ['Margen que queda para ti', r.room],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between border-b border-slate-100 pb-1">
                  <dt className="text-slate-600">{label}</dt>
                  <dd className="font-mono text-slate-800">{ready || val !== 0 ? money(val) : '-'}</dd>
                </div>
              ))}
              <div className="flex justify-between pt-1">
                <dt className="font-semibold text-slate-800">Comisión total posible</dt>
                <dd className="font-mono font-bold text-emerald-700">{ready ? money(r.total) : '-'}</dd>
              </div>
            </dl>
          </div>
          {verdict && <div className={`border rounded-xl p-4 text-sm ${tone[verdict[0]]}`}>{verdict[1]}</div>}
          <p className="text-xs text-slate-400">
            El seguro usa el 110% del valor (mínimo habitual en CIF). El interés se calcula sobre 360 días. Es una herramienta de aprendizaje, no una cotización.
          </p>
        </div>
      </div>
    </div>
  );
}
