import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Swal from "sweetalert2";
import ParticipanteSelector from '../components/ParticipanteSelector';

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

const CargaSueltaEdit = () => {
    const { blNumber } = useParams();
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(1);
    const [manifiestoData, setManifiestoData] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);

    const [puertos, setPuertos] = useState([]);
    const [tiposBulto, setTiposBulto] = useState(TIPOS_BULTO);

    // 🔥 REEMPLAZA el useState del formData (línea ~45)
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

        // 🔥 NUEVOS CAMPOS: IDs de participantes
        shipper_id: null,        // Este ES el embarcador (EMB)
        consignee_id: null,
        notify_id: null,
        almacenador_id: null,    // Este es el almacenador (ALM)

        // Participantes - Display Text
        shipper: "",
        consignee: "",
        notify_party: "",
        almacenador: "", // 🔥 NUEVO

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

    // 🔥 REEMPLAZA la función fetchBLData (línea ~80)
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

            // 🔥 PARSEAR OBSERVACIONES SI VIENEN COMO STRING JSON
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

                // 🔥 CARGAR IDs DE PARTICIPANTES
                shipper_id: bl.shipper_id || null,      // Shipper = Embarcador
                consignee_id: bl.consignee_id || null,
                notify_id: bl.notify_id || null,
                almacenador_id: bl.almacenador_id || null,  // Almacenador (separado)
                // Textos de participantes
                shipper: bl.shipper || "",
                consignee: bl.consignee || "",
                notify_party: bl.notify_party || "",
                almacenador: bl.almacenador || "",

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

   // 🔥 ACTUALIZA la función validateStep en CargaSueltaEdit.jsx (línea ~213)
