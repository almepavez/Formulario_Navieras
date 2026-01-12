import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";

const estadoStyles = {
    "CREADO": "bg-blue-100 text-blue-800 ring-blue-200",
    "VALIDADO": "bg-green-100 text-green-800 ring-green-200",
    "ENVIADO": "bg-purple-100 text-purple-800 ring-purple-200",
    "ANULADO": "bg-red-100 text-red-800 ring-red-200",
};

const formatDateCL = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${dd}-${mm}-${yyyy}`;
};

const formatNumber = (num) => {
    if (!num) return "—";
    return new Intl.NumberFormat('es-CL', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 3
    }).format(num);
};

const ExpoBLDetail = () => {
    const { blNumber } = useParams();
    const navigate = useNavigate();
    const [bl, setBl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const fetchBLDetail = async () => {
            setLoading(true);
            setError("");
            try {
                const res = await fetch(`http://localhost:4000/bls/${blNumber}`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                setBl(data);
            } catch (e) {
                setError(e?.message || "Error desconocido");
                setBl(null);
            } finally {
                setLoading(false);
            }
        };

        if (blNumber) {
            fetchBLDetail();
        }
    }, [blNumber]);

    if (loading) {
        return (
            <div className="flex min-h-screen bg-slate-100">
                <Sidebar />
                <main className="flex-1 p-10">
                    <div className="text-sm text-slate-600">Cargando detalle del BL...</div>
                </main>
            </div>
        );
    }

    if (error || !bl) {
        return (
            <div className="flex min-h-screen bg-slate-100">
                <Sidebar />
                <main className="flex-1 p-10">
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        Error: <span className="font-medium">{error || "BL no encontrado"}</span>
                    </div>
                    <button
                        onClick={() => navigate("/expo")}
                        className="text-sm text-slate-500 hover:text-[#0F2A44]"
                    >
                        ← Volver al listado
                    </button>
                </main>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-slate-100">
            <Sidebar />

            <main className="flex-1 p-10">
                {/* Header */}
                <div className="mb-6">
                    <div className="flex items-start justify-between gap-6 mb-4">
                        <div>
                            <button
                                onClick={() => navigate("/expo")}
                                className="text-sm text-slate-500 hover:text-[#0F2A44] mb-2"
                            >
                                ← Volver al listado
                            </button>
                            <h1 className="text-2xl font-semibold text-[#0F2A44]">
                                Detalle BL: {bl.bl_number}
                            </h1>
                            <p className="text-sm text-slate-500 mt-1">
                                Viaje: <strong>{bl.viaje || "—"}</strong>
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <span
                                className={[
                                    "inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ring-1",
                                    estadoStyles[bl.status] ?? "bg-slate-100 text-slate-700 ring-slate-200",
                                ].join(" ")}
                            >
                                {bl.status}
                            </span>

                            <button
                                onClick={() => navigate(`/expo/${bl.bl_number}/edit`)}
                                className="px-6 py-2 rounded-lg bg-[#0F2A44] text-white text-sm font-medium hover:bg-[#1a3a5e] transition-colors"
                            >
                                Editar BL
                            </button>
                        </div>
                    </div>
                </div>

                {/* Información General */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <h2 className="text-lg font-semibold text-[#0F2A44] mb-4">
                        Información General
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div>
                            <p className="text-xs text-slate-500 mb-1">BL Number</p>
                            <p className="text-sm font-medium text-slate-900">{bl.bl_number}</p>
                        </div>

                        <div>
                            <p className="text-xs text-slate-500 mb-1">Viaje</p>
                            <p className="text-sm font-medium text-slate-900">{bl.viaje || "—"}</p>
                        </div>

                        <div>
                            <p className="text-xs text-slate-500 mb-1">Tipo de Servicio</p>
                            <p className="text-sm font-medium text-slate-900">{bl.tipo_servicio_id || "—"}</p>
                        </div>

                        <div>
                            <p className="text-xs text-slate-500 mb-1">Fecha Emisión</p>
                            <p className="text-sm font-medium text-slate-900">{formatDateCL(bl.fecha_emision)}</p>
                        </div>

                        <div>
                            <p className="text-xs text-slate-500 mb-1">Fecha Zarpe</p>
                            <p className="text-sm font-medium text-slate-900">{formatDateCL(bl.fecha_zarpe)}</p>
                        </div>

                        <div>
                            <p className="text-xs text-slate-500 mb-1">Estado</p>
                            <p className="text-sm font-medium text-slate-900">{bl.status}</p>
                        </div>
                    </div>
                </div>

                {/* Participantes */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <h2 className="text-lg font-semibold text-[#0F2A44] mb-4">
                        Participantes
                    </h2>

                    <div className="space-y-6">
                        <div>
                            <p className="text-xs font-semibold text-slate-600 mb-2">Shipper</p>
                            <p className="text-sm text-slate-900">{bl.shipper || "—"}</p>
                        </div>

                        <div>
                            <p className="text-xs font-semibold text-slate-600 mb-2">Consignee</p>
                            <p className="text-sm text-slate-900">{bl.consignee || "—"}</p>
                        </div>

                        <div>
                            <p className="text-xs font-semibold text-slate-600 mb-2">Notify Party</p>
                            <p className="text-sm text-slate-900">{bl.notify_party || "—"}</p>
                        </div>
                    </div>
                </div>

                {/* Puertos y Rutas */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <h2 className="text-lg font-semibold text-[#0F2A44] mb-4">
                        Puertos y Rutas
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <p className="text-xs text-slate-500 mb-1">Puerto Origen</p>
                            <p className="text-sm font-medium text-slate-900">{bl.puerto_origen || "—"}</p>
                        </div>

                        <div>
                            <p className="text-xs text-slate-500 mb-1">Puerto Destino</p>
                            <p className="text-sm font-medium text-slate-900">{bl.puerto_destino || "—"}</p>
                        </div>
                    </div>
                </div>

                {/* Carga */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <h2 className="text-lg font-semibold text-[#0F2A44] mb-4">
                        Detalles de Carga
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div>
                            <p className="text-xs text-slate-500 mb-1">Peso Bruto</p>
                            <p className="text-sm font-medium text-slate-900">
                                {formatNumber(bl.peso_bruto)} {bl.unidad_peso || "KGM"}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs text-slate-500 mb-1">Volumen</p>
                            <p className="text-sm font-medium text-slate-900">
                                {formatNumber(bl.volumen)} {bl.unidad_volumen || "MTQ"}
                            </p>
                        </div>

                        <div>
                            <p className="text-xs text-slate-500 mb-1">Bultos</p>
                            <p className="text-sm font-medium text-slate-900">{bl.bultos || 0}</p>
                        </div>

                        <div>
                            <p className="text-xs text-slate-500 mb-1">Total Items</p>
                            <p className="text-sm font-medium text-slate-900">{bl.total_items || 0}</p>
                        </div>
                    </div>

                    <div className="mt-6">
                        <p className="text-xs text-slate-500 mb-2">Descripción de Carga</p>
                        <p className="text-sm text-slate-900 bg-slate-50 rounded-lg p-4 font-mono text-xs">
                            {bl.descripcion_carga || "Sin descripción"}
                        </p>
                    </div>
                </div>

                {/* Metadatos */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h2 className="text-lg font-semibold text-[#0F2A44] mb-4">
                        Información del Sistema
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-600">
                        <div>
                            <p className="mb-1">Creado:</p>
                            <p className="font-medium">{formatDateCL(bl.created_at)}</p>
                        </div>

                        <div>
                            <p className="mb-1">Última actualización:</p>
                            <p className="font-medium">{formatDateCL(bl.updated_at)}</p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default ExpoBLDetail;