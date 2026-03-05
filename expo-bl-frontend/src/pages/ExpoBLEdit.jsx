import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import Sidebar from "../components/Sidebar";
import CrearPuertoModal from "../components/CrearPuertoModal";

const API_BASE = import.meta.env.VITE_API_URL;

const steps = [
    { id: 1, name: "General", description: "Información básica del BL" },
    { id: 2, name: "Rutas", description: "" },
    { id: 3, name: "Addr.", description: "Shipper, Consignee, Notify" },
    { id: 4, name: "Mercancía", description: "Descripción general de carga" },
    { id: 5, name: "Items", description: "Detalle de ítems" },
    { id: 6, name: "Contenedores", description: "Contenedores, sellos e IMO" },
    { id: 7, name: "Revisión", description: "Confirmar cambios" }
];

const ExpoBLEdit = () => {
    const { blNumber } = useParams();
    const navigate = useNavigate();

    const [currentStep, setCurrentStep] = useState(1);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [tipoOperacion, setTipoOperacion] = useState("S");

    const [puertos, setPuertos] = useState([]);
    const [items, setItems] = useState([]);
    const [contenedores, setContenedores] = useState([]);
    const [transbordos, setTransbordos] = useState([]);
    const [tiposBulto, setTiposBulto] = useState([]);
    const [tiposContenedor, setTiposContenedor] = useState([]);
    const [tipoCntTipoBulto, setTipoCntTipoBulto] = useState([]);
    const [showCrearPuertoModal, setShowCrearPuertoModal] = useState(false);
    const [emailErrors, setEmailErrors] = useState({
        shipper: false,
        consignee: false,
        notify: false,
    });

    useEffect(() => {
        fetch(`${API_BASE}/api/tipos-contenedor`) // ✅ CORRECTO
            .then(res => res.json())
            .then(data => setTiposContenedor(data))
            .catch(err => console.error('Error:', err));
    }, []);

    const esImpo = tipoOperacion === "I" || tipoOperacion === "TR" || tipoOperacion === "TRB";
    const esExpo = tipoOperacion === "S";

    const [formData, setFormData] = useState({
        bl_number: "", viaje: "", tipo_servicio: "",
        fecha_emision: "", fecha_presentacion: "", fecha_zarpe: "", fecha_embarque: "",
        fecha_recepcion_bl: "",
        lugar_emision: "", forma_pago_flete: "",
        puerto_embarque: "", puerto_descarga: "", lugar_destino: "", lugar_entrega: "", lugar_recepcion: "",
        shipper: "", shipper_codigo_pil: "", shipper_direccion: "", shipper_telefono: "", shipper_email: "",
        consignee: "", consignee_codigo_pil: "", consignee_rut: "", consignee_nacion_id: "CL",
        consignee_direccion: "", consignee_telefono: "", consignee_email: "",
        notify_party: "", notify_codigo_pil: "", notify_rut: "", notify_nacion_id: "CL",
        notify_direccion: "", notify_telefono: "", notify_email: "",
        almacenista_nombre: "", almacenista_rut: "", almacenista_nacion_id: "CL",
        almacenista_codigo_almacen: "", almacenista_id: null,
        descripcion_carga: "", peso_bruto: "", unidad_peso: "", volumen: "", unidad_volumen: "", bultos: "",
        observaciones: [],
    });

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError("");
            try {
                // 🆕 Cargar BL
                const resBL = await fetch(`${API_BASE}/api/bls/${blNumber}`);
                if (!resBL.ok) {
                    throw new Error(`Error ${resBL.status}: No se pudo cargar el BL`);
                }
                const dataBL = await resBL.json();
                const opType = dataBL.tipo_operacion || "S";
                setTipoOperacion(opType);

                const [resPuertos, resTiposBulto, resTiposCnt, resMapeo] = await Promise.all([
                    fetch(`${API_BASE}/api/puertos`),
                    fetch(`${API_BASE}/api/tipos-bulto`),
                    fetch(`${API_BASE}/api/tipos-contenedor`),
                    fetch(`${API_BASE}/api/tipo-cnt-tipo-bulto`)
                ]);

                if (resPuertos.ok) setPuertos(await resPuertos.json());
                if (resTiposBulto.ok) setTiposBulto(await resTiposBulto.json());
                if (resTiposCnt.ok) setTiposContenedor(await resTiposCnt.json());
                if (resMapeo.ok) setTipoCntTipoBulto(await resMapeo.json());

                const formatDate = d => d ? d.split("T")[0] : "";
                const formatDateTime = d => d ? d.replace(" ", "T").substring(0, 16) : "";

                setFormData({
                    bl_number: dataBL.bl_number || "", viaje: dataBL.viaje || "",
                    tipo_servicio: dataBL.tipo_servicio_id === 1 ? "FF" : dataBL.tipo_servicio_id === 2 ? "MM" : "",
                    fecha_emision: formatDate(dataBL.fecha_emision),
                    fecha_presentacion: formatDateTime(dataBL.fecha_presentacion),
                    fecha_zarpe: formatDateTime(dataBL.fecha_zarpe),
                    fecha_embarque: formatDateTime(dataBL.fecha_embarque),
                    fecha_recepcion_bl: formatDateTime(dataBL.fecha_recepcion_bl),
                    forma_pago_flete: dataBL.forma_pago_flete || "",
                    lugar_emision: dataBL.lugar_emision_cod || "",
                    puerto_embarque: dataBL.puerto_embarque_cod || "",
                    puerto_descarga: dataBL.puerto_descarga_cod || "",
                    lugar_destino: dataBL.lugar_destino_cod || "",
                    lugar_entrega: dataBL.lugar_entrega_cod || "",
                    lugar_recepcion: dataBL.lugar_recepcion_cod || "",
                    shipper: dataBL.shipper || "", shipper_codigo_pil: dataBL.shipper_codigo_pil || "",
                    shipper_direccion: dataBL.shipper_direccion || "", shipper_telefono: dataBL.shipper_telefono || "",
                    shipper_email: dataBL.shipper_email || "",
                    consignee: dataBL.consignee || "", consignee_codigo_pil: dataBL.consignee_codigo_pil || "",
                    consignee_rut: dataBL.consignee_rut || "", consignee_nacion_id: dataBL.consignee_nacion_id || "CL",
                    consignee_direccion: dataBL.consignee_direccion || "", consignee_telefono: dataBL.consignee_telefono || "",
                    consignee_email: dataBL.consignee_email || "",
                    notify_party: dataBL.notify_party || "", notify_codigo_pil: dataBL.notify_codigo_pil || "",
                    notify_rut: dataBL.notify_rut || "", notify_nacion_id: dataBL.notify_nacion_id || "CL",
                    notify_direccion: dataBL.notify_direccion || "", notify_telefono: dataBL.notify_telefono || "",
                    notify_email: dataBL.notify_email || "",
                    almacenista_nombre: dataBL.almacenista_nombre || "",
                    almacenista_rut: dataBL.almacenista_rut || "",
                    almacenista_nacion_id: dataBL.almacenista_nacion_id || "CL",
                    almacenista_codigo_almacen: dataBL.almacenista_codigo_almacen || "",
                    almacenista_id: dataBL.almacenador_id || null,
                    descripcion_carga: dataBL.descripcion_carga || "",
                    peso_bruto: dataBL.peso_bruto || "", unidad_peso: dataBL.unidad_peso || "",
                    volumen: dataBL.volumen || "", unidad_volumen: dataBL.unidad_volumen || "",
                    bultos: dataBL.bultos || "",
                    observaciones: dataBL.observaciones
                        ? (typeof dataBL.observaciones === 'string'
                            ? (() => { try { return JSON.parse(dataBL.observaciones); } catch { return []; } })()
                            : dataBL.observaciones)
                        : [],
                });

                const resIC = await fetch(`${API_BASE}/api/bls/${blNumber}/items-contenedores`);
                if (resIC.ok) {
                    const d = await resIC.json();
                    setItems(d.items || []);
                    const opType = dataBL.tipo_operacion || "S";
                    const esImpoLocal = opType === "I" || opType === "TR" || opType === "TRB";

                    setContenedores((d.contenedores || []).map(c => ({
                        ...c,
                        es_soc: esImpoLocal ? !!c.es_soc : false,  // ← forzar false si es EXPO
                        cnt_so_numero: c.cnt_so_numero || ""
                    })));
                }

                const resTB = await fetch(`${API_BASE}/api/bls/${blNumber}/transbordos`);
                if (resTB.ok) {
                    const data = await resTB.json();
                    setTransbordos(data.map(tb => ({ ...tb, fecha_arribo: formatDateTime(tb.fecha_arribo) })));
                }

            } catch (e) {
                console.error("Error completo:", e);
                setError(e?.message || "Error desconocido");
                Swal.fire({ icon: "error", title: "Error al cargar BL", text: e?.message, confirmButtonColor: "#0F2A44" });
            } finally {
                setLoading(false);
            }
        };
        if (blNumber) fetchData();
    }, [blNumber]);

    const updateField = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));
    const validarEmail = email => !email || email.trim() === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const updateItem = (itemId, field, value) => setItems(prev => prev.map(i => i.id === itemId ? { ...i, [field]: value } : i));
    const updateContenedor = (cId, field, value) => setContenedores(prev => prev.map(c => c.id === cId ? { ...c, [field]: value } : c));
    const getCodigoContenedor = (cont) => cont.es_soc ? (cont.cnt_so_numero || `SOC_${cont.id}`) : cont.codigo;
    const esContenedorCargaPeligrosa = (cont) => {
        const codigo = getCodigoContenedor(cont);
        return items.some(i => i.contenedores?.some(c => c.codigo === codigo) && i.carga_peligrosa === "S");
    };
    const getItemsAsociados = (cont) => {
        const codigo = getCodigoContenedor(cont);
        return items.filter(i => i.contenedores?.some(c => c.codigo === codigo)).map(i => i.numero_item);
    };

    const addTransbordo = () => {
        setTransbordos(prev => [...prev, { id: `new_tb_${Date.now()}`, puerto_cod: "", puerto_id: null, puerto_nombre: null, fecha_arribo: "", sec: prev.length + 1, _isNew: true }]);
    };
    const updateTransbordo = (id, field, value) => {
        setTransbordos(prev => prev.map(tb => {
            if (tb.id !== id) return tb;
            if (field === "puerto_cod") { const p = puertos.find(p => p.codigo === value); return { ...tb, puerto_cod: value, puerto_id: p?.id || null, puerto_nombre: p?.nombre || null }; }
            return { ...tb, [field]: value };
        }));
    };
    const removeTransbordo = id => {
        Swal.fire({ title: "¿Eliminar transbordo?", text: "Esta acción no se puede deshacer", icon: "warning", showCancelButton: true, confirmButtonText: "Sí, eliminar", cancelButtonText: "Cancelar", confirmButtonColor: "#ef4444", cancelButtonColor: "#64748b" })
            .then(r => { if (r.isConfirmed) setTransbordos(prev => prev.filter(tb => tb.id !== id).map((tb, i) => ({ ...tb, sec: i + 1 }))); });
    };

    const addContenedorToItem = async (itemId, itemNumero) => {
        const item = items.find(i => i.id === itemId);
        if (!item?.tipo_bulto) return Swal.fire({ icon: "error", title: "Error", text: "El ítem no tiene tipo_bulto definido", confirmButtonColor: "#ef4444" });
        const mapeo = tipoCntTipoBulto.find(m => m.tipo_bulto === item.tipo_bulto);
        if (!mapeo) return Swal.fire({ icon: "error", title: "Error de configuración", text: `No se encontró tipo_cnt para tipo_bulto "${item.tipo_bulto}"`, confirmButtonColor: "#ef4444" });
        const tipoCntAsignado = mapeo.tipo_cnt;

        const { value: fv } = await Swal.fire({
            title: `Agregar Contenedor al Item ${itemNumero}`,
            html: `<div class="space-y-4 text-left">
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4"><p class="text-sm text-blue-800"><strong>Tipo contenedor:</strong> ${tipoCntAsignado}</p></div>
                <div class="flex items-center gap-3 p-3 bg-slate-100 rounded-lg mb-2">
                    <input type="checkbox" id="es_soc_new" class="w-4 h-4">
                    <label for="es_soc_new" class="text-sm font-medium text-slate-700">Shipper Owner Container (SOC)</label>
                </div>
                <div id="campo_codigo_normal">
                    <label class="block text-sm font-medium text-slate-700 mb-2">Código Contenedor <span class="text-red-500">*</span></label>
                    <input id="codigo_contenedor" class="swal2-input w-full" placeholder="Ej: FFAU5291030" maxlength="11" style="margin:0;text-transform:uppercase;">
                    <p class="text-xs text-slate-500 mt-1">11 caracteres: 4 letras + 7 números</p>
                </div>
                <div id="campo_soc" style="display:none">
                    <label class="block text-sm font-medium text-slate-700 mb-2">Número SOC <span class="text-red-500">*</span></label>
                    <input id="cnt_so_numero" class="swal2-input w-full" placeholder="Ej: TCNU 729792-0" style="margin:0;">
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div><label class="block text-sm font-medium text-slate-700 mb-2">Peso Bruto <span class="text-red-500">*</span></label><input id="peso_bruto" type="number" step="0.001" class="swal2-input w-full" placeholder="0.000" style="margin:0;"></div>
                    <div><label class="block text-sm font-medium text-slate-700 mb-2">Unidad Peso <span class="text-red-500">*</span></label><input id="unidad_peso" type="text" class="swal2-input w-full" placeholder="KGM" maxlength="3" style="margin:0;text-transform:uppercase;"></div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div><label class="block text-sm font-medium text-slate-700 mb-2">Volumen <span class="text-red-500">*</span></label><input id="volumen" type="number" step="0.001" min="0" class="swal2-input w-full" placeholder="0.000" style="margin:0;"></div>
                    <div><label class="block text-sm font-medium text-slate-700 mb-2">Unidad Volumen <span class="text-red-500">*</span></label><input id="unidad_volumen" type="text" class="swal2-input w-full" placeholder="MTQ" maxlength="3" style="margin:0;text-transform:uppercase;"></div>
                </div>
            </div>`,
            didOpen: () => {
                document.getElementById("es_soc_new").addEventListener("change", (e) => {
                    document.getElementById("campo_codigo_normal").style.display = e.target.checked ? "none" : "block";
                    document.getElementById("campo_soc").style.display = e.target.checked ? "block" : "none";
                });
            },
            showCancelButton: true, confirmButtonText: "Agregar", cancelButtonText: "Cancelar", confirmButtonColor: "#10b981", width: "600px",
            preConfirm: () => {
                const esSoc = document.getElementById("es_soc_new").checked;
                const codigo = !esSoc ? document.getElementById("codigo_contenedor").value.trim().toUpperCase() : null;
                const cntSoNumero = esSoc ? document.getElementById("cnt_so_numero").value.trim() : null;
                const pesoBruto = document.getElementById("peso_bruto").value;
                const unidadPeso = document.getElementById("unidad_peso").value.trim().toUpperCase();
                const volumen = document.getElementById("volumen").value;
                const unidadVol = document.getElementById("unidad_volumen").value.trim().toUpperCase();
                if (!esSoc) {
                    if (!codigo) { Swal.showValidationMessage("Debes ingresar el código del contenedor"); return null; }
                    if (codigo.length !== 11) { Swal.showValidationMessage("El código debe tener exactamente 11 caracteres"); return null; }
                    if (!/^[A-Z]{4}\d{7}$/.test(codigo)) { Swal.showValidationMessage("Formato inválido: 4 LETRAS + 7 NÚMEROS"); return null; }
                    if (contenedores.some(c => !c.es_soc && c.codigo === codigo)) { Swal.showValidationMessage("Este contenedor ya existe en el BL"); return null; }
                } else {
                    if (!cntSoNumero) { Swal.showValidationMessage("Debes ingresar el número SOC"); return null; }
                }
                if (!pesoBruto || parseFloat(pesoBruto) <= 0) { Swal.showValidationMessage("Debes ingresar un peso bruto válido"); return null; }
                if (!unidadPeso) { Swal.showValidationMessage("Debes ingresar la unidad de peso"); return null; }
                if (volumen === "" || volumen === null) { Swal.showValidationMessage("Debes ingresar un volumen (puede ser 0)"); return null; }
                if (parseFloat(volumen) < 0) { Swal.showValidationMessage("El volumen no puede ser negativo"); return null; }
                if (!unidadVol) { Swal.showValidationMessage("Debes ingresar la unidad de volumen"); return null; }
                return { esSoc, codigo, cntSoNumero, pesoBruto: parseFloat(pesoBruto), unidadPeso, volumen: parseFloat(volumen), unidadVolumen: unidadVol };
            }
        });

        if (fv) {
            let sigla = "", numero = "", digito = "";
            if (!fv.esSoc) {
                sigla = fv.codigo.substring(0, 4);
                const todos = fv.codigo.substring(4);
                numero = todos.substring(0, todos.length - 1);
                digito = todos.substring(todos.length - 1);
            }
            const codigoDisplay = fv.esSoc ? fv.cntSoNumero : fv.codigo;
            const nuevo = {
                id: `new_${Date.now()}`, bl_id: null, item_id: itemId,
                codigo: fv.esSoc ? "" : fv.codigo, sigla, numero, digito,
                tipo_cnt: tipoCntAsignado, es_soc: fv.esSoc, cnt_so_numero: fv.cntSoNumero || "",
                peso: fv.pesoBruto, unidad_peso: fv.unidadPeso,
                volumen: fv.volumen, unidad_volumen: fv.unidadVolumen,
                sellos: [], imos: [], _isNew: true
            };
            setContenedores(prev => [...prev, nuevo]);
            setItems(prev => prev.map(i => i.id === itemId ? { ...i, contenedores: [...(i.contenedores || []), { codigo: codigoDisplay }] } : i));
        }
    };

    const addSelloToContenedor = cId => {
        Swal.fire({ title: "Agregar Sello", input: "text", inputLabel: "Número de sello (máx. 35 caracteres)", inputPlaceholder: "Ej: BZ023785", showCancelButton: true, confirmButtonText: "Agregar", cancelButtonText: "Cancelar", confirmButtonColor: "#10b981", inputValidator: v => !v ? "Debes ingresar un número de sello" : v.length > 35 ? "Máximo 35 caracteres" : null })
            .then(r => {
                if (r.isConfirmed) setContenedores(prev => prev.map(c => {
                    if (c.id !== cId) return c;
                    if ((c.sellos || []).includes(r.value)) { Swal.fire("Error", "Este sello ya existe en el contenedor", "error"); return c; }
                    return { ...c, sellos: [...(c.sellos || []), r.value] };
                }));
            });
    };
    const removeSelloFromContenedor = (cId, sello) => {
        Swal.fire({ title: "¿Eliminar sello?", text: `Sello: ${sello}`, icon: "warning", showCancelButton: true, confirmButtonText: "Sí, eliminar", cancelButtonText: "Cancelar", confirmButtonColor: "#ef4444" })
            .then(r => { if (r.isConfirmed) setContenedores(prev => prev.map(c => c.id === cId ? { ...c, sellos: (c.sellos || []).filter(s => s !== sello) } : c)); });
    };

    const addImoToContenedor = (cId, cont) => {
        if (!esContenedorCargaPeligrosa(cont)) return Swal.fire({ icon: "error", title: "Acción no permitida", text: "Solo puedes agregar datos IMO a contenedores con carga peligrosa.", confirmButtonColor: "#0F2A44" });
        Swal.fire({
            title: "Agregar IMO",
            html: `<input id="clase_imo" class="swal2-input" placeholder="Clase IMO (ej: 9)" maxlength="5"><input id="numero_imo" class="swal2-input" placeholder="Número IMO (ej: 3077)" maxlength="10">`,
            showCancelButton: true, confirmButtonText: "Agregar", cancelButtonText: "Cancelar", confirmButtonColor: "#10b981",
            preConfirm: () => {
                const clase = document.getElementById("clase_imo").value.trim();
                const numero = document.getElementById("numero_imo").value.trim();
                if (!clase || !numero) { Swal.showValidationMessage("Debes completar ambos campos"); return null; }
                return { clase, numero };
            }
        }).then(r => { if (r.isConfirmed && r.value) setContenedores(prev => prev.map(c => c.id === cId ? { ...c, imos: [...(c.imos || []), r.value] } : c)); });
    };
    const removeImoFromContenedor = (cId, index) => {
        Swal.fire({ title: "¿Eliminar dato IMO?", icon: "warning", showCancelButton: true, confirmButtonText: "Sí, eliminar", cancelButtonText: "Cancelar", confirmButtonColor: "#ef4444" })
            .then(r => { if (r.isConfirmed) setContenedores(prev => prev.map(c => c.id === cId ? { ...c, imos: (c.imos || []).filter((_, i) => i !== index) } : c)); });
    };

    const handlePuertoCreado = nuevoPuerto => {
        setPuertos(prev => [...prev, nuevoPuerto].sort((a, b) => a.nombre.localeCompare(b.nombre)));
        Swal.fire({ icon: "success", title: `Puerto ${nuevoPuerto.codigo} creado`, timer: 2000, showConfirmButton: false });
    };

    const validarCantidadContenedores = () =>
        items.map(item => {
            const esp = parseInt(item.cantidad) || 0;
            const real = (item.contenedores || []).length;
            if (esp !== real) return { itemId: item.id, numeroItem: item.numero_item, esperada: esp, actual: real, diferencia: esp - real, faltanContenedores: esp > real, sobranContenedores: esp < real };
            return null;
        }).filter(Boolean);

    const validateStep = step => {
        const warn = text => { Swal.fire({ icon: "warning", title: "Campo requerido", text, confirmButtonColor: "#0F2A44" }); return false; };
        const err = (title, text) => { Swal.fire({ icon: "error", title, text, confirmButtonColor: "#0F2A44" }); return false; };
        switch (step) {
            case 1:
                if (!formData.tipo_servicio) return warn("Debes seleccionar un tipo de servicio");
                if (!formData.fecha_emision) return warn("La fecha de emisión es obligatoria");
                if (!formData.fecha_presentacion) return warn("La fecha de presentación es obligatoria");
                if (!formData.fecha_zarpe) return warn("La fecha de zarpe es obligatoria");
                if (!formData.fecha_embarque) return warn("La fecha de embarque es obligatoria");
                if (!formData.forma_pago_flete && formData.tipo_servicio !== "MM") return warn("La forma de pago del flete es obligatoria");
                break;
            case 2:
                if (!formData.puerto_embarque) return warn("Debes seleccionar el puerto de embarque");
                if (!formData.puerto_descarga) return warn("Debes seleccionar el puerto de descarga");
                if (!formData.lugar_emision) return warn("Debes seleccionar el lugar de emisión");
                if (!formData.lugar_destino) return warn("Debes seleccionar el lugar de destino");
                if (!formData.lugar_entrega) return warn("Debes seleccionar el lugar de entrega");
                if (!formData.lugar_recepcion) return warn("Debes seleccionar el lugar de recepción");
                for (const tb of transbordos) {
                    if (!tb.puerto_cod) return err("Transbordo incompleto", "Todos los transbordos deben tener un puerto seleccionado");
                    if (esImpo && tb.fecha_arribo === "") return err("Transbordo incompleto", `El transbordo ${tb.sec} debe tener fecha de arribo`);
                }
                break;
            case 3:
                if (!formData.shipper || formData.shipper.trim().length < 3) return err("Datos incompletos", "El Shipper no tiene datos válidos del archivo PMS");
                if (formData.shipper_telefono?.trim() && formData.shipper_telefono.trim().length < 7) return warn("El teléfono del Shipper debe tener al menos 7 caracteres");
                if (formData.shipper_email?.trim() && !validarEmail(formData.shipper_email)) return err("Email inválido", "El email del Shipper no tiene un formato válido");
                if (!formData.consignee || formData.consignee.trim().length < 3) return err("Datos incompletos", "El Consignee no tiene datos válidos del archivo PMS");
                if (esImpo && !formData.consignee_rut?.trim()) return warn("El Consignee debe tener RUT/ID en importación");
                if (formData.consignee_telefono?.trim() && formData.consignee_telefono.trim().length < 7) return warn("El teléfono del Consignee debe tener al menos 7 caracteres");
                if (formData.consignee_email?.trim() && !validarEmail(formData.consignee_email)) return err("Email inválido", "El email del Consignee no tiene un formato válido");
                if (!formData.notify_party || formData.notify_party.trim().length < 3) return err("Datos incompletos", "El Notify Party no tiene datos válidos del archivo PMS");
                if (esImpo && !formData.notify_rut?.trim()) return warn("El Notify Party debe tener RUT/ID en importación");
                if (!formData.notify_telefono?.trim() && !formData.notify_email?.trim()) return warn("El Notify Party debe tener al menos teléfono o email");
                if (formData.notify_telefono?.trim() && formData.notify_telefono.trim().length < 7) return warn("El teléfono del Notify Party debe tener al menos 7 caracteres");
                if (formData.notify_email?.trim() && !validarEmail(formData.notify_email)) return err("Email inválido", "El email del Notify Party no tiene un formato válido");
                if (esImpo) {
                    if (!formData.almacenista_nombre?.trim()) return warn("El Almacenista es obligatorio en importación");
                    if (!formData.almacenista_rut?.trim()) return warn("El Almacenista debe tener RUT");
                    if (!formData.almacenista_codigo_almacen?.trim()) return warn("El Almacenista debe tener código de almacén");
                }
                break;
            case 4: {
                if (formData.peso_bruto === "" || formData.peso_bruto === null) return warn("El peso bruto es obligatorio");
                const pb = parseFloat(formData.peso_bruto);
                if (formData.tipo_servicio === "MM" ? pb < 0 : pb <= 0) return warn(formData.tipo_servicio === "MM" ? "El peso bruto no puede ser negativo" : "El peso bruto debe ser mayor a 0");
                if (!formData.unidad_peso?.trim()) return warn("La unidad de peso es obligatoria");
                if (formData.volumen === null || formData.volumen === "") return warn("El volumen es obligatorio (puede ser 0)");
                if (parseFloat(formData.volumen) < 0) return warn("El volumen no puede ser negativo");
                if (!formData.unidad_volumen?.trim()) return warn("La unidad de volumen es obligatoria");
                if (!formData.bultos || parseInt(formData.bultos) <= 0) return warn("La cantidad de bultos debe ser mayor a 0");
                break;
            }
            case 5:
                if (items.length === 0) return true;
                for (const item of items) {
                    if (item.peso_bruto === "" || item.peso_bruto === null) return warn(`Item ${item.numero_item}: peso bruto requerido`);
                    const pb = parseFloat(item.peso_bruto);
                    if (formData.tipo_servicio === "MM" ? pb < 0 : pb <= 0) return warn(`Item ${item.numero_item}: peso bruto inválido`);
                    if (!item.unidad_peso?.trim()) return warn(`Item ${item.numero_item}: unidad de peso requerida`);
                    if (item.volumen === null || item.volumen === "") return warn(`Item ${item.numero_item}: volumen requerido (puede ser 0)`);
                    if (parseFloat(item.volumen) < 0) return warn(`Item ${item.numero_item}: volumen no puede ser negativo`);
                    if (!item.unidad_volumen?.trim()) return warn(`Item ${item.numero_item}: unidad de volumen requerida`);
                    if (!item.tipo_bulto?.trim()) return warn(`Item ${item.numero_item}: tipo de bulto requerido`);
                    if (!item.cantidad || parseInt(item.cantidad) <= 0) return warn(`Item ${item.numero_item}: cantidad debe ser mayor a 0`);
                }
                break;
            case 6:
                if (contenedores.length === 0) return true;
                const socSinNumero = contenedores.filter(c => c.es_soc && !c.cnt_so_numero?.trim());
                if (socSinNumero.length > 0) return err("SOC incompleto", `Hay ${socSinNumero.length} contenedor(es) SOC sin número asignado`);
                const sinIMO = contenedores.filter(c => esContenedorCargaPeligrosa(c) && (!c.imos || c.imos.length === 0));
                if (sinIMO.length > 0) {
                    Swal.fire({ icon: "error", title: "Datos IMO faltantes", html: `Contenedores con carga peligrosa sin IMO:<br><strong>${sinIMO.map(c => getCodigoContenedor(c)).join(", ")}</strong>`, confirmButtonColor: "#0F2A44" });
                    return false;
                }
                break;
        }
        return true;
    };

    const nextStep = () => {
        if (!validateStep(currentStep)) return;
        if (currentStep === 5) {
            const inc = validarCantidadContenedores();
            if (inc.length > 0) {
                const mensajeHTML = inc.map(i => `<div class="text-left mb-2 p-2 bg-gray-50 rounded"><strong>Item ${i.numeroItem}:</strong><br>Esperados: ${i.esperada} | Actuales: ${i.actual}<br>${i.faltanContenedores ? `<span class="text-red-600 font-bold">Faltan ${i.diferencia} contenedor(es)</span>` : `<span class="text-orange-600 font-bold">Sobran ${Math.abs(i.diferencia)} contenedor(es)</span>`}</div>`).join("");
                Swal.fire({ icon: "error", title: "Cantidad inconsistente", html: `<div class="text-sm">${mensajeHTML}</div>`, confirmButtonText: "Entendido", confirmButtonColor: "#ef4444", width: "600px" });
                return;
            }
        }
        setCurrentStep(prev => prev + 1);
    };
    const prevStep = () => { if (currentStep > 1) setCurrentStep(currentStep - 1); };
    const handleStepClick = targetStep => {
        if (currentStep === 5 && targetStep !== 5) {
            const inc = validarCantidadContenedores();
            if (inc.length > 0) {
                Swal.fire({ icon: "error", title: "Cantidad inconsistente", html: inc.map(i => `<div class="text-left mb-2 p-2 bg-gray-50 rounded"><strong>Item ${i.numeroItem}:</strong> Esperados ${i.esperada} | Actuales ${i.actual}</div>`).join(""), confirmButtonText: "Entendido", confirmButtonColor: "#ef4444" });
                return;
            }
        }
        setCurrentStep(targetStep);
    };

    const handleSave = async () => {
        for (let s = 1; s <= steps.length - 1; s++) if (!validateStep(s)) return;
        const result = await Swal.fire({
            title: "¿Guardar cambios?",
            html: `<p class="text-sm text-gray-600 mb-3">Estás por guardar los cambios del BL:</p><p class="font-semibold text-lg">${formData.bl_number}</p>`,
            showCancelButton: true, confirmButtonText: "Sí, guardar", cancelButtonText: "Cancelar",
            confirmButtonColor: "#10b981", cancelButtonColor: "#e43a3aff", reverseButtons: true
        });
        if (!result.isConfirmed) return;
        setSaving(true);
        setError("");
        try {
            const fmtDT = d => d ? d.replace("T", " ") + ":00" : null;
            const dataToSend = {
                tipo_servicio: formData.tipo_servicio,
                fecha_emision: formData.fecha_emision || null,
                fecha_presentacion: fmtDT(formData.fecha_presentacion),
                fecha_zarpe: fmtDT(formData.fecha_zarpe),
                fecha_embarque: fmtDT(formData.fecha_embarque),
                fecha_recepcion_bl: esImpo ? fmtDT(formData.fecha_recepcion_bl) : null,
                forma_pago_flete: formData.forma_pago_flete || null,
                puerto_embarque: formData.puerto_embarque || null,
                puerto_descarga: formData.puerto_descarga || null,
                lugar_emision: formData.lugar_emision || null,
                lugar_destino: formData.lugar_destino || null,
                lugar_entrega: formData.lugar_entrega || null,
                lugar_recepcion: formData.lugar_recepcion || null,
                shipper: formData.shipper || null, shipper_direccion: formData.shipper_direccion || null,
                shipper_telefono: formData.shipper_telefono || null, shipper_email: formData.shipper_email || null,
                consignee: formData.consignee || null, consignee_direccion: formData.consignee_direccion || null,
                consignee_telefono: formData.consignee_telefono || null, consignee_email: formData.consignee_email || null,
                consignee_rut: formData.consignee_rut || null, consignee_nacion_id: formData.consignee_nacion_id || null,
                notify_party: formData.notify_party || null, notify_direccion: formData.notify_direccion || null,
                notify_telefono: formData.notify_telefono || null, notify_email: formData.notify_email || null,
                notify_rut: formData.notify_rut || null, notify_nacion_id: formData.notify_nacion_id || null,
                almacenista_nombre: formData.almacenista_nombre || null,
                almacenista_rut: formData.almacenista_rut || null,
                almacenista_nacion_id: formData.almacenista_nacion_id || null,
                almacenista_codigo_almacen: formData.almacenista_codigo_almacen || null,
                almacenista_id: formData.almacenista_id || null,
                descripcion_carga: formData.descripcion_carga?.trim() || null,
                peso_bruto: formData.peso_bruto ? parseFloat(formData.peso_bruto) : null,
                unidad_peso: formData.unidad_peso || null,
                volumen: formData.volumen ? parseFloat(formData.volumen) : null,
                unidad_volumen: formData.unidad_volumen || null,
                bultos: formData.bultos ? parseInt(formData.bultos) : null,
                observaciones: formData.observaciones?.length > 0 ? formData.observaciones : null,
            };
            const res = await fetch(`${API_BASE}/api/bls/${blNumber}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dataToSend) });
            if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Error al guardar"); }

            if (items.length > 0) {
                const resItems = await fetch(`${API_BASE}/api/bls/${blNumber}/items`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ items })
                });
                if (!resItems.ok) console.warn("Error al actualizar items (no crítico)");
            }

            if (esImpo || transbordos.length > 0) {
                await fetch(`${API_BASE}/api/bls/${blNumber}/transbordos`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ transbordos: transbordos.map(tb => ({ ...tb, fecha_arribo: fmtDT(tb.fecha_arribo) })) })
                });
            }

            if (contenedores.length > 0) {
                console.log('🚀 ENVIANDO CONTENEDORES AL BACKEND:', JSON.stringify(contenedores, null, 2));
                const resContenedores = await fetch(`${API_BASE}/api/bls/${blNumber}/contenedores`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contenedores: contenedores.map(c => ({
                            id: c.id, item_id: c.item_id, codigo: c.es_soc ? "" : c.codigo,
                            tipo_cnt: c.tipo_cnt, carga_cnt: c.carga_cnt || "S",
                            es_soc: c.es_soc || false, cnt_so_numero: c.cnt_so_numero || null,
                            peso: c.peso || null, unidad_peso: c.unidad_peso || "KGM",
                            volumen: c.volumen ?? null, unidad_volumen: c.unidad_volumen || "MTQ",
                            sellos: c.sellos || [], imos: c.imos || [], _isNew: c._isNew || false
                        }))
                    })
                });
            }
            await Swal.fire({ icon: "success", title: "¡Cambios guardados!", html: `<p class="text-sm text-gray-600">El BL <strong>${formData.bl_number}</strong> se actualizó correctamente</p>`, timer: 2000, showConfirmButton: false });
            const params = new URLSearchParams(window.location.search);
            const returnTo = params.get("returnTo");
            const manifestId = params.get("manifestId");
            if (returnTo === "xml-preview" && manifestId) navigate(`/manifiestos/${manifestId}/generar-xml`);
            else navigate(`/expo/detail/${blNumber}`);
        } catch (e) {
            console.error("Error al guardar:", e);
            setError(e?.message || "Error al guardar");
            Swal.fire({ icon: "error", title: "Error al guardar", text: e?.message, confirmButtonColor: "#ef4444" });
        } finally {
            setSaving(false);
        }
    };

    const AlmacenistaBuscador = ({ onSelect }) => {
        const [query, setQuery] = useState("");
        const [resultados, setResultados] = useState([]);
        const [buscando, setBuscando] = useState(false);
        const [mostrar, setMostrar] = useState(false);
        const ref = useRef(null);

        useEffect(() => {
            const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setMostrar(false); };
            document.addEventListener("mousedown", handler);
            return () => document.removeEventListener("mousedown", handler);
        }, []);

        useEffect(() => {
            if (query.trim().length < 2) { setResultados([]); return; }
            const timer = setTimeout(async () => {
                setBuscando(true);
                try {
                    const res = await fetch(`${API_BASE}/api/mantenedores/participantes?tipo=almacenador&q=${encodeURIComponent(query)}`);
                    if (res.ok) setResultados(await res.json());
                } catch { setResultados([]); }
                finally { setBuscando(false); }
            }, 300);
            return () => clearTimeout(timer);
        }, [query]);

        return (
            <div className="relative mb-4" ref={ref}>
                <div className="relative">
                    <input
                        type="text" value={query}
                        onChange={e => { setQuery(e.target.value); setMostrar(true); }}
                        onFocus={() => setMostrar(true)}
                        placeholder="Buscar almacenista en BD para autocompletar (opcional)..."
                        className="w-full px-4 py-2 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-orange-400 text-sm"
                    />
                    {buscando && <div className="absolute right-3 top-1/2 -translate-y-1/2"><div className="animate-spin h-4 w-4 border-2 border-orange-400 border-t-transparent rounded-full" /></div>}
                </div>
                {mostrar && resultados.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                        {resultados.map(a => (
                            <button key={a.id} type="button" onClick={() => { onSelect(a); setQuery(""); setMostrar(false); }} className="w-full text-left px-4 py-3 hover:bg-orange-50 border-b border-slate-100 last:border-0 transition-colors">
                                <div className="flex items-center justify-between gap-2">
                                    <div>
                                        <p className="text-sm font-medium text-slate-800">{a.nombre}</p>
                                        <p className="text-xs text-slate-500 mt-0.5">RUT: {a.rut || "—"}</p>
                                    </div>
                                    {a.codigo_almacen && <span className="text-xs font-mono bg-orange-100 text-orange-700 px-2 py-0.5 rounded border border-orange-200 flex-shrink-0">ALM: {a.codigo_almacen}</span>}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
                {mostrar && query.length >= 2 && !buscando && resultados.length === 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow p-3 text-sm text-slate-500 text-center">
                        No encontrado — completa los campos manualmente
                    </div>
                )}
            </div>
        );
    };

    if (loading) return (
        <div className="flex min-h-screen bg-slate-100"><Sidebar />
            <main className="flex-1 p-10 flex items-center justify-center">
                <div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4"></div><p className="text-sm text-slate-600">Cargando BL...</p></div>
            </main>
        </div>
    );
    if (error && !formData.bl_number) return (
        <div className="flex min-h-screen bg-slate-100"><Sidebar />
            <main className="flex-1 p-10">
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><strong>Error al cargar BL:</strong> {error}</div>
                <button onClick={() => navigate("/expo-bl")} className="text-sm text-slate-500 hover:text-slate-800">← Volver al listado</button>
            </main>
        </div>
    );

    return (
        <div className="flex min-h-screen bg-slate-100">
            <Sidebar />
            <main className="flex-1 p-10">

                {/* Header */}
                <div className="mb-6">
                    <button onClick={() => {
                        const params = new URLSearchParams(window.location.search);
                        const returnTo = params.get("returnTo");
                        const manifestId = params.get("manifestId");
                        if (returnTo === "xml-preview" && manifestId) navigate(`/manifiestos/${manifestId}/generar-xml`);
                        else navigate(`/expo/detail/${blNumber}`);
                    }} className="text-sm text-slate-500 hover:text-slate-800 mb-2">← Volver</button>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-semibold text-slate-900">Editar BL: {formData.bl_number}</h1>
                        <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wide ${esImpo ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800"}`}>{esImpo ? "IMPORTACIÓN" : "EXPORTACIÓN"}</span>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">Viaje: <strong>{formData.viaje || "—"}</strong></p>
                </div>

                {/* Stepper */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <div className="flex items-center justify-between">
                        {steps.map((step, index) => (
                            <div key={step.id} className="flex items-center flex-1">
                                <div className="flex flex-col items-center">
                                    <button onClick={() => handleStepClick(step.id)} className={["w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all", currentStep === step.id ? "bg-slate-900 text-white" : currentStep > step.id ? "bg-green-500 text-white" : "bg-slate-200 text-slate-500"].join(" ")}>
                                        {currentStep > step.id ? "✓" : step.id}
                                    </button>
                                    <span className="text-xs text-slate-600 mt-2 text-center">{step.name}</span>
                                </div>
                                {index < steps.length - 1 && <div className="flex-1 h-0.5 bg-slate-200 mx-2" />}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Contenido */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8">
                    <h2 className="text-xl font-semibold text-slate-900 mb-2">{steps[currentStep - 1].name}</h2>
                    <p className="text-sm text-slate-500 mb-6">{steps[currentStep - 1].description}</p>

                    {/* ════ STEP 1: GENERAL ════ */}
                    {currentStep === 1 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div><label className="block text-sm font-medium text-slate-700 mb-2">BL Number</label><input type="text" value={formData.bl_number} disabled className="w-full px-4 py-2 rounded-lg border border-slate-300 bg-slate-50 text-slate-500" /></div>
                            <div><label className="block text-sm font-medium text-slate-700 mb-2">Viaje</label><input type="text" value={formData.viaje} disabled className="w-full px-4 py-2 rounded-lg border border-slate-300 bg-slate-50 text-slate-500" /></div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Tipo de Servicio <span className="text-red-500">*</span></label>
                                <select value={formData.tipo_servicio} onChange={e => { updateField("tipo_servicio", e.target.value); if (e.target.value === "MM") updateField("forma_pago_flete", ""); }} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500">
                                    <option value="">Seleccionar tipo de servicio...</option>
                                    <option value="FF">FCL/FCL (FF)</option>
                                    <option value="MM">EMPTY (MM)</option>
                                </select>
                            </div>
                            <div><label className="block text-sm font-medium text-slate-700 mb-2">Fecha Emisión <span className="text-red-500">*</span></label><input type="date" value={formData.fecha_emision} onChange={e => updateField("fecha_emision", e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500" /></div>
                            <div><label className="block text-sm font-medium text-slate-700 mb-2">Fecha Presentación <span className="text-red-500">*</span></label><input type="datetime-local" value={formData.fecha_presentacion} onChange={e => updateField("fecha_presentacion", e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500" /></div>
                            <div><label className="block text-sm font-medium text-slate-700 mb-2">Fecha Zarpe <span className="text-red-500">*</span></label><input type="datetime-local" value={formData.fecha_zarpe} onChange={e => updateField("fecha_zarpe", e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500" /></div>
                            <div><label className="block text-sm font-medium text-slate-700 mb-2">Fecha Embarque <span className="text-red-500">*</span></label><input type="datetime-local" value={formData.fecha_embarque} onChange={e => updateField("fecha_embarque", e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500" /></div>
                            {esImpo && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Fecha Recepción BL</label>
                                    <input type="datetime-local" value={formData.fecha_recepcion_bl} onChange={e => updateField("fecha_recepcion_bl", e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500" />
                                    <p className="text-xs text-slate-500 mt-1">Opcional — solo aplica en importación</p>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Forma de Pago Flete {formData.tipo_servicio !== "MM" && <span className="text-red-500">*</span>}</label>
                                <select value={formData.forma_pago_flete} onChange={e => updateField("forma_pago_flete", e.target.value)} disabled={formData.tipo_servicio === "MM"} className={`w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500 ${formData.tipo_servicio === "MM" ? "bg-slate-100 text-slate-400 cursor-not-allowed" : ""}`}>
                                    <option value="">Seleccionar forma de pago...</option>
                                    <option value="PREPAID">Prepaid</option>
                                    <option value="COLLECT">Collect</option>
                                </select>
                                {formData.tipo_servicio === "MM" && <p className="text-xs text-slate-500 mt-1">No aplica para tipo EMPTY</p>}
                            </div>
                        </div>
                    )}

                    {/* ════ STEP 2: RUTAS ════ */}
                    {currentStep === 2 && (
                        <div className="space-y-8">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">Rutas y Transbordos</h2>
                                    <p className="text-sm text-slate-600 mt-1">{esImpo ? "En importación los transbordos son obligatorios con fecha de arribo" : "En exportación los transbordos son opcionales"}</p>
                                </div>
                                <button type="button" onClick={() => setShowCrearPuertoModal(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                    Crear Puerto
                                </button>
                            </div>
                            <div className="border-b pb-6">
                                <h3 className="font-semibold text-slate-800 mb-4">Lugares de Origen</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {[["lugar_emision", "Lugar Emisión"], ["lugar_recepcion", "Lugar Recepción"]].map(([field, label]) => (
                                        <div key={field}>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">{label} <span className="text-red-500">*</span></label>
                                            <select value={formData[field]} onChange={e => updateField(field, e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500">
                                                <option value="">Seleccionar lugar...</option>
                                                {puertos.map(p => <option key={p.id} value={p.codigo}>{p.codigo} - {p.nombre}</option>)}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="border-b pb-6">
                                <h3 className="font-semibold text-slate-800 mb-4">Puertos Principales</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {[["puerto_embarque", "Puerto Embarque"], ["puerto_descarga", "Puerto Descarga"]].map(([field, label]) => (
                                        <div key={field}>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">{label} <span className="text-red-500">*</span></label>
                                            <select value={formData[field]} onChange={e => updateField(field, e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500">
                                                <option value="">Seleccionar puerto...</option>
                                                {puertos.map(p => <option key={p.id} value={p.codigo}>{p.codigo} - {p.nombre}</option>)}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="border-b pb-6">
                                <h3 className="font-semibold text-slate-800 mb-4">Lugares de Destino</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {[["lugar_destino", "Lugar Destino"], ["lugar_entrega", "Lugar Entrega"]].map(([field, label]) => (
                                        <div key={field}>
                                            <label className="block text-sm font-medium text-slate-700 mb-2">{label} <span className="text-red-500">*</span></label>
                                            <select value={formData[field]} onChange={e => updateField(field, e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500">
                                                <option value="">Seleccionar lugar...</option>
                                                {puertos.map(p => <option key={p.id} value={p.codigo}>{p.codigo} - {p.nombre}</option>)}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                                        Transbordos ({transbordos.length})
                                        {esImpo ? <span className="text-xs font-normal text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">Opcionales — Impo</span> : <span className="text-xs font-normal text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">Opcionales — Expo</span>}
                                    </h3>
                                    {esImpo && (
                                        <button type="button" onClick={addTransbordo} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                            Agregar Transbordo
                                        </button>
                                    )}
                                </div>
                                {transbordos.length === 0 ? (
                                    <div className={`text-center py-8 rounded-lg border-2 border-dashed ${esImpo ? "bg-red-50 border-red-300" : "bg-slate-50 border-slate-300"}`}>
                                        <p className="text-slate-500 text-sm">Este BL no tiene transbordos.</p>                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {transbordos.map((tb, idx) => (
                                            <div key={tb.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold flex-shrink-0">{idx + 1}</div>
                                                <div className={`flex-1 grid gap-3 ${esImpo ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"}`}>
                                                    <div className="relative">
                                                        <input type="text" value={tb.puerto_search ?? tb.puerto_cod} onChange={e => { updateTransbordo(tb.id, "puerto_search", e.target.value); updateTransbordo(tb.id, "puerto_cod", e.target.value); }} placeholder="Buscar puerto por código o nombre..." className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500" />
                                                        {tb.puerto_search && tb.puerto_search.length >= 2 && (() => {
                                                            const filtrados = puertos.filter(p => p.codigo.toLowerCase().includes(tb.puerto_search.toLowerCase()) || p.nombre.toLowerCase().includes(tb.puerto_search.toLowerCase())).slice(0, 8);
                                                            return filtrados.length > 0 ? (
                                                                <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                                                    {filtrados.map(p => (
                                                                        <button key={p.id} type="button" onClick={() => { updateTransbordo(tb.id, "puerto_cod", p.codigo); updateTransbordo(tb.id, "puerto_search", `${p.codigo} - ${p.nombre}`); }} className="w-full text-left px-4 py-2 hover:bg-blue-50 text-sm border-b border-slate-100 last:border-0">
                                                                            <span className="font-mono font-semibold text-blue-700">{p.codigo}</span><span className="text-slate-600 ml-2">{p.nombre}</span>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            ) : null;
                                                        })()}
                                                    </div>
                                                    {esImpo && (
                                                        <div>
                                                            <input type="datetime-local" value={tb.fecha_arribo || ""} onChange={e => updateTransbordo(tb.id, "fecha_arribo", e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500" />
                                                            <p className="text-xs text-slate-500 mt-1">Fecha de arribo <span className="text-red-500">*</span></p>
                                                        </div>
                                                    )}
                                                </div>
                                                {esImpo && (
                                                    <button type="button" onClick={() => removeTransbordo(tb.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {(formData.puerto_embarque || transbordos.length > 0 || formData.puerto_descarga) && (
                                    <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                        <p className="text-xs text-blue-700"><strong>Ruta:</strong> {formData.puerto_embarque || "?"}{transbordos.length > 0 && ` → ${transbordos.map(t => t.puerto_cod || "?").join(" → ")}`}{formData.puerto_descarga && ` → ${formData.puerto_descarga}`}</p>
                                    </div>
                                )}
                                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800"><strong>Nota:</strong> Si un puerto no aparece en la lista, usa el botón <strong>"Crear Puerto"</strong> arriba.</div>
                            </div>

                            {/* ── Observaciones (solo IMPO, dentro del step 2) ── */}
                            {esImpo && (
                                <div className="mt-6 pt-6 border-t border-slate-200">
                                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3 text-sm text-slate-600">
                                        <strong>Observaciones automáticas:</strong> El sistema agrega automáticamente
                                        <span className="font-mono bg-slate-200 px-1 mx-1 rounded">14: SIN TRB</span> si no hay transbordos.
                                        Aquí puedes agregar observaciones manuales adicionales.
                                    </div>
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-semibold text-slate-800">Observaciones manuales</h3>
                                        <button
                                            type="button"
                                            onClick={() => updateField("observaciones", [...(formData.observaciones || []), { nombre: "MOT", contenido: "" }])}
                                            className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 flex items-center gap-2 transition-colors"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                            </svg>
                                            Agregar Observación
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {(formData.observaciones || []).map((obs, idx) => (
                                            <div key={idx} className="border border-slate-200 rounded-lg p-3 bg-white relative">
                                                <button
                                                    type="button"
                                                    onClick={() => updateField("observaciones", formData.observaciones.filter((_, i) => i !== idx))}
                                                    className="absolute top-2 right-2 text-red-500 hover:text-red-700 p-1 rounded transition-colors"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                    </svg>
                                                </button>
                                                <div className="grid grid-cols-4 gap-3">
                                                    <div className="col-span-1">
                                                        <label className="block text-xs font-medium text-slate-600 mb-1">Tipo</label>
                                                        <select
                                                            value={obs.nombre}
                                                            onChange={e => updateField("observaciones", formData.observaciones.map((o, i) => i === idx ? { ...o, nombre: e.target.value } : o))}
                                                            className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        >
                                                            <option value="MOT">MOT</option>
                                                            <option value="GRAL">GRAL</option>
                                                            <option value="OBS">OBS</option>
                                                        </select>
                                                    </div>
                                                    <div className="col-span-3">
                                                        <label className="block text-xs font-medium text-slate-600 mb-1">Contenido</label>
                                                        <input
                                                            type="text"
                                                            value={obs.contenido}
                                                            onChange={e => updateField("observaciones", formData.observaciones.map((o, i) => i === idx ? { ...o, contenido: e.target.value } : o))}
                                                            placeholder="Ej: MOD SENT OP"
                                                            className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {/* ════ FIN STEP 2 ════ */}

                    {/* ════ STEP 3: PARTICIPANTES ════ */}
                    {currentStep === 3 && (
                        <div className="space-y-8">
                            {esImpo && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                                    <strong>Importación:</strong> Consignee y Notify requieren RUT/ID y Nación. El Almacenista es obligatorio.
                                </div>
                            )}
                            <div className="border border-slate-300 rounded-lg p-6 bg-white relative">
                                {formData.shipper_codigo_pil && <div className="absolute top-4 right-4"><span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-mono bg-blue-100 text-blue-800 border border-blue-300">PIL: {formData.shipper_codigo_pil}</span></div>}
                                <h3 className="font-semibold text-slate-900 mb-4 text-lg border-b pb-2">{esImpo ? "Embarcador (EMB)" : "Shipper / Embarcador"}</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-2">Nombre / Razón Social <span className="text-red-500">*</span></label><input type="text" value={formData.shipper || ""} onChange={e => updateField("shipper", e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500" /></div>
                                    <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-2">Dirección</label><input type="text" value={formData.shipper_direccion || ""} onChange={e => updateField("shipper_direccion", e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500" /></div>
                                    <div><label className="block text-sm font-medium text-slate-700 mb-2">Teléfono</label><input type="text" value={formData.shipper_telefono || ""} onChange={e => updateField("shipper_telefono", e.target.value.replace(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, ""))} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500" /></div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                                        <input type="email" value={formData.shipper_email || ""} onChange={e => { updateField("shipper_email", e.target.value); setEmailErrors(p => ({ ...p, shipper: false })); }} onBlur={e => setEmailErrors(p => ({ ...p, shipper: !validarEmail(e.target.value) }))} className={`w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-slate-500 ${emailErrors.shipper ? "border-red-400 bg-red-50" : "border-slate-300"}`} />
                                        {emailErrors.shipper && <p className="text-xs text-red-600 mt-1">Formato de email inválido</p>}
                                    </div>
                                </div>
                            </div>
                            <div className="border border-slate-300 rounded-lg p-6 bg-white relative">
                                {formData.consignee_codigo_pil && <div className="absolute top-4 right-4"><span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-mono bg-green-100 text-green-800 border border-green-300">PIL: {formData.consignee_codigo_pil}</span></div>}
                                <h3 className="font-semibold text-slate-900 mb-4 text-lg border-b pb-2">Consignatario {esImpo && <span className="ml-2 text-xs font-normal text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">Con RUT en Impo</span>}</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-2">Nombre / Razón Social <span className="text-red-500">*</span></label><input type="text" value={formData.consignee || ""} onChange={e => updateField("consignee", e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500" /></div>
                                    {esImpo && (<>
                                        <div><label className="block text-sm font-medium text-slate-700 mb-2">RUT / ID <span className="text-red-500">*</span></label><input type="text" value={formData.consignee_rut || ""} onChange={e => updateField("consignee_rut", e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500" placeholder="Ej: 77471259-3" /></div>
                                        <div><label className="block text-sm font-medium text-slate-700 mb-2">Nación ID <span className="text-red-500">*</span></label><input type="text" value={formData.consignee_nacion_id || "CL"} onChange={e => updateField("consignee_nacion_id", e.target.value.toUpperCase())} maxLength={2} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500 uppercase" /></div>
                                    </>)}
                                    <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-2">Dirección</label><input type="text" value={formData.consignee_direccion || ""} onChange={e => updateField("consignee_direccion", e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500" /></div>
                                    <div><label className="block text-sm font-medium text-slate-700 mb-2">Teléfono</label><input type="text" value={formData.consignee_telefono || ""} onChange={e => updateField("consignee_telefono", e.target.value.replace(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, ""))} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500" /></div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                                        <input type="email" value={formData.consignee_email || ""} onChange={e => { updateField("consignee_email", e.target.value); setEmailErrors(p => ({ ...p, consignee: false })); }} onBlur={e => setEmailErrors(p => ({ ...p, consignee: !validarEmail(e.target.value) }))} className={`w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-slate-500 ${emailErrors.consignee ? "border-red-400 bg-red-50" : "border-slate-300"}`} />
                                        {emailErrors.consignee && <p className="text-xs text-red-600 mt-1">Formato de email inválido</p>}
                                    </div>
                                </div>
                            </div>
                            <div className="border border-slate-300 rounded-lg p-6 bg-white relative">
                                {formData.notify_codigo_pil && <div className="absolute top-4 right-4"><span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-mono bg-purple-100 text-purple-800 border border-purple-300">PIL: {formData.notify_codigo_pil}</span></div>}
                                <h3 className="font-semibold text-slate-900 mb-4 text-lg border-b pb-2">Notify Party {esImpo && <span className="ml-2 text-xs font-normal text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">Con RUT en Impo</span>}</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-2">Nombre / Razón Social <span className="text-red-500">*</span></label><input type="text" value={formData.notify_party || ""} onChange={e => updateField("notify_party", e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500" /></div>
                                    {esImpo && (<>
                                        <div><label className="block text-sm font-medium text-slate-700 mb-2">RUT / ID <span className="text-red-500">*</span></label><input type="text" value={formData.notify_rut || ""} onChange={e => updateField("notify_rut", e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500" placeholder="Ej: 77471259-3" /></div>
                                        <div><label className="block text-sm font-medium text-slate-700 mb-2">Nación ID <span className="text-red-500">*</span></label><input type="text" value={formData.notify_nacion_id || "CL"} onChange={e => updateField("notify_nacion_id", e.target.value.toUpperCase())} maxLength={2} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500 uppercase" /></div>
                                    </>)}
                                    <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-2">Dirección</label><input type="text" value={formData.notify_direccion || ""} onChange={e => updateField("notify_direccion", e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500" /></div>
                                    <div><label className="block text-sm font-medium text-slate-700 mb-2">Teléfono</label><input type="text" value={formData.notify_telefono || ""} onChange={e => updateField("notify_telefono", e.target.value.replace(/[a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, ""))} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500" /></div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                                        <input type="email" value={formData.notify_email || ""} onChange={e => { updateField("notify_email", e.target.value); setEmailErrors(p => ({ ...p, notify: false })); }} onBlur={e => setEmailErrors(p => ({ ...p, notify: !validarEmail(e.target.value) }))} className={`w-full px-4 py-2 rounded-lg border focus:ring-2 focus:ring-slate-500 ${emailErrors.notify ? "border-red-400 bg-red-50" : "border-slate-300"}`} />
                                        {emailErrors.notify && <p className="text-xs text-red-600 mt-1">Formato de email inválido</p>}
                                    </div>
                                </div>
                            </div>
                            {esImpo && (
                                <div className="border-2 border-orange-300 rounded-lg p-6 bg-orange-50 relative">
                                    <div className="absolute top-4 right-4"><span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-orange-200 text-orange-800 border border-orange-400">Solo Importación</span></div>
                                    <h3 className="font-semibold text-slate-900 mb-4 text-lg border-b border-orange-200 pb-2">Almacenista (ALM) <span className="text-red-500">*</span></h3>
                                    <AlmacenistaBuscador
                                        onSelect={(datos) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                almacenista_id: datos.id || null,
                                                almacenista_nombre: datos.nombre || "",
                                                almacenista_rut: datos.rut || "",
                                                almacenista_nacion_id: datos.pais || "CL",
                                                almacenista_codigo_almacen: datos.codigo_almacen || ""
                                            }));
                                        }}
                                    />
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-2">Nombre / Razón Social <span className="text-red-500">*</span></label><input type="text" value={formData.almacenista_nombre || ""} onChange={e => updateField("almacenista_nombre", e.target.value)} className="w-full px-4 py-2 rounded-lg border border-orange-300 bg-white focus:ring-2 focus:ring-orange-400" placeholder="Ej: SITRANS ALMACENES EXTRAPORTUARIOS LTDA." /></div>
                                        <div><label className="block text-sm font-medium text-slate-700 mb-2">RUT <span className="text-red-500">*</span></label><input type="text" value={formData.almacenista_rut || ""} onChange={e => updateField("almacenista_rut", e.target.value)} className="w-full px-4 py-2 rounded-lg border border-orange-300 bg-white focus:ring-2 focus:ring-orange-400" placeholder="Ej: 76451351-7" /></div>
                                        <div><label className="block text-sm font-medium text-slate-700 mb-2">Nación ID <span className="text-red-500">*</span></label><input type="text" value={formData.almacenista_nacion_id || "CL"} onChange={e => updateField("almacenista_nacion_id", e.target.value.toUpperCase())} maxLength={2} className="w-full px-4 py-2 rounded-lg border border-orange-300 bg-white focus:ring-2 focus:ring-orange-400 uppercase" placeholder="CL" /></div>
                                        <div><label className="block text-sm font-medium text-slate-700 mb-2">Código Almacén <span className="text-red-500">*</span></label><input type="text" value={formData.almacenista_codigo_almacen || ""} onChange={e => updateField("almacenista_codigo_almacen", e.target.value)} className="w-full px-4 py-2 rounded-lg border border-orange-300 bg-white focus:ring-2 focus:ring-orange-400" placeholder="Ej: A-84" /></div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {/* ════ FIN STEP 3 ════ */}

                    {/* ════ STEP 4: MERCANCÍA ════ */}
                    {currentStep === 4 && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-2">Peso Bruto <span className="text-red-500">*</span></label><input type="number" step="0.001" min={formData.tipo_servicio === "MM" ? "0" : "0.001"} value={formData.peso_bruto} onChange={e => updateField("peso_bruto", e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500" /></div>
                                <div><label className="block text-sm font-medium text-slate-700 mb-2">Unidad <span className="text-red-500">*</span></label><input type="text" value={formData.unidad_peso} onChange={e => updateField("unidad_peso", e.target.value.toUpperCase())} placeholder="KGM" className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500" /></div>
                                <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-2">Volumen <span className="text-red-500">*</span></label><input type="number" step="0.001" min="0" value={formData.volumen ?? ""} onChange={e => updateField("volumen", e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500" /></div>
                                <div><label className="block text-sm font-medium text-slate-700 mb-2">Unidad <span className="text-red-500">*</span></label><input type="text" value={formData.unidad_volumen} onChange={e => updateField("unidad_volumen", e.target.value.toUpperCase())} placeholder="MTQ" className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500" /></div>
                                <div className="md:col-span-3"><label className="block text-sm font-medium text-slate-700 mb-2">Cantidad de Bultos <span className="text-red-500">*</span></label><input type="number" min="1" value={formData.bultos} onChange={e => updateField("bultos", e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500" /></div>
                            </div>
                        </div>
                    )}

                    {/* ════ STEP 5: ITEMS ════ */}
                    {currentStep === 5 && (
                        <div className="space-y-6">
                            {items.length === 0 ? (
                                <div className="text-center py-8 text-slate-500"><p>Este BL no tiene ítems cargados</p></div>
                            ) : (
                                <div className="space-y-8">
                                    {items.map(item => (
                                        <div key={item.id} className="border border-slate-200 rounded-lg p-6 bg-slate-50">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="font-semibold text-slate-900">Item {item.numero_item}</h3>
                                                <span className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded">{item.contenedores?.length || 0} contenedor(es)</span>
                                            </div>
                                            {item.contenedores && item.contenedores.length > 0 && (
                                                <div className="mb-4">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <label className="block text-xs font-medium text-slate-600">Contenedores asociados:</label>
                                                        <button type="button" onClick={() => addContenedorToItem(item.id, item.numero_item)} className="text-xs bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 font-medium">+ Agregar Contenedor</button>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {item.contenedores.map((c, i) => <span key={i} className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-mono">{c.codigo}</span>)}
                                                    </div>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div className="md:col-span-2"><label className="block text-sm font-medium text-slate-700 mb-2">Descripción</label><textarea rows={3} value={item.descripcion || ""} onChange={e => updateItem(item.id, "descripcion", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500 text-sm" /></div>
                                                <div><label className="block text-sm font-medium text-slate-700 mb-2">Marcas</label><input type="text" value={item.marcas || ""} onChange={e => updateItem(item.id, "marcas", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500 text-sm" /></div>
                                                <div><label className="block text-sm font-medium text-slate-700 mb-2">Tipo Bulto</label><select value={item.tipo_bulto || ""} onChange={e => updateItem(item.id, "tipo_bulto", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500 text-sm"><option value="">Seleccionar...</option>{tiposBulto.map(t => <option key={t.id} value={t.tipo_bulto}>{t.tipo_bulto}</option>)}</select></div>
                                                <div><label className="block text-sm font-medium text-slate-700 mb-2">Cantidad</label><input type="number" value={item.cantidad || ""} onChange={e => updateItem(item.id, "cantidad", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500 text-sm" /></div>
                                                <div><label className="block text-sm font-medium text-slate-700 mb-2">Peso Bruto</label><input type="number" step="0.001" value={item.peso_bruto ?? ""} onChange={e => updateItem(item.id, "peso_bruto", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500 text-sm" /></div>
                                                <div><label className="block text-sm font-medium text-slate-700 mb-2">Unidad Peso</label><input type="text" value={item.unidad_peso || ""} onChange={e => updateItem(item.id, "unidad_peso", e.target.value.toUpperCase())} placeholder="KGM" maxLength="3" className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500 text-sm uppercase" /></div>
                                                <div><label className="block text-sm font-medium text-slate-700 mb-2">Volumen</label><input type="number" step="0.001" value={item.volumen || ""} onChange={e => updateItem(item.id, "volumen", e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500 text-sm" /></div>
                                                <div><label className="block text-sm font-medium text-slate-700 mb-2">Unidad Volumen</label><input type="text" value={item.unidad_volumen || ""} onChange={e => updateItem(item.id, "unidad_volumen", e.target.value.toUpperCase())} placeholder="MTQ" maxLength="3" className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500 text-sm uppercase" /></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ════ STEP 6: CONTENEDORES ════ */}
                    {currentStep === 6 && (
                        <div className="space-y-6">
                            {contenedores.some(c => !esContenedorCargaPeligrosa(c) && c.imos?.length > 0) && (
                                <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 flex items-start justify-between gap-4">
                                    <div><p className="text-sm font-medium text-amber-900">⚠️ Datos IMO innecesarios detectados</p><p className="text-xs text-amber-700 mt-1">Contenedores sin carga peligrosa tienen datos IMO.</p></div>
                                    <button type="button" onClick={() => { Swal.fire({ title: "¿Limpiar datos IMO?", icon: "question", showCancelButton: true, confirmButtonText: "Sí, limpiar", cancelButtonText: "Cancelar", confirmButtonColor: "#f59e0b" }).then(r => { if (r.isConfirmed) setContenedores(prev => prev.map(c => esContenedorCargaPeligrosa(c) ? c : { ...c, imos: [] })); }); }} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium whitespace-nowrap">Limpiar IMOs</button>
                                </div>
                            )}
                            {contenedores.length === 0 ? (
                                <div className="text-center py-8 text-slate-500"><p>Este BL no tiene contenedores cargados</p></div>
                            ) : (
                                <div className="space-y-6">
                                    {contenedores.map((cont, idx) => {
                                        const esPeligrosa = esContenedorCargaPeligrosa(cont);
                                        const itemsAsoc = getItemsAsociados(cont);
                                        const labelCont = cont.es_soc ? (cont.cnt_so_numero || "SOC sin número") : (cont.codigo || "—");
                                        return (
                                            <div key={cont.id} className={`border rounded-lg p-6 ${esPeligrosa ? "border-red-400 bg-red-50" : cont.es_soc ? "border-blue-400 bg-blue-50" : "border-slate-300 bg-slate-50"}`}>
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <h3 className="font-semibold text-slate-900 text-lg">Contenedor {idx + 1}: {labelCont}</h3>
                                                        {cont.es_soc && <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-xs font-bold">SOC</span>}
                                                        {esPeligrosa && <span className="px-3 py-1 bg-red-600 text-white rounded-full text-xs font-bold animate-pulse">CARGA PELIGROSA</span>}
                                                        {cont._isNew && <span className="px-3 py-1 bg-green-600 text-white rounded-full text-xs font-bold">NUEVO</span>}
                                                    </div>
                                                    <span className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full">{cont.tipo_cnt || "N/A"}</span>
                                                </div>
                                                {itemsAsoc.length > 0 && (
                                                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                                        <p className="text-xs font-medium text-blue-900 mb-1">Items asociados:</p>
                                                        <div className="flex flex-wrap gap-2">{itemsAsoc.map((n, i) => <span key={i} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">Item {n}</span>)}</div>
                                                    </div>
                                                )}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    {esImpo && (
                                                        <div className="md:col-span-2 flex items-center gap-3 p-3 bg-slate-100 rounded-lg">
                                                            <input type="checkbox" id={`soc_${cont.id}`} checked={cont.es_soc || false} onChange={e => {
                                                                const nuevoValor = e.target.checked;
                                                                if (nuevoValor && esContenedorCargaPeligrosa(cont) && (cont.imos || []).length > 0) {
                                                                    Swal.fire({
                                                                        title: "⚠️ Contenedor con carga peligrosa",
                                                                        text: "Al marcar como SOC se perderán los datos IMO asociados. ¿Deseas continuar?",
                                                                        icon: "warning",
                                                                        showCancelButton: true,
                                                                        confirmButtonText: "Sí, marcar SOC",
                                                                        cancelButtonText: "Cancelar",
                                                                        confirmButtonColor: "#f59e0b"
                                                                    }).then(r => {
                                                                        if (r.isConfirmed) {
                                                                            updateContenedor(cont.id, "es_soc", true);
                                                                            updateContenedor(cont.id, "imos", []);
                                                                        }
                                                                    });
                                                                } else {
                                                                    updateContenedor(cont.id, "es_soc", nuevoValor);
                                                                }
                                                            }} className="w-4 h-4 accent-blue-600" />
                                                            <label htmlFor={`soc_${cont.id}`} className="text-sm font-medium text-slate-700 cursor-pointer">Shipper Owner Container (SOC)</label>
                                                            {cont.es_soc && <span className="ml-auto text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">SOC activo — sin sigla/número/dígito</span>}
                                                        </div>
                                                    )}
                                                    {cont.es_soc ? (
                                                        <div className="md:col-span-2">
                                                            <label className="block text-sm font-medium text-slate-700 mb-2">Número Contenedor SOC <span className="text-red-500">*</span></label>
                                                            <input type="text" value={cont.cnt_so_numero || ""} onChange={e => updateContenedor(cont.id, "cnt_so_numero", e.target.value)} placeholder="Ej: TCNU 729792-0" className="w-full px-4 py-2 rounded-lg border border-blue-300 focus:ring-2 focus:ring-blue-500 font-mono" />
                                                            <p className="text-xs text-slate-500 mt-1">Este número irá en &lt;cnt-so&gt; del XML.</p>
                                                        </div>
                                                    ) : (
                                                        <div>
                                                            <label className="block text-sm font-medium text-slate-700 mb-2">Código Contenedor <span className="text-red-500">*</span></label>
                                                            <input type="text" value={cont.codigo || ""} onChange={e => updateContenedor(cont.id, "codigo", e.target.value)} className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500 font-mono" maxLength="11" />
                                                        </div>
                                                    )}
                                                    {!cont.es_soc && (
                                                        <div>
                                                            <label className="block text-sm font-medium text-slate-700 mb-2">Tipo Contenedor</label>
                                                            <input type="text" value={cont.tipo_cnt || "N/A"} disabled className="w-full px-4 py-2 rounded-lg border border-slate-300 bg-slate-100 text-slate-600 font-mono cursor-not-allowed" />
                                                            <p className="text-xs text-slate-500 mt-1">No editable (asignado automáticamente)</p>
                                                        </div>
                                                    )}
                                                    <div className="md:col-span-2">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <label className="block text-sm font-medium text-slate-700">Sellos ({(cont.sellos || []).length})</label>
                                                            <button type="button" onClick={() => addSelloToContenedor(cont.id)} className="text-sm bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 transition-colors">+ Agregar Sello</button>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {(cont.sellos || []).length === 0 ? <p className="text-sm text-slate-500 italic">Sin sellos</p> : (cont.sellos || []).map((s, i) => (
                                                                <div key={i} className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-mono">
                                                                    {s}<button type="button" onClick={() => removeSelloFromContenedor(cont.id, s)} className="text-red-600 hover:text-red-800 font-bold">×</button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    {esPeligrosa && (
                                                        <div className="md:col-span-2 border-t-2 border-red-300 pt-4">
                                                            <div className="flex items-center justify-between mb-3">
                                                                <label className="block text-sm font-medium text-red-800">⚠️ Datos IMO (Obligatorio) — {(cont.imos || []).length} registrado(s)</label>
                                                                <button type="button" onClick={() => addImoToContenedor(cont.id, cont)} className="text-sm bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors font-medium">+ Agregar IMO</button>
                                                            </div>
                                                            {(cont.imos || []).length === 0 && <div className="mb-3 p-3 bg-red-100 border border-red-300 rounded-lg"><p className="text-sm text-red-800 font-medium">⚠️ Este contenedor tiene carga peligrosa y debe tener al menos un dato IMO</p></div>}
                                                            <div className="space-y-2">
                                                                {(cont.imos || []).map((imo, i) => (
                                                                    <div key={i} className="flex items-center gap-3 p-4 bg-white border-2 border-orange-300 rounded-lg shadow-sm">
                                                                        <div className="flex-1 grid grid-cols-2 gap-4">
                                                                            <div><span className="text-xs text-slate-600">Clase IMO</span><p className="text-sm font-bold text-slate-900">{imo.clase}</p></div>
                                                                            <div><span className="text-xs text-slate-600">Número IMO</span><p className="text-sm font-bold text-slate-900">{imo.numero}</p></div>
                                                                        </div>
                                                                        <button type="button" onClick={() => removeImoFromContenedor(cont.id, i)} className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors">
                                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800"><strong>Nota:</strong> Los contenedores con carga peligrosa DEBEN tener datos IMO.</div>
                        </div>
                    )}

                    {/* ════ STEP 7: REVISIÓN ════ */}
                    {currentStep === 7 && (
                        <div className="space-y-6">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                                <h3 className="font-semibold text-blue-900 mb-4 text-lg flex items-center gap-2">
                                    Resumen de cambios
                                    <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${esImpo ? "bg-blue-200 text-blue-900" : "bg-emerald-200 text-emerald-900"}`}>{esImpo ? "IMPORTACIÓN" : "EXPORTACIÓN"}</span>
                                </h3>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    {[
                                        ["BL Number", formData.bl_number], ["Viaje", formData.viaje],
                                        ["Tipo Servicio", formData.tipo_servicio], ["Forma Pago Flete", formData.forma_pago_flete || "N/A"],
                                        ["Fecha Emisión", formData.fecha_emision || "—"], ["Fecha Presentación", formData.fecha_presentacion || "—"],
                                        ...(esImpo ? [["Fecha Recepción BL", formData.fecha_recepcion_bl || "—"]] : []),
                                        ["Puerto Embarque", formData.puerto_embarque || "—"], ["Puerto Descarga", formData.puerto_descarga || "—"],
                                        ["Transbordos", `${transbordos.length} transbordo(s)`],
                                        ["Shipper", formData.shipper || "—"], ["Consignee", formData.consignee || "—"], ["Notify Party", formData.notify_party || "—"],
                                        ...(esImpo ? [["Almacenista", formData.almacenista_nombre || "—"], ["Cód. Almacén", formData.almacenista_codigo_almacen || "—"]] : []),
                                        ["Peso Bruto", `${formData.peso_bruto} ${formData.unidad_peso}`], ["Volumen", `${formData.volumen} ${formData.unidad_volumen}`],
                                        ["Bultos", formData.bultos], ["Total Contenedores", contenedores.length],
                                        ["SOC", contenedores.filter(c => c.es_soc).length > 0 ? `${contenedores.filter(c => c.es_soc).length} contenedor(es) SOC` : "Ninguno"],
                                        ["Total Items", items.length],
                                    ].map(([label, val]) => (
                                        <div key={label}><p className="text-blue-700 font-medium">{label}:</p><p className="text-blue-900">{val}</p></div>
                                    ))}
                                </div>
                            </div>
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800"><strong>Atención:</strong> Al confirmar, los cambios se aplicarán inmediatamente en el sistema.</div>
                        </div>
                    )}
                </div>

                {/* Botones navegación */}
                <div className="flex items-center justify-between mt-6">
                    <button onClick={prevStep} disabled={currentStep === 1} className="px-6 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">← Anterior</button>
                    <div className="text-sm text-slate-600">Paso {currentStep} de {steps.length}</div>
                    {currentStep < steps.length ? (
                        <button onClick={nextStep} className="px-6 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors">Siguiente →</button>
                    ) : (
                        <button onClick={handleSave} disabled={saving} className="px-8 py-3 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold">
                            {saving ? <span className="flex items-center gap-2"><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>Guardando...</span> : "Guardar Cambios"}
                        </button>
                    )}
                </div>
            </main>

            <CrearPuertoModal isOpen={showCrearPuertoModal} onClose={() => setShowCrearPuertoModal(false)} onPuertoCreado={handlePuertoCreado} />
        </div>
    );
};

export default ExpoBLEdit;