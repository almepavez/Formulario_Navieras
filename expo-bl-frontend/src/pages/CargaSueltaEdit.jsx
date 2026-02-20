import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Swal from "sweetalert2";

const STEPS = [
    { id: 1, name: "Datos BL" },
    { id: 2, name: "Shipper/Consignee" },
    { id: 3, name: "Items de Carga" },
    { id: 4, name: "Revisión" }
];

const API_BASE = "http://localhost:4000";

const TIPOS_BULTO = [
    { value: "80", label: "80 - Pallets/Tarimas" },
    { value: "73", label: "73 - Cajas/Boxes" },
    { value: "76", label: "76 - Cartones/Cartons" },
    { value: "78", label: "78 - Sacos/Bags" },
    { value: "79", label: "79 - Tambores/Drums" },
    { value: "70", label: "70 - Bultos/Packages" },
    { value: "75", label: "75 - Envases/Packages" }
];

const UNIDADES_PESO = [
    { value: "KGM", label: "KGM - Kilogramos" },
    { value: "TNE", label: "TNE - Toneladas" },
    { value: "LBR", label: "LBR - Libras" }
];

const UNIDADES_VOLUMEN = [
    { value: "MTQ", label: "MTQ - Metros cúbicos" },
    { value: "FTQ", label: "FTQ - Pies cúbicos" },
    { value: "LTR", label: "LTR - Litros" }
];

