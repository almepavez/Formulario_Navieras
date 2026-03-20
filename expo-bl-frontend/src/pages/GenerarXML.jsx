import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import {
  FileText, Download, Loader2, Search, AlertTriangle,
  CheckCircle2, XCircle, RefreshCw, ChevronDown,
  AlertCircle, X, ChevronRight, Send, Edit2,
} from "lucide-react";
import Swal from "sweetalert2";

const API_BASE = import.meta.env.VITE_API_URL;

const REGION_MAP = {
  "SHANGHAI": "ORIENTE", "NINGBO": "ORIENTE", "QINGDAO": "ORIENTE",
  "TIANJIN": "ORIENTE", "TIANJIN XINGANG": "ORIENTE", "NANJING": "ORIENTE",
  "WUHAN": "ORIENTE", "LIANYUNGANG": "ORIENTE", "GUANGZHOU": "ORIENTE",
  "SHENZHEN": "ORIENTE", "YANTIAN": "ORIENTE", "CHIWAN": "ORIENTE",
  "NANSHA": "ORIENTE", "XIAMEN": "ORIENTE", "FUZHOU": "ORIENTE",
  "DALIAN": "ORIENTE", "HONG KONG": "ORIENTE", "KAOHSIUNG": "ORIENTE",
  "BUSAN": "ORIENTE", "INCHEON": "ORIENTE", "TOKYO": "ORIENTE",
  "YOKOHAMA": "ORIENTE", "NAGOYA": "ORIENTE", "OSAKA": "ORIENTE",
  "KOBE": "ORIENTE", "SINGAPORE": "ORIENTE", "PORT KELANG": "ORIENTE",
  "TANJUNG PELEPAS": "ORIENTE", "JAKARTA": "ORIENTE", "SURABAYA": "ORIENTE",
  "MANILA": "ORIENTE", "HO CHI MINH": "ORIENTE", "CAT LAI": "ORIENTE",
  "HAIPHONG": "ORIENTE", "BANGKOK": "ORIENTE", "LAEM CHABANG": "ORIENTE",
  "COLOMBO": "ORIENTE", "CHENNAI": "ORIENTE", "NHAVA SHEVA": "ORIENTE",
  "MUNDRA": "ORIENTE", "CALCUTTA": "ORIENTE", "CALCUTTA - KOLKATA": "ORIENTE",
  "KOLKATA": "ORIENTE", "KARACHI": "ORIENTE", "CHITTAGONG": "ORIENTE",
  "MANZANILLO": "MÉXICO", "LAZARO CARDENAS": "MÉXICO",
  "LÁZARO CÁRDENAS": "MÉXICO", "ENSENADA": "MÉXICO", "VERACRUZ": "MÉXICO",
  "QUETZAL": "GUATEMALA", "PUERTO QUETZAL": "GUATEMALA",
  "BUENAVENTURA": "COLOMBIA", "CARTAGENA": "COLOMBIA",
  "CALLAO": "PERÚ",
};

const getRegion = (polName) => {
  if (!polName) return polName;
  const key   = polName.trim().toUpperCase();
  const found = Object.keys(REGION_MAP).find(k => k.toUpperCase() === key);
  return found ? REGION_MAP[found] : polName.toUpperCase();
};

const TIPOS_ACCION = [
  { value: "I", label: "Ingreso",      description: "Presentación inicial del BL ante Aduana", color: "emerald" },
  { value: "M", label: "Modificación", description: "Corrección de un documento ya aceptado",  color: "amber"   },
  { value: "A", label: "Anulación",    description: "Eliminación de un documento previo",       color: "red"     },
];

// ─────────────────────────────────────────────────────────────────────────────
// Campos P3 que se pueden corregir desde la edición masiva
// ─────────────────────────────────────────────────────────────────────────────
const BULK_EDITABLE_FIELDS = new Set([
  "fecha_emision",
  "fecha_embarque",
  "fecha_zarpe",
  "forma_pago_flete",
  "cond_transporte",
]);

// ─────────────────────────────────────────────────────────────────────────────
// MAPA de prioridades
// P1 — requieren agregar al mantenedor y reprocesar el PMS (resolver PRIMERO)
// P2 — corrección en mantenedor sin reproceso
// P3 — edición directa en el BL (algunos via edición masiva)
// ─────────────────────────────────────────────────────────────────────────────
const TIPO_RESOLUCION_MAP = {
  tipo_embalaje:      { prioridad: 1, tipo: "REPROCESO",  mantenedorPath: "/mantenedores/empaque-contenedores" },
  embalaje:           { prioridad: 1, tipo: "REPROCESO",  mantenedorPath: "/mantenedores/empaque-contenedores" },
  almacenador:        { prioridad: 1, tipo: "REPROCESO",  mantenedorPath: "/mantenedores/almacenistas"         },
  peso:               { prioridad: 1, tipo: "REPROCESO",  mantenedorPath: null },
  volumen:            { prioridad: 1, tipo: "REPROCESO",  mantenedorPath: null },
  shipper_contacto:   { prioridad: 2, tipo: "MANTENEDOR", mantenedorPath: "/mantenedores/participantes" },
  consignee_contacto: { prioridad: 2, tipo: "MANTENEDOR", mantenedorPath: "/mantenedores/participantes" },
  notify_contacto:    { prioridad: 2, tipo: "MANTENEDOR", mantenedorPath: "/mantenedores/participantes" },
  puerto:             { prioridad: 2, tipo: "MANTENEDOR", mantenedorPath: "/mantenedores/puertos"       },
  puerto_embarque:    { prioridad: 2, tipo: "MANTENEDOR", mantenedorPath: "/mantenedores/puertos"       },
  puerto_descarga:    { prioridad: 2, tipo: "MANTENEDOR", mantenedorPath: "/mantenedores/puertos"       },
  fecha_emision:      { prioridad: 3, tipo: "BL_DIRECTO", mantenedorPath: null },
  fecha_embarque:     { prioridad: 3, tipo: "BL_DIRECTO", mantenedorPath: null },
  fecha_zarpe:        { prioridad: 3, tipo: "BL_DIRECTO", mantenedorPath: null },
  forma_pago_flete:   { prioridad: 3, tipo: "BL_DIRECTO", mantenedorPath: null },
  cond_transporte:    { prioridad: 3, tipo: "BL_DIRECTO", mantenedorPath: null },
};

