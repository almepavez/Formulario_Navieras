import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { Pencil, Edit3 } from "lucide-react"; // ← Agregado Edit3

const estadoStyles = {
    "CREADO": "bg-blue-100 text-blue-800 ring-blue-200",
    "VALIDADO": "bg-green-100 text-green-800 ring-green-200",
    "ENVIADO": "bg-purple-100 text-purple-800 ring-purple-200",
    "ANULADO": "bg-red-100 text-red-800 ring-red-200",
    "ACTIVO": "bg-emerald-100 text-emerald-800 ring-emerald-200",
    "INACTIVO": "bg-slate-100 text-slate-800 ring-slate-200",
};

// Formatear fecha
const formatDateCL = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${dd}-${mm}-${yyyy}`;
};

// Formatear número con separadores
const formatNumber = (num) => {
    if (!num) return "—";
    return new Intl.NumberFormat('es-CL', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 3
    }).format(num);
};

const ExpoBL = () => {
    const navigate = useNavigate();
    const [bls, setBls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Filtros
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("TODOS");
    const [viajeFilter, setViajeFilter] = useState("TODOS");

    // Paginación
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const fetchBLs = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("http://localhost:4000/bls");
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

    useEffect(() => {
        fetchBLs();
    }, []);

    // Obtener viajes únicos
    const viajes = [...new Set(bls.map(bl => bl.viaje).filter(Boolean))].sort();

    // Filtrar BLs
    const filteredBLs = bls.filter(bl => {
        const matchesSearch =
            (bl.bl_number || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (bl.shipper || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (bl.consignee || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
            (bl.descripcion_carga || "").toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === "TODOS" || bl.status === statusFilter;
        const matchesViaje = viajeFilter === "TODOS" || bl.viaje === viajeFilter;

        return matchesSearch && matchesStatus && matchesViaje;
    });

    // Calcular paginación
    const totalPages = Math.ceil(filteredBLs.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentBLs = filteredBLs.slice(startIndex, endIndex);

    // Resetear página cuando cambien los filtros
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, statusFilter, viajeFilter, itemsPerPage]);

    // Generar números de página con ellipsis
    const getPageNumbers = () => {
        const pages = [];
        const maxVisible = 5;

        if (totalPages <= maxVisible) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            if (currentPage <= 3) {
                for (let i = 1; i <= 5; i++) pages.push(i);
                pages.push('...');
                pages.push(totalPages);
            } else if (currentPage >= totalPages - 2) {
                pages.push(1);
                pages.push('...');
                for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
            } else {
                pages.push(1);
                pages.push('...');
                for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
                pages.push('...');
                pages.push(totalPages);
            }
        }

        return pages;
    };

    const handleEdit = (e, blNumber) => {
        e.stopPropagation();
        navigate(`/expo/${blNumber}/edit`);
    };

    return (
        <div className="flex min-h-screen bg-slate-100">
            <Sidebar />

            <main className="flex-1 p-6 lg:p-10">
                {/* Header + Filtros */}
                <div className="mb-6">
                    <div className="flex items-start justify-between gap-6 mb-4">
                        <div>
                            <h1 className="text-2xl font-semibold text-[#0F2A44]">
                                EXPO BL
                            </h1>
                            <p className="text-sm text-slate-500 mt-1">
                                Gestión de Bills of Lading de exportación
                            </p>
                        </div>

                        {/* Botones de acción */}
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => navigate("/expo/bulk-edit")}
                                className="px-4 py-2 rounded-lg bg-[#0F2A44] text-white text-sm font-medium hover:bg-[#1a3a5c] flex items-center gap-2 transition-colors"
                                title="Edición Masiva"
                            >
                                <Edit3 className="w-4 h-4" />
                                Editar Varios BLs
                            </button>
                            <button
                                onClick={fetchBLs}
                                className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
                                title="Actualizar"
                            >
                                Actualizar
                            </button>
                        </div>
                    </div>

                    {/* Barra de filtros */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Búsqueda */}
                            <div className="md:col-span-1">
                                <input
                                    type="text"
                                    placeholder="Buscar BL, Shipper, Consignee..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full px-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F2A44] focus:border-[#0F2A44]"
                                />
                            </div>

                            {/* Filtro Viaje */}
                            <div>
                                <select
                                    value={viajeFilter}
                                    onChange={(e) => setViajeFilter(e.target.value)}
                                    className="w-full px-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F2A44] focus:border-[#0F2A44]"
                                >
                                    <option value="TODOS">Todos los viajes</option>
                                    {viajes.map(viaje => (
                                        <option key={viaje} value={viaje}>{viaje}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Filtro Status */}
                            <div>
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="w-full px-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F2A44] focus:border-[#0F2A44]"
                                >
                                    <option value="TODOS">Todos los estados</option>
                                    <option value="CREADO">Creado</option>
                                    <option value="VALIDADO">Validado</option>
                                    <option value="ENVIADO">Enviado</option>
                                    <option value="ANULADO">Anulado</option>
                                    <option value="ACTIVO">Activo</option>
                                    <option value="INACTIVO">Inactivo</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Estado carga/error */}
                {loading && (
                    <div className="text-sm text-slate-600 mb-4">Cargando BLs...</div>
                )}

                {error && (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        Error al cargar: <span className="font-medium">{error}</span>
                    </div>
                )}

                {/* Contador + Selector de items por página */}
                {!loading && (
                    <div className="mb-4 flex items-center justify-between">
                        <div className="text-sm text-slate-600">
                            Mostrando <span className="font-semibold">{startIndex + 1}</span> a{" "}
                            <span className="font-semibold">{Math.min(endIndex, filteredBLs.length)}</span> de{" "}
                            <span className="font-semibold">{filteredBLs.length}</span> BL(s)
                        </div>

                        <div className="flex items-center gap-2">
                            <label className="text-sm text-slate-600">Mostrar:</label>
                            <select
                                value={itemsPerPage}
                                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                                className="px-3 py-1 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F2A44] focus:border-[#0F2A44]"
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                    </div>
                )}

                {/* Tabla */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-slate-600">
                                <tr>
                                    <th className="text-left px-6 py-3 font-semibold">BL Number</th>
                                    <th className="text-left px-6 py-3 font-semibold">Viaje</th>
                                    <th className="text-left px-6 py-3 font-semibold">Shipper</th>
                                    <th className="text-left px-6 py-3 font-semibold">Consignee</th>
                                    <th className="text-left px-6 py-3 font-semibold">Origen → Destino</th>
                                    <th className="text-left px-6 py-3 font-semibold">Fecha Emisión</th>
                                    <th className="text-right px-6 py-3 font-semibold">Peso (KG)</th>
                                    <th className="text-center px-6 py-3 font-semibold">Bultos</th>
                                    <th className="text-left px-6 py-3 font-semibold">Status</th>
                                </tr>
                            </thead>

                            <tbody>
                                {!loading &&
                                    currentBLs.map((bl) => (
                                        <tr
                                            key={bl.id}
                                            onClick={() => navigate(`/expo/${bl.bl_number}`)}
                                            className="border-t hover:bg-slate-50 cursor-pointer transition-colors"
                                        >
                                            <td className="px-6 py-4 font-medium text-[#0F2A44]">
                                                {bl.bl_number}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                                                    {bl.viaje || "—"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 max-w-xs truncate" title={bl.shipper}>
                                                {bl.shipper || "—"}
                                            </td>
                                            <td className="px-6 py-4 max-w-xs truncate" title={bl.consignee}>
                                                {bl.consignee || "—"}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-slate-700">
                                                    {bl.puerto_embarque || "—"} → {bl.puerto_descarga || "—"}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {formatDateCL(bl.fecha_emision)}
                                            </td>
                                            <td className="px-6 py-4 text-right font-medium">
                                                {formatNumber(bl.peso_bruto)}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {bl.bultos || 0}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span
                                                    className={[
                                                        "inline-flex items-center px-3 py-1 rounded-full text-xs ring-1",
                                                        estadoStyles[bl.status] ??
                                                        "bg-slate-100 text-slate-700 ring-slate-200",
                                                    ].join(" ")}
                                                >
                                                    {bl.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}

                                {!loading && filteredBLs.length === 0 && (
                                    <tr>
                                        <td className="px-6 py-10 text-center text-slate-500" colSpan={9}>
                                            {searchTerm || statusFilter !== "TODOS" || viajeFilter !== "TODOS"
                                                ? "No se encontraron BLs con los filtros aplicados"
                                                : "No hay BLs registrados aún"}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Controles de paginación */}
                {!loading && totalPages > 1 && (
                    <div className="mt-6 flex items-center justify-between">
                        <div className="text-sm text-slate-600">
                            Página <span className="font-semibold">{currentPage}</span> de{" "}
                            <span className="font-semibold">{totalPages}</span>
                        </div>

                        <div className="flex items-center gap-2">
                            {/* Botón Primera Página */}
                            <button
                                onClick={() => setCurrentPage(1)}
                                disabled={currentPage === 1}
                                className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Primera página"
                            >
                                ««
                            </button>

                            {/* Botón Anterior */}
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Página anterior"
                            >
                                ‹
                            </button>

                            {/* Números de página */}
                            {getPageNumbers().map((page, index) => (
                                page === '...' ? (
                                    <span key={`ellipsis-${index}`} className="px-2 text-slate-500">
                                        ...
                                    </span>
                                ) : (
                                    <button
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        className={[
                                            "px-4 py-2 text-sm rounded-lg border transition-colors",
                                            currentPage === page
                                                ? "bg-[#0F2A44] text-white border-[#0F2A44]"
                                                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                                        ].join(" ")}
                                    >
                                        {page}
                                    </button>
                                )
                            ))}

                            {/* Botón Siguiente */}
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Página siguiente"
                            >
                                ›
                            </button>

                            {/* Botón Última Página */}
                            <button
                                onClick={() => setCurrentPage(totalPages)}
                                disabled={currentPage === totalPages}
                                className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Última página"
                            >
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