import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, AlertCircle, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import Sidebar from "../components/Sidebar";

const API_BASE = "http://localhost:4000";

const formatDateCL = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return `${String(d.getUTCDate()).padStart(2,"0")}-${String(d.getUTCMonth()+1).padStart(2,"0")}-${d.getUTCFullYear()}`;
};

const estadoStyles = {
    "CREADO":   "bg-blue-100 text-blue-800 ring-blue-200",
    "VALIDADO": "bg-green-100 text-green-800 ring-green-200",
    "ENVIADO":  "bg-purple-100 text-purple-800 ring-purple-200",
    "ANULADO":  "bg-red-100 text-red-800 ring-red-200",
};

const getFieldLabel = (field) => ({
    descripcion_carga: "Descripción de Carga",
    bultos:            "Bultos",
    peso_bruto:        "Peso Bruto",
    status:            "Estado",
    fecha_embarque:    "Fecha de Embarque",
    fecha_zarpe:       "Fecha de Zarpe",
    fecha_emision:     "Fecha de Emisión",
    observaciones:     "Observaciones",
    forma_pago_flete:  "Forma de Pago Flete",
    cond_transporte:   "Condición de Transporte",
    almacenador:       "Almacenador",
}[field] || field);

const esBB = (bl) => (bl?.tipo_servicio || "").toUpperCase() === "BB";