const getTipoResolucion = (campo) => {
  if (!campo) return { prioridad: 3, tipo: "BL_DIRECTO", mantenedorPath: null };
  return TIPO_RESOLUCION_MAP[campo.toLowerCase()]
    ?? { prioridad: 3, tipo: "BL_DIRECTO", mantenedorPath: null };
};

// ─────────────────────────────────────────────────────────────────────────────
// MODAL RESUMEN DE ERRORES
// ─────────────────────────────────────────────────────────────────────────────
const ResumenErroresModal = ({ manifiestoId, bls, onClose }) => {
  const navigate = useNavigate();

  const [resumen,   setResumen]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [collapsed, setCollapsed] = useState({});
  const [enviando,  setEnviando]  = useState(null);

  useEffect(() => { construirResumen(); }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const construirResumen = async () => {
    setLoading(true);
    try {
      // Solo BLs con ERROR crítico — las observaciones no se incluyen en este resumen
      const blsConError = bls.filter(bl => bl.valid_status === "ERROR");

      const resultados = await Promise.all(
        blsConError.map(async (bl) => {
          try {
            const res = await fetch(`${API_BASE}/api/bls/${bl.bl_number}/validaciones`);
            if (!res.ok) return [];
            const data = await res.json();
            // Solo severidad ERROR, descartar OBS
            return data
              .filter(v => v.severidad === "ERROR")
              .map(v => ({ ...v, bl_number: bl.bl_number }));
          } catch { return []; }
        })
      );

      const grupos = {};
      resultados.flat().forEach((v) => {
        const key = `${v.campo}||${v.mensaje}`;
        if (!grupos[key]) {
          grupos[key] = {
            campo:       v.campo,
            mensaje:     v.mensaje,
            valor_crudo: v.valor_crudo,
            severidad:   v.severidad,
            ...getTipoResolucion(v.campo),
            bls: [],
          };
        }
        if (!grupos[key].bls.includes(v.bl_number)) grupos[key].bls.push(v.bl_number);
      });

      setResumen(
        Object.values(grupos).sort((a, b) =>
          a.prioridad !== b.prioridad
            ? a.prioridad - b.prioridad
            : b.bls.length - a.bls.length
        )
      );
    } catch (e) {
      console.error("Error construyendo resumen:", e);
    } finally {
      setLoading(false);
    }
  };

  const porPrioridad = useMemo(() => {
    const g = { 1: [], 2: [], 3: [] };
    resumen.forEach(e => g[e.prioridad]?.push(e));
    return g;
  }, [resumen]);

  const blsConError = bls.filter(bl => bl.valid_status === "ERROR").length;
  const blsListos   = bls.filter(bl => bl.valid_status === "OK").length;

  const irAMantenedor = (item) => {
    if (!item.mantenedorPath) return;
    onClose();
    navigate(item.mantenedorPath);
  };

  const enviarSoporte = async (item) => {
    const key = `${item.campo}||${item.mensaje}`;
    setEnviando(key);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_BASE}/api/soporte/error-mantenedor`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          manifiestoId,
          campo:        item.campo,
          mensaje:      item.mensaje,
          valorCrudo:   item.valor_crudo,
          blsAfectados: item.bls,
          tipoError:    item.tipo,
        }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Error al enviar"); }
      Swal.fire({
        icon: "success", title: "Correo enviado",
        html: `<p>Se notificó a <strong>soporte.sga@broomgroup.com</strong>.</p><p style="margin-top:8px;font-size:13px;color:#6B7280;">Recibirás una copia y la respuesta llegará directo a ti.</p>`,
        timer: 3500, showConfirmButton: false,
      });
    } catch (e) {
      Swal.fire({ icon: "error", title: "No se pudo enviar", text: e.message, confirmButtonColor: "#0F2A44" });
    } finally {
      setEnviando(null);
    }
  };

  // ── Navegar a edición masiva pasando BLs y campo via URL params ──────────
  // Al guardar, bulk-edit vuelve a returnTo con ?revalidar=BL1,BL2
  // y GenerarXML revalida automáticamente esos BLs al montar
  const irABulkEdit = (item) => {
    const params = new URLSearchParams({
      bls:      item.bls.join(","),
      field:    item.campo,
      returnTo: `/manifiestos/${manifiestoId}/generar-xml`,
    });
    onClose();
navigate(`/expo/bulk-edit?${params.toString()}`);  };

  // ── Config visual por prioridad ──────────────────────────────────────────
  const CFG = {
    1: {
      label:    "Prioridad 1 — Resolver primero: requieren agregar al mantenedor y reprocesar el PMS",
      pill:     "bg-red-100 text-red-800",
      pillText: "P1 · Reproceso PMS",
      head:     "bg-red-50",
      border:   "border-red-200",
      countBg:  "bg-red-100 text-red-800",
      btnClass: "text-red-700 border-red-300 hover:bg-red-50",
      accion: (item) => ({ label: "Solicitar soporte", Icon: Send, fn: () => enviarSoporte(item) }),
    },
    2: {
      label:    "Prioridad 2 — Corrección en mantenedor (sin reprocesar PMS)",
      pill:     "bg-amber-100 text-amber-800",
      pillText: "P2 · Mantenedor",
      head:     "bg-amber-50",
      border:   "border-amber-200",
      countBg:  "bg-amber-100 text-amber-800",
      btnClass: "text-amber-700 border-amber-300 hover:bg-amber-50",
      accion: (item) => item.mantenedorPath
        ? { label: "Ir a mantenedor", Icon: ChevronRight, fn: () => irAMantenedor(item) }
        : { label: "Solicitar soporte", Icon: Send,        fn: () => enviarSoporte(item) },
    },
    3: {
      label:    "Prioridad 3 — Edición directa en los BLs",
      pill:     "bg-emerald-100 text-emerald-800",
      pillText: "P3 · Editar BL",
      head:     "bg-emerald-50",
      border:   "border-emerald-200",
      countBg:  "bg-emerald-100 text-emerald-800",
      btnClass: "text-emerald-700 border-emerald-300 hover:bg-emerald-50",
      // Si el campo es bulk-editable → botón edición masiva; si no → label informativo
      accion: (item) => BULK_EDITABLE_FIELDS.has(item.campo)
        ? { label: "Editar en masa", Icon: Edit2, fn: () => irABulkEdit(item) }
        : null,
    },
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-200">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-slate-200 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <h2 className="text-base font-semibold text-[#0F2A44]">
                Resumen de errores — Manifiesto #{manifiestoId}
              </h2>
            </div>
            <p className="text-sm text-slate-500 mt-1 ml-7">
              Solo errores críticos · agrupados por tipo · un mismo error puede afectar varios BLs
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stats — solo errores críticos y BLs listos, sin columna de observaciones */}
        <div className="grid grid-cols-2 gap-3 px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="bg-red-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-semibold text-red-600">{blsConError}</div>
            <div className="text-xs text-red-400 mt-0.5">BLs con errores críticos</div>
          </div>
          <div className="bg-emerald-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-semibold text-emerald-600">{blsListos}</div>
            <div className="text-xs text-emerald-400 mt-0.5">BLs listos para generar</div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Cargando errores...</span>
            </div>
          ) : resumen.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12">
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              <p className="text-sm font-medium text-slate-600">Sin errores críticos</p>
              <p className="text-xs text-slate-400">Todos los BLs están listos para generar XML</p>
            </div>
          ) : (
            [1, 2, 3].map((p) => {
              const items = porPrioridad[p];
              if (!items?.length) return null;
              const cfg = CFG[p];
              const isCollapsed = collapsed[p];

              return (
                <div key={p} className={`rounded-xl border ${cfg.border} overflow-hidden`}>
                  <button
                    onClick={() => setCollapsed(prev => ({ ...prev, [p]: !prev[p] }))}
                    className={`w-full flex items-center justify-between px-4 py-3 ${cfg.head} hover:brightness-95 transition-all`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.pill}`}>
                        {cfg.pillText}
                      </span>
                      <span className="text-sm font-medium text-slate-700">{cfg.label}</span>
                      <span className="text-xs text-slate-400">({items.length})</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isCollapsed ? "-rotate-90" : ""}`} />
                  </button>

                  {!isCollapsed && (
                    <div className="divide-y divide-slate-100">
                      {items.map((item, idx) => {
                        const key     = `${item.campo}||${item.mensaje}`;
                        const sending = enviando === key;
                        const accion  = cfg.accion(item);

                        return (
                          <div
                            key={idx}
                            className="flex items-start justify-between gap-4 px-4 py-3 bg-white hover:bg-slate-50/60 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800 leading-snug">
                                {item.mensaje}
                              </p>
                              {item.valor_crudo && (
                                <p className="text-xs text-slate-400 mt-0.5 font-mono">
                                  Valor recibido: &quot;{item.valor_crudo}&quot;
                                </p>
                              )}
                              {item.bls.length <= 4 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {item.bls.map(bl => (
                                    <span key={bl} className="text-xs bg-slate-100 text-slate-600 rounded px-1.5 py-0.5 font-mono">
                                      {bl}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col items-end gap-2 flex-shrink-0">
                              <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${cfg.countBg}`}>
                                {item.bls.length} {item.bls.length === 1 ? "BL" : "BLs"}
                              </span>
                              {accion ? (
                                <button
                                  onClick={accion.fn}
                                  disabled={sending}
                                  className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${cfg.btnClass}`}
                                >
                                  {sending
                                    ? <><Loader2 className="w-3 h-3 animate-spin" />Enviando...</>
                                    : <><accion.Icon className="w-3 h-3" />{accion.label}</>
                                  }
                                </button>
                              ) : (
                                <span className="text-xs text-slate-400 italic">Editar en cada BL</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Resuelve siempre P1 antes que P2 y P3 — al reprocesar el PMS se revertirán las correcciones posteriores
          </p>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors font-medium"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TipoAccionSelector
// ─────────────────────────────────────────────────────────────────────────────
const TipoAccionSelector = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const selected = TIPOS_ACCION.find((t) => t.value === value) || TIPOS_ACCION[0];

  const colorMap = {
    emerald: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500", activeBorder: "border-l-emerald-500", activeRow: "bg-emerald-50/60", hoverRow: "hover:bg-emerald-50/40" },
    amber:   { badge: "bg-amber-50 text-amber-700 border-amber-200",       dot: "bg-amber-500",   activeBorder: "border-l-amber-500",   activeRow: "bg-amber-50/60",   hoverRow: "hover:bg-amber-50/40"   },
    red:     { badge: "bg-red-50 text-red-700 border-red-200",             dot: "bg-red-500",     activeBorder: "border-l-red-500",     activeRow: "bg-red-50/60",     hoverRow: "hover:bg-red-50/40"     },
  };
  const colors = colorMap[selected.color];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 pl-3 pr-2.5 py-2 rounded-lg border text-sm font-medium transition-all duration-150 select-none whitespace-nowrap ${colors.badge} focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-slate-400 shadow-sm`}
      >
        <span className={`w-2 h-2 rounded-full ${colors.dot} flex-shrink-0`} />
        <span className="font-mono font-bold">{selected.value}</span>
        <span className="text-xs opacity-75 font-normal">— {selected.label}</span>
        <ChevronDown className={`w-3.5 h-3.5 ml-0.5 opacity-50 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-2 z-50 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Tipo de Acción</p>
            </div>
            <div className="py-1">
              {TIPOS_ACCION.map((tipo) => {
                const c = colorMap[tipo.color];
                const isSelected = tipo.value === value;
                return (
                  <button key={tipo.value} type="button" onClick={() => { onChange(tipo.value); setOpen(false); }}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-l-4 ${isSelected ? `${c.activeBorder} ${c.activeRow}` : `border-l-transparent ${c.hoverRow}`}`}
                  >
                    <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold font-mono border ${c.badge}`}>{tipo.value}</span>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800">{tipo.label}</span>
                        {isSelected && <span className="text-[10px] bg-slate-200 text-slate-500 rounded px-1.5 py-0.5 font-medium">Activo</span>}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{tipo.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-200">
              <p className="text-[11px] text-slate-400">Se aplicará a todos los XMLs generados en esta sesión</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// POLFilterDropdown
// ─────────────────────────────────────────────────────────────────────────────
const POLFilterDropdown = ({ pols, selected, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const toggle = (pol) => onChange(prev => {
    const next = new Set(prev);
    next.has(pol) ? next.delete(pol) : next.add(pol);
    return next;
  });

  const label = selected.size === 0 ? "Puerto de Embarque (POL)" : `POL: ${[...selected].join(", ")}`;

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between gap-2 px-4 py-2 rounded-lg border text-sm transition-colors ${selected.size > 0 ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-300 bg-white text-slate-600 hover:border-slate-400"}`}
      >
        <span className="truncate">{label}</span>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {selected.size > 0 && <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs flex items-center justify-center font-semibold">{selected.size}</span>}
          <ChevronDown className={`w-4 h-4 opacity-50 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1.5 z-50 w-64 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Filtrar por POL</span>
              {selected.size > 0 && <button onClick={() => onChange(new Set())} className="text-xs text-red-500 hover:text-red-700 font-medium">Limpiar</button>}
            </div>
            <div className="py-1 max-h-56 overflow-y-auto">
              {pols.length === 0 && <p className="px-4 py-3 text-sm text-slate-400 text-center">Sin POLs disponibles</p>}
              {pols.map(pol => (
                <label key={pol} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors">
                  <input type="checkbox" checked={selected.has(pol)} onChange={() => toggle(pol)} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                  <span className={`text-sm ${selected.has(pol) ? "text-indigo-700 font-medium" : "text-slate-700"}`}>{pol}</span>
                </label>
              ))}
            </div>
            {selected.size > 0 && (
              <div className="px-4 py-2 bg-indigo-50 border-t border-indigo-100">
                <p className="text-xs text-indigo-600">{selected.size} de {pols.length} seleccionado{selected.size !== 1 ? "s" : ""}</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTE PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
const GenerarXML = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [bls, setBls]                         = useState([]);
  const [selectedBls, setSelectedBls]         = useState(new Set());
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState("");
  const [generando, setGenerando]             = useState(false);
  const [revalidando, setRevalidando]         = useState(false);
  const [searchTerm, setSearchTerm]           = useState("");
  const [filterStatus, setFilterStatus]       = useState("all");
  const [showOnlyErrors, setShowOnlyErrors]   = useState(false);
  const [filterPOL, setFilterPOL]             = useState(new Set());
  const [tipoAccion, setTipoAccion]           = useState("I");
  const [naveManifiesto, setNaveManifiesto]   = useState("");
  const [viajeManifiesto, setViajeManifiesto] = useState("");
  const [showResumen, setShowResumen]         = useState(false);

  // ── Revalidar automáticamente BLs que vuelven del bulk-edit ─────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const returnedBls = params.get("revalidar");
    if (!returnedBls) return;
    const blNumbers = returnedBls.split(",").filter(Boolean);
    // Limpiar el param de la URL sin recargar la página
    window.history.replaceState({}, "", window.location.pathname);
    // Cargar BLs y luego revalidar los afectados
    fetchBLs().then(() => revalidarSilencioso(blNumbers));
  }, []);

  const revalidarSilencioso = async (blNumbers) => {
    if (!blNumbers?.length) return;
    try {
      await Promise.all(
        blNumbers.map(num =>
          fetch(`${API_BASE}/api/bls/${num}/revalidar`, { method: "POST" })
        )
      );
      await fetchBLs();
    } catch { /* silencioso — la tabla igual queda actualizada */ }
  };

  const polesDisponibles = useMemo(() =>
    [...new Set(bls.map(bl => getRegion(bl.puerto_embarque)).filter(Boolean))].sort(),
  [bls]);

  // El contador del botón "Resumen de errores" solo cuenta ERROREs, no OBS
  const countBlsConError = useMemo(() =>
    bls.filter(bl => bl.valid_status === "ERROR").length,
  [bls]);

  useEffect(() => {
    if (!id) { setError("ID de manifiesto no válido"); setLoading(false); return; }
    fetchBLs();
    fetchManifiestoInfo();
    const handleFocus = () => {
      fetchBLs();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, [id]);

  const fetchManifiestoInfo = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/manifiestos/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      const m = data.manifiesto || data;
      setNaveManifiesto((m.nave  || "").toUpperCase().replace(/\s+/g, "_"));
      setViajeManifiesto((m.viaje || "").toUpperCase().replace(/\s+/g, "_"));
    } catch { /* silencioso */ }
  };

  const fetchBLs = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API_BASE}/api/manifiestos/${id}/bls-para-xml`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setBls(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || "Error al cargar BLs"); setBls([]);
    } finally { setLoading(false); }
  };

  const filteredAndSortedBLs = useMemo(() => {
    let r = [...bls];
    if (searchTerm) { const t = searchTerm.toLowerCase(); r = r.filter(bl => bl.bl_number?.toLowerCase().includes(t) || bl.shipper?.toLowerCase().includes(t) || bl.consignee?.toLowerCase().includes(t)); }
    if (filterStatus !== "all") r = r.filter(bl => bl.status === filterStatus);
    if (showOnlyErrors)         r = r.filter(bl => bl.valid_status === "ERROR");
    if (filterPOL.size > 0)     r = r.filter(bl => filterPOL.has(getRegion(bl.puerto_embarque)));
    return r.sort((a, b) => a.bl_number.localeCompare(b.bl_number));
  }, [bls, searchTerm, filterStatus, showOnlyErrors, filterPOL]);

  const toggleBL  = (n) => setSelectedBls(prev => { const s = new Set(prev); s.has(n) ? s.delete(n) : s.add(n); return s; });
  const toggleAll = ()  => setSelectedBls(selectedBls.size === filteredAndSortedBLs.length ? new Set() : new Set(filteredAndSortedBLs.map(bl => bl.bl_number)));

  const revalidarBLsSeleccionados = async () => {
    if (selectedBls.size === 0) { Swal.fire({ icon: "warning", title: "Sin BLs seleccionados", text: "Debes seleccionar al menos un BL", confirmButtonColor: "#F59E0B" }); return; }
    const r = await Swal.fire({ icon: "question", title: "Revalidar BLs", html: `<p>Se revalidarán <strong>${selectedBls.size}</strong> BL(s).</p>`, showCancelButton: true, confirmButtonText: "Sí, revalidar", cancelButtonText: "Cancelar", confirmButtonColor: "#0F2A44", cancelButtonColor: "#6B7280" });
    if (!r.isConfirmed) return;

    setRevalidando(true);
    try {
      const blNumbers = Array.from(selectedBls);
      let exitosos = 0, fallidos = 0;
      const errores = [];
      Swal.fire({ title: "Revalidando BLs...", html: `<div class="text-lg font-semibold">0 / ${blNumbers.length}</div>`, allowOutsideClick: false, showConfirmButton: false, didOpen: () => Swal.showLoading() });
      for (let i = 0; i < blNumbers.length; i++) {
        try {
          const res = await fetch(`${API_BASE}/api/bls/${blNumbers[i]}/revalidar`, { method: "POST" });
          if (res.ok) exitosos++; else { fallidos++; const d = await res.json(); errores.push({ blNumber: blNumbers[i], error: d.error || "Error" }); }
        } catch (e) { fallidos++; errores.push({ blNumber: blNumbers[i], error: e.message }); }
        Swal.update({ html: `<div class="text-lg font-semibold">${i + 1} / ${blNumbers.length}</div><div class="text-sm text-slate-600">✓ ${exitosos} • ✗ ${fallidos}</div>` });
      }
      await fetchBLs();
      if (fallidos === 0) {
        Swal.fire({ icon: "success", title: "Revalidación completada", html: `<p><strong>${exitosos}</strong> BL(s) revalidados</p>`, confirmButtonColor: "#0F2A44" });
      } else {
        const html = errores.map(e => `<div style="text-align:left;padding:8px;background:#FEE2E2;border-radius:6px;margin-bottom:8px;"><strong style="color:#DC2626;">${e.blNumber}:</strong> <span style="color:#991B1B;font-size:13px;">${e.error}</span></div>`).join("");
        Swal.fire({ icon: "warning", title: "Revalidación con errores", html: `<p>✓ <strong>${exitosos}</strong> exitosos · ✗ <strong>${fallidos}</strong> fallidos</p><div style="max-height:200px;overflow-y:auto;margin-top:12px;">${html}</div>`, confirmButtonColor: "#F59E0B", width: "600px" });
      }
    } catch (e) {
      Swal.fire({ icon: "error", title: "Error en revalidación", text: e.message, confirmButtonColor: "#0F2A44" });
    } finally { setRevalidando(false); }
  };

  const generarXMLsMultiples = async () => {
    if (selectedBls.size === 0) { Swal.fire({ icon: "warning", title: "Sin BLs seleccionados", text: "Debes seleccionar al menos un BL", confirmButtonColor: "#F59E0B" }); return; }
    const arr = Array.from(selectedBls);
    const conErrores = bls.filter(bl => arr.includes(bl.bl_number) && bl.valid_status === "ERROR");

    if (conErrores.length > 0) {
      const html = conErrores.map(bl => `<div style="text-align:left;margin-bottom:10px;padding:12px;background:#FEE2E2;border-radius:8px;border:1px solid #FCA5A5;"><strong style="color:#DC2626;">${bl.bl_number}</strong><p style="margin:6px 0 0;font-size:13px;color:#991B1B;">${bl.valid_count_error} error(es) crítico(s)</p></div>`).join("");
      await Swal.fire({ icon: "error", title: "No se puede generar XML", html: `<div style="text-align:left;"><p style="color:#DC2626;font-weight:500;margin-bottom:12px;">${conErrores.length} BL${conErrores.length > 1 ? "s tienen" : " tiene"} errores:</p><div style="max-height:300px;overflow-y:auto;">${html}</div></div><div style="background:#FEF3C7;padding:12px;border-radius:8px;margin-top:12px;"><p style="color:#92400E;font-size:13px;margin:0;"><strong>Tip:</strong> Usa "Resumen de errores" para resolverlos en orden de prioridad.</p></div>`, confirmButtonText: "Entendido", confirmButtonColor: "#0F2A44", width: "600px" });
      return;
    }

    const conWarnings = bls.filter(bl => arr.includes(bl.bl_number) && bl.valid_status === "OBS");
    if (conWarnings.length > 0) {
      const r = await Swal.fire({ icon: "warning", title: "BLs con advertencias", html: `<p>${conWarnings.length} BL(s) con observaciones. Los XMLs se generarán pero pueden tener datos incompletos. ¿Continuar?</p>`, showCancelButton: true, confirmButtonText: "Sí, generar", cancelButtonText: "Cancelar", confirmButtonColor: "#F59E0B", cancelButtonColor: "#6B7280" });
      if (!r.isConfirmed) return;
    }

    setGenerando(true);
    try {
      const res = await fetch(`${API_BASE}/api/manifiestos/${id}/generar-xmls-multiples`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blNumbers: arr, tipoAccion }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Error al generar XMLs"); }

      const blob = await res.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url;
      a.download = naveManifiesto && viajeManifiesto ? `${naveManifiesto}_${viajeManifiesto}.zip` : `BLs_Manifiesto_${id}.zip`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      const tipoLabel = TIPOS_ACCION.find(t => t.value === tipoAccion)?.label || tipoAccion;
      Swal.fire({ icon: "success", title: "XMLs generados correctamente", html: `<p>Se descargaron <strong>${arr.length}</strong> XMLs en ZIP</p><p style="margin-top:8px;font-size:13px;color:#6B7280;">Tipo: <strong>${tipoAccion} — ${tipoLabel}</strong></p>`, confirmButtonColor: "#0F2A44" });
    } catch (e) {
      Swal.fire({ icon: "error", title: "Error al generar XMLs", text: e?.message, confirmButtonColor: "#DC2626" });
    } finally { setGenerando(false); }
  };

  const navegarAEdicion = (blNumber) => {
    const bl = bls.find(b => b.bl_number === blNumber);
    if (bl?.tipo_servicio === "BB" || bl?.tipo_servicio_codigo === "BB") {
      navigate(`/expo/${blNumber}/carga-suelta/edit?returnTo=xml-preview&manifestId=${id}`);
    } else {
      navigate(`/expo/${blNumber}/edit?returnTo=xml-preview&manifestId=${id}`);
    }
  };

  const mostrarVistaPrevia = async (blNumber) => {
    const bl = bls.find(b => b.bl_number === blNumber);
    let validacionesReales = [];
    if (bl.valid_status === "ERROR" || bl.valid_status === "OBS") {
      try { const r = await fetch(`${API_BASE}/api/bls/${blNumber}/validaciones`); if (r.ok) validacionesReales = await r.json(); } catch { /* silencioso */ }
    }

    const errores       = validacionesReales.filter(v => v.severidad === "ERROR");
    const observaciones = validacionesReales.filter(v => v.severidad === "OBS");

    if (errores.length > 0) {
      const errHTML = errores.map(e => {
        let pre = "";
        if (e.nivel === "ITEM")       pre = `<strong style="color:#DC2626;">Item ${e.sec || ""}:</strong> `;
        if (e.nivel === "CONTENEDOR") pre = `<strong style="color:#DC2626;">Contenedor${e.sec ? " " + e.sec : ""}:</strong> `;
        if (e.nivel === "TRANSBORDO") pre = `<strong style="color:#DC2626;">Transbordo ${e.sec || ""}:</strong> `;
        if (e.nivel === "BL")         pre = `<strong style="color:#DC2626;">BL:</strong> `;
        return `<li style="margin:6px 0;color:#991B1B;"><span style="color:#DC2626;">●</span> ${pre}${e.mensaje}</li>`;
      }).join("");
      const obsHTML = observaciones.length > 0
        ? `<div style="margin-top:12px;background:#FEF3C7;padding:12px;border-radius:6px;"><strong style="color:#92400E;">Observaciones (${observaciones.length}):</strong><ul style="margin:4px 0;padding-left:20px;font-size:13px;">${observaciones.map(o => `<li style="color:#92400E;">${o.mensaje}</li>`).join("")}</ul></div>`
        : "";
      const result = await Swal.fire({
        icon: "error", title: `BL ${blNumber} — Errores críticos`,
        html: `<div style="text-align:left;background:#FEE2E2;padding:16px;border-radius:8px;"><strong style="color:#DC2626;">No se puede generar el XML:</strong><ul style="margin:8px 0;padding-left:20px;">${errHTML}</ul></div>${obsHTML}`,
        showDenyButton: true, confirmButtonText: "Cerrar", denyButtonText: "Editar BL",
        confirmButtonColor: "#DC2626", denyButtonColor: "#3B82F6", width: "700px",
      });
      if (result.isDenied) navegarAEdicion(blNumber);
      return;
    }

    Swal.fire({ title: "Generando vista previa...", allowOutsideClick: false, didOpen: () => Swal.showLoading() });

    try {
      const res = await fetch(`${API_BASE}/api/bls/${blNumber}/generar-xml`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipoAccion }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Error al generar preview"); }

      const blob    = await res.blob();
      const xmlText = await blob.text();

      const formatXML = (xml) => {
        if (!xml.trim().startsWith("<?xml")) xml = '<?xml version="1.0" encoding="ISO-8859-1"?>\n' + xml;
        let out = "", ind = 0;
        const I = "  ";
        const parts = xml.match(/(<\?[^?]+\?>|<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->|<[^>]+>|[^<]+)/g);
        if (!parts) return xml;
        for (let i = 0; i < parts.length; i++) {
          const t = parts[i].trim();
          if (!t) continue;
          if (t.startsWith("<?"))    { out += t + "\n"; }
          else if (t.startsWith("<!--")) { out += I.repeat(ind) + t + "\n"; }
          else if (t.startsWith("</"))   { ind = Math.max(0, ind - 1); out += I.repeat(ind) + t + "\n"; }
          else if (t.endsWith("/>"))     { out += I.repeat(ind) + t + "\n"; }
          else if (t.startsWith("<")) {
            const nt = (parts[i + 1] || "").trim();
            const at = (parts[i + 2] || "").trim();
            if (nt && !nt.startsWith("<") && at.startsWith("</")) { out += I.repeat(ind) + t + nt + at + "\n"; i += 2; }
            else { out += I.repeat(ind) + t + "\n"; ind++; }
          }
        }
        return out;
      };

      const esc       = s => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
      const tipoLabel = TIPOS_ACCION.find(t => t.value === tipoAccion)?.label || tipoAccion;
      const obsHTML   = observaciones.length > 0
        ? `<div style="margin-bottom:16px;padding:12px;background:#FEF3C7;border-radius:8px;text-align:left;"><strong style="color:#F59E0B;">Observaciones (${observaciones.length}):</strong><ul style="padding-left:20px;margin:4px 0;font-size:13px;">${observaciones.map(o => `<li style="color:#92400E;">${o.mensaje}</li>`).join("")}</ul></div>`
        : `<div style="margin-bottom:16px;padding:12px;background:#D1FAE5;border-radius:8px;color:#065F46;text-align:left;"><strong>Sin problemas detectados</strong> — El XML está listo.</div>`;

      const result = await Swal.fire({
        title: `Vista Previa XML — ${blNumber}`,
        html: `<div style="margin-bottom:12px;padding:8px 12px;background:#EFF6FF;border-radius:8px;text-align:left;border:1px solid #BFDBFE;font-size:12px;color:#1D4ED8;"><strong>Tipo de acción:</strong> ${tipoAccion} — ${tipoLabel}</div>${obsHTML}<div style="text-align:left;"><strong style="font-size:14px;">Contenido del XML:</strong><pre style="background:#1E293B;color:#E2E8F0;padding:16px;border-radius:8px;max-height:400px;overflow-y:auto;font-size:12px;line-height:1.5;margin-top:8px;text-align:left;">${esc(formatXML(xmlText))}</pre></div>`,
        width: "800px", showCancelButton: true, showDenyButton: true,
        confirmButtonText: "Descargar XML", denyButtonText: "Editar BL", cancelButtonText: "Cerrar",
        confirmButtonColor: "#16a34a", denyButtonColor: "#3B82F6", cancelButtonColor: "#6B7280",
      });
      if (result.isConfirmed) {
        const url = window.URL.createObjectURL(blob);
        const a   = document.createElement("a");
        a.href = url; a.download = `SGA_V1_SNA-BL-1.0-${blNumber}.xml`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        Swal.fire({ icon: "success", title: "XML descargado", text: `BL ${blNumber} descargado`, timer: 2000, showConfirmButton: false });
      } else if (result.isDenied) {
        navegarAEdicion(blNumber);
      }
    } catch (e) {
      Swal.fire({ icon: "error", title: "Error al generar preview", text: e?.message, confirmButtonColor: "#0F2A44" });
    }
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-10 min-h-screen bg-slate-100">

        {/* Header */}
        <div className="mb-8">
          <button onClick={() => navigate("/manifiestos")} className="text-sm text-slate-600 hover:text-slate-900 mb-2">
            ← Volver al manifiesto
          </button>
          <div className="flex items-start justify-between gap-4 mt-1">
            <div>
              <h1 className="text-2xl font-semibold text-[#0F2A44]">Generar XMLs — Manifiesto #{id}</h1>
              <p className="text-sm text-slate-500 mt-1">Selecciona los BLs para generar sus XMLs</p>
            </div>
            {!loading && countBlsConError > 0 && (
              <button
                onClick={() => setShowResumen(true)}
                className="flex items-center gap-2.5 px-4 py-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white rounded-xl text-sm font-medium transition-all duration-150 shadow-sm flex-shrink-0"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>Resumen de errores</span>
                <span className="bg-white/20 text-white text-xs font-semibold rounded-full px-2 py-0.5 leading-none">
                  {countBlsConError}
                </span>
              </button>
            )}
          </div>
        </div>

        {loading && <div className="flex items-center gap-2 text-slate-600"><Loader2 className="w-4 h-4 animate-spin" />Cargando BLs...</div>}
        {error   && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {!loading && bls.length > 0 && (
          <>
            {/* Filtros */}
            <div className="mb-4 bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input type="text" placeholder="Buscar BL, Shipper, Consignee..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <POLFilterDropdown pols={polesDisponibles} selected={filterPOL} onChange={setFilterPOL} />
                <label className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" checked={showOnlyErrors} onChange={(e) => setShowOnlyErrors(e.target.checked)} className="w-4 h-4 rounded border-slate-300" />
                  <span className="text-sm text-slate-700">Solo con errores críticos</span>
                </label>
              </div>
              <div className="mt-3 text-sm text-slate-600">
                Mostrando {filteredAndSortedBLs.length} de {bls.length} BLs
                {filterPOL.size > 0 && <span className="ml-2 text-indigo-600 font-medium">· POL: {[...filterPOL].join(", ")}</span>}
              </div>
            </div>

            {/* Acciones */}
            <div className="mb-4 flex items-center gap-3 flex-wrap">
              <button onClick={toggleAll} className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50">
                {selectedBls.size === filteredAndSortedBLs.length ? "Deseleccionar todos" : "Seleccionar todos"}
              </button>
              <button onClick={revalidarBLsSeleccionados} disabled={selectedBls.size === 0 || revalidando}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
                {revalidando ? <><Loader2 className="w-4 h-4 animate-spin" />Revalidando...</> : <><RefreshCw className="w-4 h-4" />Revalidar {selectedBls.size} BL{selectedBls.size !== 1 ? "s" : ""}</>}
              </button>
              <div className="flex items-stretch rounded-lg overflow-visible border border-emerald-300 shadow-sm">
                <div className="flex items-center px-2 py-1.5 bg-slate-50 border-r border-emerald-300">
                  <TipoAccionSelector value={tipoAccion} onChange={setTipoAccion} />
                </div>
                <button onClick={generarXMLsMultiples} disabled={selectedBls.size === 0 || generando}
                  className="px-4 py-2 bg-emerald-600 text-white text-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors rounded-r-lg">
                  {generando ? <><Loader2 className="w-4 h-4 animate-spin" />Generando...</> : <><Download className="w-4 h-4" />Generar {selectedBls.size} XML{selectedBls.size !== 1 ? "s" : ""} (ZIP)</>}
                </button>
              </div>
              <span className="text-sm text-slate-500">{selectedBls.size} de {filteredAndSortedBLs.length} seleccionados</span>
            </div>
          </>
        )}

        {/* Tabla */}
        {!loading && filteredAndSortedBLs.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-visible">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-6 py-3 font-semibold w-12"><input type="checkbox" checked={selectedBls.size === filteredAndSortedBLs.length && filteredAndSortedBLs.length > 0} onChange={toggleAll} className="w-4 h-4 rounded border-slate-300" /></th>
                  <th className="text-left px-6 py-3 font-semibold">Estado</th>
                  <th className="text-left px-6 py-3 font-semibold">BL Number</th>
                  <th className="text-left px-6 py-3 font-semibold">Shipper</th>
                  <th className="text-left px-6 py-3 font-semibold">Consignee</th>
                  <th className="text-left px-6 py-3 font-semibold">POL</th>
                  <th className="text-left px-6 py-3 font-semibold">POD</th>
                  <th className="text-left px-6 py-3 font-semibold">Bultos</th>
                  <th className="text-left px-6 py-3 font-semibold">Peso (kg)</th>
                  <th className="text-left px-6 py-3 font-semibold">Status</th>
                  <th className="text-left px-6 py-3 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedBLs.map((bl) => {
                  const totalErrores = bl.valid_count_error || 0;
                  const totalObs     = bl.valid_count_obs   || 0;
                  const validStatus  = bl.valid_status      || "OK";
                  return (
                    <tr key={bl.bl_number} className="border-t hover:bg-slate-50">
                      <td className="px-6 py-4"><input type="checkbox" checked={selectedBls.has(bl.bl_number)} onChange={() => toggleBL(bl.bl_number)} className="w-4 h-4 rounded border-slate-300" /></td>
                      <td className="px-6 py-4">
                        {validStatus === "OK"    && <div className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-5 h-5" /></div>}
                        {validStatus === "OBS"   && (
                          <div className="flex items-center gap-2 text-amber-600 cursor-help group relative">
                            <AlertTriangle className="w-5 h-5" /><span className="text-xs font-medium">{totalObs}</span>
                            <div className="absolute left-0 top-full mt-2 hidden group-hover:block z-[9999] w-64 bg-white rounded-lg shadow-xl border border-amber-200 p-3">
                              <div className="text-xs font-semibold text-amber-700 mb-1">Observaciones ({totalObs})</div>
                              <div className="text-xs text-amber-600">Clic en "Preview" para ver el detalle</div>
                            </div>
                          </div>
                        )}
                        {validStatus === "ERROR" && (
                          <div className="flex items-center gap-2 text-red-600 cursor-help group relative">
                            <XCircle className="w-5 h-5" /><span className="text-xs font-medium">{totalErrores}</span>
                            <div className="absolute left-0 top-full mt-2 hidden group-hover:block z-[9999] w-64 bg-white rounded-lg shadow-xl border border-red-200 p-3">
                              <div className="text-xs font-semibold text-red-700 mb-1">Errores críticos ({totalErrores})</div>
                              {totalObs > 0 && <div className="text-xs text-amber-600">+ {totalObs} observación(es)</div>}
                              <div className="text-xs text-red-500 mt-1 font-medium">No se puede generar XML</div>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 font-medium">{bl.bl_number}</td>
                      <td className="px-6 py-4 text-slate-600 truncate max-w-[200px]">{bl.shipper   || <span className="text-red-400">Sin Shipper</span>}</td>
                      <td className="px-6 py-4 text-slate-600 truncate max-w-[200px]">{bl.consignee || <span className="text-red-400">Sin Consignee</span>}</td>
                      <td className="px-6 py-4">{bl.puerto_embarque || <span className="text-amber-500">—</span>}</td>
                      <td className="px-6 py-4">{bl.puerto_descarga || <span className="text-amber-500">—</span>}</td>
                      <td className="px-6 py-4">{bl.bultos    || 0}</td>
                      <td className="px-6 py-4">{bl.peso_bruto || 0}</td>
                      <td className="px-6 py-4"><span className="inline-flex items-center px-2 py-1 rounded text-xs bg-slate-100 text-slate-700">{bl.status}</span></td>
                      <td className="px-6 py-4">
                        <button onClick={() => mostrarVistaPrevia(bl.bl_number)} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs hover:bg-blue-700 flex items-center gap-1">
                          <FileText className="w-3 h-3" />Preview
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && bls.length > 0 && filteredAndSortedBLs.length === 0 && <div className="text-center py-12 text-slate-500">No se encontraron BLs con los filtros aplicados</div>}
        {!loading && bls.length === 0 && <div className="text-center py-12 text-slate-500">No hay BLs en este manifiesto</div>}
      </main>

      {showResumen && (
        <ResumenErroresModal
          manifiestoId={id}
          bls={bls}
          onClose={() => setShowResumen(false)}
        />
      )}
    </div>
  );
};

export default GenerarXML;