const validateStep = (step) => {
    switch (step) {
        case 1:
            // Validar BL Number
            if (!formData.bl_number?.trim()) {
                Swal.fire({
                    title: "Campo requerido",
                    text: "Debes ingresar el N° de BL",
                    icon: "warning",
                    confirmButtonColor: "#10b981"
                });
                return false;
            }
            
            // 🔥 VALIDAR LUGAR EMISIÓN
            if (!formData.lugar_emision?.trim()) {
                Swal.fire({
                    title: "Campo requerido",
                    text: "Debes seleccionar el Lugar de Emisión",
                    icon: "warning",
                    confirmButtonColor: "#10b981"
                });
                return false;
            }
            if (!puertos.some(p => p.codigo === formData.lugar_emision)) {
                Swal.fire({
                    title: "Puerto inválido",
                    html: `El código "<strong>${formData.lugar_emision}</strong>" no existe en el catálogo de puertos.<br><br>Por favor, selecciona un puerto válido de la lista.`,
                    icon: "error",
                    confirmButtonColor: "#10b981"
                });
                return false;
            }
            
            // 🔥 VALIDAR LUGAR RECEPCIÓN
            if (!formData.lugar_recepcion?.trim()) {
                Swal.fire({
                    title: "Campo requerido",
                    text: "Debes seleccionar el Lugar de Recepción",
                    icon: "warning",
                    confirmButtonColor: "#10b981"
                });
                return false;
            }
            if (!puertos.some(p => p.codigo === formData.lugar_recepcion)) {
                Swal.fire({
                    title: "Puerto inválido",
                    html: `El código "<strong>${formData.lugar_recepcion}</strong>" no existe en el catálogo de puertos.<br><br>Por favor, selecciona un puerto válido de la lista.`,
                    icon: "error",
                    confirmButtonColor: "#10b981"
                });
                return false;
            }
            
            // 🔥 VALIDAR PUERTO EMBARQUE
            if (!formData.puerto_embarque?.trim()) {
                Swal.fire({
                    title: "Campo requerido",
                    text: "Debes seleccionar el Puerto de Embarque",
                    icon: "warning",
                    confirmButtonColor: "#10b981"
                });
                return false;
            }
            if (!puertos.some(p => p.codigo === formData.puerto_embarque)) {
                Swal.fire({
                    title: "Puerto inválido",
                    html: `El código "<strong>${formData.puerto_embarque}</strong>" no existe en el catálogo de puertos.<br><br>Por favor, selecciona un puerto válido de la lista.`,
                    icon: "error",
                    confirmButtonColor: "#10b981"
                });
                return false;
            }
            
            // 🔥 VALIDAR PUERTO DESCARGA
            if (!formData.puerto_descarga?.trim()) {
                Swal.fire({
                    title: "Campo requerido",
                    text: "Debes seleccionar el Puerto de Descarga",
                    icon: "warning",
                    confirmButtonColor: "#10b981"
                });
                return false;
            }
            if (!puertos.some(p => p.codigo === formData.puerto_descarga)) {
                Swal.fire({
                    title: "Puerto inválido",
                    html: `El código "<strong>${formData.puerto_descarga}</strong>" no existe en el catálogo de puertos.<br><br>Por favor, selecciona un puerto válido de la lista.`,
                    icon: "error",
                    confirmButtonColor: "#10b981"
                });
                return false;
            }
            
            // 🔥 VALIDAR LUGAR DESTINO (si está presente)
            if (formData.lugar_destino?.trim()) {
                if (!puertos.some(p => p.codigo === formData.lugar_destino)) {
                    Swal.fire({
                        title: "Puerto inválido",
                        html: `El código "<strong>${formData.lugar_destino}</strong>" no existe en el catálogo de puertos.<br><br>Por favor, selecciona un puerto válido de la lista.`,
                        icon: "error",
                        confirmButtonColor: "#10b981"
                    });
                    return false;
                }
            }
            
            // 🔥 VALIDAR LUGAR ENTREGA (si está presente)
            if (formData.lugar_entrega?.trim()) {
                if (!puertos.some(p => p.codigo === formData.lugar_entrega)) {
                    Swal.fire({
                        title: "Puerto inválido",
                        html: `El código "<strong>${formData.lugar_entrega}</strong>" no existe en el catálogo de puertos.<br><br>Por favor, selecciona un puerto válido de la lista.`,
                        icon: "error",
                        confirmButtonColor: "#10b981"
                    });
                    return false;
                }
            }
            
            // Validar fechas
            if (!formData.fecha_emision) {
                Swal.fire({
                    title: "Campo requerido",
                    text: "Debes ingresar la Fecha de Emisión",
                    icon: "warning",
                    confirmButtonColor: "#10b981"
                });
                return false;
            }
            if (!formData.fecha_presentacion) {
                Swal.fire({
                    title: "Campo requerido",
                    text: "Debes ingresar la Fecha de Presentación",
                    icon: "warning",
                    confirmButtonColor: "#10b981"
                });
                return false;
            }
            if (!formData.fecha_embarque) {
                Swal.fire({
                    title: "Campo requerido",
                    text: "Debes ingresar la Fecha de Embarque",
                    icon: "warning",
                    confirmButtonColor: "#10b981"
                });
                return false;
            }
            if (!formData.fecha_zarpe) {
                Swal.fire({
                    title: "Campo requerido",
                    text: "Debes ingresar la Fecha de Zarpe",
                    icon: "warning",
                    confirmButtonColor: "#10b981"
                });
                return false;
            }
            return true;

        case 2:

                // Validar Step 2: Participantes
                if (!formData.shipper_id) {
                    Swal.fire({
                        title: "Campo requerido",
                        text: "Debes seleccionar un Shipper",
                        icon: "warning",
                        confirmButtonColor: "#10b981"
                    });
                    return false;
                }
                if (!formData.consignee_id) {
                    Swal.fire({
                        title: "Campo requerido",
                        text: "Debes seleccionar un Consignee",
                        icon: "warning",
                        confirmButtonColor: "#10b981"
                    });
                    return false;
                }
                // Notify party NO es obligatorio
                return true;

            case 3:
                if (formData.items.length === 0) {
                    Swal.fire({
                        title: "Sin items",
                        text: "Debes tener al menos 1 item de carga",
                        icon: "warning",
                        confirmButtonColor: "#10b981"
                    });
                    return false;
                }

                for (const item of formData.items) {
                    if (!item.descripcion || item.descripcion.trim() === '') {
                        Swal.fire({
                            title: "Descripción requerida",
                            text: `El item #${item.numero_item} debe tener descripción`,
                            icon: "warning",
                            confirmButtonColor: "#10b981"
                        });
                        return false;
                    }

                    if (!item.tipo_bulto?.trim()) {
                        Swal.fire({
                            title: "Tipo de bulto requerido",
                            text: `El item #${item.numero_item} debe tener tipo de bulto`,
                            icon: "warning",
                            confirmButtonColor: "#10b981"
                        });
                        return false;
                    }

                    const peso = parseFloat(item.peso_bruto);
                    if (isNaN(peso) || peso <= 0) {
                        Swal.fire({
                            title: "Peso inválido",
                            text: `El item #${item.numero_item} debe tener peso mayor a 0`,
                            icon: "warning",
                            confirmButtonColor: "#10b981"
                        });
                        return false;
                    }

                    if (!item.unidad_peso?.trim()) {
                        Swal.fire({
                            title: "Unidad de peso requerida",
                            text: `El item #${item.numero_item} debe tener unidad de peso`,
                            icon: "warning",
                            confirmButtonColor: "#10b981"
                        });
                        return false;
                    }

                    const volumen = parseFloat(item.volumen);
                    if (isNaN(volumen) || volumen < 0) {
                        Swal.fire({
                            title: "Volumen inválido",
                            text: `El item #${item.numero_item} debe tener volumen mayor o igual a 0`,
                            icon: "warning",
                            confirmButtonColor: "#10b981"
                        });
                        return false;
                    }

                    if (!item.unidad_volumen?.trim()) {
                        Swal.fire({
                            title: "Unidad de volumen requerida",
                            text: `El item #${item.numero_item} debe tener unidad de volumen`,
                            icon: "warning",
                            confirmButtonColor: "#10b981"
                        });
                        return false;
                    }

                    const cantidad = parseInt(item.cantidad);
                    if (isNaN(cantidad) || cantidad <= 0) {
                        Swal.fire({
                            title: "Cantidad inválida",
                            text: `El item #${item.numero_item} debe tener cantidad mayor a 0`,
                            icon: "warning",
                            confirmButtonColor: "#10b981"
                        });
                        return false;
                    }

                    if (!item.marcas?.trim()) {
                        Swal.fire({
                            title: "Marcas requeridas",
                            text: `El item #${item.numero_item} debe tener marcas (usa "N/M" si no aplica)`,
                            icon: "warning",
                            confirmButtonColor: "#10b981"
                        });
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

        if (currentStep < 4) {
            setCurrentStep(currentStep + 1);
        }
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
            // 🔥 DENTRO DE handleSubmit, reemplaza el body del fetch (línea ~400)
            const res = await fetch(`${API_BASE}/bls/${blNumber}/carga-suelta`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    // Datos BL
                    bl_number: formData.bl_number,
                    tipo_servicio: formData.tipo_servicio,
                    forma_pago_flete: formData.forma_pago_flete,
                    cond_transporte: formData.cond_transporte,
                    fecha_emision: formData.fecha_emision,
                    fecha_presentacion: formData.fecha_presentacion,
                    fecha_embarque: formData.fecha_embarque,
                    fecha_zarpe: formData.fecha_zarpe,

                    // Locaciones
                    lugar_emision: formData.lugar_emision,
                    lugar_recepcion: formData.lugar_recepcion,
                    puerto_embarque: formData.puerto_embarque,
                    puerto_descarga: formData.puerto_descarga,
                    lugar_destino: formData.lugar_destino,
                    lugar_entrega: formData.lugar_entrega,

                    // 🔥 IDs de participantes
                    shipper_id: formData.shipper_id,
                    consignee_id: formData.consignee_id,
                    notify_id: formData.notify_id,
                    almacenador_id: formData.almacenador_id,  // Almacenador

                    // Textos de participantes (backup)
                    shipper: formData.shipper,
                    consignee: formData.consignee,
                    notify_party: formData.notify_party,
                    almacenador: formData.almacenador,

                    // Items y observaciones
                    items: formData.items,
                    observaciones: formData.observaciones
                })
            });

            const data = await res.json();

            if (!data.success) {
                throw new Error(data.error || 'Error al actualizar');
            }

            // 🔥 REVALIDAR AUTOMÁTICAMENTE DESPUÉS DE GUARDAR
            try {
                await fetch(`${API_BASE}/api/bls/${blNumber}/revalidar`, {
                    method: 'POST'
                });
                console.log('✅ BL revalidado automáticamente');
            } catch (e) {
                console.warn('⚠️ No se pudo revalidar automáticamente:', e);
            }

            await Swal.fire({
                title: "¡Actualizado!",
                html: `
        <div class="text-center">
          <p class="text-lg mb-2">BL <strong class="text-green-600">${data.bl_number}</strong></p>
          <p class="text-sm text-gray-600">actualizado exitosamente</p>
        </div>
      `,
                icon: "success",
                confirmButtonColor: "#10b981",
                timer: 2000,
                showConfirmButton: false
            });

            // 🔥 REDIRIGIR CORRECTAMENTE SEGÚN DE DÓNDE VIENE
            const urlParams = new URLSearchParams(window.location.search);
            const returnTo = urlParams.get('returnTo');
            const manifestId = urlParams.get('manifestId');

            if (returnTo === 'xml-preview' && manifestId) {
                // Si viene desde generar XML, volver ahí
                navigate(`/manifiestos/${manifestId}/generar-xml`);
            } else {
                // Si viene desde otra parte, ir a la lista de BLs
                navigate(`/expo-bl`);
            }


        } catch (e) {
            console.error('❌ Error:', e);

            Swal.fire({
                title: "Error",
                text: e?.message || "No se pudo actualizar la carga suelta",
                icon: "error",
                confirmButtonColor: "#10b981"
            });
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
                    unidad_volumen: "MTQ"                }
            ]
        });
    };

    const removeItem = (index) => {
        if (formData.items.length === 1) {
            Swal.fire({
                title: "Atención",
                text: "Debe haber al menos 1 item",
                icon: "warning",
                confirmButtonColor: "#10b981"
            });
            return;
        }

        const newItems = formData.items.filter((_, idx) => idx !== index);
        newItems.forEach((item, idx) => {
            item.numero_item = idx + 1;
        });
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
                            Volver {/* El texto se mantiene genérico */}
                        </button>
                        <h1 className="text-2xl font-semibold text-[#0F2A44]">
                            Editar Carga Suelta
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">
                            BL #{formData.bl_number}
                        </p>
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
                                        <div
                                            className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold transition-all ${currentStep >= step.id
                                                ? "bg-[#0F2A44] text-white"
                                                : "bg-slate-200 text-slate-400"
                                                }`}
                                        >
                                            {step.id}
                                        </div>
                                        <span className="text-xs mt-2 text-slate-600 text-center">{step.name}</span>
                                    </div>
                                    {idx < STEPS.length - 1 && (
                                        <div
                                            className={`h-1 flex-1 transition-all ${currentStep > step.id ? "bg-[#0F2A44]" : "bg-slate-200"
                                                }`}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Form content */}
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                        {currentStep === 1 && (
                            <Step1DatosBL
                                formData={formData}
                                setFormData={setFormData}
                                manifiestoData={manifiestoData}
                                puertos={puertos}
                            />
                        )}
                        {currentStep === 2 && (
                            <Step2Participantes
                                formData={formData}
                                setFormData={setFormData}
                            />
                        )}
                        {currentStep === 3 && (
                            <Step3Items
                                formData={formData}
                                setFormData={setFormData}
                                addItem={addItem}
                                removeItem={removeItem}
                                tiposBulto={tiposBulto}
                            />
                        )}
                        {currentStep === 4 && (
                            <Step4Revision
                                formData={formData}
                                manifiestoData={manifiestoData}
                                tiposBulto={tiposBulto}
                            />
                        )}
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
                                ) : (
                                    'Actualizar Carga Suelta'
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

// ==================== COMPONENTS ====================
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
                        <strong>Carga Suelta (Break Bulk):</strong> Mercancía que se transporta en bultos individuales sin contenedor. Los items se detallan por tipo de bulto (pallets, cajas, sacos, etc.).
                    </p>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
            <InputField
                label="N° BL"
                value={formData.bl_number}
                onChange={(v) => setFormData({ ...formData, bl_number: v })}
                required
                placeholder="Ej: B042025"
                disabled
            />

            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                    Tipo Servicio <span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    value="BB - Break Bulk (Carga Suelta)"
                    disabled
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-100 text-slate-600 cursor-not-allowed"
                />
            </div>

            <SelectField
                label="Forma Pago Flete"
                value={formData.forma_pago_flete}
                onChange={(v) => setFormData({ ...formData, forma_pago_flete: v })}
                options={[
                    { value: "PREPAID", label: "PREPAID - Pagado en origen" },
                    { value: "COLLECT", label: "COLLECT - Por cobrar en destino" }
                ]}
                required
            />

            <InputField
                label="Condición Transporte"
                value={formData.cond_transporte}
                onChange={(v) => setFormData({ ...formData, cond_transporte: v.toUpperCase() })}
                placeholder="HH, CY, SD, etc."
                maxLength={10}
                required
            />
        </div>

        <h3 className="text-md font-semibold text-slate-700 mt-6 mb-3">Fechas</h3>
        <div className="grid grid-cols-2 gap-4">
            <InputField
                label="Fecha Emisión"
                type="date"
                value={formData.fecha_emision}
                onChange={(v) => setFormData({ ...formData, fecha_emision: v })}
                required
            />

            <InputField
                label="Fecha Presentación"
                type="date"
                value={formData.fecha_presentacion}
                onChange={(v) => setFormData({ ...formData, fecha_presentacion: v })}
                required
            />

            <InputField
                label="Fecha Embarque"
                type="date"
                value={formData.fecha_embarque}
                onChange={(v) => setFormData({ ...formData, fecha_embarque: v })}
                required
            />

            <InputField
                label="Fecha Zarpe"
                type="date"
                value={formData.fecha_zarpe}
                onChange={(v) => setFormData({ ...formData, fecha_zarpe: v })}
                required
            />
        </div>

        <h3 className="text-md font-semibold text-slate-700 mt-6 mb-3">Locaciones</h3>
        {manifiestoData?.puertoCentral && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-sm text-blue-800">
                <strong>Puerto Central del Manifiesto:</strong> {manifiestoData.puertoCentral}
            </div>
        )}

        <div className="grid grid-cols-2 gap-4">
            <SelectPuerto
                label="Lugar Emisión"
                value={formData.lugar_emision}
                onChange={(v) => setFormData({ ...formData, lugar_emision: v })}
                puertos={puertos}
                required
            />

            <SelectPuerto
                label="Lugar Recepción"
                value={formData.lugar_recepcion}
                onChange={(v) => setFormData({ ...formData, lugar_recepcion: v })}
                puertos={puertos}
                required
            />

            <SelectPuerto
                label="Puerto Embarque"
                value={formData.puerto_embarque}
                onChange={(v) => setFormData({ ...formData, puerto_embarque: v })}
                puertos={puertos}
                required
            />

            <SelectPuerto
                label="Puerto Descarga"
                value={formData.puerto_descarga}
                onChange={(v) => setFormData({ ...formData, puerto_descarga: v })}
                puertos={puertos}
                required
            />

            <SelectPuerto
                label="Lugar Destino"
                value={formData.lugar_destino}
                onChange={(v) => setFormData({ ...formData, lugar_destino: v })}
                puertos={puertos}
                required
            />

            <SelectPuerto
                label="Lugar Entrega"
                value={formData.lugar_entrega}
                onChange={(v) => setFormData({ ...formData, lugar_entrega: v })}
                puertos={puertos}
                required
            />
        </div>
    </div>
);

// 🔥 REEMPLAZA TODO el componente Step2Participantes (línea ~730)
const Step2Participantes = ({ formData, setFormData }) => {
    const handleParticipanteChange = (tipo, id, displayText) => {
        // Mapear nombres de campos
        const fieldMap = {
            shipper: { id: 'shipper_id', text: 'shipper' },
            consignee: { id: 'consignee_id', text: 'consignee' },
            notify: { id: 'notify_id', text: 'notify_party' },
            almacenador: { id: 'almacenador_id', text: 'almacenador' }
        };

        const fields = fieldMap[tipo];
        if (!fields) return;

        setFormData(prev => ({
            ...prev,
            [fields.id]: id,
            [fields.text]: displayText
        }));
    };

    const addObservacion = () => {
        setFormData({
            ...formData,
            observaciones: [
                ...formData.observaciones,
                { nombre: 'GRAL', contenido: '' }
            ]
        });
    };

    const removeObservacion = (index) => {
        const newObs = formData.observaciones.filter((_, idx) => idx !== index);
        setFormData({ ...formData, observaciones: newObs });
    };

    const updateObservacion = (index, field, value) => {
        const newObs = [...formData.observaciones];
        newObs[index] = { ...newObs[index], [field]: value };
        setFormData({ ...formData, observaciones: newObs });
    };

    return (
        <div className="space-y-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
                Participantes de Carga Suelta
            </h2>


            {/* 🔥 SHIPPER = EMBARCADOR */}
            <ParticipanteSelector
                label="Shipper / Embarcador (EMB)"
                tipo="shipper"
                value={formData.shipper_id}
                displayValue={formData.shipper}
                onChange={(id, text) => handleParticipanteChange('shipper', id, text)}
                required={true}
                helpText="El shipper actúa como embarcador en carga suelta"
            />

            {/* 🔥 CONSIGNEE con ParticipanteSelector */}
            <ParticipanteSelector
                label="Consignee / Consignatario (CONS)"
                tipo="consignee"
                value={formData.consignee_id}
                displayValue={formData.consignee}
                onChange={(id, text) => handleParticipanteChange('consignee', id, text)}
                required={true}
            />

            {/* 🔥 NOTIFY PARTY con ParticipanteSelector */}
            <ParticipanteSelector
                label="Notify Party / Notificar a (NOTI)"
                tipo="notify"
                value={formData.notify_id}
                displayValue={formData.notify_party}
                onChange={(id, text) => handleParticipanteChange('notify', id, text)}
                required={false}
            />
            {/* 🔥 ALMACENADOR (DIFERENTE AL SHIPPER) */}
            <ParticipanteSelector
                label="Almacenador (ALM)"
                tipo="almacenador"
                value={formData.almacenador_id}
                displayValue={formData.almacenador || ''}
                onChange={(id, text) => handleParticipanteChange('almacenador', id, text)}
                required={false}
                helpText="Empresa que almacena la mercancía (requiere código de almacén)"
            />



            {/* 🆕 SECCIÓN DE OBSERVACIONES */}
            <div className="mt-6 pt-6 border-t border-slate-200">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-md font-semibold text-slate-700">
                        Observaciones del BL
                    </h3>
                    <button
                        type="button"
                        onClick={addObservacion}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 flex items-center gap-2 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Agregar Observación
                    </button>
                </div>


                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-sm text-blue-800">
                    <strong>Info:</strong> Las observaciones aparecerán en el XML de carga suelta.
                    Por defecto se incluye "LISTA DE ENCARGO" como motivo (MOT).
                </div>

                <div className="space-y-3">
                    {formData.observaciones && formData.observaciones.map((obs, idx) => (
                        <div key={idx} className="border border-slate-200 rounded-lg p-3 bg-slate-50 relative">
                            {/* Botón eliminar */}
                            {formData.observaciones.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => removeObservacion(idx)}
                                    className="absolute top-2 right-2 text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
                                    title="Eliminar observación"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}

                            <div className="grid grid-cols-4 gap-3">
                                <div className="col-span-1">
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Tipo
                                    </label>
                                    <select
                                        value={obs.nombre}
                                        onChange={(e) => updateObservacion(idx, 'nombre', e.target.value)}
                                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="GRAL">GRAL</option>
                                        <option value="MOT">MOT</option>
                                        <option value="OBS">OBS</option>
                                    </select>
                                </div>

                                <div className="col-span-3">
                                    <label className="block text-xs font-medium text-slate-600 mb-1">
                                        Contenido
                                    </label>
                                    <input
                                        type="text"
                                        value={obs.contenido}
                                        onChange={(e) => updateObservacion(idx, 'contenido', e.target.value)}
                                        placeholder="Ej: SELLOS PARA CONTENEDORES"
                                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {(!formData.observaciones || formData.observaciones.length === 0) && (
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
                <button
                    onClick={addItem}
                    className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 flex items-center gap-2 transition-colors"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Agregar Item
                </button>
            </div>

            {formData.items.map((item, idx) => (
                <div key={idx} className="border border-slate-200 rounded-lg p-4 relative bg-slate-50 hover:bg-slate-100 transition-colors">
                    {formData.items.length > 1 && (
                        <button
                            onClick={() => removeItem(idx)}
                            className="absolute top-2 right-2 text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
                            title="Eliminar item"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    )}

                    <div className="mb-3 text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <span className="bg-[#0F2A44] text-white w-7 h-7 rounded-full flex items-center justify-center text-xs">
                            {item.numero_item}
                        </span>
                        Item #{item.numero_item}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <InputField
                            label="Marcas"
                            value={item.marcas}
                            onChange={(v) => updateItem(idx, 'marcas', v)}
                            placeholder="N/M (si no aplica)"
                            required
                        />

                        <SelectField
                            label="Tipo Bulto"
                            value={item.tipo_bulto}
                            onChange={(v) => updateItem(idx, 'tipo_bulto', v)}
                            options={tiposBulto}
                            required
                        />

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Descripción de la Mercancía <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={item.descripcion}
                                onChange={(e) => updateItem(idx, 'descripcion', e.target.value)}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F2A44]"
                                rows={5}
                                placeholder="Descripción detallada de la mercancía"
                            />
                        </div>

                        <InputField
                            label="Cantidad de Bultos"
                            type="number"
                            value={item.cantidad}
                            onChange={(v) => updateItem(idx, 'cantidad', v)}
                            required
                            min="1"
                            step="1"
                        />

                        <div className="col-span-2 grid grid-cols-2 gap-4">
                            <InputField
                                label="Peso Bruto"
                                type="number"
                                step="0.001"
                                value={item.peso_bruto}
                                onChange={(v) => updateItem(idx, 'peso_bruto', v)}
                                required
                                min="0.001"
                                placeholder="Ej: 1500.500"
                            />

                            <InputField
                                label="Unidad de Peso"
                                value={item.unidad_peso}
                                onChange={(v) => updateItem(idx, 'unidad_peso', v.toUpperCase())}
                                required
                                placeholder="Ej: KGM, TNE, LBR"
                                maxLength={3}
                            />
                        </div>

                        <div className="col-span-2 grid grid-cols-2 gap-4">
                            <InputField
                                label="Volumen"
                                type="number"
                                step="0.001"
                                value={item.volumen}
                                onChange={(v) => updateItem(idx, 'volumen', v)}
                                min="0"
                                placeholder="0 si no aplica"
                                required
                            />

                            <InputField
                                label="Unidad de Volumen"
                                value={item.unidad_volumen}
                                onChange={(v) => updateItem(idx, 'unidad_volumen', v.toUpperCase())}
                                required
                                placeholder="Ej: MTQ, FTQ, LTR"
                                maxLength={3}
                            />
                        </div>
                    </div>
                </div>
            ))}

            {formData.items.length === 0 && (
                <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
                    <svg className="w-12 h-12 mx-auto mb-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
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
                <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Datos del BL
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                        <span className="font-medium text-slate-600">N° BL:</span>
                        <span className="ml-2 text-slate-900 font-mono">{formData.bl_number || "—"}</span>
                    </div>

                    <div>
                        <span className="font-medium text-slate-600">Tipo Servicio:</span>
                        <span className="ml-2 text-slate-900 bg-blue-100 px-2 py-0.5 rounded text-xs font-medium">
                            BB (Break Bulk)
                        </span>
                    </div>

                    <div>
                        <span className="font-medium text-slate-600">Forma Pago:</span>
                        <span className="ml-2 text-slate-900">{formData.forma_pago_flete}</span>
                    </div>

                    <div>
                        <span className="font-medium text-slate-600">Cond. Transporte:</span>
                        <span className="ml-2 text-slate-900">{formData.cond_transporte || "—"}</span>
                    </div>

                    <div className="col-span-2 border-t border-slate-200 pt-2 mt-2">
                        <span className="font-medium text-slate-600">Fechas:</span>
                        <div className="ml-2 text-slate-900 text-xs grid grid-cols-2 gap-2 mt-1">
                            <div>Emisión: {formData.fecha_emision || "—"}</div>
                            <div>Presentación: {formData.fecha_presentacion || "—"}</div>
                            <div>Embarque: {formData.fecha_embarque || "—"}</div>
                            <div>Zarpe: {formData.fecha_zarpe || "—"}</div>
                        </div>
                    </div>

                    <div className="col-span-2 border-t border-slate-200 pt-2 mt-2">
                        <span className="font-medium text-slate-600">Lugar Emisión:</span>
                        <span className="ml-2 text-slate-900 font-mono">{formData.lugar_emision || "—"}</span>
                    </div>

                    <div className="col-span-2">
                        <span className="font-medium text-slate-600">Lugar Recepción:</span>
                        <span className="ml-2 text-slate-900 font-mono">{formData.lugar_recepcion || "—"}</span>
                    </div>

                    <div className="col-span-2">
                        <span className="font-medium text-slate-600">Puerto Embarque:</span>
                        <span className="ml-2 text-slate-900 font-mono">{formData.puerto_embarque || "—"}</span>
                    </div>

                    <div className="col-span-2">
                        <span className="font-medium text-slate-600">Puerto Descarga:</span>
                        <span className="ml-2 text-slate-900 font-mono">{formData.puerto_descarga || "—"}</span>
                    </div>
                </div>
            </div>

            <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                <h3 className="font-semibold text-emerald-800 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    Totales de Carga
                </h3>
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
                {totalVolumen > 0 && (
                    <div className="text-center mt-3 pt-3 border-t border-emerald-200">
                        <div className="text-emerald-600 font-medium text-sm">Volumen Total</div>
                        <div className="text-xl font-bold text-emerald-900">{totalVolumen.toFixed(3)} {formData.items[0]?.unidad_volumen || 'MTQ'}</div>
                    </div>
                )}
            </div>

            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    Items de Carga ({formData.items.length})
                </h3>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                    {formData.items.map((item, idx) => {
                        const tipoBultoLabel = tiposBulto.find(t => t.value === item.tipo_bulto)?.label || item.tipo_bulto;

                        return (
                            <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 text-sm hover:border-slate-300 transition-colors">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="bg-[#0F2A44] text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold">
                                                {item.numero_item}
                                            </span>
                                            <span className="font-medium text-slate-900">Item #{item.numero_item}</span>
                                            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                                {tipoBultoLabel}
                                            </span>
                                        </div>
                                        <div className="text-slate-600 text-xs line-clamp-2 mb-2 pl-7">
                                            {item.descripcion || "Sin descripción"}
                                        </div>
                                        <div className="flex flex-wrap gap-3 text-xs text-slate-500 pl-7">
                                            <span className="flex items-center gap-1">
                                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                                    <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                                                </svg>
                                                {item.cantidad} bulto(s)
                                            </span>
                                            <span>•</span>
                                            <span className="font-mono">{parseFloat(item.peso_bruto).toFixed(3)} {item.unidad_peso}</span>
                                            {item.volumen > 0 && (
                                                <>
                                                    <span>•</span>
                                                    <span className="font-mono">{parseFloat(item.volumen).toFixed(3)} {item.unidad_volumen}</span>
                                                </>
                                            )}
                                            <span>•</span>
                                            <span className="text-xs">Marcas: {item.marcas}</span>
                                        </div>
                                    </div>
                                    <div className="ml-3 flex flex-col gap-1">
                                        <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-medium">
                                            Sin CNT
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <h3 className="font-semibold text-slate-700 mb-3">Participantes del BL</h3>
                <div className="space-y-2 text-sm">
                    <div>
                        <span className="font-medium text-slate-600">Shipper/Embarcador (EMB):</span>
                        <p className="text-slate-900 mt-1 text-xs whitespace-pre-line">{formData.shipper || "—"}</p>
                    </div>
                    <div className="pt-2 border-t border-slate-200">
                        <span className="font-medium text-slate-600">Consignee (CONS):</span>
                        <p className="text-slate-900 mt-1 text-xs whitespace-pre-line">{formData.consignee || "—"}</p>
                    </div>
                    <div className="pt-2 border-t border-slate-200">
                        <span className="font-medium text-slate-600">Notify Party (NOTI):</span>
                        <p className="text-slate-900 mt-1 text-xs whitespace-pre-line">{formData.notify_party || "—"}</p>
                    </div>
                    {formData.almacenador && (
                        <div className="pt-2 border-t border-slate-200">
                            <span className="font-medium text-slate-600">Almacenador (ALM):</span>
                            <p className="text-slate-900 mt-1 text-xs whitespace-pre-line">{formData.almacenador}</p>
                        </div>
                    )}
                </div>
                <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-500">
                    <strong>Nota:</strong> Los roles EMI (Emisor), REP (Representante) y EMIDO (Emisor Doc) se toman de las referencias del manifiesto.
                </div>
            </div>
            {/* 🆕 Observaciones */}
            {formData.observaciones && formData.observaciones.length > 0 && (
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                        </svg>
                        Observaciones ({formData.observaciones.length})
                    </h3>
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

const InputField = ({ label, type = "text", value, onChange, placeholder, required, step, min, maxLength, disabled }) => (
    <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            step={step}
            min={min}
            maxLength={maxLength}
            disabled={disabled}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F2A44] transition-colors disabled:bg-slate-100 disabled:cursor-not-allowed"
        />
    </div>
);

const SelectField = ({ label, value, onChange, options, required }) => (
    <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
            {label} {required && <span className="text-red-500">*</span>}
        </label>
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F2A44] transition-colors"
        >
            {options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
        </select>
    </div>
);

// 🔥 REEMPLAZA el componente SelectPuerto en CargaSueltaEdit.jsx (al final del archivo)
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
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value.toUpperCase())}
                    list={datalistId}
                    placeholder="Escribe o selecciona un puerto..."
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                        mostrarWarning 
                            ? 'border-red-300 focus:ring-red-500 bg-red-50' 
                            : 'border-slate-300 focus:ring-[#0F2A44]'
                    }`}
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
                {puertos.map(puerto => (
                    <option 
                        key={puerto.codigo} 
                        value={puerto.codigo}
                    >
                        {puerto.nombre}
                    </option>
                ))}
            </datalist>
            {mostrarWarning && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1 font-medium">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    El código "{value}" no existe en el catálogo de puertos
                </p>
            )}
        </div>
    );
};

export default CargaSueltaEdit;