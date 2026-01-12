import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import Sidebar from "../components/Sidebar";

// Simulación de Sidebar (reemplaza con tu componente real)


const steps = [
    { id: 1, name: "General", description: "Información básica del BL" },
    { id: 2, name: "Addr.", description: "Shipper, Consignee, Notify" },
    { id: 3, name: "Carga", description: "Descripción y medidas" },
    { id: 4, name: "Revisión", description: "Confirmar cambios" }
];

const ExpoBLEdit = () => {
    const { blNumber } = useParams();
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Estado del formulario (solo campos que EXISTEN en la BD)
    const [formData, setFormData] = useState({
        bl_number: "",
        viaje: "",
        tipo_servicio: "FF",
        fecha_emision: "",
        fecha_zarpe: "",
        fecha_embarque: "",
        shipper: "",
        consignee: "",
        notify_party: "",
        descripcion_carga: "",
        peso_bruto: "",
        volumen: "",
        bultos: ""
    });

    useEffect(() => {
        const fetchBL = async () => {
            setLoading(true);
            setError("");
            try {
                const res = await fetch(`http://localhost:4000/bls/${blNumber}`);
                
                if (!res.ok) {
                    throw new Error(`Error ${res.status}: No se pudo cargar el BL`);
                }
                
                const data = await res.json();
                
                // Función para convertir fecha MySQL a formato input[type="date"]
                const formatDate = (mysqlDate) => {
                    if (!mysqlDate) return "";
                    return mysqlDate.split("T")[0];
                };
                
                // Función para convertir datetime MySQL a formato input[type="datetime-local"]
                const formatDateTime = (mysqlDateTime) => {
                    if (!mysqlDateTime) return "";
                    return mysqlDateTime.substring(0, 16);
                };
                
                // Mapear datos del BL al formulario
                setFormData({
                    bl_number: data.bl_number || "",
                    viaje: data.viaje || "",
                    tipo_servicio: data.tipo_servicio_id === 1 ? "FF" : "MM",
                    fecha_emision: formatDate(data.fecha_emision),
                    fecha_zarpe: formatDateTime(data.fecha_zarpe),
                    fecha_embarque: formatDateTime(data.fecha_embarque),
                    shipper: data.shipper || "",
                    consignee: data.consignee || "",
                    notify_party: data.notify_party || "",
                    descripcion_carga: data.descripcion_carga || "",
                    peso_bruto: data.peso_bruto || "",
                    volumen: data.volumen || "",
                    bultos: data.bultos || ""
                });
            } catch (e) {
                console.error("Error completo:", e);
                setError(e?.message || "Error desconocido");
                
                // SweetAlert para error de carga
                Swal.fire({
                    icon: "error",
                    title: "Error al cargar BL",
                    text: e?.message || "No se pudo cargar la información del BL",
                    confirmButtonColor: "#0F2A44"
                });
            } finally {
                setLoading(false);
            }
        };

        if (blNumber) {
            fetchBL();
        }
    }, [blNumber]);

    const updateField = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    // ✅ VALIDACIONES
    const validateStep = (step) => {
        switch (step) {
            case 1: // General
                if (!formData.tipo_servicio) {
                    Swal.fire({
                        icon: "warning",
                        title: "Campo requerido",
                        text: "Debes seleccionar un tipo de servicio",
                        confirmButtonColor: "#0F2A44"
                    });
                    return false;
                }
                if (!formData.fecha_emision) {
                    Swal.fire({
                        icon: "warning",
                        title: "Campo requerido",
                        text: "La fecha de emisión es obligatoria",
                        confirmButtonColor: "#0F2A44"
                    });
                    return false;
                }
                break;

            case 2: // Direcciones
                if (!formData.shipper || formData.shipper.trim().length < 5) {
                    Swal.fire({
                        icon: "warning",
                        title: "Campo requerido",
                        text: "Debes completar la información del Shipper (mínimo 5 caracteres)",
                        confirmButtonColor: "#0F2A44"
                    });
                    return false;
                }
                if (!formData.consignee || formData.consignee.trim().length < 5) {
                    Swal.fire({
                        icon: "warning",
                        title: "Campo requerido",
                        text: "Debes completar la información del Consignatario (mínimo 5 caracteres)",
                        confirmButtonColor: "#0F2A44"
                    });
                    return false;
                }
                if (!formData.notify_party || formData.notify_party.trim().length < 5) {
                    Swal.fire({
                        icon: "warning",
                        title: "Campo requerido",
                        text: "Debes completar la información del Notify Party (mínimo 5 caracteres)",
                        confirmButtonColor: "#0F2A44"
                    });
                    return false;
                }
                break;

            case 3: // Carga
                if (!formData.peso_bruto || parseFloat(formData.peso_bruto) <= 0) {
                    Swal.fire({
                        icon: "warning",
                        title: "Campo requerido",
                        text: "El peso bruto debe ser mayor a 0",
                        confirmButtonColor: "#0F2A44"
                    });
                    return false;
                }
                if (!formData.volumen || parseFloat(formData.volumen) <= 0) {
                    Swal.fire({
                        icon: "warning",
                        title: "Campo requerido",
                        text: "El volumen debe ser mayor a 0",
                        confirmButtonColor: "#0F2A44"
                    });
                    return false;
                }
                if (!formData.bultos || parseInt(formData.bultos) <= 0) {
                    Swal.fire({
                        icon: "warning",
                        title: "Campo requerido",
                        text: "La cantidad de bultos debe ser mayor a 0",
                        confirmButtonColor: "#0F2A44"
                    });
                    return false;
                }
                if (!formData.descripcion_carga || formData.descripcion_carga.trim().length < 10) {
                    Swal.fire({
                        icon: "warning",
                        title: "Campo requerido",
                        text: "La descripción de la carga debe tener al menos 10 caracteres",
                        confirmButtonColor: "#0F2A44"
                    });
                    return false;
                }
                break;
        }
        return true;
    };

    const handleSave = async () => {
        // ✅ Confirmación antes de guardar
        const result = await Swal.fire({
            title: "¿Guardar cambios?",
            html: `
                <p class="text-sm text-gray-600 mb-3">Estás por guardar los cambios del BL:</p>
                <p class="font-semibold text-lg">${formData.bl_number}</p>
                <p class="text-sm text-gray-500 mt-2">Los cambios se aplicarán inmediatamente</p>
            `,
            showCancelButton: true,
            confirmButtonText: "Sí, guardar",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#10b981",
            cancelButtonColor: "#e43a3aff",
            reverseButtons: true
        });

        if (!result.isConfirmed) return;

        setSaving(true);
        setError("");
        
        try {
            // Convertir fechas datetime-local a formato MySQL
            const formatToMysql = (dateTimeLocal) => {
                if (!dateTimeLocal) return null;
                return dateTimeLocal.replace("T", " ") + ":00";
            };

            // Preparar datos para enviar
            const dataToSend = {
                tipo_servicio: formData.tipo_servicio,
                fecha_emision: formData.fecha_emision || null,
                fecha_zarpe: formatToMysql(formData.fecha_zarpe),
                fecha_embarque: formatToMysql(formData.fecha_embarque),
                shipper: formData.shipper || null,
                consignee: formData.consignee || null,
                notify_party: formData.notify_party || null,
                descripcion_carga: formData.descripcion_carga || null,
                peso_bruto: formData.peso_bruto ? parseFloat(formData.peso_bruto) : null,
                volumen: formData.volumen ? parseFloat(formData.volumen) : null,
                bultos: formData.bultos ? parseInt(formData.bultos) : null
            };

            console.log("Enviando datos:", dataToSend);

            const res = await fetch(`http://localhost:4000/bls/${blNumber}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dataToSend)
            });
            
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Error al guardar");
            }
            
            // ✅ SweetAlert de éxito
            await Swal.fire({
                icon: "success",
                title: "¡Cambios guardados!",
                html: `
                    <p class="text-sm text-gray-600">El BL <strong>${formData.bl_number}</strong> se actualizó correctamente</p>
                `,
                timer: 2000,
                showConfirmButton: false
            });
            
            // Redirigir al detalle
            navigate(`/expo/detail/${blNumber}`);
            
        } catch (e) {
            console.error("Error al guardar:", e);
            setError(e?.message || "Error al guardar");
            
            // ✅ SweetAlert de error
            Swal.fire({
                icon: "error",
                title: "Error al guardar",
                text: e?.message || "No se pudieron guardar los cambios",
                confirmButtonColor: "#ef4444"
            });
        } finally {
            setSaving(false);
        }
    };

    const nextStep = () => {
        // Validar antes de avanzar
        if (!validateStep(currentStep)) {
            return;
        }

        if (currentStep < steps.length) {
            setCurrentStep(currentStep + 1);
        }
    };

    const prevStep = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen bg-slate-100">
                <Sidebar />
                <main className="flex-1 p-10">
                    <div className="flex items-center justify-center h-64">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4"></div>
                            <p className="text-sm text-slate-600">Cargando BL...</p>
                        </div>
                    </div>
                </main>
            </div>
        );
    }

    if (error && !formData.bl_number) {
        return (
            <div className="flex min-h-screen bg-slate-100">
                <Sidebar />
                <main className="flex-1 p-10">
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        <strong>Error al cargar BL:</strong> {error}
                    </div>
                    <button
                        onClick={() => navigate("/expo")}
                        className="text-sm text-slate-500 hover:text-slate-800"
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
                    <button
                        onClick={() => navigate(`/expo/detail/${blNumber}`)}
                        className="text-sm text-slate-500 hover:text-slate-800 mb-2"
                    >
                        ← Volver al detalle
                    </button>
                    <h1 className="text-2xl font-semibold text-slate-900">
                        Editar BL: {formData.bl_number}
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Viaje: <strong>{formData.viaje || "—"}</strong>
                    </p>
                </div>

                {/* Stepper */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <div className="flex items-center justify-between">
                        {steps.map((step, index) => (
                            <div key={step.id} className="flex items-center flex-1">
                                <div className="flex flex-col items-center">
                                    <button
                                        onClick={() => setCurrentStep(step.id)}
                                        className={[
                                            "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all",
                                            currentStep === step.id
                                                ? "bg-slate-900 text-white"
                                                : currentStep > step.id
                                                    ? "bg-green-500 text-white"
                                                    : "bg-slate-200 text-slate-500"
                                        ].join(" ")}
                                    >
                                        {currentStep > step.id ? "✓" : step.id}
                                    </button>
                                    <span className="text-xs text-slate-600 mt-2 text-center">
                                        {step.name}
                                    </span>
                                </div>
                                {index < steps.length - 1 && (
                                    <div className="flex-1 h-0.5 bg-slate-200 mx-2" />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Contenido del Step */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                    <h2 className="text-xl font-semibold text-slate-900 mb-2">
                        {steps[currentStep - 1].name}
                    </h2>
                    <p className="text-sm text-slate-500 mb-6">
                        {steps[currentStep - 1].description}
                    </p>

                    {/* STEP 1: GENERAL */}
                    {currentStep === 1 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    BL Number
                                </label>
                                <input
                                    type="text"
                                    value={formData.bl_number}
                                    disabled
                                    className="w-full px-4 py-2 rounded-lg border border-slate-300 bg-slate-50 text-slate-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Viaje
                                </label>
                                <input
                                    type="text"
                                    value={formData.viaje}
                                    disabled
                                    className="w-full px-4 py-2 rounded-lg border border-slate-300 bg-slate-50 text-slate-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Tipo de Servicio <span className="text-red-500">*</span>
                                </label>
                                <select
                                    value={formData.tipo_servicio}
                                    onChange={(e) => updateField("tipo_servicio", e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500"
                                >
                                    <option value="FF">FCL/FCL (FF)</option>
                                    <option value="MM">EMPTY (MM)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Fecha Emisión <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={formData.fecha_emision}
                                    onChange={(e) => updateField("fecha_emision", e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Fecha Zarpe
                                </label>
                                <input
                                    type="datetime-local"
                                    value={formData.fecha_zarpe}
                                    onChange={(e) => updateField("fecha_zarpe", e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Fecha Embarque
                                </label>
                                <input
                                    type="datetime-local"
                                    value={formData.fecha_embarque}
                                    onChange={(e) => updateField("fecha_embarque", e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500"
                                />
                            </div>
                        </div>
                    )}

                    {/* STEP 2: DIRECCIONES */}
                    {currentStep === 2 && (
                        <div className="space-y-8">
                            <div className="border-b pb-6">
                                <h3 className="font-semibold text-slate-800 mb-4">
                                    Shipper / Embarcador <span className="text-red-500">*</span>
                                </h3>
                                <textarea
                                    rows={4}
                                    value={formData.shipper}
                                    onChange={(e) => updateField("shipper", e.target.value)}
                                    placeholder="Nombre completo, dirección y contacto del embarcador"
                                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500"
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    Incluye nombre, dirección y datos de contacto en un solo campo
                                </p>
                            </div>

                            <div className="border-b pb-6">
                                <h3 className="font-semibold text-slate-800 mb-4">
                                    Consignatario <span className="text-red-500">*</span>
                                </h3>
                                <textarea
                                    rows={4}
                                    value={formData.consignee}
                                    onChange={(e) => updateField("consignee", e.target.value)}
                                    placeholder="Nombre completo, dirección y contacto del consignatario"
                                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500"
                                />
                            </div>

                            <div>
                                <h3 className="font-semibold text-slate-800 mb-4">
                                    Notify Party <span className="text-red-500">*</span>
                                </h3>
                                <textarea
                                    rows={4}
                                    value={formData.notify_party}
                                    onChange={(e) => updateField("notify_party", e.target.value)}
                                    placeholder="Nombre completo, dirección y contacto del notify"
                                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500"
                                />
                            </div>
                        </div>
                    )}

                    {/* STEP 3: CARGA */}
                    {currentStep === 3 && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Peso Bruto (KGM) <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="0.001"
                                        value={formData.peso_bruto}
                                        onChange={(e) => updateField("peso_bruto", e.target.value)}
                                        className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Volumen (MTQ) <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="0.001"
                                        value={formData.volumen}
                                        onChange={(e) => updateField("volumen", e.target.value)}
                                        className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Cantidad de Bultos <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.bultos}
                                        onChange={(e) => updateField("bultos", e.target.value)}
                                        className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Descripción de Mercancía <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    rows={8}
                                    value={formData.descripcion_carga}
                                    onChange={(e) => updateField("descripcion_carga", e.target.value)}
                                    placeholder="Descripción detallada de la carga..."
                                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500 font-mono text-sm"
                                />
                            </div>
                        </div>
                    )}

                    {/* STEP 4: REVISIÓN */}
                    {currentStep === 4 && (
                        <div className="space-y-6">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                                <h3 className="font-semibold text-blue-900 mb-4 text-lg">
                                    📋 Resumen de cambios
                                </h3>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="text-blue-700 font-medium">BL Number:</p>
                                        <p className="text-blue-900">{formData.bl_number}</p>
                                    </div>
                                    <div>
                                        <p className="text-blue-700 font-medium">Viaje:</p>
                                        <p className="text-blue-900">{formData.viaje}</p>
                                    </div>
                                    <div>
                                        <p className="text-blue-700 font-medium">Tipo Servicio:</p>
                                        <p className="text-blue-900">{formData.tipo_servicio}</p>
                                    </div>
                                    <div>
                                        <p className="text-blue-700 font-medium">Fecha Emisión:</p>
                                        <p className="text-blue-900">{formData.fecha_emision || "—"}</p>
                                    </div>
                                    <div>
                                        <p className="text-blue-700 font-medium">Peso Bruto:</p>
                                        <p className="text-blue-900">{formData.peso_bruto} KGM</p>
                                    </div>
                                    <div>
                                        <p className="text-blue-700 font-medium">Volumen:</p>
                                        <p className="text-blue-900">{formData.volumen} MTQ</p>
                                    </div>
                                    <div>
                                        <p className="text-blue-700 font-medium">Bultos:</p>
                                        <p className="text-blue-900">{formData.bultos}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                                <strong>⚠️ Atención:</strong> Al confirmar, los cambios se aplicarán inmediatamente en el sistema SIDEMAR.
                            </div>
                        </div>
                    )}
                </div>

                {/* Botones de navegación */}
                <div className="flex items-center justify-between mt-6">
                    <button
                        onClick={prevStep}
                        disabled={currentStep === 1}
                        className="px-6 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        ← Anterior
                    </button>

                    <div className="text-sm text-slate-600">
                        Paso {currentStep} de {steps.length}
                    </div>

                    {currentStep < steps.length ? (
                        <button
                            onClick={nextStep}
                            className="px-6 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors"
                        >
                            Siguiente →
                        </button>
                    ) : (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-8 py-3 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
                        >
                            {saving ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Guardando...
                                </span>
                            ) : (
                                "Guardar Cambios"
                            )}
                        </button>
                    )}
                </div>
            </main>
        </div>
    );
};

export default ExpoBLEdit;