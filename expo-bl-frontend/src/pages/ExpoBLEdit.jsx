import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import Sidebar from "../components/Sidebar";
import ParticipanteSelector from '../components/ParticipanteSelector';
import CrearPuertoModal from "../components/CrearPuertoModal";  // 🔥 AGREGAR ESTE IMPORT

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
    const [puertos, setPuertos] = useState([]);
    const [items, setItems] = useState([]);
    const [contenedores, setContenedores] = useState([]);
    const [transbordos, setTransbordos] = useState([]);
    const [tiposBulto, setTiposBulto] = useState([]); // 🆕 NUEVO
    const [tiposContenedor, setTiposContenedor] = useState([]);
    const [tipoCntTipoBulto, setTipoCntTipoBulto] = useState([]); // 🆕 NUEVO
    const [showCrearPuertoModal, setShowCrearPuertoModal] = useState(false);


    useEffect(() => {
        fetch('http://localhost:4000/tipos-contenedor')  // ✅ CORRECTO
            .then(res => res.json())
            .then(data => setTiposContenedor(data))
            .catch(err => console.error('Error:', err));
    }, []);

    // Estado del formulario
    // REEMPLAZAR POR:
    const [formData, setFormData] = useState({
        bl_number: "",
        viaje: "",
        tipo_servicio: "", //REVISAR
        fecha_emision: "",
        fecha_presentacion: "",  // ← AGREGAR AQUÍ
        fecha_zarpe: "",
        fecha_embarque: "",
        lugar_emision: "",
        puerto_embarque: "",
        puerto_descarga: "",
        lugar_destino: "",
        lugar_entrega: "",
        lugar_recepcion: "",
        shipper: "",
        consignee: "",
        notify_party: "",
        shipper_id: null,
        consignee_id: null,
        notify_id: null,
        descripcion_carga: "",
        peso_bruto: "",
        unidad_peso: "",        // ← AGREGAR
        volumen: "",
        unidad_volumen: "",     // ← AGREGAR
        bultos: ""
    });

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            setError("");
            try {
                // 🆕 Cargar BL
                const resBL = await fetch(`http://localhost:4000/bls/${blNumber}`);
                if (!resBL.ok) {
                    throw new Error(`Error ${resBL.status}: No se pudo cargar el BL`);
                }
                const dataBL = await resBL.json();

                // 🆕 Cargar lista de puertos
                const resPuertos = await fetch(`http://localhost:4000/puertos`);
                if (resPuertos.ok) {
                    const dataPuertos = await resPuertos.json();
                    setPuertos(dataPuertos);
                }
                // 🆕 AGREGAR ESTAS LÍNEAS 👇
                const resTiposBulto = await fetch(`http://localhost:4000/tipos-bulto`);
                if (resTiposBulto.ok) {
                    const dataTiposBulto = await resTiposBulto.json();
                    setTiposBulto(dataTiposBulto);
                }
                // AGREGAR INMEDIATAMENTE DESPUÉS:
                // 🆕 Cargar tipos de contenedor
                const resTiposContenedor = await fetch(`http://localhost:4000/tipos-contenedor`);
                if (resTiposContenedor.ok) {
                    const dataTiposContenedor = await resTiposContenedor.json();
                    setTiposContenedor(dataTiposContenedor);
                }
                // 🆕 Cargar mapeo tipo_cnt <-> tipo_bulto
                const resMapeo = await fetch(`http://localhost:4000/tipo-cnt-tipo-bulto`);
                if (resMapeo.ok) {
                    const dataMapeo = await resMapeo.json();
                    setTipoCntTipoBulto(dataMapeo);
                }
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
                // Mapear datos del BL al formulario
                setFormData({
                    bl_number: dataBL.bl_number || "",
                    viaje: dataBL.viaje || "",
                    tipo_servicio: dataBL.tipo_servicio_id === 1 ? "FF" :
                        dataBL.tipo_servicio_id === 2 ? "MM" :
                            "", // 👈 Si es NULL, quedará vacío                    
                    fecha_emision: formatDate(dataBL.fecha_emision),
                    fecha_presentacion: formatDateTime(dataBL.fecha_presentacion),  // ← AGREGAR AQUÍ
                    fecha_zarpe: formatDateTime(dataBL.fecha_zarpe),
                    fecha_embarque: formatDateTime(dataBL.fecha_embarque),
                    lugar_emision: dataBL.lugar_emision_cod || "",
                    puerto_embarque: dataBL.puerto_embarque_cod || "",
                    puerto_descarga: dataBL.puerto_descarga_cod || "",
                    lugar_destino: dataBL.lugar_destino_cod || "",
                    lugar_entrega: dataBL.lugar_entrega_cod || "",
                    lugar_recepcion: dataBL.lugar_recepcion_cod || "",
                    shipper: dataBL.shipper || "",
                    consignee: dataBL.consignee || "",
                    notify_party: dataBL.notify_party || "",
                    descripcion_carga: dataBL.descripcion_carga || "",
                    peso_bruto: dataBL.peso_bruto || "",
                    unidad_peso: dataBL.unidad_peso || "",
                    volumen: dataBL.volumen || "",
                    unidad_volumen: dataBL.unidad_volumen || "",
                    bultos: dataBL.bultos || ""
                });
                // 🆕 Cargar items y contenedores
                const resItems = await fetch(`http://localhost:4000/bls/${blNumber}/items-contenedores`);
                if (resItems.ok) {
                    const dataItems = await resItems.json();
                    setItems(dataItems.items || []);
                    setContenedores(dataItems.contenedores || []);
                }
                // 🆕 Cargar transbordos
                const resTransbordos = await fetch(`http://localhost:4000/bls/${blNumber}/transbordos`);
                if (resTransbordos.ok) {
                    const dataTransbordos = await resTransbordos.json();
                    setTransbordos(dataTransbordos || []);
                }
            } catch (e) {
                console.error("Error completo:", e);
                setError(e?.message || "Error desconocido");

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
            fetchData();
        }
    }, [blNumber]);

    const updateField = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const updateItem = (itemId, field, value) => {
        setItems(prevItems =>
            prevItems.map(item =>
                item.id === itemId ? { ...item, [field]: value } : item
            )
        );
    };

    // 🆕 FUNCIÓN PARA AGREGAR CONTENEDOR A UN ITEM
    // 🆕 FUNCIÓN PARA AGREGAR CONTENEDOR A UN ITEM
    const addContenedorToItem = async (itemId, itemNumero) => {
        // 🔥 Obtener el tipo_bulto del item
        const item = items.find(i => i.id === itemId);
        if (!item || !item.tipo_bulto) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'El ítem no tiene tipo_bulto definido',
                confirmButtonColor: '#ef4444'
            });
            return;
        }

        // 🔥 Buscar el tipo_cnt correspondiente
        const mapeo = tipoCntTipoBulto.find(m => m.tipo_bulto === item.tipo_bulto);
        if (!mapeo) {
            Swal.fire({
                icon: 'error',
                title: 'Error de configuración',
                text: `No se encontró tipo_cnt para el tipo_bulto "${item.tipo_bulto}"`,
                confirmButtonColor: '#ef4444'
            });
            return;
        }

        const tipoCntAsignado = mapeo.tipo_cnt;

        const { value: formValues } = await Swal.fire({
            title: `Agregar Contenedor al Item ${itemNumero}`,
            html: `
            <div class="space-y-4 text-left">
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                    <p class="text-sm text-blue-800">
                        <strong>Tipo contenedor:</strong> ${tipoCntAsignado}
                        <span class="text-xs block mt-1">(asignado automáticamente según tipo_bulto: ${item.tipo_bulto})</span>
                    </p>
                </div>

                <div>
                    <label class="block text-sm font-medium text-slate-700 mb-2">
                        Código Contenedor <span class="text-red-500">*</span>
                    </label>
                    <input 
                        id="codigo_contenedor" 
                        class="swal2-input w-full" 
                        placeholder="Ej: FFAU5291030" 
                        maxlength="11" 
                        style="margin: 0; text-transform: uppercase;"
                    >
                    <p class="text-xs text-slate-500 mt-1">11 caracteres: 4 letras + 7 números</p>
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-2">
                            Peso Bruto <span class="text-red-500">*</span>
                        </label>
                        <input 
                            id="peso_bruto" 
                            type="number" 
                            step="0.001"
                            class="swal2-input w-full" 
                            placeholder="0.000"
                            style="margin: 0;"
                        >
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-2">
                            Unidad Peso <span class="text-red-500">*</span>
                        </label>
                        <input 
                            id="unidad_peso" 
                            type="text" 
                            class="swal2-input w-full" 
                            placeholder="KGM"
                            maxlength="3"
                            style="margin: 0; text-transform: uppercase;"
                        >
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-2">
                            Volumen <span class="text-red-500">*</span>
                        </label>
                        <input 
                            id="volumen" 
                            type="number" 
                            step="0.001"
                            min="0"
                            class="swal2-input w-full" 
                            placeholder="0.000"
                            style="margin: 0;"
                        >
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-2">
                            Unidad Volumen <span class="text-red-500">*</span>
                        </label>
                        <input 
                            id="unidad_volumen" 
                            type="text" 
                            class="swal2-input w-full" 
                            placeholder="MTQ"
                            maxlength="3"
                            style="margin: 0; text-transform: uppercase;"
                        >
                    </div>
                </div>
            </div>
        `,
            showCancelButton: true,
            confirmButtonText: 'Agregar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#10b981',
            width: '600px',
            preConfirm: () => {
                const codigo = document.getElementById('codigo_contenedor').value.trim().toUpperCase();
                const pesoBruto = document.getElementById('peso_bruto').value;
                const unidadPeso = document.getElementById('unidad_peso').value.trim().toUpperCase();
                const volumen = document.getElementById('volumen').value;
                const unidadVolumen = document.getElementById('unidad_volumen').value.trim().toUpperCase();

                // 🔥 Validaciones
                if (!codigo) {
                    Swal.showValidationMessage('Debes ingresar el código del contenedor');
                    return null;
                }

                if (codigo.length !== 11) {
                    Swal.showValidationMessage('El código debe tener exactamente 11 caracteres');
                    return null;
                }

                // 🔥 Validar formato: 4 letras + 7 números
                const regex = /^[A-Z]{4}\d{7}$/;
                if (!regex.test(codigo)) {
                    Swal.showValidationMessage('Formato inválido. Debe ser 4 LETRAS + 7 NÚMEROS (ej: FFAU5291030)');
                    return null;
                }

                if (!pesoBruto || parseFloat(pesoBruto) <= 0) {
                    Swal.showValidationMessage('Debes ingresar un peso bruto válido');
                    return null;
                }

                if (!unidadPeso) {
                    Swal.showValidationMessage('Debes ingresar la unidad de peso');
                    return null;
                }

                // 🔥 CORRECCIÓN AQUÍ - Validar que volumen no esté vacío Y que no sea negativo
                if (volumen === '' || volumen === null || volumen === undefined) {
                    Swal.showValidationMessage('Debes ingresar un volumen (puede ser 0)');
                    return null;
                }

                const volumenNum = parseFloat(volumen);
                if (isNaN(volumenNum) || volumenNum < 0) {
                    Swal.showValidationMessage('El volumen no puede ser negativo');
                    return null;
                }

                if (!unidadVolumen) {
                    Swal.showValidationMessage('Debes ingresar la unidad de volumen');
                    return null;
                }

                // 🔥 Verificar si el contenedor ya existe
                const existe = contenedores.some(c => c.codigo === codigo);
                if (existe) {
                    Swal.showValidationMessage('Este contenedor ya existe en el BL');
                    return null;
                }

                // 🔥 IMPORTANTE: Asegurarse de parsear correctamente el volumen
                return {
                    codigo,
                    pesoBruto: parseFloat(pesoBruto),
                    unidadPeso,
                    volumen: volumenNum,  // ← Usar la variable ya parseada
                    unidadVolumen
                };
            }
        });

        if (formValues) {
            // 🔥 Parsear el código del contenedor
            const sigla = formValues.codigo.substring(0, 4);  // Primeras 4 letras (FFAU)
            const todosLosNumeros = formValues.codigo.substring(4); // Todos los números (5291030)
            const numero = todosLosNumeros.substring(0, todosLosNumeros.length - 1); // Todos menos el último (529103)
            const digito = todosLosNumeros.substring(todosLosNumeros.length - 1); // Último dígito (0)

            // 🔥 Crear nuevo contenedor
            const nuevoContenedor = {
                id: `new_${Date.now()}`,
                bl_id: null, // Se asignará al guardar
                item_id: itemId,
                codigo: formValues.codigo,
                sigla: sigla,
                numero: numero,
                digito: digito,
                tipo_cnt: tipoCntAsignado, // 🔥 Asignado automáticamente
                peso: formValues.pesoBruto,
                unidad_peso: formValues.unidadPeso,
                volumen: formValues.volumen,
                unidad_volumen: formValues.unidadVolumen,
                sellos: [],
                imos: [],
                _isNew: true
            };

            // 🔥 Agregar contenedor a la lista
            setContenedores(prev => [...prev, nuevoContenedor]);

            // 🔥 Asociar contenedor al item
            setItems(prevItems =>
                prevItems.map(item => {
                    if (item.id === itemId) {
                        const contenedoresActuales = item.contenedores || [];
                        return {
                            ...item,
                            contenedores: [...contenedoresActuales, { codigo: formValues.codigo }]
                        };
                    }
                    return item;
                })
            );

            Swal.fire({
                icon: 'success',
                title: 'Contenedor agregado',
                html: `
                <div class="text-left">
                    <p class="mb-2"><strong>Contenedor:</strong> ${formValues.codigo}</p>
                    <p class="mb-2"><strong>Tipo:</strong> ${tipoCntAsignado}</p>
                    <p class="text-sm text-slate-600">
                        Sigla: ${sigla} | Número: ${numero} | Dígito: ${digito}
                    </p>
                </div>
            `,
                timer: 3000,
                showConfirmButton: false
            });
        }
    };

    // AGREGAR DESPUÉS DE addContenedorToItem:
    // 🆕 FUNCIÓN PARA OBTENER ITEMS ASOCIADOS A UN CONTENEDOR
    const getItemsAsociados = (codigoContenedor) => {
        return items
            .filter(item =>
                item.contenedores?.some(cont => cont.codigo === codigoContenedor)
            )
            .map(item => item.numero_item);
    };
    // 🆕 FUNCIONES PARA CONTENEDORES
    const updateContenedor = (contenedorId, field, value) => {
        setContenedores(prev => prev.map(cont =>
            cont.id === contenedorId ? { ...cont, [field]: value } : cont
        ));
    };
    const esContenedorCargaPeligrosa = (contenedorCodigo) => {
        // Buscar si algún item asociado a este contenedor tiene carga_peligrosa = 'S'
        return items.some(item =>
            item.contenedores?.some(cont => cont.codigo === contenedorCodigo) &&
            item.carga_peligrosa === 'S'
        );
    };
    const addSelloToContenedor = (contenedorId) => {
        Swal.fire({
            title: 'Agregar Sello',
            input: 'text',
            inputLabel: 'Número de sello (máx. 35 caracteres)',
            inputPlaceholder: 'Ej: BZ023785',
            showCancelButton: true,
            confirmButtonText: 'Agregar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#10b981',
            inputValidator: (value) => {
                if (!value) return 'Debes ingresar un número de sello';
                if (value.length > 35) return 'Máximo 35 caracteres';
                return null;
            }
        }).then((result) => {
            if (result.isConfirmed) {
                setContenedores(prev => prev.map(cont => {
                    if (cont.id === contenedorId) {
                        const sellos = cont.sellos || [];
                        if (sellos.includes(result.value)) {
                            Swal.fire('Error', 'Este sello ya existe en el contenedor', 'error');
                            return cont;
                        }
                        return { ...cont, sellos: [...sellos, result.value] };
                    }
                    return cont;
                }));
            }
        });
    };

    const removeSelloFromContenedor = (contenedorId, sello) => {
        Swal.fire({
            title: '¿Eliminar sello?',
            text: `Sello: ${sello}`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#ef4444'
        }).then((result) => {
            if (result.isConfirmed) {
                setContenedores(prev => prev.map(cont => {
                    if (cont.id === contenedorId) {
                        return { ...cont, sellos: (cont.sellos || []).filter(s => s !== sello) };
                    }
                    return cont;
                }));
            }
        });
    };

    const addImoToContenedor = (contenedorId, contenedorCodigo) => {
        const esCargaPeligrosa = esContenedorCargaPeligrosa(contenedorCodigo);

        if (!esCargaPeligrosa) {
            Swal.fire({
                icon: 'error',
                title: 'Acción no permitida',
                text: 'Solo puedes agregar datos IMO a contenedores con carga peligrosa.',
                confirmButtonColor: '#0F2A44'
            });
            return;
        }

        Swal.fire({
            title: 'Agregar IMO',
            html: `
            <input id="clase_imo" class="swal2-input" placeholder="Clase IMO (ej: 9)" maxlength="5">
            <input id="numero_imo" class="swal2-input" placeholder="Número IMO (ej: 3077)" maxlength="10">
        `,
            showCancelButton: true,
            confirmButtonText: 'Agregar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#10b981',
            preConfirm: () => {
                const clase = document.getElementById('clase_imo').value.trim();
                const numero = document.getElementById('numero_imo').value.trim();
                if (!clase || !numero) {
                    Swal.showValidationMessage('Debes completar ambos campos');
                    return null;
                }
                return { clase, numero };
            }
        }).then((result) => {
            if (result.isConfirmed && result.value) {
                setContenedores(prev =>
                    prev.map(cont =>
                        cont.id === contenedorId
                            ? { ...cont, imos: [...(cont.imos || []), result.value] }
                            : cont
                    )
                );
            }
        });
    };

    const removeImoFromContenedor = (contenedorId, index, contenedorCodigo) => {
        // 🔥 PERMITIR ELIMINAR SIEMPRE (para limpiar datos incorrectos)
        const esCargaPeligrosa = esContenedorCargaPeligrosa(contenedorCodigo);

        Swal.fire({
            title: '¿Eliminar dato IMO?',
            html: esCargaPeligrosa
                ? '<p class="text-sm text-amber-700">⚠️ Este contenedor tiene carga peligrosa y debe tener al menos un dato IMO.</p>'
                : '<p class="text-sm text-slate-600">Este dato será eliminado permanentemente.</p>',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#ef4444'
        }).then((result) => {
            if (result.isConfirmed) {
                setContenedores(prev =>
                    prev.map(cont =>
                        cont.id === contenedorId
                            ? { ...cont, imos: (cont.imos || []).filter((_, i) => i !== index) }
                            : cont
                    )
                );

                // 🔥 ADVERTENCIA si se quedó sin IMOs siendo carga peligrosa
                const contenedorActualizado = prev.find(c => c.id === contenedorId);
                if (esCargaPeligrosa && (!contenedorActualizado?.imos || contenedorActualizado.imos.length <= 1)) {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Advertencia',
                        text: 'Este contenedor tiene carga peligrosa y debe tener al menos un dato IMO antes de guardar.',
                        confirmButtonColor: '#f59e0b'
                    });
                }
            }
        });
    };


    // 🆕 Función para actualizar transbordo
    const updateTransbordo = (id, puertoCod) => {
        setTransbordos(prev => prev.map(tb => {
            if (tb.id === id) {
                const puerto = puertos.find(p => p.codigo === puertoCod);
                return {
                    ...tb,
                    puerto_cod: puertoCod,
                    puerto_id: puerto?.id || null,
                    puerto_nombre: puerto?.nombre || null
                };
            }
            return tb;
        }));
    };

    // 🆕 Función para eliminar transbordo
    const removeTransbordo = (id) => {
        Swal.fire({
            title: "¿Eliminar transbordo?",
            text: "Esta acción no se puede deshacer",
            icon: "warning",
            showCancelButton: true,
            confirmButtonText: "Sí, eliminar",
            cancelButtonText: "Cancelar",
            confirmButtonColor: "#ef4444",
            cancelButtonColor: "#64748b"
        }).then((result) => {
            if (result.isConfirmed) {
                setTransbordos(prev => {
                    const filtered = prev.filter(tb => tb.id !== id);
                    // Reordenar sec
                    return filtered.map((tb, idx) => ({ ...tb, sec: idx + 1 }));
                });
            }
        });
    };

    // AGREGAR ESTA FUNCIÓN (después de las otras funciones)
    const handlePuertoCreado = (nuevoPuerto) => {
        // Agregar a la lista de puertos y ordenar
        setPuertos(prev => [...prev, nuevoPuerto].sort((a, b) => a.nombre.localeCompare(b.nombre)));

        // Mostrar mensaje de éxito
        alert(`✅ Puerto ${nuevoPuerto.codigo} creado exitosamente`);
    };

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
                // 🆕 Fecha presentación obligatoria
                if (!formData.fecha_presentacion) {
                    Swal.fire({
                        icon: "warning",
                        title: "Campo requerido",
                        text: "La fecha de presentación es obligatoria",
                        confirmButtonColor: "#0F2A44"
                    });
                    return false;
                }
                // 🆕 Fecha zarpe obligatoria
                if (!formData.fecha_zarpe) {
                    Swal.fire({
                        icon: "warning",
                        title: "Campo requerido",
                        text: "La fecha de zarpe es obligatoria",
                        confirmButtonColor: "#0F2A44"
                    });
                    return false;
                }
                // 🆕 Fecha embarque obligatoria
                if (!formData.fecha_embarque) {
                    Swal.fire({
                        icon: "warning",
                        title: "Campo requerido",
                        text: "La fecha de embarque es obligatoria",
                        confirmButtonColor: "#0F2A44"
                    });
                    return false;
                }
                break;

            case 2: // Rutas
                if (!formData.puerto_embarque) {
                    Swal.fire({
                        icon: "warning",
                        title: "Campo requerido",
                        text: "Debes seleccionar el puerto de embarque",
                        confirmButtonColor: "#0F2A44"
                    });
                    return false;
                }
                if (!formData.puerto_descarga) {
                    Swal.fire({
                        icon: "warning",
                        title: "Campo requerido",
                        text: "Debes seleccionar el puerto de descarga",
                        confirmButtonColor: "#0F2A44"
                    });
                    return false;
                }
                // 🆕 Lugar emisión obligatorio
                if (!formData.lugar_emision) {
                    Swal.fire({
                        icon: "warning",
                        title: "Campo requerido",
                        text: "Debes seleccionar el lugar de emisión",
                        confirmButtonColor: "#0F2A44"
                    });
                    return false;
                }
                // 🆕 Lugar destino obligatorio
                if (!formData.lugar_destino) {
                    Swal.fire({
                        icon: "warning",
                        title: "Campo requerido",
                        text: "Debes seleccionar el lugar de destino",
                        confirmButtonColor: "#0F2A44"
                    });
                    return false;
                }
                // 🆕 Lugar entrega obligatorio
                if (!formData.lugar_entrega) {
                    Swal.fire({
                        icon: "warning",
                        title: "Campo requerido",
                        text: "Debes seleccionar el lugar de entrega",
                        confirmButtonColor: "#0F2A44"
                    });
                    return false;
                }
                // 🆕 Lugar recepción obligatorio
                if (!formData.lugar_recepcion) {
                    Swal.fire({
                        icon: "warning",
                        title: "Campo requerido",
                        text: "Debes seleccionar el lugar de recepción",
                        confirmButtonColor: "#0F2A44"
                    });
                    return false;
                }
                break;

            case 3: // Addr.
                if (!formData.shipper || formData.shipper.trim().length < 5) {
                    Swal.fire({
                        icon: "warning",
                        title: "Campo requerido",
                        text: "El Shipper es obligatorio (mínimo 5 caracteres)",
                        confirmButtonColor: "#0F2A44"
                    });
                    return false;
                }
                if (!formData.consignee || formData.consignee.trim().length < 5) {
                    Swal.fire({
                        icon: "warning",
                        title: "Campo requerido",
                        text: "El Consignee es obligatorio (mínimo 5 caracteres)",
                        confirmButtonColor: "#0F2A44"
                    });
                    return false;
                }
                if (!formData.notify_party || formData.notify_party.trim().length < 5) {
                    Swal.fire({
                        icon: "warning",
                        title: "Campo requerido",
                        text: "El Notify Party es obligatorio (mínimo 5 caracteres)",
                        confirmButtonColor: "#0F2A44"
                    });
                    return false;
                }
                break;

            case 4: // Mercancía
                // 🔥 Validar peso_bruto según tipo_servicio
                if (formData.peso_bruto === '' || formData.peso_bruto === null || formData.peso_bruto === undefined) {
                    Swal.fire({
                        icon: "warning",
                        title: "Campo requerido",
                        text: "El peso bruto es obligatorio",
                        confirmButtonColor: "#0F2A44"
                    });
                    return false;
                }

                const pesoBruto = parseFloat(formData.peso_bruto);

                // Si es EMPTY (MM), puede ser 0 pero no negativo
                if (formData.tipo_servicio === 'MM') {
                    if (pesoBruto < 0) {
                        Swal.fire({
                            icon: "warning",
                            title: "Valor inválido",
                            text: "El peso bruto no puede ser negativo",
                            confirmButtonColor: "#0F2A44"
                        });
                        return false;
                    }
                } else {
                    // Para otros servicios, debe ser mayor a 0
                    if (pesoBruto <= 0) {
                        Swal.fire({
                            icon: "warning",
                            title: "Campo requerido",
                            text: "El peso bruto debe ser mayor a 0",
                            confirmButtonColor: "#0F2A44"
                        });
                        return false;
                    }
                }

                // 🆕 Unidad peso obligatoria
                if (!formData.unidad_peso || formData.unidad_peso.trim() === '') {
                    Swal.fire({
                        icon: "warning",
                        title: "Campo requerido",
                        text: "La unidad de peso es obligatoria",
                        confirmButtonColor: "#0F2A44"
                    });
                    return false;
                }

                // 🆕 Volumen obligatorio (puede ser 0, pero no negativo)
                if (formData.volumen === null || formData.volumen === undefined || formData.volumen === '') {
                    Swal.fire({
                        icon: "warning",
                        title: "Campo requerido",
                        text: "El volumen es obligatorio (puede ser 0)",
                        confirmButtonColor: "#0F2A44"
                    });
                    return false;
                }

                // 🔥 NUEVA: Validar que volumen no sea negativo
                if (parseFloat(formData.volumen) < 0) {
                    Swal.fire({
                        icon: "warning",
                        title: "Valor inválido",
                        text: "El volumen no puede ser negativo",
                        confirmButtonColor: "#0F2A44"
                    });
                    return false;
                }

                // 🆕 Unidad volumen obligatoria
                if (!formData.unidad_volumen || formData.unidad_volumen.trim() === '') {
                    Swal.fire({
                        icon: "warning",
                        title: "Campo requerido",
                        text: "La unidad de volumen es obligatoria",
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

                // ✅ descripcion_carga NO es obligatoria
                break;

            case 5: // Items
                if (items.length === 0) {
                    Swal.fire({
                        icon: "warning",
                        title: "Sin items",
                        text: "Este BL no tiene items para editar",
                        confirmButtonColor: "#0F2A44"
                    });
                    return true; // No bloquea si no hay items
                }

                for (const item of items) {
                    // 🔥 Validar peso bruto según tipo_servicio
                    if (item.peso_bruto === '' || item.peso_bruto === null || item.peso_bruto === undefined) {
                        Swal.fire({
                            icon: "warning",
                            title: "Campo requerido",
                            text: `El Item ${item.numero_item} debe tener un peso bruto`,
                            confirmButtonColor: "#0F2A44"
                        });
                        return false;
                    }

                    const pesoBrutoItem = parseFloat(item.peso_bruto);

                    // Si es EMPTY (MM), puede ser 0 pero no negativo
                    if (formData.tipo_servicio === 'MM') {
                        if (pesoBrutoItem < 0) {
                            Swal.fire({
                                icon: "warning",
                                title: "Valor inválido",
                                text: `El Item ${item.numero_item} no puede tener peso bruto negativo`,
                                confirmButtonColor: "#0F2A44"
                            });
                            return false;
                        }
                    } else {
                        // Para otros servicios, debe ser mayor a 0
                        if (pesoBrutoItem <= 0) {
                            Swal.fire({
                                icon: "warning",
                                title: "Campo requerido",
                                text: `El Item ${item.numero_item} debe tener un peso bruto mayor a 0`,
                                confirmButtonColor: "#0F2A44"
                            });
                            return false;
                        }
                    }

                    // 🆕 Validar unidad_peso
                    if (!item.unidad_peso || item.unidad_peso.trim() === '') {
                        Swal.fire({
                            icon: "warning",
                            title: "Campo requerido",
                            text: `El Item ${item.numero_item} debe tener una unidad de peso`,
                            confirmButtonColor: "#0F2A44"
                        });
                        return false;
                    }

                    // Validar volumen (puede ser 0, pero debe existir)
                    if (item.volumen === null || item.volumen === undefined || item.volumen === '') {
                        Swal.fire({
                            icon: "warning",
                            title: "Campo requerido",
                            text: `El Item ${item.numero_item} debe tener un volumen (puede ser 0)`,
                            confirmButtonColor: "#0F2A44"
                        });
                        return false;
                    }

                    // 🔥 NUEVA: Validar que volumen no sea negativo
                    if (parseFloat(item.volumen) < 0) {
                        Swal.fire({
                            icon: "warning",
                            title: "Valor inválido",
                            text: `El Item ${item.numero_item} no puede tener volumen negativo`,
                            confirmButtonColor: "#0F2A44"
                        });
                        return false;
                    }

                    // 🆕 Validar unidad_volumen
                    if (!item.unidad_volumen || item.unidad_volumen.trim() === '') {
                        Swal.fire({
                            icon: "warning",
                            title: "Campo requerido",
                            text: `El Item ${item.numero_item} debe tener una unidad de volumen`,
                            confirmButtonColor: "#0F2A44"
                        });
                        return false;
                    }

                    // 🆕 Validar tipo_bulto
                    if (!item.tipo_bulto || item.tipo_bulto.trim() === '') {
                        Swal.fire({
                            icon: "warning",
                            title: "Campo requerido",
                            text: `El Item ${item.numero_item} debe tener un tipo de bulto`,
                            confirmButtonColor: "#0F2A44"
                        });
                        return false;
                    }

                    // 🆕 Validar cantidad
                    if (!item.cantidad || parseInt(item.cantidad) <= 0) {
                        Swal.fire({
                            icon: "warning",
                            title: "Campo requerido",
                            text: `El Item ${item.numero_item} debe tener una cantidad mayor a 0`,
                            confirmButtonColor: "#0F2A44"
                        });
                        return false;
                    }
                }
                break;

            case 6: // Contenedores
                if (contenedores.length === 0) {
                    Swal.fire({
                        icon: "warning",
                        title: "Sin contenedores",
                        text: "Este BL no tiene contenedores para editar",
                        confirmButtonColor: "#0F2A44"
                    });
                    return true; // No bloquea si no hay contenedores
                }

                // Validar que contenedores con carga peligrosa tengan IMOs
                const contenedoresSinImo = contenedores.filter(cont => {
                    const esCargaPeligrosa = esContenedorCargaPeligrosa(cont.codigo);
                    return esCargaPeligrosa && (!cont.imos || cont.imos.length === 0);
                });

                if (contenedoresSinImo.length > 0) {
                    Swal.fire({
                        icon: "error",
                        title: "Datos IMO faltantes",
                        html: `Los siguientes contenedores tienen carga peligrosa y deben tener al menos un dato IMO:<br><br><strong>${contenedoresSinImo.map(c => c.codigo).join(', ')}</strong>`,
                        confirmButtonColor: "#0F2A44"
                    });
                    return false;
                }
                break;
        }
        return true;
    };

    const handleSave = async () => {
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
            const formatToMysql = (dateTimeLocal) => {
                if (!dateTimeLocal) return null;
                return dateTimeLocal.replace("T", " ") + ":00";
            };

            // 🆕 Preparar datos con puertos
            const dataToSend = {
                tipo_servicio: formData.tipo_servicio,
                fecha_emision: formData.fecha_emision || null,
                fecha_presentacion: formatToMysql(formData.fecha_presentacion),
                fecha_zarpe: formatToMysql(formData.fecha_zarpe),
                fecha_embarque: formatToMysql(formData.fecha_embarque),
                puerto_embarque: formData.puerto_embarque || null,
                puerto_descarga: formData.puerto_descarga || null,
                lugar_emision: formData.lugar_emision || null,
                lugar_destino: formData.lugar_destino || null,
                lugar_entrega: formData.lugar_entrega || null,
                lugar_recepcion: formData.lugar_recepcion || null,
                shipper: formData.shipper || null,
                consignee: formData.consignee || null,
                notify_party: formData.notify_party || null,
                shipper_id: formData.shipper_id || null,
                consignee_id: formData.consignee_id || null,
                notify_id: formData.notify_id || null,
                descripcion_carga: formData.descripcion_carga?.trim() || null,
                peso_bruto: formData.peso_bruto ? parseFloat(formData.peso_bruto) : null,
                unidad_peso: formData.unidad_peso || null,
                volumen: formData.volumen ? parseFloat(formData.volumen) : null,
                unidad_volumen: formData.unidad_volumen || null,
                bultos: formData.bultos ? parseInt(formData.bultos) : null
            };

            // 🔥 AGREGA ESTO AQUÍ 👇
            console.log('═══════════════════════════════════');
            console.log('🚀 DATOS QUE SE ENVIARÁN AL BACKEND:');
            console.log('shipper_id:', formData.shipper_id);
            console.log('consignee_id:', formData.consignee_id);
            console.log('notify_id:', formData.notify_id);
            console.log('formData COMPLETO:', formData);
            console.log('dataToSend COMPLETO:', dataToSend);
            console.log('═══════════════════════════════════');

            const res = await fetch(`http://localhost:4000/api/bls/${blNumber}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dataToSend)
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || "Error al guardar");
            }
            // 🆕 Guardar items si fueron modificados
            if (items.length > 0) {
                const resItems = await fetch(`http://localhost:4000/bls/${blNumber}/items`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ items })
                });

                if (!resItems.ok) {
                    console.warn("Error al actualizar items (no crítico)");
                }
            }
            // 🆕 Guardar transbordos
            if (transbordos.length > 0) {
                const resTransbordos = await fetch(`http://localhost:4000/bls/${blNumber}/transbordos`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ transbordos })
                });

                if (!resTransbordos.ok) {
                    console.warn("Error al actualizar transbordos (no crítico)");
                }
            }
            // 🆕 GUARDAR CONTENEDORES
            // 🆕 GUARDAR CONTENEDORES
            // 🆕 GUARDAR CONTENEDORES
            if (contenedores.length > 0) {
                console.log('🚀 ENVIANDO CONTENEDORES AL BACKEND:', JSON.stringify(contenedores, null, 2));

                const resContenedores = await fetch(`http://localhost:4000/bls/${blNumber}/contenedores`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contenedores: contenedores.map(cont => ({
                            id: cont.id,
                            item_id: cont.item_id,
                            codigo: cont.codigo,
                            tipo_cnt: cont.tipo_cnt,
                            carga_cnt: cont.carga_cnt || 'S',       // 🆕
                            peso: cont.peso || null,                // 🆕 AGREGAR
                            unidad_peso: cont.unidad_peso || 'KGM', // 🆕 AGREGAR
                            volumen: cont.volumen ?? null,
                            unidad_volumen: cont.unidad_volumen || 'MTQ', // 🆕 AGREGAR
                            sellos: cont.sellos || [],
                            imos: cont.imos || [],
                            _isNew: cont._isNew || false
                        }))
                    })
                });

                if (!resContenedores.ok) {
                    console.warn("❌ Error al actualizar contenedores (no crítico)");
                    const errorData = await resContenedores.text();
                    console.error('Respuesta del servidor:', errorData);
                } else {
                    console.log('✅ Contenedores actualizados correctamente');
                }
            }
            await Swal.fire({
                icon: "success",
                title: "¡Cambios guardados!",
                html: `
        <p class="text-sm text-gray-600">El BL <strong>${formData.bl_number}</strong> se actualizó correctamente</p>
    `,
                timer: 2000,
                showConfirmButton: false
            });

            // 🔥 REDIRECCIÓN INTELIGENTE CON DEBUG
            const params = new URLSearchParams(window.location.search);
            const returnTo = params.get('returnTo');
            const manifestId = params.get('manifestId');

            console.log('=== DEBUG GUARDAR ===');
            console.log('URL:', window.location.href);
            console.log('returnTo:', returnTo);
            console.log('manifestId:', manifestId);

            if (returnTo === 'xml-preview' && manifestId) {
                console.log('✅ Redirigiendo a XML');
                navigate(`/manifiestos/${manifestId}/generar-xml`);
            } else {
                console.log('ℹ️ Redirigiendo a detalle');
                navigate(`/expo/detail/${blNumber}`);
            }
        } catch (e) {
            console.error("Error al guardar:", e);
            setError(e?.message || "Error al guardar");

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

    // 🔥 PRIMERO AGREGA ESTA FUNCIÓN (antes de nextStep)
    const validarCantidadContenedores = () => {
        const inconsistencias = items.map(item => {
            const cantEsperada = parseInt(item.cantidad) || 0;
            const cantReal = (item.contenedores || []).length;

            if (cantEsperada !== cantReal) {
                return {
                    itemId: item.id,
                    numeroItem: item.numero_item,
                    esperada: cantEsperada,
                    actual: cantReal,
                    diferencia: cantEsperada - cantReal,
                    faltanContenedores: cantEsperada > cantReal,
                    sobranContenedores: cantEsperada < cantReal
                };
            }
            return null;
        }).filter(Boolean);

        return inconsistencias;
    };

    // 🔥 LUEGO REEMPLAZA TU nextStep ACTUAL CON ESTA:
    const nextStep = () => {
        // Validar el paso actual primero
        if (!validateStep(currentStep)) {
            return;
        }

        // 🔥 SI ESTAMOS EN EL STEP 5, VALIDAR CANTIDAD VS CONTENEDORES
        if (currentStep === 5) {
            const inconsistencias = validarCantidadContenedores();

            if (inconsistencias.length > 0) {
                const mensajeHTML = inconsistencias.map(inc => {
                    const icon = inc.faltanContenedores ? '❌' : '⚠️';
                    const accion = inc.faltanContenedores
                        ? `<span class="text-red-600 font-bold">Faltan ${inc.diferencia} contenedor(es)</span>`
                        : `<span class="text-orange-600 font-bold">Sobran ${Math.abs(inc.diferencia)} contenedor(es)</span>`;

                    return `
                    <div class="text-left mb-2 p-2 bg-gray-50 rounded">
                        <strong>Item ${inc.numeroItem}:</strong><br>
                        Esperados: ${inc.esperada} | Actuales: ${inc.actual}<br>
                        ${accion}
                    </div>
                `;
                }).join('');

                Swal.fire({
                    icon: 'error',
                    title: 'Cantidad inconsistente',
                    html: `
                    <div class="text-sm">
                        ${mensajeHTML}
                        <div class="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-blue-800">
                            <strong>Acción requerida:</strong><br>
                            ${inconsistencias.some(i => i.faltanContenedores)
                            ? '• Usa el botón "+ Agregar Contenedor" para añadir los faltantes<br>'
                            : ''}
                            ${inconsistencias.some(i => i.sobranContenedores)
                            ? '• Reduce la cantidad o elimina contenedores sobrantes en el Step 6'
                            : ''}
                        </div>
                    </div>
                `,
                    confirmButtonText: 'Entendido',
                    confirmButtonColor: '#ef4444',
                    width: '600px'
                });
                return; // 🔥 BLOQUEAR avance al siguiente step
            }
        }

        // Si pasó todas las validaciones, avanzar
        setCurrentStep(prev => prev + 1);
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
                        onClick={() => navigate("/expo-bl")}
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
                        onClick={() => {
                            const params = new URLSearchParams(window.location.search);
                            const returnTo = params.get('returnTo');
                            const manifestId = params.get('manifestId');

                            console.log('=== DEBUG VOLVER ===');
                            console.log('URL:', window.location.href);
                            console.log('returnTo:', returnTo);
                            console.log('manifestId:', manifestId);

                            if (returnTo === 'xml-preview' && manifestId) {
                                console.log('✅ Volviendo a XML');
                                navigate(`/manifiestos/${manifestId}/generar-xml`);
                            } else {
                                console.log('ℹ️ Volviendo a detalle');
                                navigate(`/expo/detail/${blNumber}`);
                            }
                        }}
                        className="text-sm text-slate-500 hover:text-slate-800 mb-2"
                    >
                        ← Volver
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
                                        onClick={() => {
                                            // 🔥 SI ESTAMOS EN EL STEP 5 Y QUEREMOS IR A OTRO STEP, VALIDAR PRIMERO
                                            if (currentStep === 5 && step.id !== 5) {
                                                const inconsistencias = validarCantidadContenedores();

                                                if (inconsistencias.length > 0) {
                                                    const mensajeHTML = inconsistencias.map(inc => {
                                                        const icon = inc.faltanContenedores ? '❌' : '⚠️';
                                                        const accion = inc.faltanContenedores
                                                            ? `<span class="text-red-600 font-bold">Faltan ${inc.diferencia} contenedor(es)</span>`
                                                            : `<span class="text-orange-600 font-bold">Sobran ${Math.abs(inc.diferencia)} contenedor(es)</span>`;

                                                        return `
                        <div class="text-left mb-2 p-2 bg-gray-50 rounded">
                            ${icon} <strong>Item ${inc.numeroItem}:</strong><br>
                            Esperados: ${inc.esperada} | Actuales: ${inc.actual}<br>
                            ${accion}
                        </div>
                    `;
                                                    }).join('');

                                                    Swal.fire({
                                                        icon: 'error',
                                                        title: '⚠️ Cantidad inconsistente',
                                                        html: `
                        <div class="text-sm">
                            ${mensajeHTML}
                            <div class="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-blue-800">
                                <strong>💡 Acción requerida:</strong><br>
                                ${inconsistencias.some(i => i.faltanContenedores)
                                                                ? '• Usa el botón "+ Agregar Contenedor" para añadir los faltantes<br>'
                                                                : ''}
                                ${inconsistencias.some(i => i.sobranContenedores)
                                                                ? '• Reduce la cantidad o elimina contenedores sobrantes en el Step 6'
                                                                : ''}
                            </div>
                        </div>
                    `,
                                                        confirmButtonText: 'Entendido',
                                                        confirmButtonColor: '#ef4444',
                                                        width: '600px'
                                                    });
                                                    return; // 🔥 BLOQUEAR el cambio de step
                                                }
                                            }

                                            // Si pasó la validación (o no estaba en step 5), cambiar de step
                                            setCurrentStep(step.id);
                                        }}
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
                                    <option value="">Seleccionar tipo de servicio...</option> {/* 👈 AGREGAR */}
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

                            {/* ← AGREGAR ESTE NUEVO DIV AQUÍ */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Fecha Presentación <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="datetime-local"
                                    value={formData.fecha_presentacion}
                                    onChange={(e) => updateField("fecha_presentacion", e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500"
                                />
                            </div>


                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Fecha Zarpe <span className="text-red-500">*</span>
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
                                    Fecha Embarque <span className="text-red-500">*</span>
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
                    {/* STEP 2: RUTAS Y TRANSBORDOS */}
                    {currentStep === 2 && (
                        <div className="space-y-8">
                            {/* 🆕 Header con botón crear puerto */}
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-800">Rutas y Transbordos</h2>
                                    <p className="text-sm text-slate-600 mt-1">
                                        Define las ubicaciones y rutas del BL
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowCrearPuertoModal(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Crear Puerto
                                </button>
                            </div>

                            {/* Lugares de Origen */}
                            <div className="border-b pb-6">
                                <h3 className="font-semibold text-slate-800 mb-4">
                                    Lugares de Origen
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Lugar Emisión */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Lugar Emisión <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={formData.lugar_emision}
                                            onChange={(e) => updateField("lugar_emision", e.target.value)}
                                            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500"
                                        >
                                            <option value="">Seleccionar lugar...</option>
                                            {puertos.map(puerto => (
                                                <option key={puerto.id} value={puerto.codigo}>
                                                    {puerto.codigo} - {puerto.nombre}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Lugar Recepción */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Lugar Recepción <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={formData.lugar_recepcion}
                                            onChange={(e) => updateField("lugar_recepcion", e.target.value)}
                                            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500"
                                        >
                                            <option value="">Seleccionar lugar...</option>
                                            {puertos.map(puerto => (
                                                <option key={puerto.id} value={puerto.codigo}>
                                                    {puerto.codigo} - {puerto.nombre}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Puertos Principales */}
                            <div className="border-b pb-6">
                                <h3 className="font-semibold text-slate-800 mb-4">
                                    Puertos Principales
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Puerto Embarque */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Puerto Embarque <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={formData.puerto_embarque}
                                            onChange={(e) => updateField("puerto_embarque", e.target.value)}
                                            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500"
                                        >
                                            <option value="">Seleccionar puerto...</option>
                                            {puertos.map(puerto => (
                                                <option key={puerto.id} value={puerto.codigo}>
                                                    {puerto.codigo} - {puerto.nombre}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Puerto Descarga */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Puerto Descarga <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={formData.puerto_descarga}
                                            onChange={(e) => updateField("puerto_descarga", e.target.value)}
                                            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500"
                                        >
                                            <option value="">Seleccionar puerto...</option>
                                            {puertos.map(puerto => (
                                                <option key={puerto.id} value={puerto.codigo}>
                                                    {puerto.codigo} - {puerto.nombre}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Lugares de Destino */}
                            <div className="border-b pb-6">
                                <h3 className="font-semibold text-slate-800 mb-4">
                                    Lugares de Destino
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Lugar Destino */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Lugar Destino <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={formData.lugar_destino}
                                            onChange={(e) => updateField("lugar_destino", e.target.value)}
                                            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500"
                                        >
                                            <option value="">Seleccionar lugar...</option>
                                            {puertos.map(puerto => (
                                                <option key={puerto.id} value={puerto.codigo}>
                                                    {puerto.codigo} - {puerto.nombre}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Lugar Entrega */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Lugar Entrega <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={formData.lugar_entrega}
                                            onChange={(e) => updateField("lugar_entrega", e.target.value)}
                                            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500"
                                        >
                                            <option value="">Seleccionar lugar...</option>
                                            {puertos.map(puerto => (
                                                <option key={puerto.id} value={puerto.codigo}>
                                                    {puerto.codigo} - {puerto.nombre}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Transbordos */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="font-semibold text-slate-800">
                                        Transbordos ({transbordos.length})
                                    </h3>
                                </div>

                                {transbordos.length === 0 ? (
                                    <div className="text-center py-8 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
                                        <p className="text-slate-500 text-sm">
                                            Este BL no tiene transbordos.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {transbordos.map((tb, idx) => (
                                            <div
                                                key={tb.id}
                                                className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200"
                                            >
                                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-bold flex-shrink-0">
                                                    {idx + 1}
                                                </div>

                                                <div className="flex-1">
                                                    <select
                                                        value={tb.puerto_cod}
                                                        onChange={(e) => updateTransbordo(tb.id, e.target.value)}
                                                        className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500"
                                                    >
                                                        <option value="">Seleccionar puerto...</option>
                                                        {puertos.map(puerto => (
                                                            <option key={puerto.id} value={puerto.codigo}>
                                                                {puerto.codigo} - {puerto.nombre}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => removeTransbordo(tb.id)}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Eliminar transbordo"
                                                >
                                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Ruta completa preview */}
                                {(formData.puerto_embarque || transbordos.length > 0 || formData.puerto_descarga) && (
                                    <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                        <p className="text-xs text-blue-700">
                                            <strong>Ruta completa:</strong> {formData.puerto_embarque || "?"}
                                            {transbordos.length > 0 && ` → ${transbordos.map(t => t.puerto_cod || "?").join(" → ")}`}
                                            {formData.puerto_descarga && ` → ${formData.puerto_descarga}`}
                                        </p>
                                    </div>
                                )}

                                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                                    <strong>Nota:</strong> Si un puerto no aparece en la lista, usa el botón <strong>"Crear Puerto"</strong> arriba.
                                </div>
                            </div>
                        </div>
                    )}
                    {/* STEP 3: PARTICIPANTES */}
                    {currentStep === 3 && (
                        <div className="space-y-8">
                            {/* SHIPPER */}
                            <ParticipanteSelector
                                label="Shipper / Embarcador"
                                tipo="shipper"
                                value={formData.shipper_id}
                                displayValue={formData.shipper}
                                onChange={(participanteId, textoCompleto) => {
                                    setFormData(prev => ({
                                        ...prev,
                                        shipper_id: participanteId,
                                        shipper: textoCompleto
                                    }));
                                }}
                                required={true}
                            />

                            {/* CONSIGNEE */}
                            <ParticipanteSelector
                                label="Consignatario"
                                tipo="consignee"
                                value={formData.consignee_id}
                                displayValue={formData.consignee}
                                onChange={(participanteId, textoCompleto) => {
                                    setFormData(prev => ({
                                        ...prev,
                                        consignee_id: participanteId,
                                        consignee: textoCompleto
                                    }));
                                }}
                                required={true}
                            />

                            {/* NOTIFY PARTY */}
                            <ParticipanteSelector
                                label="Notify Party"
                                tipo="notify"
                                value={formData.notify_id}
                                displayValue={formData.notify_party}
                                onChange={(participanteId, textoCompleto) => {
                                    setFormData(prev => ({
                                        ...prev,
                                        notify_id: participanteId,
                                        notify_party: textoCompleto
                                    }));
                                }}
                                required={true}
                            />
                        </div>
                    )}

                    {/* STEP 4: MERCANCÍA */}
                    {currentStep === 4 && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                                {/* Peso Bruto */}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Peso Bruto <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="0.001"
                                        min={formData.tipo_servicio === 'MM' ? "0" : "0.001"}  // 🔥 CAMBIO AQUÍ
                                        value={formData.peso_bruto}
                                        onChange={(e) => {
                                            // 🔥 Permitir 0 si es MM, mayor a 0 si no
                                            const value = parseFloat(e.target.value);
                                            const minValue = formData.tipo_servicio === 'MM' ? 0 : 0.001;

                                            if (value >= minValue || e.target.value === '') {
                                                updateField("peso_bruto", e.target.value);
                                            }
                                        }}
                                        onBlur={(e) => {
                                            // 🔥 Valor mínimo según tipo de servicio
                                            const minValue = formData.tipo_servicio === 'MM' ? 0 : 0.001;

                                            if (e.target.value === '' || parseFloat(e.target.value) < minValue) {
                                                updateField("peso_bruto", minValue.toString());
                                            }
                                        }}
                                        className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500"
                                    />
                                </div>

                                {/* Unidad de Peso */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Unidad <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.unidad_peso}
                                        onChange={(e) => updateField("unidad_peso", e.target.value.toUpperCase())}
                                        placeholder="KGM, LBT, TON..."
                                        className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500"
                                    />
                                </div>

                                {/* Volumen */}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Volumen <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        step="0.001"
                                        min="0"
                                        value={formData.volumen ?? ""}
                                        onChange={(e) => {
                                            const value = parseFloat(e.target.value);
                                            if (value >= 0 || e.target.value === '') {
                                                updateField("volumen", e.target.value);
                                            }
                                        }}
                                        onBlur={(e) => {
                                            if (e.target.value === '' || parseFloat(e.target.value) < 0) {
                                                updateField("volumen", "0");
                                            }
                                        }}
                                        className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500"
                                    />
                                </div>

                                {/* Unidad de Volumen */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Unidad <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.unidad_volumen}
                                        onChange={(e) => updateField("unidad_volumen", e.target.value.toUpperCase())}
                                        placeholder="MTQ, LTR..."
                                        className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500"
                                    />
                                </div>

                                {/* Bultos */}
                                <div className="md:col-span-3">
                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                        Cantidad de Bultos <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={formData.bultos}
                                        onChange={(e) => {
                                            const value = parseInt(e.target.value);
                                            if (value > 0 || e.target.value === '') {
                                                updateField("bultos", e.target.value);
                                            }
                                        }}
                                        onBlur={(e) => {
                                            if (e.target.value === '' || parseInt(e.target.value) < 1) {
                                                updateField("bultos", "1");
                                            }
                                        }}
                                        className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500"
                                    />
                                </div>

                            </div>
                        </div>
                    )}
                    {/* STEP 5: ITEMS Y CONTENEDORES */}
                    {currentStep === 5 && (
                        <div className="space-y-6">
                            {items.length === 0 ? (
                                <div className="text-center py-8 text-slate-500">
                                    <p>Este BL no tiene ítems cargados</p>
                                    <p className="text-xs mt-2">Los ítems se crean automáticamente al procesar el PMS</p>
                                </div>
                            ) : (
                                <div className="space-y-8">
                                    {items.map((item, idx) => (
                                        <div key={item.id} className="border border-slate-200 rounded-lg p-6 bg-slate-50">
                                            <div className="flex items-center justify-between mb-4">
                                                <h3 className="font-semibold text-slate-900">
                                                    Item {item.numero_item}
                                                </h3>
                                                <span className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded">
                                                    {item.contenedores?.length || 0} contenedor(es)
                                                </span>
                                            </div>

                                            {item.contenedores && item.contenedores.length > 0 && (
                                                <div className="mb-4">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <label className="block text-xs font-medium text-slate-600">
                                                            Contenedores asociados:
                                                        </label>
                                                        <button
                                                            type="button"
                                                            onClick={() => addContenedorToItem(item.id, item.numero_item)}
                                                            className="text-xs bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 transition-colors font-medium"
                                                        >
                                                            + Agregar Contenedor
                                                        </button>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {item.contenedores.map((cont, i) => (
                                                            <span
                                                                key={i}
                                                                className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-mono"
                                                            >
                                                                {cont.codigo}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {/* Descripción */}
                                                <div className="md:col-span-2">
                                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                                        Descripción <span className="text-red-500">*</span>
                                                    </label>
                                                    <textarea
                                                        rows={3}
                                                        value={item.descripcion || ""}
                                                        onChange={(e) => updateItem(item.id, "descripcion", e.target.value)}
                                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500 text-sm"
                                                    />
                                                </div>

                                                {/* Marcas */}
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                                        Marcas <span className="text-red-500">*</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={item.marcas || ""}
                                                        onChange={(e) => updateItem(item.id, "marcas", e.target.value)}
                                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500 text-sm"
                                                    />
                                                </div>

                                                {/* Tipo Bulto */}
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                                        Tipo Bulto <span className="text-red-500">*</span>
                                                    </label>
                                                    <select
                                                        value={item.tipo_bulto || ""}
                                                        onChange={(e) => updateItem(item.id, "tipo_bulto", e.target.value)}
                                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500 text-sm"
                                                    >
                                                        <option value="">Seleccionar...</option>
                                                        {tiposBulto.map(tipo => (
                                                            <option key={tipo.id} value={tipo.tipo_bulto}>
                                                                {tipo.tipo_bulto}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                {/* Cantidad */}
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                                        Cantidad <span className="text-red-500">*</span>
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={item.cantidad || ""}
                                                        onChange={(e) => updateItem(item.id, "cantidad", e.target.value)}
                                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500 text-sm"
                                                    />
                                                </div>

                                                {/* Peso */}
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                                        Peso Bruto <span className="text-red-500">*</span>
                                                    </label>
                                                    <input
                                                        type="number"
                                                        step="0.001"
                                                        min={formData.tipo_servicio === 'MM' ? "0" : "0.001"}
                                                        value={item.peso_bruto ?? ""}
                                                        onChange={(e) => {
                                                            const value = parseFloat(e.target.value);
                                                            const minValue = formData.tipo_servicio === 'MM' ? 0 : 0.001;
                                                            if (value >= minValue || e.target.value === '') {
                                                                updateItem(item.id, "peso_bruto", e.target.value);
                                                            }
                                                        }}
                                                        onBlur={(e) => {
                                                            const minValue = formData.tipo_servicio === 'MM' ? 0 : 0.001;
                                                            if (e.target.value === '' || parseFloat(e.target.value) < minValue) {
                                                                updateItem(item.id, "peso_bruto", minValue.toString());
                                                            }
                                                        }}
                                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500 text-sm"
                                                    />
                                                </div>

                                                {/* Unidad Peso */}
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                                        Unidad Peso <span className="text-red-500">*</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={item.unidad_peso || ""}
                                                        onChange={(e) => updateItem(item.id, "unidad_peso", e.target.value.toUpperCase())}
                                                        placeholder="KGM"
                                                        maxLength="3"
                                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500 text-sm uppercase"
                                                    />
                                                </div>

                                                {/* Volumen */}
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                                        Volumen <span className="text-red-500">*</span>
                                                    </label>
                                                    <input
                                                        type="number"
                                                        step="0.001"
                                                        value={item.volumen || ""}
                                                        onChange={(e) => updateItem(item.id, "volumen", e.target.value)}
                                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500 text-sm"
                                                    />
                                                </div>

                                                {/* Unidad Volumen */}
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-2">
                                                        Unidad Volumen <span className="text-red-500">*</span>
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={item.unidad_volumen || ""}
                                                        onChange={(e) => updateItem(item.id, "unidad_volumen", e.target.value.toUpperCase())}
                                                        placeholder="MTQ"
                                                        maxLength="3"
                                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500 text-sm uppercase"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                                <strong>Nota:</strong> Los contenedores no son editables desde aquí. Solo puedes modificar los datos de los ítems.
                            </div>
                        </div>
                    )}

                    {/* STEP 6: CONTENEDORES */}
                    {currentStep === 6 && (
                        <div className="space-y-6">
                            {/* 🆕 BOTÓN DE LIMPIEZA */}
                            {contenedores.some(cont => !esContenedorCargaPeligrosa(cont.codigo) && cont.imos && cont.imos.length > 0) && (
                                <div className="bg-amber-50 border border-amber-300 rounded-lg p-4">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-amber-900 mb-1">
                                                ⚠️ Datos IMO innecesarios detectados
                                            </p>
                                            <p className="text-xs text-amber-700">
                                                Algunos contenedores sin carga peligrosa tienen datos IMO. Puedes limpiarlos automáticamente.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const contsSinPeligro = contenedores.filter(cont =>
                                                    !esContenedorCargaPeligrosa(cont.codigo) && cont.imos && cont.imos.length > 0
                                                );

                                                Swal.fire({
                                                    title: '¿Limpiar datos IMO?',
                                                    html: `Se eliminarán los datos IMO de ${contsSinPeligro.length} contenedor(es):<br><strong>${contsSinPeligro.map(c => c.codigo).join(', ')}</strong>`,
                                                    icon: 'question',
                                                    showCancelButton: true,
                                                    confirmButtonText: 'Sí, limpiar',
                                                    cancelButtonText: 'Cancelar',
                                                    confirmButtonColor: '#f59e0b'
                                                }).then((result) => {
                                                    if (result.isConfirmed) {
                                                        setContenedores(prev => prev.map(cont => {
                                                            if (!esContenedorCargaPeligrosa(cont.codigo)) {
                                                                return { ...cont, imos: [] };
                                                            }
                                                            return cont;
                                                        }));

                                                        Swal.fire({
                                                            icon: 'success',
                                                            title: 'Limpieza completada',
                                                            text: 'Se eliminaron los datos IMO innecesarios',
                                                            timer: 2000,
                                                            showConfirmButton: false
                                                        });
                                                    }
                                                });
                                            }}
                                            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors text-sm font-medium whitespace-nowrap"
                                        >
                                            Limpiar IMOs
                                        </button>
                                    </div>
                                </div>
                            )}
                            {contenedores.length === 0 ? (
                                <div className="text-center py-8 text-slate-500">
                                    <p>Este BL no tiene contenedores cargados</p>
                                    <p className="text-xs mt-2">Los contenedores se crean automáticamente al procesar el PMS</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {contenedores.map((cont, idx) => {
                                        const esCargaPeligrosa = esContenedorCargaPeligrosa(cont.codigo);
                                        const itemsAsociados = getItemsAsociados(cont.codigo);

                                        return (
                                            <div
                                                key={cont.id}
                                                className={`border rounded-lg p-6 ${esCargaPeligrosa
                                                    ? 'border-red-400 bg-red-50'
                                                    : 'border-slate-300 bg-slate-50'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <h3 className="font-semibold text-slate-900 text-lg">
                                                            Contenedor {idx + 1}: {cont.codigo}
                                                        </h3>
                                                        {esCargaPeligrosa && (
                                                            <span className="px-3 py-1 bg-red-600 text-white rounded-full text-xs font-bold animate-pulse">
                                                                CARGA PELIGROSA
                                                            </span>
                                                        )}
                                                        {cont._isNew && (
                                                            <span className="px-3 py-1 bg-green-600 text-white rounded-full text-xs font-bold">
                                                                NUEVO
                                                            </span>
                                                        )}
                                                    </div>

                                                    <span className="text-xs bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
                                                        {cont.tipo_cnt || 'N/A'}
                                                    </span>
                                                </div>
                                                {/* 🆕 AQUÍ VA EL BLOQUE DE ITEMS ASOCIADOS */}
                                                {itemsAsociados.length > 0 && (
                                                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                                        <p className="text-xs font-medium text-blue-900 mb-1">
                                                            Items asociados:
                                                        </p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {itemsAsociados.map((numItem, i) => (
                                                                <span
                                                                    key={i}
                                                                    className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold"
                                                                >
                                                                    Item {numItem}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    {/* Código Contenedor */}
                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                                            Código Contenedor <span className="text-red-500">*</span>
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={cont.codigo || ""}
                                                            onChange={(e) => updateContenedor(cont.id, "codigo", e.target.value)}
                                                            className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-slate-500 font-mono"
                                                            maxLength="11"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                                            Tipo Contenedor <span className="text-red-500">*</span>
                                                        </label>
                                                        <input
                                                            type="text"
                                                            value={cont.tipo_cnt || "N/A"}
                                                            disabled
                                                            className="w-full px-4 py-2 rounded-lg border border-slate-300 bg-slate-100 text-slate-600 font-mono cursor-not-allowed"
                                                            title="Campo no editable - asignado automáticamente según tipo de bulto"
                                                        />
                                                        <p className="text-xs text-slate-500 mt-1">
                                                            No editable (asignado automáticamente)
                                                        </p>
                                                    </div>
                                                    {/* Sellos */}
                                                    <div className="md:col-span-2">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <label className="block text-sm font-medium text-slate-700">
                                                                Sellos ({(cont.sellos || []).length})
                                                            </label>
                                                            <button
                                                                type="button"
                                                                onClick={() => addSelloToContenedor(cont.id)}
                                                                className="text-sm bg-green-600 text-white px-3 py-1 rounded-lg hover:bg-green-700 transition-colors"
                                                            >
                                                                + Agregar Sello
                                                            </button>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {(cont.sellos || []).length === 0 ? (
                                                                <p className="text-sm text-slate-500 italic">Sin sellos</p>
                                                            ) : (
                                                                (cont.sellos || []).map((sello, i) => (
                                                                    <div
                                                                        key={i}
                                                                        className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-mono"
                                                                    >
                                                                        {sello}
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => removeSelloFromContenedor(cont.id, sello)}
                                                                            className="text-red-600 hover:text-red-800 font-bold"
                                                                        >
                                                                            ×
                                                                        </button>

                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>


                                                        {esCargaPeligrosa && (cont.sellos || []).length < 2 && (cont.sellos || []).length > 0 && (
                                                            <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700">
                                                                💡 Se recomienda más de un sello para carga peligrosa
                                                            </div>
                                                        )}
                                                        {/* 🆕 HASTA AQUÍ 👆 */}

                                                    </div>

                                                    {/* 🔥 SECCIÓN IMO - CONDICIONAL */}
                                                    {esCargaPeligrosa && (
                                                        <div className="md:col-span-2 border-t-2 border-red-300 pt-4">
                                                            <div className="flex items-center justify-between mb-3">
                                                                <label className="block text-sm font-medium text-red-800 flex items-center gap-2">
                                                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                                    </svg>
                                                                    Datos IMO (Obligatorio) - {(cont.imos || []).length} registrado(s)
                                                                </label>
                                                                {/* DENTRO DEL STEP 6, en la sección de IMO */}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => addImoToContenedor(cont.id, cont.codigo)} // 🔥 Pasar código
                                                                    className="text-sm bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors font-medium"
                                                                >
                                                                    + Agregar IMO
                                                                </button>
                                                            </div>

                                                            {/* Alert si no hay IMOs */}
                                                            {(cont.imos || []).length === 0 && (
                                                                <div className="mb-3 p-3 bg-red-100 border border-red-300 rounded-lg">
                                                                    <p className="text-sm text-red-800 font-medium">
                                                                        ⚠️ Este contenedor tiene carga peligrosa y debe tener al menos un dato IMO
                                                                    </p>
                                                                </div>
                                                            )}

                                                            <div className="space-y-2">
                                                                {(cont.imos || []).length === 0 ? (
                                                                    <p className="text-sm text-orange-700 italic bg-orange-100 p-3 rounded">
                                                                        Sin datos IMO registrados
                                                                    </p>
                                                                ) : (
                                                                    (cont.imos || []).map((imo, i) => (
                                                                        <div
                                                                            key={i}
                                                                            className="flex items-center gap-3 p-4 bg-white border-2 border-orange-300 rounded-lg shadow-sm"
                                                                        >
                                                                            <div className="flex-1 grid grid-cols-2 gap-4">
                                                                                <div>
                                                                                    <span className="text-xs text-slate-600">Clase IMO</span>
                                                                                    <p className="text-sm font-bold text-slate-900">{imo.clase}</p>
                                                                                </div>
                                                                                <div>
                                                                                    <span className="text-xs text-slate-600">Número IMO</span>
                                                                                    <p className="text-sm font-bold text-slate-900">{imo.numero}</p>
                                                                                </div>
                                                                            </div>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => removeImoFromContenedor(cont.id, i, cont.codigo)} // 🔥 Pasar código
                                                                                className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                                                                                title="Eliminar IMO"
                                                                            >
                                                                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                                </svg>
                                                                            </button>
                                                                        </div>
                                                                    ))
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                                <strong>Nota:</strong> Los contenedores con carga peligrosa DEBEN tener datos IMO. Los datos de peso, volumen y tipo de contenedor no son editables.
                            </div>
                        </div>
                    )}
                    {/* STEP 7: REVISIÓN */}
                    {currentStep === 7 && (
                        <div className="space-y-6">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                                <h3 className="font-semibold text-blue-900 mb-4 text-lg">
                                    Resumen de cambios
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
                                    {/* ← AGREGAR AQUÍ */}
                                    <div>
                                        <p className="text-blue-700 font-medium">Fecha Presentación:</p>
                                        <p className="text-blue-900">{formData.fecha_presentacion ?
                                            new Date(formData.fecha_presentacion).toLocaleString('es-CL') : "—"}
                                        </p>
                                    </div>
                                    {/* 🆕 PUERTOS EN RESUMEN */}
                                    <div>
                                        <p className="text-blue-700 font-medium">Puerto Embarque:</p>
                                        <p className="text-blue-900">{formData.puerto_embarque || "—"}</p>
                                    </div>
                                    <div>
                                        <p className="text-blue-700 font-medium">Puerto Descarga:</p>
                                        <p className="text-blue-900">{formData.puerto_descarga || "—"}</p>
                                    </div>
                                    <div>
                                        <p className="text-blue-700 font-medium">Peso Bruto:</p>
                                        <p className="text-blue-900">{formData.peso_bruto} {formData.unidad_peso}</p>
                                    </div>
                                    <div>
                                        <p className="text-blue-700 font-medium">Volumen:</p>
                                        <p className="text-blue-900">{formData.volumen} {formData.unidad_volumen}</p>
                                    </div>
                                    <div>
                                        <p className="text-blue-700 font-medium">Bultos:</p>
                                        <p className="text-blue-900">{formData.bultos}</p>
                                    </div>
                                    <div>
                                        <p className="text-blue-700 font-medium">Total Contenedores:</p>
                                        <p className="text-blue-900">{contenedores.length}</p>
                                    </div>
                                    <div>
                                        <p className="text-blue-700 font-medium">Total Items:</p>
                                        <p className="text-blue-900">{items.length}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                                <strong>Atención:</strong> Al confirmar, los cambios se aplicarán inmediatamente en el sistema.
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
            </main >
            {/* 🔥 AGREGAR EL MODAL AQUÍ - JUSTO ANTES DEL CIERRE DEL RETURN */}
            <CrearPuertoModal
                isOpen={showCrearPuertoModal}
                onClose={() => setShowCrearPuertoModal(false)}
                onPuertoCreado={handlePuertoCreado}
            />
        </div >
    );
};

export default ExpoBLEdit;