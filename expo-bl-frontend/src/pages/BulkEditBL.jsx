import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Edit3, AlertCircle, Search } from "lucide-react";
import Sidebar from "../components/Sidebar";

const estadoStyles = {
    "CREADO": "bg-blue-100 text-blue-800 ring-blue-200",
    "VALIDADO": "bg-green-100 text-green-800 ring-green-200",
    "ENVIADO": "bg-purple-100 text-purple-800 ring-purple-200",
    "ANULADO": "bg-red-100 text-red-800 ring-red-200",
    "ACTIVO": "bg-emerald-100 text-emerald-800 ring-emerald-200",
    "INACTIVO": "bg-slate-100 text-slate-800 ring-slate-200",
};

const formatDateCL = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${dd}-${mm}-${yyyy}`;
};

const BulkEditBL = () => {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(true);
    const [allBLs, setAllBLs] = useState([]);
    const [error, setError] = useState("");

    // Step 1: Selección de manifesto/viaje o búsqueda
    const [searchMode, setSearchMode] = useState("viaje");
    const [selectedViaje, setSelectedViaje] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [filteredBLs, setFilteredBLs] = useState([]);

    // Step 2: Selección de BLs
    const [selectedBLs, setSelectedBLs] = useState([]);

    // Step 3: Campos a editar
    const [fieldsToEdit, setFieldsToEdit] = useState({
        shipper: false,
        consignee: false,
        notify: false,
        puerto_embarque: false,
        puerto_descarga: false,
        descripcion_carga: false,
        bultos: false,
        peso_bruto: false,
        status: false,
    });

    const [editValues, setEditValues] = useState({
        shipper: "",
        consignee: "",
        notify: "",
        puerto_embarque: "",
        puerto_descarga: "",
        descripcion_carga: "",
        bultos: "",
        peso_bruto: "",
        status: "ACTIVO",
    });

    // Step 4: Edición de puertos individual
    const [puertosDisponibles, setPuertosDisponibles] = useState([]);
    const [editarPuertos, setEditarPuertos] = useState(false);
    const [puertosIndividuales, setPuertosIndividuales] = useState({});

    // 🆕 ESTADOS PARA EDICIÓN MASIVA DE PUERTOS
    const [editarPuertosMasivo, setEditarPuertosMasivo] = useState(false);
    const [puertosMasivos, setPuertosMasivos] = useState({
        lugar_recepcion_cod: '',
        puerto_embarque_cod: '',
        puerto_descarga_cod: '',
        lugar_entrega_cod: '',
        lugar_destino_cod: '',
        lugar_emision_cod: ''
    });

    // Step 5: Confirmación y guardado
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    useEffect(() => {
        fetchBLs();
        fetchPuertos();
    }, []);

    const fetchBLs = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("http://localhost:4000/bls");
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            setAllBLs(Array.isArray(data) ? data : []);
        } catch (e) {
            setError(e?.message || "Error desconocido");
            setAllBLs([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchPuertos = async () => {
        try {
            const res = await fetch("http://localhost:4000/mantenedores/puertos");
            if (!res.ok) throw new Error('Error al cargar puertos');
            const data = await res.json();
            setPuertosDisponibles(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error('Error al cargar puertos:', e);
            setPuertosDisponibles([]);
        }
    };

    const viajes = [...new Set(allBLs.map(bl => bl.viaje).filter(Boolean))].sort();

    // Filtrar BLs según modo de selección
    useEffect(() => {
        if (searchMode === "viaje" && selectedViaje) {
            const bls = allBLs.filter(bl => bl.viaje === selectedViaje);
            setFilteredBLs(bls);
        } else if (searchMode === "search" && searchTerm) {
            const term = searchTerm.toLowerCase();
            const bls = allBLs.filter(bl =>
                (bl.bl_number || "").toLowerCase().includes(term) ||
                (bl.shipper || "").toLowerCase().includes(term) ||
                (bl.consignee || "").toLowerCase().includes(term)
            );

            const viajes = [...new Set(bls.map(bl => bl.viaje))];
            if (viajes.length > 1) {
                setError("Los BLs encontrados pertenecen a diferentes manifiestos. Por favor, refina tu búsqueda.");
                setFilteredBLs([]);
            } else {
                setError("");
                setFilteredBLs(bls);
            }
        } else {
            setFilteredBLs([]);
        }
    }, [searchMode, selectedViaje, searchTerm, allBLs]);



    // Inicializar puertos individuales cuando se seleccionan BLs
    useEffect(() => {
        if (selectedBLs.length > 0 && filteredBLs.length > 0) {
            const initialPuertos = {};
            selectedBLs.forEach(blNumber => {
                const bl = filteredBLs.find(b => b.bl_number === blNumber);
                if (bl) {
                    // 🆕 DEBUG: Ver qué datos tiene el BL
                    console.log('🔍 BL encontrado:', blNumber);
                    console.log('📦 Datos del BL:', {
                        lugar_recepcion_cod: bl.lugar_recepcion_cod,
                        puerto_embarque_cod: bl.puerto_embarque_cod,
                        puerto_descarga_cod: bl.puerto_descarga_cod,
                        lugar_entrega_cod: bl.lugar_entrega_cod,
                        lugar_destino_cod: bl.lugar_destino_cod,
                        lugar_emision_cod: bl.lugar_emision_cod
                    });

                    initialPuertos[blNumber] = {
                        lugar_recepcion_cod: bl.lugar_recepcion_cod || '',
                        puerto_embarque_cod: bl.puerto_embarque_cod || '',
                        puerto_descarga_cod: bl.puerto_descarga_cod || '',
                        lugar_entrega_cod: bl.lugar_entrega_cod || '',
                        lugar_destino_cod: bl.lugar_destino_cod || '',
                        lugar_emision_cod: bl.lugar_emision_cod || ''
                    };
                }
            });

            // 🆕 DEBUG: Ver qué se guardó en el estado
            console.log('💾 Puertos individuales inicializados:', initialPuertos);
            setPuertosIndividuales(initialPuertos);
        }
    }, [selectedBLs, filteredBLs]);

    // 🆕 Inicializar puertos masivos con el primer BL seleccionado
    useEffect(() => {
        if (editarPuertosMasivo && selectedBLs.length > 0 && filteredBLs.length > 0) {
            const primerBL = filteredBLs.find(b => b.bl_number === selectedBLs[0]);
            if (primerBL) {
                setPuertosMasivos({
                    lugar_recepcion_cod: primerBL.lugar_recepcion_cod || '',
                    puerto_embarque_cod: primerBL.puerto_embarque_cod || '',
                    puerto_descarga_cod: primerBL.puerto_descarga_cod || '',
                    lugar_entrega_cod: primerBL.lugar_entrega_cod || '',
                    lugar_destino_cod: primerBL.lugar_destino_cod || '',
                    lugar_emision_cod: primerBL.lugar_emision_cod || ''
                });
            }
        }
    }, [editarPuertosMasivo, selectedBLs, filteredBLs]);

    const handleSelectAll = () => {
        if (selectedBLs.length === filteredBLs.length) {
            setSelectedBLs([]);
        } else {
            setSelectedBLs(filteredBLs.map(bl => bl.bl_number));
        }
    };

    const handleSelectBL = (blNumber) => {
        setSelectedBLs(prev =>
            prev.includes(blNumber)
                ? prev.filter(n => n !== blNumber)
                : [...prev, blNumber]
        );
    };

    const handleToggleField = (field) => {
        setFieldsToEdit(prev => ({
            ...prev,
            [field]: !prev[field]
        }));
    };

    const handlePuertoChange = (blNumber, field, value) => {
        setPuertosIndividuales(prev => ({
            ...prev,
            [blNumber]: {
                ...prev[blNumber],
                [field]: value
            }
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        setError("");

        try {
            const updates = {};
            Object.keys(fieldsToEdit).forEach(field => {
                if (fieldsToEdit[field]) {
                    updates[field] = editValues[field];
                }
            });

            if (Object.keys(updates).length > 0) {
                const response = await fetch("http://localhost:4000/bls/bulk-update", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        blNumbers: selectedBLs,
                        updates: updates
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Error al actualizar campos generales');
                }
            }
            // 2. 🆕 Actualizar puertos MASIVOS (todos los BLs reciben lo mismo)
            if (editarPuertosMasivo) {
                const promises = selectedBLs.map(blNumber => {
                    return fetch(`http://localhost:4000/bls/${blNumber}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(puertosMasivos)
                    });
                });

                await Promise.all(promises);
            }
            if (editarPuertos) {
                const promises = selectedBLs.map(blNumber => {
                    const puertos = puertosIndividuales[blNumber];
                    return fetch(`http://localhost:4000/bls/${blNumber}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(puertos)
                    });
                });

                await Promise.all(promises);
            }

            setSaveSuccess(true);
            setTimeout(() => {
                navigate("/expo-bl");
            }, 2000);

        } catch (e) {
            setError(e?.message || "Error al guardar");
        } finally {
            setSaving(false);
        }
    };
    // 👇 VALIDACIONES - AQUÍ ESTÁ LA PARTE QUE FALTABA
    const canContinue = {
        1: searchMode === "viaje" ? selectedViaje : filteredBLs.length > 0,
        2: selectedBLs.length > 0,
        3: true,
        4: true,
    };

    const hasChangesToSave = Object.values(fieldsToEdit).some(v => v) || editarPuertos || editarPuertosMasivo;    // 👆 FIN DE VALIDACIONES

    // Validaciones para continuar en cada step
    const canProceedStep1 = searchMode === "viaje" ? selectedViaje : filteredBLs.length > 0;
    const canProceedStep2 = selectedBLs.length > 0;
    const canProceedStep3 = Object.values(fieldsToEdit).some(v => v);

    const steps = [
        { number: 1, title: "Seleccionar Manifesto" },
        { number: 2, title: "Seleccionar BLs" },
        { number: 3, title: "Editar Campos" },
        { number: 4, title: "Editar Puertos" },
        { number: 5, title: "Confirmar" },
    ];

    return (
        <div className="flex min-h-screen bg-slate-100">
                    <Sidebar />

            <main className="flex-1 p-6 lg:p-10">
                <div className="mb-6">
                    <button
                        onClick={() => navigate("/expo-bl")}
                        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span className="text-sm font-medium">Volver a Lista de BLs</span>
                    </button>

                    <h1 className="text-2xl font-semibold text-[#0F2A44]">
                        Edición Masiva de BLs
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Edita múltiples Bills of Lading del mismo manifesto simultáneamente
                    </p>
                </div>

                {/* Progress Steps */}
                <div className="mb-8">
                    <div className="flex items-center justify-between max-w-3xl mx-auto">
                        {steps.map((step, index) => (
                            <div key={step.number} className="flex items-center flex-1">
                                <div className="flex flex-col items-center flex-1">
                                    <div
                                        className={[
                                            "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all",
                                            currentStep > step.number
                                                ? "bg-green-500 text-white"
                                                : currentStep === step.number
                                                    ? "bg-[#0F2A44] text-white ring-4 ring-blue-100"
                                                    : "bg-slate-200 text-slate-500"
                                        ].join(" ")}
                                    >
                                        {currentStep > step.number ? (
                                            <Check className="w-5 h-5" />
                                        ) : (
                                            step.number
                                        )}
                                    </div>
                                    <span className="text-xs mt-2 font-medium text-slate-700">
                                        {step.title}
                                    </span>
                                </div>
                                {index < steps.length - 1 && (
                                    <div
                                        className={[
                                            "h-0.5 flex-1 mx-4 transition-all",
                                            currentStep > step.number
                                                ? "bg-green-500"
                                                : "bg-slate-200"
                                        ].join(" ")}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {error && (
                    <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                    {/* STEP 1 */}
                    {currentStep === 1 && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900 mb-4">
                                    ¿Cómo deseas seleccionar los BLs?
                                </h2>

                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <button
                                        onClick={() => {
                                            setSearchMode("viaje");
                                            setSearchTerm("");
                                            setError("");
                                        }}
                                        className={[
                                            "p-4 rounded-xl border-2 text-left transition-all",
                                            searchMode === "viaje"
                                                ? "border-[#0F2A44] bg-blue-50"
                                                : "border-slate-200 hover:border-slate-300"
                                        ].join(" ")}
                                    >
                                        <div className="font-semibold text-slate-900 mb-1">
                                            Por Manifesto/Viaje
                                        </div>
                                        <div className="text-sm text-slate-600">
                                            Selecciona todos los BLs de un viaje específico
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => {
                                            setSearchMode("search");
                                            setSelectedViaje("");
                                            setError("");
                                        }}
                                        className={[
                                            "p-4 rounded-xl border-2 text-left transition-all",
                                            searchMode === "search"
                                                ? "border-[#0F2A44] bg-blue-50"
                                                : "border-slate-200 hover:border-slate-300"
                                        ].join(" ")}
                                    >
                                        <div className="font-semibold text-slate-900 mb-1">
                                            Buscar BLs Específicos
                                        </div>
                                        <div className="text-sm text-slate-600">
                                            Busca por número de BL, shipper o consignee
                                        </div>
                                    </button>
                                </div>

                                {searchMode === "viaje" && (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Selecciona el Manifesto/Viaje
                                        </label>
                                        <select
                                            value={selectedViaje}
                                            onChange={(e) => setSelectedViaje(e.target.value)}
                                            className="w-full px-4 py-3 text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F2A44] focus:border-[#0F2A44]"
                                        >
                                            <option value="">Selecciona un viaje...</option>
                                            {viajes.map(viaje => (
                                                <option key={viaje} value={viaje}>
                                                    {viaje} ({allBLs.filter(bl => bl.viaje === viaje).length} BLs)
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {searchMode === "search" && (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Buscar BLs
                                        </label>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                                            <input
                                                type="text"
                                                placeholder="Escribe número de BL, shipper o consignee..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="w-full pl-10 pr-4 py-3 text-base border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F2A44] focus:border-[#0F2A44]"
                                            />
                                        </div>
                                        {filteredBLs.length > 0 && (
                                            <div className="mt-2 text-sm text-green-600 flex items-center gap-1">
                                                <Check className="w-4 h-4" />
                                                Se encontraron {filteredBLs.length} BL(s) del mismo manifesto
                                            </div>
                                        )}
                                    </div>
                                )}

                                {filteredBLs.length > 0 && (
                                    <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                                        <div className="text-sm font-medium text-slate-700 mb-2">
                                            Vista previa: {filteredBLs.length} BL(s) disponibles
                                        </div>
                                        <div className="text-sm text-slate-600">
                                            Manifesto: <span className="font-medium">{filteredBLs[0]?.viaje}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* STEP 2 */}
                    {currentStep === 2 && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold text-slate-900">
                                        Selecciona los BLs a editar
                                    </h2>
                                    <p className="text-sm text-slate-600 mt-1">
                                        Manifesto: <span className="font-medium">{filteredBLs[0]?.viaje}</span>
                                    </p>
                                </div>
                                <button
                                    onClick={handleSelectAll}
                                    className="px-4 py-2 text-sm font-medium text-[#0F2A44] hover:bg-blue-50 rounded-lg transition-colors"
                                >
                                    {selectedBLs.length === filteredBLs.length ? "Deseleccionar" : "Seleccionar"} todos
                                </button>
                            </div>

                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                                <div className="max-h-96 overflow-y-auto">
                                    {filteredBLs.map((bl) => (
                                        <label
                                            key={bl.bl_number}
                                            className="flex items-center gap-4 p-4 hover:bg-slate-50 cursor-pointer border-b last:border-b-0"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedBLs.includes(bl.bl_number)}
                                                onChange={() => handleSelectBL(bl.bl_number)}
                                                className="w-5 h-5 text-[#0F2A44] rounded focus:ring-2 focus:ring-[#0F2A44]"
                                            />
                                            <div className="flex-1 grid grid-cols-3 gap-4">
                                                <div>
                                                    <div className="text-sm font-medium text-slate-900">
                                                        {bl.bl_number}
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        {formatDateCL(bl.fecha_emision)}
                                                    </div>
                                                </div>
                                                <div className="text-sm text-slate-700 truncate">
                                                    {bl.shipper || "—"}
                                                </div>
                                                <div>
                                                    <span
                                                        className={[
                                                            "inline-flex items-center px-2 py-1 rounded-full text-xs ring-1",
                                                            estadoStyles[bl.status] ?? "bg-slate-100 text-slate-700 ring-slate-200"
                                                        ].join(" ")}
                                                    >
                                                        {bl.status}
                                                    </span>
                                                </div>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <div className="text-sm font-medium text-blue-900">
                                    {selectedBLs.length} BL(s) seleccionado(s)
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 3 */}
                    {currentStep === 3 && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900 mb-1">
                                    ¿Qué campos deseas editar?
                                </h2>
                                <p className="text-sm text-slate-600">
                                    Selecciona solo los campos que necesites modificar
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div className="border border-slate-200 rounded-lg p-4">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={fieldsToEdit.shipper}
                                            onChange={() => handleToggleField("shipper")}
                                            className="mt-1 w-5 h-5 text-[#0F2A44] rounded focus:ring-2 focus:ring-[#0F2A44]"
                                        />
                                        <div className="flex-1">
                                            <div className="font-medium text-slate-900 mb-2">Shipper</div>
                                            {fieldsToEdit.shipper && (
                                                <input
                                                    type="text"
                                                    value={editValues.shipper}
                                                    onChange={(e) => setEditValues(prev => ({ ...prev, shipper: e.target.value }))}
                                                    placeholder="Ingresa el nuevo shipper..."
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F2A44] focus:border-[#0F2A44]"
                                                />
                                            )}
                                        </div>
                                    </label>
                                </div>

                                <div className="border border-slate-200 rounded-lg p-4">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={fieldsToEdit.consignee}
                                            onChange={() => handleToggleField("consignee")}
                                            className="mt-1 w-5 h-5 text-[#0F2A44] rounded focus:ring-2 focus:ring-[#0F2A44]"
                                        />
                                        <div className="flex-1">
                                            <div className="font-medium text-slate-900 mb-2">Consignee</div>
                                            {fieldsToEdit.consignee && (
                                                <input
                                                    type="text"
                                                    value={editValues.consignee}
                                                    onChange={(e) => setEditValues(prev => ({ ...prev, consignee: e.target.value }))}
                                                    placeholder="Ingresa el nuevo consignee..."
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F2A44] focus:border-[#0F2A44]"
                                                />
                                            )}
                                        </div>
                                    </label>
                                </div>

                                <div className="border border-slate-200 rounded-lg p-4">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={fieldsToEdit.notify_party}
                                            onChange={() => handleToggleField("notify_party")}
                                            className="mt-1 w-5 h-5 text-[#0F2A44] rounded focus:ring-2 focus:ring-[#0F2A44]"
                                        />
                                        <div className="flex-1">
                                            <div className="font-medium text-slate-900 mb-2">Notify Party</div>
                                            {fieldsToEdit.notify_party && (
                                                <input
                                                    type="text"
                                                    value={editValues.notify_party}
                                                    onChange={(e) => setEditValues(prev => ({ ...prev, notify_party: e.target.value }))}
                                                    placeholder="Ingresa notify party..."
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F2A44] focus:border-[#0F2A44]"
                                                />
                                            )}
                                        </div>
                                    </label>
                                </div>

                                <div className="border border-slate-200 rounded-lg p-4">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={fieldsToEdit.status}
                                            onChange={() => handleToggleField("status")}
                                            className="mt-1 w-5 h-5 text-[#0F2A44] rounded focus:ring-2 focus:ring-[#0F2A44]"
                                        />
                                        <div className="flex-1">
                                            <div className="font-medium text-slate-900 mb-2">Estado</div>
                                            {fieldsToEdit.status && (
                                                <select
                                                    value={editValues.status}
                                                    onChange={(e) => setEditValues(prev => ({ ...prev, status: e.target.value }))}
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F2A44] focus:border-[#0F2A44]"
                                                >
                                                    <option value="CREADO">Creado</option>
                                                    <option value="VALIDADO">Validado</option>
                                                    <option value="ENVIADO">Enviado</option>
                                                    <option value="ANULADO">Anulado</option>
                                                    <option value="ACTIVO">Activo</option>
                                                    <option value="INACTIVO">Inactivo</option>
                                                </select>
                                            )}
                                        </div>
                                    </label>
                                </div>

                                <div className="border border-slate-200 rounded-lg p-4">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={fieldsToEdit.descripcion_carga}
                                            onChange={() => handleToggleField("descripcion_carga")}
                                            className="mt-1 w-5 h-5 text-[#0F2A44] rounded focus:ring-2 focus:ring-[#0F2A44]"
                                        />
                                        <div className="flex-1">
                                            <div className="font-medium text-slate-900 mb-2">Descripción de Carga</div>
                                            {fieldsToEdit.descripcion_carga && (
                                                <textarea
                                                    value={editValues.descripcion_carga}
                                                    onChange={(e) => setEditValues(prev => ({ ...prev, descripcion_carga: e.target.value }))}
                                                    placeholder="Ingresa la descripción de carga..."
                                                    rows={3}
                                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F2A44] focus:border-[#0F2A44]"
                                                />
                                            )}
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 4: Editar Puertos */}
                    {currentStep === 4 && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900 mb-1">
                                    ¿Deseas editar los puertos de cada BL?
                                </h2>
                                <p className="text-sm text-slate-600">
                                    Puedes ajustar los puertos de forma masiva o individual para cada BL seleccionado
                                </p>
                            </div>

                            {/* 🆕 SECCIÓN DE OPCIONES */}
                            <div className="space-y-3">
                                {/* Opción 1: Edición Masiva */}
                                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={editarPuertosMasivo}
                                            onChange={(e) => {
                                                setEditarPuertosMasivo(e.target.checked);
                                                if (e.target.checked) setEditarPuertos(false); // Desactivar individual
                                            }}
                                            className="mt-1 w-5 h-5 text-green-600 rounded focus:ring-2 focus:ring-green-500"
                                        />
                                        <div>
                                            <div className="font-medium text-green-900">
                                                Editar puertos de forma masiva
                                            </div>
                                            <div className="text-sm text-green-700 mt-1">
                                                Todos los BLs seleccionados tendrán los mismos puertos
                                            </div>
                                        </div>
                                    </label>
                                </div>

                                {/* Opción 2: Edición Individual */}
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <label className="flex items-start gap-3 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={editarPuertos}
                                            onChange={(e) => {
                                                setEditarPuertos(e.target.checked);
                                                if (e.target.checked) setEditarPuertosMasivo(false); // Desactivar masivo
                                            }}
                                            className="mt-1 w-5 h-5 text-[#0F2A44] rounded focus:ring-2 focus:ring-[#0F2A44]"
                                        />
                                        <div>
                                            <div className="font-medium text-blue-900">
                                                Editar puertos de forma individual
                                            </div>
                                            <div className="text-sm text-blue-700 mt-1">
                                                Configura puertos diferentes para cada BL
                                            </div>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* 🆕 FORMULARIO DE EDICIÓN MASIVA */}
                            {editarPuertosMasivo && (
                                <div className="border border-green-200 rounded-lg p-6 bg-green-50">
                                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-green-200">
                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                        <h3 className="font-semibold text-green-900">
                                            Configuración Masiva - Se aplicará a {selectedBLs.length} BL(s)
                                        </h3>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-5 rounded-lg">
                                        {/* Lugar de Recepción */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                Lugar de Recepción (LRM)
                                            </label>
                                            <select
                                                value={puertosMasivos.lugar_recepcion_cod}
                                                onChange={(e) => setPuertosMasivos(prev => ({
                                                    ...prev,
                                                    lugar_recepcion_cod: e.target.value
                                                }))}
                                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                            >
                                                <option value="">Seleccionar puerto...</option>
                                                {puertosDisponibles.map(puerto => (
                                                    <option key={puerto.id} value={puerto.codigo}>
                                                        {puerto.nombre} ({puerto.codigo}) - {puerto.pais}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Puerto de Embarque */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                Puerto de Embarque (PE) *
                                            </label>
                                            <select
                                                value={puertosMasivos.puerto_embarque_cod}
                                                onChange={(e) => setPuertosMasivos(prev => ({
                                                    ...prev,
                                                    puerto_embarque_cod: e.target.value
                                                }))}
                                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                            >
                                                <option value="">Seleccionar puerto...</option>
                                                {puertosDisponibles.map(puerto => (
                                                    <option key={puerto.id} value={puerto.codigo}>
                                                        {puerto.nombre} ({puerto.codigo}) - {puerto.pais}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Puerto de Descarga */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                Puerto de Descarga (PD) *
                                            </label>
                                            <select
                                                value={puertosMasivos.puerto_descarga_cod}
                                                onChange={(e) => setPuertosMasivos(prev => ({
                                                    ...prev,
                                                    puerto_descarga_cod: e.target.value
                                                }))}
                                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                            >
                                                <option value="">Seleccionar puerto...</option>
                                                {puertosDisponibles.map(puerto => (
                                                    <option key={puerto.id} value={puerto.codigo}>
                                                        {puerto.nombre} ({puerto.codigo}) - {puerto.pais}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Lugar de Entrega */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                Lugar de Entrega (LEM)
                                            </label>
                                            <select
                                                value={puertosMasivos.lugar_entrega_cod}
                                                onChange={(e) => setPuertosMasivos(prev => ({
                                                    ...prev,
                                                    lugar_entrega_cod: e.target.value
                                                }))}
                                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                            >
                                                <option value="">Seleccionar puerto...</option>
                                                {puertosDisponibles.map(puerto => (
                                                    <option key={puerto.id} value={puerto.codigo}>
                                                        {puerto.nombre} ({puerto.codigo}) - {puerto.pais}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Lugar de Destino */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                Lugar de Destino (LD)
                                            </label>
                                            <select
                                                value={puertosMasivos.lugar_destino_cod}
                                                onChange={(e) => setPuertosMasivos(prev => ({
                                                    ...prev,
                                                    lugar_destino_cod: e.target.value
                                                }))}
                                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                            >
                                                <option value="">Seleccionar puerto...</option>
                                                {puertosDisponibles.map(puerto => (
                                                    <option key={puerto.id} value={puerto.codigo}>
                                                        {puerto.nombre} ({puerto.codigo}) - {puerto.pais}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Lugar de Emisión */}
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                                Lugar de Emisión (LE)
                                            </label>
                                            <select
                                                value={puertosMasivos.lugar_emision_cod}
                                                onChange={(e) => setPuertosMasivos(prev => ({
                                                    ...prev,
                                                    lugar_emision_cod: e.target.value
                                                }))}
                                                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                            >
                                                <option value="">Seleccionar puerto...</option>
                                                {puertosDisponibles.map(puerto => (
                                                    <option key={puerto.id} value={puerto.codigo}>
                                                        {puerto.nombre} ({puerto.codigo}) - {puerto.pais}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Vista previa de ruta */}
                                    {(puertosMasivos.puerto_embarque_cod || puertosMasivos.puerto_descarga_cod) && (
                                        <div className="mt-4 p-4 bg-white rounded-lg border border-green-300">
                                            <div className="text-sm font-medium text-green-900 mb-2">
                                                📍 Vista previa de ruta:
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-slate-700">
                                                <span className="font-medium">
                                                    {puertosMasivos.puerto_embarque_cod || '---'}
                                                </span>
                                                <span className="text-slate-400">→</span>
                                                <span className="font-medium">
                                                    {puertosMasivos.puerto_descarga_cod || '---'}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* FORMULARIO DE EDICIÓN INDIVIDUAL (el que ya tenías) */}
                            {editarPuertos && (
                                <div className="space-y-4">
                                    {selectedBLs.map((blNumber) => {
                                        const bl = filteredBLs.find(b => b.bl_number === blNumber);
                                        return (
                                            <div key={blNumber} className="border border-slate-200 rounded-lg p-5 bg-white">
                                                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
                                                    <div>
                                                        <div className="font-semibold text-slate-900 text-base">
                                                            {blNumber}
                                                        </div>
                                                        <div className="text-sm text-slate-600 mt-0.5">
                                                            {bl?.shipper || 'Sin shipper'}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {/* Lugar de Recepción */}
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                                            Lugar de Recepción (LRM)
                                                        </label>
                                                        <select
                                                            value={puertosIndividuales[blNumber]?.lugar_recepcion_cod || ''}
                                                            onChange={(e) => handlePuertoChange(blNumber, 'lugar_recepcion_cod', e.target.value)}
                                                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F2A44] focus:border-[#0F2A44]"
                                                        >
                                                            <option value="">Seleccionar puerto...</option>
                                                            {puertosDisponibles.map(puerto => (
                                                                <option key={puerto.id} value={puerto.codigo}>
                                                                    {puerto.nombre} ({puerto.codigo}) - {puerto.pais}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {/* Puerto de Embarque */}
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                                            Puerto de Embarque (PE) *
                                                        </label>
                                                        <select
                                                            value={puertosIndividuales[blNumber]?.puerto_embarque_cod || ''}
                                                            onChange={(e) => handlePuertoChange(blNumber, 'puerto_embarque_cod', e.target.value)}
                                                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F2A44] focus:border-[#0F2A44]"
                                                        >
                                                            <option value="">Seleccionar puerto...</option>
                                                            {puertosDisponibles.map(puerto => (
                                                                <option key={puerto.id} value={puerto.codigo}>
                                                                    {puerto.nombre} ({puerto.codigo}) - {puerto.pais}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {/* Puerto de Descarga */}
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                                            Puerto de Descarga (PD) *
                                                        </label>
                                                        <select
                                                            value={puertosIndividuales[blNumber]?.puerto_descarga_cod || ''}
                                                            onChange={(e) => handlePuertoChange(blNumber, 'puerto_descarga_cod', e.target.value)}
                                                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F2A44] focus:border-[#0F2A44]"
                                                        >
                                                            <option value="">Seleccionar puerto...</option>
                                                            {puertosDisponibles.map(puerto => (
                                                                <option key={puerto.id} value={puerto.codigo}>
                                                                    {puerto.nombre} ({puerto.codigo}) - {puerto.pais}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {/* Lugar de Entrega */}
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                                            Lugar de Entrega (LEM)
                                                        </label>
                                                        <select
                                                            value={puertosIndividuales[blNumber]?.lugar_entrega_cod || ''}
                                                            onChange={(e) => handlePuertoChange(blNumber, 'lugar_entrega_cod', e.target.value)}
                                                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F2A44] focus:border-[#0F2A44]"
                                                        >
                                                            <option value="">Seleccionar puerto...</option>
                                                            {puertosDisponibles.map(puerto => (
                                                                <option key={puerto.id} value={puerto.codigo}>
                                                                    {puerto.nombre} ({puerto.codigo}) - {puerto.pais}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {/* 🆕 LUGAR DE DESTINO */}
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                                            Lugar de Destino (LD)
                                                        </label>
                                                        <select
                                                            value={puertosIndividuales[blNumber]?.lugar_destino_cod || ''}
                                                            onChange={(e) => handlePuertoChange(blNumber, 'lugar_destino_cod', e.target.value)}
                                                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F2A44] focus:border-[#0F2A44]"
                                                        >
                                                            <option value="">Seleccionar puerto...</option>
                                                            {puertosDisponibles.map(puerto => (
                                                                <option key={puerto.id} value={puerto.codigo}>
                                                                    {puerto.nombre} ({puerto.codigo}) - {puerto.pais}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {/* 🆕 LUGAR DE EMISIÓN */}
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                                            Lugar de Emisión (LE)
                                                        </label>
                                                        <select
                                                            value={puertosIndividuales[blNumber]?.lugar_emision_cod || ''}
                                                            onChange={(e) => handlePuertoChange(blNumber, 'lugar_emision_cod', e.target.value)}
                                                            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F2A44] focus:border-[#0F2A44]"
                                                        >
                                                            <option value="">Seleccionar puerto...</option>
                                                            {puertosDisponibles.map(puerto => (
                                                                <option key={puerto.id} value={puerto.codigo}>
                                                                    {puerto.nombre} ({puerto.codigo}) - {puerto.pais}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {!editarPuertos && !editarPuertosMasivo && (
                                <div className="text-center py-12 text-slate-500">
                                    <p>Los puertos se mantendrán sin cambios</p>
                                    <p className="text-sm mt-2">Activa una de las opciones de arriba si necesitas editarlos</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* STEP 5: Confirmación */}
                    {currentStep === 5 && (
                        <div className="space-y-6">
                            {saveSuccess ? (
                                <div className="text-center py-12">
                                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Check className="w-8 h-8 text-green-600" />
                                    </div>
                                    <h2 className="text-xl font-semibold text-slate-900 mb-2">
                                        ¡Cambios guardados exitosamente!
                                    </h2>
                                    <p className="text-slate-600">
                                        Redirigiendo a la lista de BLs...
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900 mb-1">
                                            Revisa los cambios antes de guardar
                                        </h2>
                                        <p className="text-sm text-slate-600">
                                            Los siguientes cambios se aplicarán a {selectedBLs.length} BL(s)
                                        </p>
                                    </div>

                                    <div className="bg-slate-50 rounded-lg p-6 space-y-4">
                                        <div>
                                            <div className="text-sm font-medium text-slate-700 mb-2">
                                                BLs seleccionados ({selectedBLs.length}):
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {selectedBLs.slice(0, 10).map(bl => (
                                                    <span key={bl} className="px-3 py-1 bg-white rounded-full text-sm text-slate-700 border border-slate-200">
                                                        {bl}
                                                    </span>
                                                ))}
                                                {selectedBLs.length > 10 && (
                                                    <span className="px-3 py-1 bg-white rounded-full text-sm text-slate-500 border border-slate-200">
                                                        +{selectedBLs.length - 10} más
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="border-t border-slate-200 pt-4">
                                            <div className="text-sm font-medium text-slate-700 mb-3">
                                                Campos generales que se modificarán:
                                            </div>
                                            {Object.keys(fieldsToEdit).filter(key => fieldsToEdit[key]).length > 0 ? (
                                                <div className="space-y-2">
                                                    {Object.keys(fieldsToEdit).filter(key => fieldsToEdit[key]).map(key => (
                                                        <div key={key} className="flex items-start gap-3 text-sm">
                                                            <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                                                            <div>
                                                                <span className="font-medium text-slate-900">
                                                                    {key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')}:
                                                                </span>
                                                                <span className="text-slate-700 ml-2">
                                                                    {editValues[key]}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-sm text-slate-500">No se modificarán campos generales</p>
                                            )}
                                        </div>

                                        {editarPuertos && (
                                            <div className="border-t border-slate-200 pt-4">
                                                <div className="text-sm font-medium text-slate-700 mb-3">
                                                    Puertos editados individualmente:
                                                </div>
                                                <div className="space-y-2">
                                                    {selectedBLs.map(blNumber => (
                                                        <div key={blNumber} className="text-sm bg-white rounded p-3 border border-slate-200">
                                                            <div className="font-medium text-slate-900 mb-2">{blNumber}</div>
                                                            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                                                                {puertosIndividuales[blNumber]?.lugar_recepcion_cod && (
                                                                    <div>Recepción: {puertosIndividuales[blNumber].lugar_recepcion_cod}</div>
                                                                )}
                                                                {puertosIndividuales[blNumber]?.puerto_embarque_cod && (
                                                                    <div>Embarque: {puertosIndividuales[blNumber].puerto_embarque_cod}</div>
                                                                )}
                                                                {puertosIndividuales[blNumber]?.puerto_descarga_cod && (
                                                                    <div>Descarga: {puertosIndividuales[blNumber].puerto_descarga_cod}</div>
                                                                )}
                                                                {puertosIndividuales[blNumber]?.lugar_entrega_cod && (
                                                                    <div>Entrega: {puertosIndividuales[blNumber].lugar_entrega_cod}</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                                        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                        <div className="text-sm text-amber-800">
                                            <div className="font-medium mb-1">Atención</div>
                                            Esta acción modificará {selectedBLs.length} BL(s) simultáneamente.
                                            Asegúrate de que la información sea correcta antes de continuar.
                                        </div>
                                    </div>

                                    {!hasChangesToSave && (
                                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                                            <div className="text-sm text-red-800">
                                                <div className="font-medium mb-1">No hay cambios para guardar</div>
                                                Debes seleccionar al menos un campo para editar en el Step 3,
                                                o activar la edición de puertos en el Step 4.
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Navigation Buttons */}
                {!saveSuccess && (
                    <div className="flex items-center justify-between pt-6 border-t border-slate-200 mt-8">
                        <button
                            onClick={() => setCurrentStep(prev => prev - 1)}
                            disabled={currentStep === 1}
                            className="px-6 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Atrás
                        </button>

                        {currentStep < 5 ? (
                            <button
                                onClick={() => setCurrentStep(prev => prev + 1)}
                                disabled={!canContinue[currentStep]}
                                className="px-6 py-2.5 text-sm font-medium text-white bg-[#0F2A44] hover:bg-[#1a3a5c] rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Continuar
                            </button>
                        ) : (
                            <button
                                onClick={handleSave}
                                disabled={saving || !hasChangesToSave}
                                className="px-6 py-2.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Guardando...
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Guardar Cambios
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};

export default BulkEditBL;