// ── Almacenador Selector (igual que CargaSueltaEdit) ──────────────────────────
const AlmacenadorSelector = ({ value, displayValue, onChange, onClear }) => {
    const [query, setQuery]     = useState(displayValue || "");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen]       = useState(false);
    const [selected, setSelected] = useState(!!value);
    const containerRef = useRef(null);

    useEffect(() => { setQuery(displayValue || ""); setSelected(!!value); }, [value, displayValue]);

    useEffect(() => {
        const handler = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const search = async (q) => {
        if (q.trim().length < 2) { setResults([]); setOpen(false); return; }
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/mantenedores/participantes?tipo=almacenador&q=${encodeURIComponent(q)}`);
            const data = await res.json();
            setResults(data || []);
            setOpen(true);
        } catch { setResults([]); } finally { setLoading(false); }
    };

    return (
        <div ref={containerRef} className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Almacenador{" "}
                <span className="text-xs text-slate-400 font-normal">(buscar en mantenedor)</span>
            </label>
            <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
                    </svg>
                </div>
                <input
                    type="text" value={query}
                    onChange={e => { setQuery(e.target.value); setSelected(false); search(e.target.value); }}
                    onFocus={() => query.length >= 2 && !selected && setOpen(true)}
                    placeholder="Escribe para buscar..."
                    className={`w-full pl-10 pr-10 py-2 text-sm rounded-lg border focus:ring-2 focus:outline-none transition-colors ${
                        selected ? "border-emerald-400 bg-emerald-50 focus:ring-emerald-300" : "border-slate-300 focus:ring-[#0F2A44]"
                    }`}
                />
                {loading && (
                    <div className="absolute inset-y-0 right-3 flex items-center">
                        <svg className="animate-spin h-4 w-4 text-slate-400" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                    </div>
                )}
                {!loading && selected && (
                    <button type="button" onClick={() => { setQuery(""); setSelected(false); setResults([]); setOpen(false); onClear(); }}
                        className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-red-500 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                )}
            </div>
            {selected && (
                <p className="mt-1 text-xs text-emerald-600 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Almacenador seleccionado del mantenedor
                </p>
            )}
            {open && results.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                    {results.map(item => (
                        <button key={item.id} type="button"
                            onClick={() => { setQuery(item.nombre); setSelected(true); setOpen(false); setResults([]); onChange(item.id, item.nombre); }}
                            className="w-full text-left px-4 py-2.5 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors">
                            <p className="font-medium text-slate-900 text-sm">{item.nombre}</p>
                            <p className="text-xs text-slate-500">{item.ciudad || "—"}</p>
                        </button>
                    ))}
                </div>
            )}
            {open && !loading && results.length === 0 && query.length >= 2 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow px-4 py-3 text-sm text-slate-500">
                    No se encontraron almacenadores
                </div>
            )}
        </div>
    );
};

// ── Componente principal ───────────────────────────────────────────────────────
const BulkEditBL = () => {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading]         = useState(true);
    const [allBLs, setAllBLs]           = useState([]);
    const [error, setError]             = useState("");

    // Step 1
    const [selectedViaje, setSelectedViaje] = useState("");

    // Step 2
    const [filteredBLs, setFilteredBLs]   = useState([]);
    const [selectedBLs, setSelectedBLs]   = useState([]);
    const [modoTipo, setModoTipo]         = useState(null); // null | "BB" | "CONTENEDOR"

    // Step 3 — campos generales
    const [fieldsToEdit, setFieldsToEdit] = useState({
        descripcion_carga: false,
        bultos:            false,
        peso_bruto:        false,
        status:            false,
        fecha_embarque:    false,
        fecha_zarpe:       false,
        fecha_emision:     false,
        // BB específicos
        forma_pago_flete:  false,
        cond_transporte:   false,
        almacenador:       false,
    });
    const [editValues, setEditValues] = useState({
        descripcion_carga: "",
        bultos:            "",
        peso_bruto:        "",
        status:            "CREADO",
        fecha_embarque:    "",
        fecha_zarpe:       "",
        fecha_emision:     "",
        forma_pago_flete:  "PREPAID",
        cond_transporte:   "",
        almacenador:       "",
        almacenador_id:    null,
    });

    // Step 4
    const [puertosDisponibles, setPuertosDisponibles]     = useState([]);
    const [editarPuertos, setEditarPuertos]               = useState(false);
    const [editarPuertosMasivo, setEditarPuertosMasivo]   = useState(false);
    const [puertosIndividuales, setPuertosIndividuales]   = useState({});
    const [puertosMasivos, setPuertosMasivos]             = useState({
        lugar_recepcion_cod: "", puerto_embarque_cod: "", puerto_descarga_cod: "",
        lugar_entrega_cod: "",   lugar_destino_cod: "",   lugar_emision_cod: "",
    });

    // Step 5
    const [saving, setSaving]           = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => { fetchBLs(); fetchPuertos(); }, []);

    const fetchBLs = async () => {
        setLoading(true);
        try {
            const res  = await fetch(`${API_BASE}/bls`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setAllBLs(Array.isArray(data) ? data : []);
        } catch (e) { setError(e.message); } finally { setLoading(false); }
    };

    const fetchPuertos = async () => {
        try {
            const res  = await fetch(`${API_BASE}/mantenedores/puertos`);
            const data = await res.json();
            setPuertosDisponibles(Array.isArray(data) ? data : []);
        } catch { setPuertosDisponibles([]); }
    };

    // Manifiestos únicos
    const manifiestos = Object.values(
        allBLs.reduce((acc, bl) => {
            if (!bl.viaje || acc[bl.viaje]) return acc;
            acc[bl.viaje] = {
                viaje:          bl.viaje,
                tipo_operacion: bl.tipo_operacion,
                countTotal:     allBLs.filter(b => b.viaje === bl.viaje).length,
                countBB:        allBLs.filter(b => b.viaje === bl.viaje && esBB(b)).length,
                countCont:      allBLs.filter(b => b.viaje === bl.viaje && !esBB(b)).length,
            };
            return acc;
        }, {})
    ).sort((a, b) => a.viaje.localeCompare(b.viaje));

    // Cargar BLs al seleccionar viaje
    useEffect(() => {
        if (!selectedViaje) { setFilteredBLs([]); return; }
        setFilteredBLs(allBLs.filter(bl => bl.viaje === selectedViaje));
        setSelectedBLs([]);
        setModoTipo(null);
    }, [selectedViaje, allBLs]);

    // BLs visibles según modo tipo elegido
    const blsVisibles = modoTipo
        ? filteredBLs.filter(bl => modoTipo === "BB" ? esBB(bl) : !esBB(bl))
        : [];

    // Puertos individuales init
    useEffect(() => {
        if (!selectedBLs.length) return;
        const init = {};
        selectedBLs.forEach(num => {
            const bl = filteredBLs.find(b => b.bl_number === num);
            if (bl) init[num] = {
                lugar_recepcion_cod: bl.lugar_recepcion_cod || "",
                puerto_embarque_cod: bl.puerto_embarque_cod || "",
                puerto_descarga_cod: bl.puerto_descarga_cod || "",
                lugar_entrega_cod:   bl.lugar_entrega_cod   || "",
                lugar_destino_cod:   bl.lugar_destino_cod   || "",
                lugar_emision_cod:   bl.lugar_emision_cod   || "",
            };
        });
        setPuertosIndividuales(init);
    }, [selectedBLs]);

    // Puertos masivos init
    useEffect(() => {
        if (!editarPuertosMasivo || !selectedBLs.length) return;
        const bl = filteredBLs.find(b => b.bl_number === selectedBLs[0]);
        if (bl) setPuertosMasivos({
            lugar_recepcion_cod: bl.lugar_recepcion_cod || "",
            puerto_embarque_cod: bl.puerto_embarque_cod || "",
            puerto_descarga_cod: bl.puerto_descarga_cod || "",
            lugar_entrega_cod:   bl.lugar_entrega_cod   || "",
            lugar_destino_cod:   bl.lugar_destino_cod   || "",
            lugar_emision_cod:   bl.lugar_emision_cod   || "",
        });
    }, [editarPuertosMasivo]);

    const handleSelectAll = () =>
        setSelectedBLs(selectedBLs.length === blsVisibles.length ? [] : blsVisibles.map(b => b.bl_number));

    const handleSelectBL = (num) =>
        setSelectedBLs(prev => prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num]);

    const validateStep3 = () =>
        Object.keys(fieldsToEdit).filter(f => {
            if (!fieldsToEdit[f]) return false;
            if (f === "almacenador") return !editValues.almacenador_id;
            return !editValues[f]?.toString().trim();
        });

    const emptyFields    = validateStep3();
    const hasChanges     = Object.values(fieldsToEdit).some(v => v) || editarPuertos || editarPuertosMasivo;
    const manifiestoSel  = manifiestos.find(m => m.viaje === selectedViaje);

    const canContinue = {
        1: !!selectedViaje,
        2: selectedBLs.length > 0,
        3: emptyFields.length === 0,
        4: true,
    };

    const handleSave = async () => {
        setSaving(true); setError("");
        try {
            // Campos generales
            const updates = {};
            Object.keys(fieldsToEdit).forEach(f => {
                if (!fieldsToEdit[f]) return;
                if (f === "almacenador") {
                    updates.almacenador    = editValues.almacenador;
                    updates.almacenador_id = editValues.almacenador_id;
                } else {
                    updates[f] = editValues[f];
                }
            });

            if (Object.keys(updates).length > 0) {
                const res = await fetch(`${API_BASE}/bls/bulk-update`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ blNumbers: selectedBLs, updates }),
                });
                if (!res.ok) throw new Error((await res.json()).error);
            }

            // Puertos masivos
            if (editarPuertosMasivo) {
                await Promise.all(selectedBLs.map(num =>
                    fetch(`${API_BASE}/bls/${num}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(puertosMasivos),
                    })
                ));
            }

            // Puertos individuales
            if (editarPuertos) {
                await Promise.all(selectedBLs.map(num =>
                    fetch(`${API_BASE}/bls/${num}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(puertosIndividuales[num]),
                    })
                ));
            }

            setSaveSuccess(true);
            setTimeout(() => navigate("/expo-bl"), 2000);
        } catch (e) {
            setError(e?.message || "Error al guardar");
        } finally {
            setSaving(false);
        }
    };

    const steps = [
        { number: 1, title: "Manifiesto" },
        { number: 2, title: "Seleccionar BLs" },
        { number: 3, title: "Editar Campos" },
        { number: 4, title: "Puertos" },
        { number: 5, title: "Confirmar" },
    ];

    const PUERTOS_CAMPOS = [
        { key: "lugar_recepcion_cod", label: "Lugar de Recepción (LRM)" },
        { key: "puerto_embarque_cod", label: "Puerto de Embarque (POL)" },
        { key: "puerto_descarga_cod", label: "Puerto de Descarga (POD)" },
        { key: "lugar_entrega_cod",   label: "Lugar de Entrega (LEM)" },
        { key: "lugar_destino_cod",   label: "Lugar de Destino (LD)" },
        { key: "lugar_emision_cod",   label: "Lugar de Emisión (LE)" },
    ];

    const PuertoSelect = ({ label, value, onChange }) => (
        <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>
            <select value={value} onChange={e => onChange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F2A44] focus:border-[#0F2A44] outline-none">
                <option value="">Sin cambios</option>
                {puertosDisponibles.map(p => (
                    <option key={p.id} value={p.codigo}>
                        {p.nombre} ({p.codigo}){p.pais ? ` · ${p.pais}` : ""}
                    </option>
                ))}
            </select>
        </div>
    );

    const FieldRow = ({ field, children }) => (
        <div className={`border rounded-xl p-4 transition-all ${
            fieldsToEdit[field]
                ? "border-[#0F2A44]/30 bg-[#0F2A44]/5"
                : "border-slate-200 bg-white hover:border-slate-300"
        }`}>
            <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={fieldsToEdit[field]}
                    onChange={() => setFieldsToEdit(p => ({ ...p, [field]: !p[field] }))}
                    className="mt-0.5 w-4 h-4 text-[#0F2A44] rounded focus:ring-2 focus:ring-[#0F2A44]" />
                <div className="flex-1">
                    <div className="font-medium text-slate-800 text-sm mb-2">
                        {getFieldLabel(field)}
                        {fieldsToEdit[field] && <span className="text-red-400 ml-1 font-normal">*</span>}
                    </div>
                    {fieldsToEdit[field] && children}
                </div>
            </label>
        </div>
    );

    return (
        <div className="flex min-h-screen bg-slate-100">
            <Sidebar />

            <main className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-6 py-10 flex flex-col gap-6">

                    {/* Header */}
                    <div>
                        <button onClick={() => navigate("/expo-bl")}
                            className="flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-4 text-sm transition-colors">
                            <ArrowLeft className="w-4 h-4" /> Volver a BL's
                        </button>
                        <h1 className="text-2xl font-semibold text-[#0F2A44]">Edición Masiva de BLs</h1>
                        <p className="text-sm text-slate-500 mt-1">
                            Edita múltiples BLs de un mismo manifiesto simultáneamente
                        </p>
                    </div>

                    {/* Steps */}
                    <div className="flex items-center">
                        {steps.map((step, i) => (
                            <div key={step.number} className="flex items-center flex-1">
                                <div className="flex flex-col items-center flex-1">
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                                        currentStep > step.number  ? "bg-emerald-500 text-white"
                                        : currentStep === step.number ? "bg-[#0F2A44] text-white ring-4 ring-[#0F2A44]/20"
                                        : "bg-slate-200 text-slate-400"
                                    }`}>
                                        {currentStep > step.number ? <Check className="w-4 h-4" /> : step.number}
                                    </div>
                                    <span className={`text-xs mt-1.5 font-medium whitespace-nowrap ${
                                        currentStep === step.number ? "text-[#0F2A44]" : "text-slate-400"
                                    }`}>{step.title}</span>
                                </div>
                                {i < steps.length - 1 && (
                                    <div className={`h-0.5 flex-1 mb-5 mx-1 transition-all ${
                                        currentStep > step.number ? "bg-emerald-400" : "bg-slate-200"
                                    }`} />
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" /> {error}
                        </div>
                    )}

                    {/* Card */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">

                        {/* ── STEP 1 ── */}
                        {currentStep === 1 && (
                            <div className="space-y-5">
                                <div>
                                    <h2 className="text-base font-semibold text-slate-900 mb-1">Selecciona el manifiesto</h2>
                                    <p className="text-sm text-slate-500">Todos los BLs editados pertenecerán al mismo manifiesto/viaje</p>
                                </div>

                                {loading ? (
                                    <p className="text-sm text-slate-500">Cargando manifiestos...</p>
                                ) : (
                                    <div className="space-y-2">
                                        {manifiestos.map(m => (
                                            <button key={m.viaje} onClick={() => setSelectedViaje(m.viaje)}
                                                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 text-left transition-all ${
                                                    selectedViaje === m.viaje
                                                        ? "border-[#0F2A44] bg-[#0F2A44]/5"
                                                        : "border-slate-200 hover:border-slate-300 bg-white"
                                                }`}>
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                                        selectedViaje === m.viaje ? "border-[#0F2A44]" : "border-slate-300"
                                                    }`}>
                                                        {selectedViaje === m.viaje && <div className="w-2 h-2 rounded-full bg-[#0F2A44]" />}
                                                    </div>
                                                    <div>
                                                        <div className="font-semibold text-slate-900 text-sm">{m.viaje}</div>
                                                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                                                            <span>{m.countTotal} BL{m.countTotal !== 1 ? "s" : ""} total</span>
                                                            {m.countCont > 0 && <span className="text-blue-600">· {m.countCont} contenedor</span>}
                                                            {m.countBB   > 0 && <span className="text-green-600">· {m.countBB} carga suelta</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                                {m.tipo_operacion === "S" ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#0F2A44]/10 text-[#0F2A44]">
                                                        <ArrowUpRight size={11} /> EXPO
                                                    </span>
                                                ) : m.tipo_operacion === "I" ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                                                        <ArrowDownLeft size={11} /> IMPO
                                                    </span>
                                                ) : null}
                                            </button>
                                        ))}
                                        {manifiestos.length === 0 && (
                                            <p className="text-sm text-slate-400 text-center py-8">No hay manifiestos disponibles</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── STEP 2 ── */}
                        {currentStep === 2 && (
                            <div className="space-y-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h2 className="text-base font-semibold text-slate-900">Selecciona los BLs a editar</h2>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-sm text-slate-500">Manifiesto:</span>
                                            <span className="text-sm font-medium text-slate-700">{selectedViaje}</span>
                                            {manifiestoSel?.tipo_operacion === "S" ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-[#0F2A44]/10 text-[#0F2A44]">
                                                    <ArrowUpRight size={10} /> EXPO
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">
                                                    <ArrowDownLeft size={10} /> IMPO
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {modoTipo && (
                                        <button onClick={handleSelectAll}
                                            className="text-sm font-medium text-[#0F2A44] hover:underline flex-shrink-0">
                                            {selectedBLs.length === blsVisibles.length && blsVisibles.length > 0
                                                ? "Deseleccionar todos" : "Seleccionar todos"}
                                        </button>
                                    )}
                                </div>

                                {/* Selector de tipo — obligatorio antes de ver BLs */}
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                        ¿Qué tipo de BLs vas a editar?
                                    </p>
                                    <div className="grid grid-cols-2 gap-3">
                                        {[
                                            {
                                                key: "CONTENEDOR",
                                                label: "Con Contenedor",
                                                desc: "Tipos FCL, LCL, MM, etc.",
                                                count: manifiestoSel?.countCont || 0,
                                                color: "blue",
                                            },
                                            {
                                                key: "BB",
                                                label: "Carga Suelta",
                                                desc: "Tipo BB — Break Bulk",
                                                count: manifiestoSel?.countBB || 0,
                                                color: "green",
                                            },
                                        ].map(opt => {
                                            const active   = modoTipo === opt.key;
                                            const disabled = opt.count === 0;
                                            return (
                                                <button key={opt.key}
                                                    onClick={() => { if (!disabled) { setModoTipo(opt.key); setSelectedBLs([]); } }}
                                                    disabled={disabled}
                                                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                                                        disabled   ? "border-slate-100 bg-slate-50 opacity-40 cursor-not-allowed"
                                                        : active   ? "border-[#0F2A44] bg-[#0F2A44]/5"
                                                        : "border-slate-200 hover:border-slate-300 bg-white"
                                                    }`}>
                                                    <div className={`w-3 h-3 rounded-full mb-2 ${
                                                        active ? "bg-[#0F2A44]" : opt.color === "green" ? "bg-green-400" : "bg-blue-400"
                                                    }`} />
                                                    <div className="font-semibold text-slate-900 text-sm">{opt.label}</div>
                                                    <div className="text-xs text-slate-500 mt-0.5">{opt.desc}</div>
                                                    <div className={`text-xs font-semibold mt-1 ${
                                                        opt.color === "green" ? "text-green-600" : "text-blue-600"
                                                    }`}>{opt.count} BL{opt.count !== 1 ? "s" : ""}</div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {modoTipo && (
                                        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
                                            Solo puedes editar BLs del mismo tipo en una sesión. Para editar el otro tipo, inicia una nueva edición masiva.
                                        </p>
                                    )}
                                </div>

                                {/* Lista de BLs */}
                                {modoTipo && (
                                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                                        <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100">
                                            {blsVisibles.map(bl => (
                                                <label key={bl.bl_number}
                                                    className={`flex items-center gap-4 px-5 py-3.5 cursor-pointer transition-colors ${
                                                        selectedBLs.includes(bl.bl_number) ? "bg-blue-50" : "hover:bg-slate-50"
                                                    }`}>
                                                    <input type="checkbox"
                                                        checked={selectedBLs.includes(bl.bl_number)}
                                                        onChange={() => handleSelectBL(bl.bl_number)}
                                                        className="w-4 h-4 text-[#0F2A44] rounded focus:ring-2 focus:ring-[#0F2A44]" />
                                                    <div className="flex-1 grid grid-cols-4 gap-3 items-center min-w-0">
                                                        <div>
                                                            <div className="text-sm font-semibold text-[#0F2A44]">{bl.bl_number}</div>
                                                            <div className="text-xs text-slate-400">{formatDateCL(bl.fecha_emision)}</div>
                                                        </div>
                                                        <div className="text-sm text-slate-600 truncate col-span-2" title={bl.shipper}>
                                                            {bl.shipper || "—"}
                                                        </div>
                                                        <div className="flex justify-end">
                                                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs ring-1 ${
                                                                estadoStyles[bl.status] ?? "bg-slate-100 text-slate-600 ring-slate-200"
                                                            }`}>{bl.status || "—"}</span>
                                                        </div>
                                                    </div>
                                                </label>
                                            ))}
                                            {blsVisibles.length === 0 && (
                                                <div className="py-10 text-center text-sm text-slate-400">No hay BLs de este tipo</div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {selectedBLs.length > 0 && (
                                    <div className="flex items-center gap-2 px-4 py-3 bg-[#0F2A44]/5 rounded-xl border border-[#0F2A44]/20">
                                        <Check className="w-4 h-4 text-[#0F2A44]" />
                                        <span className="text-sm font-medium text-[#0F2A44]">
                                            {selectedBLs.length} BL{selectedBLs.length !== 1 ? "s" : ""} seleccionado{selectedBLs.length !== 1 ? "s" : ""}
                                        </span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── STEP 3 ── */}
                        {currentStep === 3 && (
                            <div className="space-y-4">
                                <div>
                                    <h2 className="text-base font-semibold text-slate-900 mb-1">¿Qué campos deseas modificar?</h2>
                                    <p className="text-sm text-slate-500">Solo activa los campos que necesites cambiar.</p>
                                </div>

                                {emptyFields.length > 0 && (
                                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-start gap-2">
                                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                        Completa o desactiva: <strong className="ml-1">{emptyFields.map(getFieldLabel).join(", ")}</strong>
                                    </div>
                                )}

                                {/* Campos generales */}
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Campos generales</p>

                                    <FieldRow field="descripcion_carga">
                                        <textarea rows={3} value={editValues.descripcion_carga}
                                            onChange={e => setEditValues(p => ({ ...p, descripcion_carga: e.target.value }))}
                                            placeholder="Descripción de la carga..."
                                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F2A44] outline-none" />
                                    </FieldRow>

                                    <div className="grid grid-cols-2 gap-2">
                                        <FieldRow field="bultos">
                                            <input type="number" value={editValues.bultos}
                                                onChange={e => setEditValues(p => ({ ...p, bultos: e.target.value }))}
                                                placeholder="Nº de bultos"
                                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F2A44] outline-none" />
                                        </FieldRow>
                                        <FieldRow field="peso_bruto">
                                            <input type="number" step="0.001" value={editValues.peso_bruto}
                                                onChange={e => setEditValues(p => ({ ...p, peso_bruto: e.target.value }))}
                                                placeholder="Peso en KG"
                                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F2A44] outline-none" />
                                        </FieldRow>
                                    </div>

                                    {/* Status — ENUM correcto */}
                                    <FieldRow field="status">
                                        <select value={editValues.status}
                                            onChange={e => setEditValues(p => ({ ...p, status: e.target.value }))}
                                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F2A44] outline-none">
                                            <option value="CREADO">Creado</option>
                                            <option value="VALIDADO">Validado</option>
                                            <option value="ENVIADO">Enviado</option>
                                            <option value="ANULADO">Anulado</option>
                                        </select>
                                    </FieldRow>

                                    <div className="grid grid-cols-3 gap-2">
                                        <FieldRow field="fecha_emision">
                                            <input type="date" value={editValues.fecha_emision}
                                                onChange={e => setEditValues(p => ({ ...p, fecha_emision: e.target.value }))}
                                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F2A44] outline-none" />
                                        </FieldRow>
                                        <FieldRow field="fecha_embarque">
                                            <input type="date" value={editValues.fecha_embarque}
                                                onChange={e => setEditValues(p => ({ ...p, fecha_embarque: e.target.value }))}
                                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F2A44] outline-none" />
                                        </FieldRow>
                                        <FieldRow field="fecha_zarpe">
                                            <input type="date" value={editValues.fecha_zarpe}
                                                onChange={e => setEditValues(p => ({ ...p, fecha_zarpe: e.target.value }))}
                                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F2A44] outline-none" />
                                        </FieldRow>
                                    </div>
                                </div>

                                {/* Campos BB — solo si modo es carga suelta */}
                                {modoTipo === "BB" && (
                                    <div className="space-y-2 pt-2">
                                        <div className="flex items-center gap-2">
                                            <div className="h-px flex-1 bg-green-200" />
                                            <span className="text-xs font-semibold text-green-700 uppercase tracking-wider">
                                                Carga Suelta (BB)
                                            </span>
                                            <div className="h-px flex-1 bg-green-200" />
                                        </div>

                                        <FieldRow field="forma_pago_flete">
                                            <select value={editValues.forma_pago_flete}
                                                onChange={e => setEditValues(p => ({ ...p, forma_pago_flete: e.target.value }))}
                                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F2A44] outline-none">
                                                <option value="PREPAID">PREPAID — Pagado en origen</option>
                                                <option value="COLLECT">COLLECT — Por cobrar en destino</option>
                                            </select>
                                        </FieldRow>

                                        <FieldRow field="cond_transporte">
                                            <input type="text" value={editValues.cond_transporte}
                                                onChange={e => setEditValues(p => ({ ...p, cond_transporte: e.target.value.toUpperCase() }))}
                                                placeholder="HH, CY, SD..."
                                                maxLength={10}
                                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F2A44] outline-none uppercase" />
                                        </FieldRow>

                                        {/* Almacenador con selector */}
                                        <div className={`border rounded-xl p-4 transition-all ${
                                            fieldsToEdit.almacenador
                                                ? "border-[#0F2A44]/30 bg-[#0F2A44]/5"
                                                : "border-slate-200 bg-white hover:border-slate-300"
                                        }`}>
                                            <label className="flex items-start gap-3 cursor-pointer">
                                                <input type="checkbox" checked={fieldsToEdit.almacenador}
                                                    onChange={() => setFieldsToEdit(p => ({ ...p, almacenador: !p.almacenador }))}
                                                    className="mt-0.5 w-4 h-4 text-[#0F2A44] rounded focus:ring-2 focus:ring-[#0F2A44]" />
                                                <div className="flex-1">
                                                    <div className="font-medium text-slate-800 text-sm mb-2">
                                                        Almacenador
                                                        {fieldsToEdit.almacenador && <span className="text-red-400 ml-1 font-normal">*</span>}
                                                    </div>
                                                    {fieldsToEdit.almacenador && (
                                                        <AlmacenadorSelector
                                                            value={editValues.almacenador_id}
                                                            displayValue={editValues.almacenador}
                                                            onChange={(id, nombre) => setEditValues(p => ({
                                                                ...p, almacenador_id: id, almacenador: nombre
                                                            }))}
                                                            onClear={() => setEditValues(p => ({
                                                                ...p, almacenador_id: null, almacenador: ""
                                                            }))}
                                                        />
                                                    )}
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── STEP 4 ── */}
                        {currentStep === 4 && (
                            <div className="space-y-5">
                                <div>
                                    <h2 className="text-base font-semibold text-slate-900 mb-1">¿Deseas editar los puertos?</h2>
                                    <p className="text-sm text-slate-500">Opcional. Masivo aplica a todos los BLs; individual permite puertos distintos por BL.</p>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { key: "masivo",     label: "Edición masiva",     desc: `Todos los BLs tendrán los mismos puertos` },
                                        { key: "individual", label: "Edición individual",  desc: "Puertos distintos por BL" },
                                    ].map(opt => {
                                        const active = opt.key === "masivo" ? editarPuertosMasivo : editarPuertos;
                                        return (
                                            <button key={opt.key}
                                                onClick={() => {
                                                    if (opt.key === "masivo") { setEditarPuertosMasivo(v => !v); setEditarPuertos(false); }
                                                    else { setEditarPuertos(v => !v); setEditarPuertosMasivo(false); }
                                                }}
                                                className={`p-4 rounded-xl border-2 text-left transition-all ${
                                                    active ? "border-[#0F2A44] bg-[#0F2A44]/5" : "border-slate-200 hover:border-slate-300 bg-white"
                                                }`}>
                                                <div className={`w-3 h-3 rounded-full mb-2 ${active ? "bg-[#0F2A44]" : "bg-slate-300"}`} />
                                                <div className="font-semibold text-slate-900 text-sm">{opt.label}</div>
                                                <div className="text-xs text-slate-500 mt-0.5">{opt.desc}</div>
                                            </button>
                                        );
                                    })}
                                </div>

                                {editarPuertosMasivo && (
                                    <div className="border border-slate-200 rounded-xl p-5 bg-slate-50">
                                        <p className="text-sm font-semibold text-slate-700 mb-4">
                                            Se aplicará a {selectedBLs.length} BL{selectedBLs.length !== 1 ? "s" : ""}
                                        </p>
                                        <div className="grid grid-cols-2 gap-4 bg-white p-4 rounded-lg border border-slate-200">
                                            {PUERTOS_CAMPOS.map(({ key, label }) => (
                                                <PuertoSelect key={key} label={label}
                                                    value={puertosMasivos[key]}
                                                    onChange={v => setPuertosMasivos(p => ({ ...p, [key]: v }))} />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {editarPuertos && (
                                    <div className="space-y-3">
                                        {selectedBLs.map(num => {
                                            const bl = filteredBLs.find(b => b.bl_number === num);
                                            return (
                                                <div key={num} className="border border-slate-200 rounded-xl p-5 bg-white">
                                                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                                                        <div className="font-semibold text-[#0F2A44] text-sm">{num}</div>
                                                        <div className="text-xs text-slate-500">— {bl?.shipper || "—"}</div>
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        {PUERTOS_CAMPOS.map(({ key, label }) => (
                                                            <PuertoSelect key={key} label={label}
                                                                value={puertosIndividuales[num]?.[key] || ""}
                                                                onChange={v => setPuertosIndividuales(p => ({
                                                                    ...p, [num]: { ...p[num], [key]: v }
                                                                }))} />
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {!editarPuertos && !editarPuertosMasivo && (
                                    <div className="py-10 text-center text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl">
                                        Los puertos se mantendrán sin cambios
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── STEP 5 ── */}
                        {currentStep === 5 && (
                            <div className="space-y-5">
                                {saveSuccess ? (
                                    <div className="text-center py-16">
                                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                            <Check className="w-8 h-8 text-emerald-600" />
                                        </div>
                                        <h2 className="text-xl font-semibold text-slate-900 mb-2">¡Cambios guardados!</h2>
                                        <p className="text-slate-500 text-sm">Redirigiendo a la lista de BLs...</p>
                                    </div>
                                ) : (
                                    <>
                                        <div>
                                            <h2 className="text-base font-semibold text-slate-900 mb-1">Revisa antes de guardar</h2>
                                            <p className="text-sm text-slate-500">
                                                Se aplicarán a <strong>{selectedBLs.length}</strong> BL{selectedBLs.length !== 1 ? "s" : ""} del manifiesto <strong>{selectedViaje}</strong>
                                                {modoTipo === "BB"
                                                    ? <span className="ml-1 text-green-600 font-medium">(Carga Suelta)</span>
                                                    : <span className="ml-1 text-blue-600 font-medium">(Contenedor)</span>}
                                            </p>
                                        </div>

                                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">BLs afectados</p>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedBLs.slice(0, 12).map(num => (
                                                    <span key={num} className="px-3 py-1 bg-white rounded-full text-sm text-slate-700 border border-slate-200">{num}</span>
                                                ))}
                                                {selectedBLs.length > 12 && (
                                                    <span className="px-3 py-1 bg-white rounded-full text-sm text-slate-400 border border-slate-200">
                                                        +{selectedBLs.length - 12} más
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {Object.values(fieldsToEdit).some(v => v) && (
                                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Campos a modificar</p>
                                                <div className="space-y-1.5">
                                                    {Object.keys(fieldsToEdit).filter(k => fieldsToEdit[k]).map(k => (
                                                        <div key={k} className="flex items-center gap-2 text-sm">
                                                            <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                                                            <span className="font-medium text-slate-700">{getFieldLabel(k)}:</span>
                                                            <span className="text-slate-600">
                                                                {k === "almacenador" ? editValues.almacenador || "—" : editValues[k]}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {(editarPuertosMasivo || editarPuertos) && (
                                            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                                                    Puertos — {editarPuertosMasivo ? "Masivo" : "Individual"}
                                                </p>
                                                {editarPuertosMasivo && puertosMasivos.puerto_embarque_cod && (
                                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                                        <span>{puertosMasivos.puerto_embarque_cod}</span>
                                                        <span className="text-slate-400">→</span>
                                                        <span>{puertosMasivos.puerto_descarga_cod || "—"}</span>
                                                    </div>
                                                )}
                                                {editarPuertos && (
                                                    <p className="text-sm text-slate-500">{selectedBLs.length} BLs con puertos individuales</p>
                                                )}
                                            </div>
                                        )}

                                        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                                            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                            <p className="text-sm text-amber-800">Esta acción es irreversible. Verifica que los datos sean correctos.</p>
                                        </div>

                                        {!hasChanges && (
                                            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                                                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                                <p className="text-sm text-red-700">No hay cambios para guardar. Vuelve al Step 3 o 4.</p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Navegación */}
                    {!saveSuccess && (
                        <div className="flex items-center justify-between">
                            <button onClick={() => setCurrentStep(p => p - 1)} disabled={currentStep === 1}
                                className="px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-200 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                Atrás
                            </button>
                            {currentStep < 5 ? (
                                <button onClick={() => setCurrentStep(p => p + 1)} disabled={!canContinue[currentStep]}
                                    className="px-6 py-2.5 text-sm font-medium text-white bg-[#0F2A44] hover:bg-[#1a3a5c] rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                                    Continuar
                                </button>
                            ) : (
                                <button onClick={handleSave} disabled={saving || !hasChanges}
                                    className="px-6 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
                                    {saving ? (
                                        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Guardando...</>
                                    ) : (
                                        <><Check className="w-4 h-4" /> Guardar Cambios</>
                                    )}
                                </button>
                            )}
                        </div>
                    )}

                </div>
            </main>
        </div>
    );
};

export default BulkEditBL;