import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { Edit3, ArrowUpRight, ArrowDownLeft, X } from "lucide-react";
import ComboSelect from "../components/ComboSelect";

const API_BASE = import.meta.env.VITE_API_URL;

const estadoStyles = {
    "ACTIVO": "bg-emerald-100 text-emerald-800 ring-emerald-200",
    "INACTIVO": "bg-slate-100 text-slate-600 ring-slate-200",
    "EN REVISION": "bg-amber-100 text-amber-800 ring-amber-200",
};

const formatDateCL = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`;
};

const formatNumber = (num) => {
    if (!num) return "—";
    return new Intl.NumberFormat('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(num);
};

// ─── Mapa de regiones POL ───────────────────────────────────────────────────
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
    const key = polName.trim().toUpperCase();
    const found = Object.keys(REGION_MAP).find(k => k.toUpperCase() === key);
    return found ? REGION_MAP[found] : polName.toUpperCase();
};

// ─── Combobox tipo input con autocomplete ───────────────────────────────────
const SearchableSelect = ({ value, onChange, options, allLabel }) => {
    const [inputVal, setInputVal] = useState(value === "TODOS" ? "" : value);
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        setInputVal(value === "TODOS" ? "" : value);
    }, [value]);

    useEffect(() => {
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const filtered = options.filter(o =>
        o.toLowerCase().includes(inputVal.toLowerCase())
    );

    const handleChange = (e) => {
        setInputVal(e.target.value);
        setOpen(true);
        if (e.target.value === "") onChange("TODOS");
    };

    const handleSelect = (o) => {
        setInputVal(o);
        onChange(o);
        setOpen(false);
    };

    const handleClear = () => {
        setInputVal("");
        onChange("TODOS");
        setOpen(false);
    };

    return (
        <div ref={ref} className="relative w-full">
            <div className="relative">
                <input
                    type="text"
                    value={inputVal}
                    onChange={handleChange}
                    onFocus={() => setOpen(true)}
                    placeholder={allLabel}
                    className={`w-full px-3 py-2 text-sm border rounded-lg outline-none transition-colors ${value !== "TODOS"
                        ? "border-[#0F2A44] bg-[#0F2A44]/5 text-[#0F2A44]"
                        : "border-slate-300 bg-white text-slate-700"
                        } focus:ring-2 focus:ring-[#0F2A44] focus:border-[#0F2A44]`}
                />
                {value !== "TODOS" && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                        <X size={13} />
                    </button>
                )}
            </div>

            {open && filtered.length > 0 && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                    <div className="absolute left-0 top-full mt-1 z-50 w-full bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden">
                        <div className="max-h-52 overflow-y-auto py-1">
                            {filtered.map(o => (
                                <button
                                    key={o}
                                    type="button"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => handleSelect(o)}
                                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors ${value === o ? "font-semibold text-[#0F2A44] bg-slate-50" : "text-slate-700"
                                        }`}
                                >
                                    {o}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

// ─── Componente principal ───────────────────────────────────────────────────
const ExpoBL = () => {
    const navigate = useNavigate();
    const [bls, setBls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Filtros
    const [tipoOp, setTipoOp] = useState("TODOS");
    const [searchTerm, setSearchTerm] = useState("");
    const [viajeFilter, setViajeFilter] = useState("TODOS");
    const [servicioFilter, setServicioFilter] = useState("TODOS");
    const [naveFilter, setNaveFilter] = useState("TODOS");
    const [polFilter, setPolFilter] = useState("TODOS");

    // Paginación
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const fetchBLs = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch(`${API_BASE}/api/bls`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setBls(Array.isArray(data) ? data : []);
        } catch (e) {
            setError(e?.message || "Error desconocido");
            setBls([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchBLs(); }, []);

    // Valores únicos para selects
    const viajes = [...new Set(bls.map(b => b.viaje).filter(Boolean))].sort();
    const servicios = [...new Set(bls.map(b => b.tipo_servicio).filter(Boolean))].sort();
    const naves = [...new Set(bls.map(b => b.nave).filter(Boolean))].sort();
    const regiones = [...new Set(bls.map(b => getRegion(b.puerto_embarque)).filter(Boolean))].sort();

    // Contadores para pills EXPO / IMPO
    const countExpo = bls.filter(b => b.tipo_operacion === "S").length;
    const countImpo = bls.filter(b => b.tipo_operacion === "I").length;
    const countTodos = bls.length;

    // Filtrado
    const filteredBLs = bls.filter(bl => {
        const matchesTipoOp =
            tipoOp === "TODOS" ||
            (tipoOp === "S" && bl.tipo_operacion === "S") ||
            (tipoOp === "I" && bl.tipo_operacion === "I");

        const matchesSearch =
            (bl.bl_number || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (bl.shipper || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (bl.consignee || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (bl.descripcion_carga || "").toLowerCase().includes(searchTerm.toLowerCase());

        const matchesViaje = viajeFilter === "TODOS" || bl.viaje === viajeFilter;
        const matchesServicio = servicioFilter === "TODOS" || bl.tipo_servicio === servicioFilter;
        const matchesNave = naveFilter === "TODOS" || bl.nave === naveFilter;
        const matchesPol = polFilter === "TODOS" || getRegion(bl.puerto_embarque) === polFilter;

        return matchesTipoOp && matchesSearch && matchesViaje && matchesNave && matchesServicio && matchesPol;
    });

    // Paginación
    const totalPages = Math.ceil(filteredBLs.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentBLs = filteredBLs.slice(startIndex, startIndex + itemsPerPage);

    const hayFiltrosActivos =
        tipoOp !== "TODOS" || searchTerm || viajeFilter !== "TODOS" ||
        naveFilter !== "TODOS" || servicioFilter !== "TODOS" || polFilter !== "TODOS";

    const limpiarFiltros = () => {
        setTipoOp("TODOS");
        setSearchTerm("");
        setViajeFilter("TODOS");
        setServicioFilter("TODOS");
        setNaveFilter("TODOS");
        setPolFilter("TODOS");
        setCurrentPage(1);
    };

    useEffect(() => { setCurrentPage(1); },
        [tipoOp, searchTerm, viajeFilter, naveFilter, servicioFilter, polFilter, itemsPerPage]);

    const getPageNumbers = () => {
        const pages = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else if (currentPage <= 3) {
            [1, 2, 3, 4, 5, "...", totalPages].forEach(p => pages.push(p));
        } else if (currentPage >= totalPages - 2) {
            [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages].forEach(p => pages.push(p));
        } else {
            [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages].forEach(p => pages.push(p));
        }
        return pages;
    };

    // ─── Pill de tipo de operación ──────────────────────────────────────────
    const TipoOpPill = ({ value, label, count, icon: Icon, color }) => {
        const active = tipoOp === value;
        return (
            <button
                onClick={() => setTipoOp(value)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all border ${active
                    ? `${color.active} shadow-sm`
                    : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700"
                    }`}
            >
                {Icon && <Icon size={15} />}
                {label}
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${active ? color.badge : "bg-slate-100 text-slate-500"}`}>
                    {count}
                </span>
            </button>
        );
    };

    return (
        <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 p-10 min-h-screen bg-slate-100 flex flex-col gap-5">

                {/* ── Header ─────────────────────────────────────── */}
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-semibold text-[#0F2A44]">BL's</h1>
                        <p className="text-sm text-slate-500 mt-1">Gestión de Bills of Lading</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate("/expo/bulk-edit")}
                            className="px-4 py-2 rounded-lg bg-[#0F2A44] text-white text-sm font-medium hover:bg-[#1a3a5c] flex items-center gap-2 transition-colors"
                        >
                            <Edit3 className="w-4 h-4" />
                            Edición Masiva
                        </button>
                        <button
                            onClick={fetchBLs}
                            className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
                        >
                            Actualizar
                        </button>
                    </div>
                </div>

                {/* ── Pills EXPO / IMPO ───────────────────────────── */}
                <div className="flex items-center gap-2 flex-wrap">
                    <TipoOpPill
                        value="TODOS" label="Todos" count={countTodos}
                        color={{ active: "bg-slate-800 text-white border-slate-800", badge: "bg-white/20 text-white" }}
                    />
                    <TipoOpPill
                        value="S" label="EXPO" count={countExpo} icon={ArrowUpRight}
                        color={{ active: "bg-orange-500 text-white border-orange-500", badge: "bg-white/20 text-white" }}
                    />
                    <TipoOpPill
                        value="I" label="IMPO" count={countImpo} icon={ArrowDownLeft}
                        color={{ active: "bg-indigo-600 text-white border-indigo-600", badge: "bg-white/20 text-white" }}
                    />
                </div>

                {/* ── Filtros secundarios ─────────────────────────── */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3">
                    <div className="flex items-center gap-3">
                        {/* Búsqueda libre */}
                        <input
                            type="text"
                            placeholder="Buscar BL, Shipper, Consignee..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F2A44] focus:border-[#0F2A44] outline-none"
                        />

                        <ComboSelect
                            value={viajeFilter === "TODOS" ? "" : viajeFilter}
                            onChange={v => setViajeFilter(v || "TODOS")}
                            options={[{ value: "", label: "Todos los viajes" }, ...viajes.map(v => ({ value: v, label: v }))]}
                            placeholder="Todos los viajes"
                        />

                        <ComboSelect
                            value={naveFilter === "TODOS" ? "" : naveFilter}
                            onChange={v => setNaveFilter(v || "TODOS")}
                            options={[{ value: "", label: "Todas las naves" }, ...naves.map(n => ({ value: n, label: n }))]}
                            placeholder="Todas las naves"
                        />

                        <ComboSelect
                            value={servicioFilter === "TODOS" ? "" : servicioFilter}
                            onChange={v => setServicioFilter(v || "TODOS")}
                            options={[{ value: "", label: "Todos los servicios" }, ...servicios.map(s => ({ value: s, label: s }))]}
                            placeholder="Todos los servicios"
                        />

                        <ComboSelect
                            value={polFilter === "TODOS" ? "" : polFilter}
                            onChange={v => setPolFilter(v || "TODOS")}
                            options={[{ value: "", label: "Todos los POL" }, ...regiones.map(r => ({ value: r, label: r }))]}
                            placeholder="Todos los POL"
                        />

                        {/* Botón limpiar — solo si hay filtros activos */}
                        {hayFiltrosActivos && (
                            <button
                                onClick={limpiarFiltros}
                                title="Limpiar filtros"
                                className="flex-shrink-0 p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Error ───────────────────────────────────────── */}
                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        Error al cargar: <span className="font-medium">{error}</span>
                    </div>
                )}

                {/* ── Contador + items por página ─────────────────── */}
                {!loading && (
                    <div className="flex items-center justify-between text-sm text-slate-600">
                        <span>
                            Mostrando{" "}
                            <span className="font-semibold">{Math.min(startIndex + 1, filteredBLs.length)}</span>
                            {" "}–{" "}
                            <span className="font-semibold">{Math.min(startIndex + itemsPerPage, filteredBLs.length)}</span>
                            {" "}de{" "}
                            <span className="font-semibold">{filteredBLs.length}</span> BL(s)
                            {hayFiltrosActivos && (
                                <span className="text-slate-400"> (filtrado de {bls.length} total)</span>
                            )}
                        </span>
                        <div className="flex items-center gap-2">
                            <label>Mostrar:</label>
                            <ComboSelect
                                value={String(itemsPerPage)}
                                onChange={v => setItemsPerPage(Number(v))}
                                options={[
                                    { value: "10", label: "10" },
                                    { value: "25", label: "25" },
                                    { value: "50", label: "50" },
                                    { value: "100", label: "100" },
                                ]}
                            />
                        </div>
                    </div>
                )}

                {/* ── Tabla ───────────────────────────────────────── */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center py-16 text-slate-400 text-sm">
                            Cargando BLs...
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-slate-600">
                                    <tr>
                                        <th className="text-left px-5 py-3 font-semibold">Tipo</th>
                                        <th className="text-left px-5 py-3 font-semibold">BL Number</th>
                                        <th className="text-left px-5 py-3 font-semibold">Viaje</th>
                                        <th className="text-left px-5 py-3 font-semibold">Shipper</th>
                                        <th className="text-left px-5 py-3 font-semibold">Consignee</th>
                                        <th className="text-left px-5 py-3 font-semibold">Origen → Destino</th>
                                        <th className="text-left px-5 py-3 font-semibold">F. Emisión</th>
                                        <th className="text-right px-5 py-3 font-semibold">Peso (KG)</th>
                                        <th className="text-center px-5 py-3 font-semibold">Bultos</th>
                                        <th className="text-left px-5 py-3 font-semibold">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentBLs.map(bl => (
                                        <tr
                                            key={bl.id}
                                            onClick={() => navigate(`/expo/${bl.bl_number}`)}
                                            className="border-t hover:bg-slate-50 cursor-pointer transition-colors"
                                        >
                                            <td className="px-5 py-3.5">
                                                {bl.tipo_operacion === "S" ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-700">
                                                        <ArrowUpRight size={11} /> EXPO
                                                    </span>
                                                ) : bl.tipo_operacion === "I" ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-700">
                                                        <ArrowDownLeft size={11} /> IMPO
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 text-xs">—</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5 font-medium text-[#0F2A44]">{bl.bl_number}</td>
                                            <td className="px-5 py-3.5">
                                                <span className="inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                                                    {bl.viaje || "—"}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 max-w-[160px] truncate text-slate-700" title={bl.shipper}>
                                                {bl.shipper || "—"}
                                            </td>
                                            <td className="px-5 py-3.5 max-w-[160px] truncate text-slate-700" title={bl.consignee}>
                                                {bl.consignee || "—"}
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-600">
                                                {bl.puerto_embarque || "—"} → {bl.puerto_descarga || "—"}
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-600">{formatDateCL(bl.fecha_emision)}</td>
                                            <td className="px-5 py-3.5 text-right font-medium">{formatNumber(bl.peso_bruto)}</td>
                                            <td className="px-5 py-3.5 text-center">{bl.bultos || 0}</td>
                                            <td className="px-5 py-3.5">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs ring-1 ${estadoStyles[bl.status] ?? "bg-slate-100 text-slate-600 ring-slate-200"}`}>
                                                    {bl.status || "—"}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}

                                    {filteredBLs.length === 0 && (
                                        <tr>
                                            <td colSpan={10} className="px-6 py-14 text-center text-slate-400">
                                                {hayFiltrosActivos
                                                    ? "No se encontraron BLs con los filtros aplicados"
                                                    : "No hay BLs registrados aún"}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* ── Paginación ──────────────────────────────────── */}
                {!loading && totalPages > 1 && (
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">
                            Página <span className="font-semibold">{currentPage}</span> de{" "}
                            <span className="font-semibold">{totalPages}</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                            <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}
                                className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                                ««
                            </button>
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                                className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                                ‹
                            </button>
                            {getPageNumbers().map((page, i) =>
                                page === "..." ? (
                                    <span key={`e-${i}`} className="px-2 text-slate-400">…</span>
                                ) : (
                                    <button key={page} onClick={() => setCurrentPage(page)}
                                        className={`px-3.5 py-2 text-sm rounded-lg border transition-colors ${currentPage === page
                                            ? "bg-[#0F2A44] text-white border-[#0F2A44]"
                                            : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                                            }`}>
                                        {page}
                                    </button>
                                )
                            )}
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                                className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                                ›
                            </button>
                            <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}
                                className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed">
                                »»
                            </button>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
};

export default ExpoBL;