// ==================== ALMACENADOR SELECTOR ====================
const AlmacenadorSelector = ({ value, displayValue, onChange, onClear }) => {
    const [query, setQuery] = useState(displayValue || "");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState(!!value);
    const containerRef = useRef(null);

    useEffect(() => {
        setQuery(displayValue || "");
        setSelected(!!value);
    }, [value, displayValue]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const search = async (q) => {
        if (q.trim().length < 2) {
            setResults([]);
            setOpen(false);
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/mantenedores/participantes?tipo=almacenador&q=${encodeURIComponent(q)}`);
            const data = await res.json();
            setResults(data || []);
            setOpen(true);
        } catch (e) {
            console.error("Error buscando almacenadores:", e);
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    const handleInput = (e) => {
        const val = e.target.value;
        setQuery(val);
        setSelected(false);
        search(val);
    };

    const handleSelect = (item) => {
        setQuery(item.nombre);
        setSelected(true);
        setOpen(false);
        setResults([]);
        onChange(item.id, item.nombre, {
            direccion: item.direccion || "",
            telefono: item.telefono || "",
            email: item.email || "",
            codigo_pil: item.codigo_pil || "",
        });
    };

    const handleClear = () => {
        setQuery("");
        setSelected(false);
        setResults([]);
        setOpen(false);
        onClear();
    };

    return (
        <div ref={containerRef} className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-2">
                Nombre / Razón Social{" "}
                <span className="text-xs text-slate-400 font-normal">(buscar en mantenedor)</span>
            </label>
            <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    {/* Search icon */}
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" />
                    </svg>
                </div>
                <input
                    type="text"
                    value={query}
                    onChange={handleInput}
                    onFocus={() => query.length >= 2 && !selected && setOpen(true)}
                    placeholder="Escribe para buscar almacenador..."
                    className={`w-full pl-10 pr-10 py-2 rounded-lg border focus:ring-2 focus:outline-none transition-colors ${selected
                        ? "border-emerald-400 bg-emerald-50 focus:ring-emerald-300"
                        : "border-slate-300 focus:ring-slate-400"
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
                    <button
                        type="button"
                        onClick={handleClear}
                        className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-red-500 transition-colors"
                    >
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
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                    {results.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelect(item)}
                            className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-slate-900 text-sm truncate">{item.nombre}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">{item.ciudad || "—"}</p>
                                    {item.codigo_bms && (
                                        <p className="text-xs text-slate-400">BMS: {item.codigo_bms}</p>
                                    )}
                                </div>
                                {item.codigo_almacen && (
                                    <span className="flex-shrink-0 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-mono rounded">
                                        ALM: {item.codigo_almacen}
                                    </span>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {open && !loading && results.length === 0 && query.length >= 2 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg px-4 py-3 text-sm text-slate-500">
                    No se encontraron almacenadores con ese nombre
                </div>
            )}
        </div>
    );
};

// ==================== MAIN COMPONENT ====================
const CargaSueltaEdit = () => {
    const { blNumber } = useParams();
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(1);
    const [manifiestoData, setManifiestoData] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);

    const [puertos, setPuertos] = useState([]);
    const [tiposBulto] = useState(TIPOS_BULTO);

    const [formData, setFormData] = useState({
        bl_number: "",
        tipo_servicio: "BB",
        forma_pago_flete: "PREPAID",
        cond_transporte: "HH",
        fecha_emision: "",
        fecha_presentacion: "",
        fecha_embarque: "",
        fecha_zarpe: "",
        lugar_emision: "",
        lugar_recepcion: "",
        puerto_embarque: "",
        puerto_descarga: "",
        lugar_destino: "",
        lugar_entrega: "",

        shipper: "",
        consignee: "",
        notify_party: "",
        almacenador: "",
        // 🆕 almacenador_id para el selector
        almacenador_id: null,

        shipper_codigo_pil: "",
        shipper_direccion: "",
        shipper_telefono: "",
        shipper_email: "",

        consignee_codigo_pil: "",
        consignee_direccion: "",
        consignee_telefono: "",
        consignee_email: "",

        notify_codigo_pil: "",
        notify_direccion: "",
        notify_telefono: "",
        notify_email: "",

        almacenador_codigo_pil: "",
        almacenador_direccion: "",
        almacenador_telefono: "",
        almacenador_email: "",

        items: [],
        observaciones: [
            { nombre: 'GRAL', contenido: '' },
            { nombre: 'MOT', contenido: 'LISTA DE ENCARGO' }
        ]
    });

    useEffect(() => {
        fetchBLData();
        fetchPuertos();
    }, [blNumber]);

    const fetchBLData = async () => {
        try {
            setLoading(true);

            const res = await fetch(`${API_BASE}/bls/${blNumber}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const bl = await res.json();

            if (bl.tipo_servicio_codigo !== 'BB' && bl.tipo_servicio !== 'BB') {
                Swal.fire({
                    title: "Error",
                    text: "Este BL no es de carga suelta (tipo BB)",
                    icon: "error",
                    confirmButtonColor: "#10b981"
                });
                navigate(`/expo-bl/${blNumber}`);
                return;
            }

            const resItems = await fetch(`${API_BASE}/bls/${blNumber}/items-contenedores`);
            if (!resItems.ok) throw new Error(`HTTP ${resItems.status}`);
            const dataItems = await resItems.json();

            let observacionesParsed = [
                { nombre: 'GRAL', contenido: '' },
                { nombre: 'MOT', contenido: 'LISTA DE ENCARGO' }
            ];
            if (bl.observaciones) {
                if (typeof bl.observaciones === 'string') {
                    try {
                        observacionesParsed = JSON.parse(bl.observaciones);
                    } catch (e) {
                        console.error('Error parseando observaciones:', e);
                    }
                } else if (Array.isArray(bl.observaciones)) {
                    observacionesParsed = bl.observaciones;
                }
            }

            setFormData({
                bl_number: bl.bl_number || "",
                tipo_servicio: "BB",
                forma_pago_flete: bl.forma_pago_flete || "PREPAID",
                cond_transporte: bl.cond_transporte || "HH",
                fecha_emision: bl.fecha_emision ? bl.fecha_emision.split('T')[0] : "",
                fecha_presentacion: bl.fecha_presentacion ? bl.fecha_presentacion.split('T')[0] : "",
                fecha_embarque: bl.fecha_embarque ? bl.fecha_embarque.split('T')[0] : "",
                fecha_zarpe: bl.fecha_zarpe ? bl.fecha_zarpe.split('T')[0] : "",

                lugar_emision: (bl.lugar_emision_cod && bl.lugar_emision_cod !== 'NO ESPECIFICADO')
                    ? bl.lugar_emision_cod
                    : (bl.puerto_embarque_cod || ""),
                lugar_recepcion: (bl.lugar_recepcion_cod && bl.lugar_recepcion_cod !== 'NO ESPECIFICADO')
                    ? bl.lugar_recepcion_cod
                    : (bl.puerto_embarque_cod || ""),
                puerto_embarque: bl.puerto_embarque_cod || "",
                puerto_descarga: bl.puerto_descarga_cod || "",
                lugar_destino: bl.lugar_destino_cod || "",
                lugar_entrega: bl.lugar_entrega_cod || "",

                shipper: bl.shipper || "",
                shipper_codigo_pil: bl.shipper_codigo_pil || "",
                shipper_direccion: bl.shipper_direccion || "",
                shipper_telefono: bl.shipper_telefono || "",
                shipper_email: bl.shipper_email || "",

                consignee: bl.consignee || "",
                consignee_codigo_pil: bl.consignee_codigo_pil || "",
                consignee_direccion: bl.consignee_direccion || "",
                consignee_telefono: bl.consignee_telefono || "",
                consignee_email: bl.consignee_email || "",

                notify_party: bl.notify_party || "",
                notify_codigo_pil: bl.notify_codigo_pil || "",
                notify_direccion: bl.notify_direccion || "",
                notify_telefono: bl.notify_telefono || "",
                notify_email: bl.notify_email || "",

                // 🆕 Cargar almacenador_id si existe en BD
                almacenador_id: bl.almacenador_id || null,
                almacenador: bl.almacenador || "",
                almacenador_codigo_pil: bl.almacenador_codigo_pil || "",
                almacenador_direccion: bl.almacenador_direccion || "",
                almacenador_telefono: bl.almacenador_telefono || "",
                almacenador_email: bl.almacenador_email || "",

                items: (dataItems.items || []).map(item => ({
                    numero_item: item.numero_item,
                    marcas: item.marcas || "N/M",
                    tipo_bulto: item.tipo_bulto || "80",
                    descripcion: item.descripcion || "",
                    cantidad: item.cantidad || 1,
                    peso_bruto: item.peso_bruto || "",
                    unidad_peso: item.unidad_peso || "KGM",
                    volumen: item.volumen || 0,
                    unidad_volumen: item.unidad_volumen || "MTQ",
                    carga_cnt: "N"
                })),
                observaciones: observacionesParsed
            });

            if (bl.manifiesto_id) {
                const resManifiesto = await fetch(`${API_BASE}/manifiestos/${bl.manifiesto_id}`);
                if (resManifiesto.ok) {
                    const jsonManifiesto = await resManifiesto.json();
                    setManifiestoData(jsonManifiesto.manifiesto);
                }
            }

        } catch (e) {
            console.error("Error cargando BL:", e);
            Swal.fire({
                title: "Error",
                text: "No se pudo cargar la información del BL",
                icon: "error",
                confirmButtonColor: "#10b981"
            });
            navigate("/expo-bl");
        } finally {
            setLoading(false);
        }
    };

    const fetchPuertos = async () => {
        try {
            const res = await fetch(`${API_BASE}/puertos`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            setPuertos(json || []);
        } catch (e) {
            console.error("Error cargando puertos:", e);
            setPuertos([]);
        }
    };

    const validateStep = (step) => {
        switch (step) {
            case 1:
                if (!formData.bl_number?.trim()) {
                    Swal.fire({ title: "Campo requerido", text: "Debes ingresar el N° de BL", icon: "warning", confirmButtonColor: "#10b981" });
                    return false;
                }
                if (!formData.lugar_emision?.trim()) {
                    Swal.fire({ title: "Campo requerido", text: "Debes seleccionar el Lugar de Emisión", icon: "warning", confirmButtonColor: "#10b981" });
                    return false;
                }
                if (!puertos.some(p => p.codigo === formData.lugar_emision)) {
                    Swal.fire({ title: "Puerto inválido", html: `El código "<strong>${formData.lugar_emision}</strong>" no existe en el catálogo.`, icon: "error", confirmButtonColor: "#10b981" });
                    return false;
                }
                if (!formData.lugar_recepcion?.trim()) {
                    Swal.fire({ title: "Campo requerido", text: "Debes seleccionar el Lugar de Recepción", icon: "warning", confirmButtonColor: "#10b981" });
                    return false;
                }
                if (!puertos.some(p => p.codigo === formData.lugar_recepcion)) {
                    Swal.fire({ title: "Puerto inválido", html: `El código "<strong>${formData.lugar_recepcion}</strong>" no existe en el catálogo.`, icon: "error", confirmButtonColor: "#10b981" });
                    return false;
                }
                if (!formData.puerto_embarque?.trim()) {
                    Swal.fire({ title: "Campo requerido", text: "Debes seleccionar el Puerto de Embarque", icon: "warning", confirmButtonColor: "#10b981" });
                    return false;
                }
                if (!puertos.some(p => p.codigo === formData.puerto_embarque)) {
                    Swal.fire({ title: "Puerto inválido", html: `El código "<strong>${formData.puerto_embarque}</strong>" no existe en el catálogo.`, icon: "error", confirmButtonColor: "#10b981" });
                    return false;
                }
                if (!formData.puerto_descarga?.trim()) {
                    Swal.fire({ title: "Campo requerido", text: "Debes seleccionar el Puerto de Descarga", icon: "warning", confirmButtonColor: "#10b981" });
                    return false;
                }
                if (!puertos.some(p => p.codigo === formData.puerto_descarga)) {
                    Swal.fire({ title: "Puerto inválido", html: `El código "<strong>${formData.puerto_descarga}</strong>" no existe en el catálogo.`, icon: "error", confirmButtonColor: "#10b981" });
                    return false;
                }
                if (formData.lugar_destino?.trim() && !puertos.some(p => p.codigo === formData.lugar_destino)) {
                    Swal.fire({ title: "Puerto inválido", html: `El código "<strong>${formData.lugar_destino}</strong>" no existe en el catálogo.`, icon: "error", confirmButtonColor: "#10b981" });
                    return false;
                }
                if (formData.lugar_entrega?.trim() && !puertos.some(p => p.codigo === formData.lugar_entrega)) {
                    Swal.fire({ title: "Puerto inválido", html: `El código "<strong>${formData.lugar_entrega}</strong>" no existe en el catálogo.`, icon: "error", confirmButtonColor: "#10b981" });
                    return false;
                }
                if (!formData.fecha_emision) { Swal.fire({ title: "Campo requerido", text: "Debes ingresar la Fecha de Emisión", icon: "warning", confirmButtonColor: "#10b981" }); return false; }
                if (!formData.fecha_presentacion) { Swal.fire({ title: "Campo requerido", text: "Debes ingresar la Fecha de Presentación", icon: "warning", confirmButtonColor: "#10b981" }); return false; }
                if (!formData.fecha_embarque) { Swal.fire({ title: "Campo requerido", text: "Debes ingresar la Fecha de Embarque", icon: "warning", confirmButtonColor: "#10b981" }); return false; }
                if (!formData.fecha_zarpe) { Swal.fire({ title: "Campo requerido", text: "Debes ingresar la Fecha de Zarpe", icon: "warning", confirmButtonColor: "#10b981" }); return false; }
                return true;

            case 2:
                if (!formData.shipper || formData.shipper.trim().length < 3) {
                    Swal.fire({ title: "Campo requerido", text: "El Shipper/Embarcador debe tener al menos 3 caracteres", icon: "warning", confirmButtonColor: "#10b981" });
                    return false;
                }
                // AGREGAR ESTO:
                if (!formData.shipper_direccion?.trim()) {
                    Swal.fire({ title: "Campo requerido", text: "La dirección del Shipper es obligatoria", icon: "warning", confirmButtonColor: "#10b981" });
                    return false;
                }
                if (!formData.shipper_telefono?.trim() && !formData.shipper_email?.trim()) {
                    Swal.fire({ title: "Datos de contacto faltantes", text: "El Shipper debe tener al menos teléfono o email", icon: "warning", confirmButtonColor: "#10b981" });
                    return false;
                }
                if (formData.shipper_telefono?.trim() && formData.shipper_telefono.trim().length < 7) {
                    Swal.fire({ title: "Teléfono inválido", text: "El teléfono del Shipper debe tener al menos 7 caracteres", icon: "warning", confirmButtonColor: "#10b981" });
                    return false;
                }
                if (formData.shipper_email?.trim() && !validarEmail(formData.shipper_email)) {
                    Swal.fire({ title: "Email inválido", text: "El email del Shipper no tiene formato válido", icon: "warning", confirmButtonColor: "#10b981" });
                    return false;
                }
                if (!formData.consignee || formData.consignee.trim().length < 3) {
                    Swal.fire({ title: "Campo requerido", text: "El Consignee debe tener al menos 3 caracteres", icon: "warning", confirmButtonColor: "#10b981" });
                    return false;
                }
                // AGREGAR ESTO:
                if (!formData.consignee_direccion?.trim()) {
                    Swal.fire({ title: "Campo requerido", text: "La dirección del Consignee es obligatoria", icon: "warning", confirmButtonColor: "#10b981" });
                    return false;
                }
                if (!formData.consignee_telefono?.trim() && !formData.consignee_email?.trim()) {
                    Swal.fire({ title: "Datos de contacto faltantes", text: "El Consignee debe tener al menos teléfono o email", icon: "warning", confirmButtonColor: "#10b981" });
                    return false;
                }
                // Después del check de consignee:
                if (formData.consignee_telefono?.trim() && formData.consignee_telefono.trim().length < 7) {
                    Swal.fire({ title: "Teléfono inválido", text: "El teléfono del Consignee debe tener al menos 7 caracteres", icon: "warning", confirmButtonColor: "#10b981" });
                    return false;
                }
                if (formData.consignee_email?.trim() && !validarEmail(formData.consignee_email)) {
                    Swal.fire({ title: "Email inválido", text: "El email del Consignee no tiene formato válido", icon: "warning", confirmButtonColor: "#10b981" });
                    return false;
                }
                if (formData.notify_party?.trim() && !formData.notify_telefono?.trim() && !formData.notify_email?.trim()) {
                    Swal.fire({ title: "Datos de contacto faltantes", text: "Si ingresas Notify Party, debe tener al menos teléfono o email", icon: "warning", confirmButtonColor: "#10b981" });
                    return false;
                }
                if (formData.notify_telefono?.trim() && formData.notify_telefono.trim().length < 7) {
                    Swal.fire({ title: "Teléfono inválido", text: "El teléfono del Notify Party debe tener al menos 7 caracteres", icon: "warning", confirmButtonColor: "#10b981" });
                    return false;
                }
                if (formData.notify_email?.trim() && !validarEmail(formData.notify_email)) {
                    Swal.fire({ title: "Email inválido", text: "El email del Notify Party no tiene formato válido", icon: "warning", confirmButtonColor: "#10b981" });
                    return false;
                }

                return true;

            case 3:
                if (formData.items.length === 0) {
                    Swal.fire({ title: "Sin items", text: "Debes tener al menos 1 item de carga", icon: "warning", confirmButtonColor: "#10b981" });
                    return false;
                }
                for (const item of formData.items) {
                    if (!item.descripcion || item.descripcion.trim() === '') {
                        Swal.fire({ title: "Descripción requerida", text: `El item #${item.numero_item} debe tener descripción`, icon: "warning", confirmButtonColor: "#10b981" });
                        return false;
                    }
                    if (!item.tipo_bulto?.trim()) {
                        Swal.fire({ title: "Tipo de bulto requerido", text: `El item #${item.numero_item} debe tener tipo de bulto`, icon: "warning", confirmButtonColor: "#10b981" });
                        return false;
                    }
                    const peso = parseFloat(item.peso_bruto);
                    if (isNaN(peso) || peso <= 0) {
                        Swal.fire({ title: "Peso inválido", text: `El item #${item.numero_item} debe tener peso mayor a 0`, icon: "warning", confirmButtonColor: "#10b981" });
                        return false;
                    }
                    if (!item.unidad_peso?.trim()) {
                        Swal.fire({ title: "Unidad de peso requerida", text: `El item #${item.numero_item} debe tener unidad de peso`, icon: "warning", confirmButtonColor: "#10b981" });
                        return false;
                    }
                    const volumen = parseFloat(item.volumen);
                    if (isNaN(volumen) || volumen < 0) {
                        Swal.fire({ title: "Volumen inválido", text: `El item #${item.numero_item} debe tener volumen mayor o igual a 0`, icon: "warning", confirmButtonColor: "#10b981" });
                        return false;
                    }
                    if (!item.unidad_volumen?.trim()) {
                        Swal.fire({ title: "Unidad de volumen requerida", text: `El item #${item.numero_item} debe tener unidad de volumen`, icon: "warning", confirmButtonColor: "#10b981" });
                        return false;
                    }
                    const cantidad = parseInt(item.cantidad);
                    if (isNaN(cantidad) || cantidad <= 0) {
                        Swal.fire({ title: "Cantidad inválida", text: `El item #${item.numero_item} debe tener cantidad mayor a 0`, icon: "warning", confirmButtonColor: "#10b981" });
                        return false;
                    }
                    if (!item.marcas?.trim()) {
                        Swal.fire({ title: "Marcas requeridas", text: `El item #${item.numero_item} debe tener marcas (usa "N/M" si no aplica)`, icon: "warning", confirmButtonColor: "#10b981" });
                        return false;
                    }
                }
                return true;

            default:
                return true;
        }
    };

    const handleNext = () => {
        if (!validateStep(currentStep)) return;
        if (currentStep < 4) setCurrentStep(currentStep + 1);
    };

    const handleBack = () => {
        if (currentStep > 1) setCurrentStep(currentStep - 1);
    };

    const handleSubmit = async () => {
        for (let step = 1; step <= 3; step++) {
            if (!validateStep(step)) {
                setCurrentStep(step);
                return;
            }
        }

        const totalPeso = formData.items.reduce((sum, i) => sum + parseFloat(i.peso_bruto || 0), 0);
        const totalBultos = formData.items.reduce((sum, i) => sum + parseInt(i.cantidad || 0), 0);

        const result = await Swal.fire({
            title: "¿Actualizar Carga Suelta?",
            html: `
      <div class="text-left">
        <p class="mb-2">Se actualizará el BL con los siguientes datos:</p>
        <ul class="text-sm text-gray-600 space-y-1">
          <li><strong>BL:</strong> ${formData.bl_number}</li>
          <li><strong>Tipo:</strong> BB (Break Bulk - Carga Suelta)</li>
          <li><strong>Items:</strong> ${formData.items.length}</li>
          <li><strong>Bultos:</strong> ${totalBultos}</li>
          <li><strong>Peso:</strong> ${totalPeso.toFixed(2)} KG</li>
        </ul>
      </div>
    `,
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#10b981",
            cancelButtonColor: "#e43a3a",
            confirmButtonText: "Sí, actualizar",
            cancelButtonText: "Cancelar",
            width: '500px'
        });

        if (!result.isConfirmed) return;

        setIsSubmitting(true);

        try {
            const res = await fetch(`${API_BASE}/bls/${blNumber}/carga-suelta`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });

            const data = await res.json();

            if (!data.success) throw new Error(data.error || 'Error al actualizar');

            try {
                await fetch(`${API_BASE}/api/bls/${blNumber}/revalidar`, { method: 'POST' });
            } catch (e) {
                console.warn('No se pudo revalidar automáticamente:', e);
            }

            await Swal.fire({
                title: "¡Actualizado!",
                html: `<div class="text-center"><p class="text-lg mb-2">BL <strong class="text-green-600">${data.bl_number}</strong></p><p class="text-sm text-gray-600">actualizado exitosamente</p></div>`,
                icon: "success",
                confirmButtonColor: "#10b981",
                timer: 2000,
                showConfirmButton: false
            });

            const urlParams = new URLSearchParams(window.location.search);
            const returnTo = urlParams.get('returnTo');
            const manifestId = urlParams.get('manifestId');

            if (returnTo === 'xml-preview' && manifestId) {
                navigate(`/manifiestos/${manifestId}/generar-xml`);
            } else {
                navigate(`/expo-bl`);
            }

        } catch (e) {
            console.error('Error:', e);
            Swal.fire({ title: "Error", text: e?.message || "No se pudo actualizar la carga suelta", icon: "error", confirmButtonColor: "#10b981" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const addItem = () => {
        setFormData({
            ...formData,
            items: [
                ...formData.items,
                {
                    numero_item: formData.items.length + 1,
                    marcas: "N/M",
                    tipo_bulto: "80",
                    descripcion: "",
                    cantidad: 1,
                    peso_bruto: "",
                    unidad_peso: "KGM",
                    volumen: 0,
                    unidad_volumen: "MTQ"
                }
            ]
        });
    };

    const removeItem = (index) => {
        if (formData.items.length === 1) {
            Swal.fire({ title: "Atención", text: "Debe haber al menos 1 item", icon: "warning", confirmButtonColor: "#10b981" });
            return;
        }
        const newItems = formData.items.filter((_, idx) => idx !== index);
        newItems.forEach((item, idx) => { item.numero_item = idx + 1; });
        setFormData({ ...formData, items: newItems });
    };

    if (loading) {
        return (
            <div className="flex min-h-screen bg-slate-100">
                <Sidebar />
                <main className="flex-1 p-10">
                    <div className="text-sm text-slate-600">Cargando datos del BL...</div>
                </main>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-slate-100">
            <Sidebar />
            <main className="flex-1 p-10">
                <div className="max-w-5xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <button
                            onClick={() => {
                                const urlParams = new URLSearchParams(window.location.search);
                                const returnTo = urlParams.get('returnTo');
                                const manifestId = urlParams.get('manifestId');
                                if (returnTo === 'xml-preview' && manifestId) {
                                    navigate(`/manifiestos/${manifestId}/generar-xml`);
                                } else {
                                    navigate(`/expo/${blNumber}`);
                                }
                            }}
                            className="text-sm text-slate-500 hover:text-slate-800 mb-4 flex items-center gap-1 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Volver
                        </button>
                        <h1 className="text-2xl font-semibold text-[#0F2A44]">Editar Carga Suelta</h1>
                        <p className="text-sm text-slate-500 mt-1">BL #{formData.bl_number}</p>
                        <div className="mt-2 inline-block px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
                            Tipo: BB (Break Bulk) - Carga sin contenedor
                        </div>
                    </div>

                    {/* Steps indicator */}
                    <div className="mb-8">
                        <div className="flex items-center justify-between">
                            {STEPS.map((step, idx) => (
                                <div key={step.id} className="flex items-center flex-1">
                                    <div className="flex flex-col items-center flex-1">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${currentStep >= step.id ? "bg-[#0F2A44] text-white" : "bg-slate-200 text-slate-400"}`}>
                                            {step.id}
                                        </div>
                                        <span className="text-xs mt-2 text-slate-600 text-center">{step.name}</span>
                                    </div>
                                    {idx < STEPS.length - 1 && (
                                        <div className={`h-1 flex-1 transition-all ${currentStep > step.id ? "bg-[#0F2A44]" : "bg-slate-200"}`} />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Form content */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                        {currentStep === 1 && <Step1DatosBL formData={formData} setFormData={setFormData} manifiestoData={manifiestoData} puertos={puertos} />}
                        {currentStep === 2 && <Step2Participantes formData={formData} setFormData={setFormData} />}
                        {currentStep === 3 && <Step3Items formData={formData} setFormData={setFormData} addItem={addItem} removeItem={removeItem} tiposBulto={tiposBulto} />}
                        {currentStep === 4 && <Step4Revision formData={formData} manifiestoData={manifiestoData} tiposBulto={tiposBulto} />}
                    </div>

                    {/* Navigation buttons */}
                    <div className="mt-6 flex justify-between">
                        <button
                            onClick={handleBack}
                            disabled={currentStep === 1 || isSubmitting}
                            className="px-6 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                        >
                            Anterior
                        </button>

                        {currentStep < 4 ? (
                            <button
                                onClick={handleNext}
                                disabled={isSubmitting}
                                className="px-6 py-2 rounded-lg bg-[#0F2A44] text-white hover:bg-[#1a3f5f] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                                Siguiente
                            </button>
                        ) : (
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="px-6 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        Actualizando...
                                    </>
                                ) : 'Actualizar Carga Suelta'}
                            </button>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

// ==================== STEP COMPONENTS ====================

const Step1DatosBL = ({ formData, setFormData, manifiestoData, puertos }) => (
    <div className="space-y-6">
        <h2 className="text-lg font-semibold text-slate-800 mb-4">Datos del BL</h2>

        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
            <div className="flex">
                <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                </div>
                <div className="ml-3">
                    <p className="text-sm text-blue-700">
                        <strong>Carga Suelta (Break Bulk):</strong> Mercancía que se transporta en bultos individuales sin contenedor.
                    </p>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
            <InputField label="N° BL" value={formData.bl_number} onChange={(v) => setFormData({ ...formData, bl_number: v })} required placeholder="Ej: B042025" disabled />
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo Servicio <span className="text-red-500">*</span></label>
                <input type="text" value="BB - Break Bulk (Carga Suelta)" disabled className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-600 cursor-not-allowed" />
            </div>
            <SelectField label="Forma Pago Flete" value={formData.forma_pago_flete} onChange={(v) => setFormData({ ...formData, forma_pago_flete: v })} options={[{ value: "PREPAID", label: "PREPAID - Pagado en origen" }, { value: "COLLECT", label: "COLLECT - Por cobrar en destino" }]} required />
            <InputField label="Condición Transporte" value={formData.cond_transporte} onChange={(v) => setFormData({ ...formData, cond_transporte: v.toUpperCase() })} placeholder="HH, CY, SD, etc." maxLength={10} required />
        </div>

        <h3 className="text-md font-semibold text-slate-700 mt-6 mb-3">Fechas</h3>
        <div className="grid grid-cols-2 gap-4">
            <InputField label="Fecha Emisión" type="date" value={formData.fecha_emision} onChange={(v) => setFormData({ ...formData, fecha_emision: v })} required />
            <InputField label="Fecha Presentación" type="date" value={formData.fecha_presentacion} onChange={(v) => setFormData({ ...formData, fecha_presentacion: v })} required />
            <InputField label="Fecha Embarque" type="date" value={formData.fecha_embarque} onChange={(v) => setFormData({ ...formData, fecha_embarque: v })} required />
            <InputField label="Fecha Zarpe" type="date" value={formData.fecha_zarpe} onChange={(v) => setFormData({ ...formData, fecha_zarpe: v })} required />
        </div>

        <h3 className="text-md font-semibold text-slate-700 mt-6 mb-3">Locaciones</h3>
        {manifiestoData?.puertoCentral && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-sm text-blue-800">
                <strong>Puerto Central del Manifiesto:</strong> {manifiestoData.puertoCentral}
            </div>
        )}
        <div className="grid grid-cols-2 gap-4">
            <SelectPuerto label="Lugar Emisión" value={formData.lugar_emision} onChange={(v) => setFormData({ ...formData, lugar_emision: v })} puertos={puertos} required />
            <SelectPuerto label="Lugar Recepción" value={formData.lugar_recepcion} onChange={(v) => setFormData({ ...formData, lugar_recepcion: v })} puertos={puertos} required />
            <SelectPuerto label="Puerto Embarque" value={formData.puerto_embarque} onChange={(v) => setFormData({ ...formData, puerto_embarque: v })} puertos={puertos} required />
            <SelectPuerto label="Puerto Descarga" value={formData.puerto_descarga} onChange={(v) => setFormData({ ...formData, puerto_descarga: v })} puertos={puertos} required />
            <SelectPuerto label="Lugar Destino" value={formData.lugar_destino} onChange={(v) => setFormData({ ...formData, lugar_destino: v })} puertos={puertos} required />
            <SelectPuerto label="Lugar Entrega" value={formData.lugar_entrega} onChange={(v) => setFormData({ ...formData, lugar_entrega: v })} puertos={puertos} required />
        </div>
    </div>
);

const Step2Participantes = ({ formData, setFormData }) => {
    const updateField = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));
    // AGREGAR ESTO
    const [emailErrors, setEmailErrors] = useState({ shipper: false, consignee: false, notify: false });
    const validarEmail = (email) => {
        if (!email || email.trim() === "") return true;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };
    const addObservacion = () => setFormData({ ...formData, observaciones: [...formData.observaciones, { nombre: 'GRAL', contenido: '' }] });
    const removeObservacion = (index) => setFormData({ ...formData, observaciones: formData.observaciones.filter((_, idx) => idx !== index) });
    const updateObservacion = (index, field, value) => {
        const newObs = [...formData.observaciones];
        newObs[index] = { ...newObs[index], [field]: value };
        setFormData({ ...formData, observaciones: newObs });
    };

    return (
        <div className="space-y-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Participantes del BL</h2>

            <div className="bg-slate-50 border border-slate-300 rounded-lg p-4">
                <p className="text-sm text-slate-700">
                    ℹ️ <strong>Información de los participantes.</strong> Completa los datos de contacto. Al menos teléfono o email es obligatorio para Shipper y Consignee.
                </p>
            </div>

            {/* SHIPPER */}
            <div className="border border-slate-300 rounded-lg p-6 bg-white">
                <h3 className="font-semibold text-slate-900 mb-4 text-lg border-b pb-2">Shipper / Embarcador (EMB)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Nombre / Razón Social <span className="text-red-500">*</span></label>
                        <textarea rows={3} value={formData.shipper || ""} onChange={(e) => updateField("shipper", e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500" placeholder="Ingrese nombre o razón social completa" />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Dirección <span className="text-red-500">*</span></label>
                        <input type="text" value={formData.shipper_direccion || ""} onChange={(e) => updateField("shipper_direccion", e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500" placeholder="Ingrese dirección" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Teléfono <span className="text-amber-500 text-xs">(requerido si no hay email)</span></label>
                        <input type="text" value={formData.shipper_telefono || ""}
                            onChange={(e) => updateField("shipper_telefono", e.target.value.replace(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, ""))}
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500"
                            placeholder="+56 9 1234 5678" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Email <span className="text-amber-500 text-xs">(requerido si no hay teléfono)</span></label>
                        <input type="email" value={formData.shipper_email || ""}
                            onChange={(e) => { updateField("shipper_email", e.target.value); setEmailErrors(p => ({ ...p, shipper: false })); }}
                            onBlur={(e) => setEmailErrors(p => ({ ...p, shipper: !validarEmail(e.target.value) }))}
                            className={`w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-slate-500 outline-none transition-colors ${emailErrors.shipper ? "border-red-400 bg-red-50" : "border-slate-300"}`}
                            placeholder="correo@ejemplo.com" />
                        {emailErrors.shipper && <p className="text-xs text-red-600 mt-1">Formato de email inválido</p>}
                    </div>
                </div>
            </div>

            {/* CONSIGNEE */}
            <div className="border border-slate-300 rounded-lg p-6 bg-white">
                <h3 className="font-semibold text-slate-900 mb-4 text-lg border-b pb-2">Consignatario (CONS)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Nombre / Razón Social <span className="text-red-500">*</span></label>
                        <textarea rows={3} value={formData.consignee || ""} onChange={(e) => updateField("consignee", e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500" placeholder="Ingrese nombre o razón social completa" />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Dirección<span className="text-red-500">*</span></label>
                        <input type="text" value={formData.consignee_direccion || ""} onChange={(e) => updateField("consignee_direccion", e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500" placeholder="Ingrese dirección" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Teléfono <span className="text-amber-500 text-xs">(requerido si no hay email)</span></label>

                        <input type="text" value={formData.consignee_telefono || ""}
                            onChange={(e) => updateField("consignee_telefono", e.target.value.replace(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, ""))}
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500"
                            placeholder="+56 9 1234 5678" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Email <span className="text-amber-500 text-xs">(requerido si no hay teléfono)</span></label>
                        <input type="email" value={formData.consignee_email || ""}
                            onChange={(e) => { updateField("consignee_email", e.target.value); setEmailErrors(p => ({ ...p, consignee: false })); }}
                            onBlur={(e) => setEmailErrors(p => ({ ...p, consignee: !validarEmail(e.target.value) }))}
                            className={`w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-slate-500 outline-none transition-colors ${emailErrors.consignee ? "border-red-400 bg-red-50" : "border-slate-300"}`}
                            placeholder="correo@ejemplo.com" />
                        {emailErrors.consignee && <p className="text-xs text-red-600 mt-1">Formato de email inválido</p>}
                    </div>
                </div>
            </div>

            {/* NOTIFY PARTY */}
            <div className="border border-slate-300 rounded-lg p-6 bg-white">
                <h3 className="font-semibold text-slate-900 mb-4 text-lg border-b pb-2">Notify Party (NOTI) <span className="text-sm text-slate-500 font-normal">(Opcional)</span></h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Nombre / Razón Social</label>
                        <textarea rows={3} value={formData.notify_party || ""} onChange={(e) => updateField("notify_party", e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500" placeholder="Ingrese nombre o razón social completa" />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-slate-700 mb-2">Dirección</label>
                        <input type="text" value={formData.notify_direccion || ""} onChange={(e) => updateField("notify_direccion", e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500" placeholder="Ingrese dirección" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Teléfono</label>
                        <input type="text" value={formData.notify_telefono || ""}
                            onChange={(e) => updateField("notify_telefono", e.target.value.replace(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, ""))}
                            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500"
                            placeholder="+56 9 1234 5678" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                        <input type="email" value={formData.notify_email || ""}
                            onChange={(e) => { updateField("notify_email", e.target.value); setEmailErrors(p => ({ ...p, notify: false })); }}
                            onBlur={(e) => setEmailErrors(p => ({ ...p, notify: !validarEmail(e.target.value) }))}
                            className={`w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-slate-500 outline-none transition-colors ${emailErrors.notify ? "border-red-400 bg-red-50" : "border-slate-300"}`}
                            placeholder="correo@ejemplo.com" />
                        {emailErrors.notify && <p className="text-xs text-red-600 mt-1">Formato de email inválido</p>}
                    </div>
                </div>
            </div>

            {/* ALMACENADOR CON SELECTOR */}
            <div className="border border-slate-300 rounded-lg p-6 bg-white">
                <h3 className="font-semibold text-slate-900 mb-4 text-lg border-b pb-2">
                    Almacenador (ALM) <span className="text-sm text-slate-500 font-normal">(Opcional)</span>
                </h3>
                <AlmacenadorSelector
                    value={formData.almacenador_id}
                    displayValue={formData.almacenador}
                    onChange={(id, texto, datos) => {
                        setFormData(prev => ({
                            ...prev,
                            almacenador_id: id,
                            almacenador: texto,
                            almacenador_codigo_pil: datos.codigo_pil || '',
                        }));
                    }}
                    onClear={() => {
                        setFormData(prev => ({
                            ...prev,
                            almacenador_id: null,
                            almacenador: '',
                            almacenador_codigo_pil: '',
                        }));
                    }}
                />
            </div>

            {/* Nota roles */}
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
                <div className="flex">
                    <svg className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div className="ml-3 text-sm text-blue-700">
                        <p className="font-medium mb-1">Roles específicos de Carga Suelta:</p>
                        <ul className="list-disc list-inside space-y-1 ml-2">
                            <li><strong>EMB:</strong> Shipper/Embarcador — <strong>Obligatorio</strong></li>
                            <li><strong>CONS:</strong> Consignatario — <strong>Obligatorio</strong></li>
                            <li><strong>NOTI:</strong> A quien notificar — Opcional</li>
                            <li><strong>ALM:</strong> Almacenador del mantenedor — Opcional</li>
                        </ul>
                        <p className="mt-2 text-xs">Los roles EMI, REP y EMIDO se toman automáticamente de las referencias del manifiesto.</p>
                    </div>
                </div>
            </div>

            {/* OBSERVACIONES */}
            <div className="mt-6 pt-6 border-t border-slate-200">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-md font-semibold text-slate-700">Observaciones del BL</h3>
                    <button type="button" onClick={addObservacion} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 flex items-center gap-2 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                        Agregar Observación
                    </button>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-sm text-blue-800">
                    <strong>Info:</strong> Las observaciones aparecerán en el XML de carga suelta.
                </div>
                <div className="space-y-3">
                    {formData.observaciones.map((obs, idx) => (
                        <div key={idx} className="border border-slate-200 rounded-lg p-3 bg-slate-50 relative">
                            {formData.observaciones.length > 1 && (
                                <button type="button" onClick={() => removeObservacion(idx)} className="absolute top-2 right-2 text-red-500 hover:text-red-700 p-1 rounded transition-colors">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            )}
                            <div className="grid grid-cols-4 gap-3">
                                <div className="col-span-1">
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
                                    <select value={obs.nombre} onChange={(e) => updateObservacion(idx, 'nombre', e.target.value)} className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                        <option value="GRAL">GRAL</option>
                                        <option value="MOT">MOT</option>
                                        <option value="OBS">OBS</option>
                                    </select>
                                </div>
                                <div className="col-span-3">
                                    <label className="block text-xs font-medium text-slate-600 mb-1">Contenido</label>
                                    <input type="text" value={obs.contenido} onChange={(e) => updateObservacion(idx, 'contenido', e.target.value)} placeholder="Ej: SELLOS PARA CONTENEDORES" className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                {formData.observaciones.length === 0 && (
                    <div className="text-center py-6 text-slate-500 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
                        <p className="text-sm">No hay observaciones. Haz clic en "Agregar Observación".</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const Step3Items = ({ formData, setFormData, addItem, removeItem, tiposBulto }) => {
    const updateItem = (index, field, value) => {
        const newItems = [...formData.items];
        newItems[index] = { ...newItems[index], [field]: value };
        setFormData({ ...formData, items: newItems });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800">Items de Carga</h2>
                <button onClick={addItem} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 flex items-center gap-2 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Agregar Item
                </button>
            </div>

            {formData.items.map((item, idx) => (
                <div key={idx} className="border border-slate-200 rounded-lg p-4 relative bg-slate-50 hover:bg-slate-100 transition-colors">
                    {formData.items.length > 1 && (
                        <button onClick={() => removeItem(idx)} className="absolute top-2 right-2 text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    )}
                    <div className="mb-3 text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <span className="bg-[#0F2A44] text-white w-7 h-7 rounded-full flex items-center justify-center text-xs">{item.numero_item}</span>
                        Item #{item.numero_item}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <InputField label="Marcas" value={item.marcas} onChange={(v) => updateItem(idx, 'marcas', v)} placeholder="N/M (si no aplica)" required />
                        <SelectField label="Tipo Bulto" value={item.tipo_bulto} onChange={(v) => updateItem(idx, 'tipo_bulto', v)} options={tiposBulto} required />
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Descripción de la Mercancía <span className="text-red-500">*</span></label>
                            <textarea value={item.descripcion} onChange={(e) => updateItem(idx, 'descripcion', e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F2A44]" rows={5} placeholder="Descripción detallada de la mercancía" />
                        </div>
                        <InputField label="Cantidad de Bultos" type="number" value={item.cantidad} onChange={(v) => updateItem(idx, 'cantidad', v)} required min="1" step="1" />
                        <div className="col-span-2 grid grid-cols-2 gap-4">
                            <InputField label="Peso Bruto" type="number" step="0.001" value={item.peso_bruto} onChange={(v) => updateItem(idx, 'peso_bruto', v)} required min="0.001" placeholder="Ej: 1500.500" />
                            <SelectField label="Unidad de Peso" value={item.unidad_peso} onChange={(v) => updateItem(idx, 'unidad_peso', v)} options={UNIDADES_PESO} required />
                        </div>
                        <div className="col-span-2 grid grid-cols-2 gap-4">
                            <InputField label="Volumen" type="number" step="0.001" value={item.volumen} onChange={(v) => updateItem(idx, 'volumen', v)} min="0" placeholder="0 si no aplica" required />
                            <SelectField label="Unidad de Volumen" value={item.unidad_volumen} onChange={(v) => updateItem(idx, 'unidad_volumen', v)} options={UNIDADES_VOLUMEN} required />
                        </div>
                    </div>
                </div>
            ))}

            {formData.items.length === 0 && (
                <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
                    <p>No hay items. Haz clic en "Agregar Item" para comenzar.</p>
                </div>
            )}
        </div>
    );
};

const Step4Revision = ({ formData, manifiestoData, tiposBulto }) => {
    const totalPeso = formData.items.reduce((sum, i) => sum + parseFloat(i.peso_bruto || 0), 0);
    const totalVolumen = formData.items.reduce((sum, i) => sum + parseFloat(i.volumen || 0), 0);
    const totalBultos = formData.items.reduce((sum, i) => sum + parseInt(i.cantidad || 0), 0);

    return (
        <div className="space-y-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Revisión Final</h2>

            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <h3 className="font-semibold text-slate-700 mb-3">Datos del BL</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="font-medium text-slate-600">N° BL:</span><span className="ml-2 font-mono">{formData.bl_number || "—"}</span></div>
                    <div><span className="font-medium text-slate-600">Tipo:</span><span className="ml-2 bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-xs font-medium">BB (Break Bulk)</span></div>
                    <div><span className="font-medium text-slate-600">Forma Pago:</span><span className="ml-2">{formData.forma_pago_flete}</span></div>
                    <div><span className="font-medium text-slate-600">Cond. Transporte:</span><span className="ml-2">{formData.cond_transporte || "—"}</span></div>
                    <div className="col-span-2 border-t border-slate-200 pt-2 mt-2">
                        <span className="font-medium text-slate-600">Puertos:</span>
                        <div className="ml-2 text-xs grid grid-cols-2 gap-2 mt-1">
                            <div>Embarque: {formData.puerto_embarque || "—"}</div>
                            <div>Descarga: {formData.puerto_descarga || "—"}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                <h3 className="font-semibold text-emerald-800 mb-3">Totales de Carga</h3>
                <div className="grid grid-cols-3 gap-4">
                    <div className="text-center bg-white rounded-lg p-3">
                        <div className="text-emerald-600 font-medium text-sm">Items</div>
                        <div className="text-3xl font-bold text-emerald-900 mt-1">{formData.items.length}</div>
                    </div>
                    <div className="text-center bg-white rounded-lg p-3">
                        <div className="text-emerald-600 font-medium text-sm">Bultos</div>
                        <div className="text-3xl font-bold text-emerald-900 mt-1">{totalBultos}</div>
                    </div>
                    <div className="text-center bg-white rounded-lg p-3">
                        <div className="text-emerald-600 font-medium text-sm">Peso Total</div>
                        <div className="text-2xl font-bold text-emerald-900 mt-1">{totalPeso.toFixed(3)}</div>
                        <div className="text-xs text-emerald-600">{formData.items[0]?.unidad_peso || 'KGM'}</div>
                    </div>
                </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <h3 className="font-semibold text-slate-700 mb-3">Items de Carga ({formData.items.length})</h3>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                    {formData.items.map((item, idx) => {
                        const tipoBultoLabel = tiposBulto.find(t => t.value === item.tipo_bulto)?.label || item.tipo_bulto;
                        return (
                            <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 text-sm">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="bg-[#0F2A44] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold">{item.numero_item}</span>
                                    <span className="font-medium">Item #{item.numero_item}</span>
                                    <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{tipoBultoLabel}</span>
                                </div>
                                <div className="text-slate-600 text-xs line-clamp-2 pl-7">{item.descripcion || "Sin descripción"}</div>
                                <div className="flex gap-3 text-xs text-slate-500 pl-7 mt-1">
                                    <span>{item.cantidad} bulto(s)</span>
                                    <span>•</span>
                                    <span className="font-mono">{parseFloat(item.peso_bruto).toFixed(3)} {item.unidad_peso}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <h3 className="font-semibold text-slate-700 mb-3">Participantes del BL</h3>
                <div className="space-y-2 text-sm">
                    <div><span className="font-medium text-slate-600">Shipper (EMB):</span><p className="text-slate-900 mt-1 text-xs whitespace-pre-line">{formData.shipper || "—"}</p></div>
                    <div className="pt-2 border-t border-slate-200"><span className="font-medium text-slate-600">Consignee (CONS):</span><p className="text-slate-900 mt-1 text-xs whitespace-pre-line">{formData.consignee || "—"}</p></div>
                    <div className="pt-2 border-t border-slate-200"><span className="font-medium text-slate-600">Notify Party (NOTI):</span><p className="text-slate-900 mt-1 text-xs whitespace-pre-line">{formData.notify_party || "—"}</p></div>
                    {formData.almacenador && (
                        <div className="pt-2 border-t border-slate-200">
                            <span className="font-medium text-slate-600">Almacenador (ALM):</span>
                            <p className="text-slate-900 mt-1 text-xs">{formData.almacenador}</p>
                            {formData.almacenador_id && <span className="text-xs text-emerald-600">✓ Del mantenedor</span>}
                        </div>
                    )}
                </div>
            </div>

            {formData.observaciones?.length > 0 && (
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <h3 className="font-semibold text-slate-700 mb-3">Observaciones ({formData.observaciones.length})</h3>
                    <div className="space-y-2">
                        {formData.observaciones.map((obs, idx) => (
                            <div key={idx} className="bg-white p-2 rounded border border-slate-200 text-sm">
                                <span className="font-medium text-slate-600">{obs.nombre}:</span>
                                <span className="ml-2 text-slate-900">{obs.contenido || '—'}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div className="text-sm text-amber-800">
                    <strong>Importante:</strong> Verifica que todos los datos sean correctos antes de actualizar.
                </div>
            </div>
        </div>
    );
};

// ==================== HELPER COMPONENTS ====================

const InputField = ({ label, type = "text", value, onChange, placeholder, required, step, min, maxLength, disabled }) => (
    <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        <input
            type={type} value={value} onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder} step={step} min={min} maxLength={maxLength} disabled={disabled}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F2A44] transition-colors disabled:bg-slate-100 disabled:cursor-not-allowed"
        />
    </div>
);

const SelectField = ({ label, value, onChange, options, required }) => (
    <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F2A44] transition-colors">
            {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
    </div>
);

const SelectPuerto = ({ label, value, onChange, puertos, required }) => {
    const datalistId = `puertos-edit-${label.replace(/\s+/g, '-').toLowerCase()}`;
    const isPuertoValido = puertos.some(p => p.codigo === value);
    const mostrarWarning = value && !isPuertoValido;

    return (
        <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
                {label} {required && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
                <input
                    type="text" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())}
                    list={datalistId} placeholder="Escribe o selecciona un puerto..."
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${mostrarWarning ? 'border-red-300 focus:ring-red-500 bg-red-50' : 'border-slate-300 focus:ring-[#0F2A44]'}`}
                />
                {mostrarWarning && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                    </div>
                )}
            </div>
            <datalist id={datalistId}>
                {puertos.map(puerto => <option key={puerto.codigo} value={puerto.codigo}>{puerto.nombre}</option>)}
            </datalist>
            {mostrarWarning && (
                <p className="text-xs text-red-600 mt-1 font-medium">El código "{value}" no existe en el catálogo de puertos</p>
            )}
        </div>
    );
};

export default CargaSueltaEdit;