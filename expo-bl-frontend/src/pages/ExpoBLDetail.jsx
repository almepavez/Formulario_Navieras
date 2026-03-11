import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { AlertCircle, Ship, AlertTriangle, RefreshCw } from "lucide-react";


const API_BASE = import.meta.env.VITE_API_URL;

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
    const [items, setItems] = useState([]);
    const [contenedores, setContenedores] = useState([]);
    const [transbordos, setTransbordos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [puertosNoRegistrados, setPuertosNoRegistrados] = useState([]);
    const [validaciones, setValidaciones] = useState([]);
    const [observaciones, setObservaciones] = useState([]);

    const fetchBLDetail = async () => {
        setLoading(true);
        setError("");
        try {
            // Fetch BL básico (AHORA revalida automáticamente en el backend)
            const res = await fetch(`${API_BASE}/api/bls/${blNumber}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setBl(data);

            // Fetch items y contenedores
            const resItems = await fetch(`${API_BASE}/api/bls/${blNumber}/items-contenedores`);
            if (resItems.ok) {
                const dataItems = await resItems.json();
                setItems(dataItems.items || []);
                setContenedores(dataItems.contenedores || []);
            }

            // Fetch transbordos
            const resTransbordos = await fetch(`${API_BASE}/api/bls/${blNumber}/transbordos`);
            if (resTransbordos.ok) {
                const dataTransbordos = await resTransbordos.json();
                setTransbordos(dataTransbordos || []);
            }
            const resObs = await fetch(`${API_BASE}/api/bls/${blNumber}/observaciones`);
            if (resObs.ok) {
                const dataObs = await resObs.json();
                setObservaciones(dataObs || []);
            }
            // Fetch validaciones (ya actualizadas por el backend)
            const resValidaciones = await fetch(`${API_BASE}/api/bls/${blNumber}/validaciones`);
            if (resValidaciones.ok) {
                const dataValidaciones = await resValidaciones.json();
                setValidaciones(dataValidaciones || []);
            }

            // Detectar puertos no registrados (de los códigos guardados)
            const puertosNulos = [];
            if (!data.lugar_emision_id && data.lugar_emision_cod) {
                puertosNulos.push({ tipo: "Lugar Emisión", codigo: data.lugar_emision_cod });
            }
            if (!data.puerto_embarque_id && data.puerto_embarque_cod) {
                puertosNulos.push({ tipo: "Puerto Embarque", codigo: data.puerto_embarque_cod });
            }
            if (!data.puerto_descarga_id && data.puerto_descarga_cod) {
                puertosNulos.push({ tipo: "Puerto Descarga", codigo: data.puerto_descarga_cod });
            }

            setPuertosNoRegistrados(puertosNulos);
        } catch (e) {
            setError(e?.message || "Error desconocido");
            setBl(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (blNumber) {
            fetchBLDetail();
        }
    }, [blNumber]);

    const getValidacionTransbordo = (sec) => {
        return validaciones.find(v =>
            v.nivel === "TRANSBORDO" &&
            v.campo === "puerto_id" &&
            v.sec === sec
        );
    };

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
                        onClick={() => navigate("/expo-bl")}
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
                                onClick={() => navigate("/expo-bl")}
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

                            {/* 🆕 Botón para recargar validaciones */}
                            <button
                                onClick={fetchBLDetail}
                                className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-300 transition-colors flex items-center gap-2"
                                title="Recargar validaciones"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Actualizar
                            </button>

                            <button
                                onClick={() => {
                                    // Si es carga suelta (BB), va a edición de carga suelta
                                    if (bl.tipo_servicio_codigo === 'BB' || bl.tipo_servicio === 'BB') {
                                        navigate(`/expo/${bl.bl_number}/carga-suelta/edit`);
                                    } else {
                                        // Si es con contenedores, va a edición normal
                                        navigate(`/expo/${bl.bl_number}/edit`);
                                    }
                                }}
                                className="px-6 py-2 rounded-lg bg-[#0F2A44] text-white text-sm font-medium hover:bg-[#1a3a5e] transition-colors"
                            >
                                Editar BL
                            </button>
                        </div>
                    </div>
                </div>

                {/* Alerta de puertos no registrados */}
                {puertosNoRegistrados.length > 0 && (
                    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <h3 className="text-sm font-semibold text-amber-800 mb-2">
                                    Puertos no registrados en el sistema
                                </h3>
                                <div className="space-y-1 mb-3">
                                    {puertosNoRegistrados.map((p, idx) => (
                                        <p key={idx} className="text-sm text-amber-700">
                                            • <strong>{p.tipo}:</strong> {p.codigo}
                                        </p>
                                    ))}
                                </div>
                                <p className="text-sm text-amber-700">
                                    Para que estos puertos aparezcan correctamente, debes registrarlos en:{" "}
                                    <button
                                        onClick={() => navigate("/mantenedores/puertos")}
                                        className="font-semibold underline hover:text-amber-900"
                                    >
                                        Mantenedores → Puertos
                                    </button>
                                </p>
                            </div>
                        </div>
                    </div>
                )}

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
                            <p className="text-sm font-medium text-slate-900">
                                {bl.tipo_servicio_codigo || bl.tipo_servicio || "—"}
                            </p>
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
                        {bl.fecha_recepcion_bl && (
                            <div>
                                <p className="text-xs text-slate-500 mb-1">Fecha Recepción BL</p>
                                <p className="text-sm font-medium text-slate-900">
                                    {formatDateCL(bl.fecha_recepcion_bl)}
                                </p>
                            </div>
                        )}
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
                    <h2 className="text-lg font-semibold text-[#0F2A44] mb-4">Puertos y Rutas</h2>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <p className="text-xs text-slate-500 mb-1">Lugar Emisión</p>
                            {bl.lugar_emision_cod
                                ? [bl.lugar_emision_cod, bl.lugar_emision_nombre].filter(Boolean).join(" — ")
                                : "—"}                        </div>
                        <div>
                            <p className="text-xs text-slate-500 mb-1">Puerto Embarque</p>
                            {bl.puerto_embarque_cod
                                ? [bl.puerto_embarque_cod, bl.puerto_embarque_nombre].filter(Boolean).join(" — ")
                                : "—"}                        </div>
                        <div>
                            <p className="text-xs text-slate-500 mb-1">Puerto Descarga</p>
                            {bl.puerto_descarga_cod
                                ? [bl.puerto_descarga_cod, bl.puerto_descarga_nombre].filter(Boolean).join(" — ")
                                : "—"}                        </div>
                        <div>
                            <p className="text-xs text-slate-500 mb-1">Lugar Destino</p>
                            {bl.lugar_destino_cod
                                ? [bl.lugar_destino_cod, bl.lugar_destino_nombre].filter(Boolean).join(" — ")
                                : "—"}                        </div>
                        <div>
                            <p className="text-xs text-slate-500 mb-1">Lugar Entrega</p>
                            {bl.lugar_entrega_cod
                                ? [bl.lugar_entrega_cod, bl.lugar_entrega_nombre].filter(Boolean).join(" — ")
                                : "—"}                        </div>
                        <div>
                            <p className="text-xs text-slate-500 mb-1">Lugar Recepción</p>
                            {bl.lugar_recepcion_cod
                                ? [bl.lugar_recepcion_cod, bl.lugar_recepcion_nombre].filter(Boolean).join(" — ")
                                : "—"}                        </div>
                    </div>
                </div>

                {/* Transbordos CON VALIDACIONES */}
                {transbordos.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Ship className="w-5 h-5 text-[#0F2A44]" />
                            <h2 className="text-lg font-semibold text-[#0F2A44]">
                                Transbordos ({transbordos.length})
                            </h2>
                        </div>

                        <div className="space-y-3">
                            {transbordos.map((tb, idx) => {
                                const validacion = getValidacionTransbordo(tb.sec);
                                const tieneError = !!validacion;

                                return (
                                    <div
                                        key={tb.id}
                                        className={`flex items-center gap-4 p-4 rounded-lg border transition-all ${tieneError
                                            ? 'bg-orange-50 border-orange-300 ring-2 ring-orange-200'
                                            : 'bg-slate-50 border-slate-200'
                                            }`}
                                    >
                                        <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${tieneError
                                            ? 'bg-orange-500 text-white'
                                            : 'bg-[#0F2A44] text-white'
                                            }`}>
                                            {idx + 1}
                                        </div>

                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-slate-900">
                                                {tb.puerto_nombre || tb.puerto_cod}
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                Código: {tb.puerto_cod}
                                            </p>

                                            {validacion && (
                                                <div className="mt-2 flex items-start gap-2">
                                                    <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                                                    <p className="text-xs text-orange-700 font-medium">
                                                        {validacion.mensaje}
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {tieneError ? (
                                            <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-800 text-xs font-medium border border-orange-200">
                                                No registrado
                                            </span>
                                        ) : (
                                            <span className="px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs font-medium border border-green-200">
                                                Registrado
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Ruta completa */}
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <p className="text-xs text-blue-700">
                                <strong>Ruta completa:</strong> {bl.puerto_embarque_cod || bl.puerto_embarque || "—"} → {transbordos.map(t => t.puerto_cod).join(" → ")} → {bl.puerto_descarga_cod || bl.puerto_descarga || "—"}
                            </p>
                        </div>
                    </div>
                )}
                {observaciones.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                        <h2 className="text-lg font-semibold text-[#0F2A44] mb-4">
                            Observaciones ({observaciones.length})
                        </h2>
                        <div className="space-y-2">
                            {observaciones.map((obs, idx) => (
                                <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                    <span className="inline-flex items-center px-2 py-1 rounded bg-[#0F2A44] text-white text-xs font-bold flex-shrink-0">
                                        {obs.nombre}
                                    </span>
                                    <p className="text-sm text-slate-700">{obs.contenido}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Resto del componente (Carga, Items, Contenedores, Metadatos) sin cambios */}
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

                {/* Items y Contenedores (sin cambios) */}
                {items.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                        <h2 className="text-lg font-semibold text-[#0F2A44] mb-4">
                            Ítems del BL ({items.length})
                        </h2>

                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Item</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Descripción</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Marcas</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Contenedores</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tipo Bulto</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Cantidad</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Peso</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Volumen</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Peligrosa</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-200">
                                    {items.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 text-sm font-medium text-slate-900">
                                                {item.numero_item}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-600 max-w-md">
                                                <div className="line-clamp-2" title={item.descripcion}>
                                                    {item.descripcion || "—"}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-600 max-w-xs">
                                                <div className="line-clamp-1" title={item.marcas}>
                                                    {item.marcas || "—"}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                {item.contenedores && item.contenedores.length > 0 ? (
                                                    <div className="flex flex-col gap-1">
                                                        {item.contenedores.map((cont, idx) => (
                                                            <span
                                                                key={idx}
                                                                className="inline-flex items-center px-2 py-1 rounded bg-indigo-100 text-indigo-800 text-xs font-mono font-medium"
                                                                title={`Tipo: ${cont.tipo_cnt || 'N/A'}`}
                                                            >
                                                                {cont.codigo}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 text-xs">Sin contenedores</span>
                                                )}
                                            </td>

                                            <td className="px-4 py-3 text-sm text-slate-900">
                                                {item.tipo_bulto || "—"}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-900">
                                                {item.cantidad || "—"}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-900">
                                                {formatNumber(item.peso_bruto)} {item.unidad_peso || ""}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-900">
                                                {formatNumber(item.volumen)} {item.unidad_volumen || ""}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${item.carga_peligrosa === 'S'
                                                    ? 'bg-red-100 text-red-800'
                                                    : 'bg-green-100 text-green-800'
                                                    }`}>
                                                    {item.carga_peligrosa === 'S' ? 'Sí' : 'No'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {contenedores.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                        <h2 className="text-lg font-semibold text-[#0F2A44] mb-4">
                            Contenedores ({contenedores.length})
                        </h2>

                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-200">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Código</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tipo</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">SOC</th> 
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Peso</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Volumen</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Sellos</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">IMO</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-200">
                                    {contenedores.map((cont) => (
                                        <tr key={cont.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 text-sm font-mono font-medium text-slate-900">
                                                {cont.es_soc ? "—" : cont.codigo}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-900">
                                                {cont.tipo_cnt || "—"}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-900">
                                                {cont.es_soc ? (
                                                    <div>
                                                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold border border-amber-200">
                                                            SOC
                                                        </span>
                                                        {cont.cnt_so_numero && (
                                                            <p className="text-xs text-slate-500 mt-1 font-mono">{cont.cnt_so_numero}</p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-300 text-xs">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-900">
                                                {formatNumber(cont.peso)} {cont.unidad_peso || ""}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-900">
                                                {formatNumber(cont.volumen)} {cont.unidad_volumen || ""}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-600">
                                                {(() => {
                                                    const sellosArray = Array.isArray(cont.sellos)
                                                        ? cont.sellos
                                                        : (cont.sellos || '').split(',').filter(s => s.trim());

                                                    return sellosArray.length > 0
                                                        ? sellosArray.map((sello, i) => (
                                                            <span
                                                                key={i}
                                                                className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs mr-1 mb-1"
                                                            >
                                                                {sello}
                                                            </span>
                                                        ))
                                                        : <span className="text-slate-400 italic">Sin sellos</span>;
                                                })()}
                                            </td>
                                            <td className="px-4 py-3 text-sm text-slate-600">
                                                {cont.carga_cnt === 'S' ? (
                                                    (() => {
                                                        const imosArray = cont.imos || [];

                                                        return imosArray.length > 0
                                                            ? imosArray.map((imo, i) => (
                                                                <div
                                                                    key={i}
                                                                    className="inline-block px-2 py-1 bg-orange-100 text-orange-800 rounded text-xs mr-1 mb-1 font-mono"
                                                                >
                                                                    {imo.clase}/{imo.numero}
                                                                </div>
                                                            ))
                                                            : <span className="text-amber-600 text-xs font-medium">Sin IMO</span>;
                                                    })()
                                                ) : (
                                                    <span className="text-slate-400 italic text-xs">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

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