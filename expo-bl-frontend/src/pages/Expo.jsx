import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { expoInitialModel } from "../models/expoModel";

const steps = [
    "Datos BL",
    "Transporte",
    "Locaciones",
    "Participantes",
    "Carga",
    "Resumen"
];

const Expo = () => {
    const { blNumber } = useParams();
    const navigate = useNavigate();

    const [step, setStep] = useState(1);
    const [expoData, setExpoData] = useState(expoInitialModel);
    const [selectedItemIndex, setSelectedItemIndex] = useState(0);
    const [showPreview, setShowPreview] = useState(false);


    /* ======================
       Precargar BL desde URL
       ====================== */
    useEffect(() => {
        if (blNumber) {
            setExpoData(prev => ({
                ...prev,
                documento: {
                    ...prev.documento,
                    cabecera: {
                        ...prev.documento.cabecera,
                        numeroReferencia: blNumber
                    }
                }
            }));
        }
    }, [blNumber]);

    /* ======================
       Helper update JSON
       ====================== */
    const updateField = (path, value) => {
        setExpoData(prev => {
            const newData = structuredClone(prev);
            const keys = path.split(".");
            let current = newData;

            keys.forEach((key, index) => {
                if (index === keys.length - 1) {
                    current[key] = value;
                } else {
                    current = current[key];
                }
            });

            return newData;
        });
    };

    const nextStep = () => setStep(s => Math.min(s + 1, steps.length));
    const prevStep = () => setStep(s => Math.max(s - 1, 1));

    const generarXML = (data) => {
        const xml = `<?xml version="1.0" encoding="ISO-8859-1"?>
<Documento tipo="BL" version="1.0">
  <tipo-accion>${data.documento.cabecera.tipoAccion}</tipo-accion>
  <numero-referencia>${data.documento.cabecera.numeroReferencia}</numero-referencia>

  <OpTransporte>
    <optransporte>
      <sentido-operacion>S</sentido-operacion>
      <nombre-nave>${data.documento.transporte.nombreNave}</nombre-nave>
    </optransporte>
  </OpTransporte>

  <Locaciones>
    <locacion>
      <nombre>PE</nombre>
      <codigo>${data.documento.locaciones.puertoEmbarque.codigo}</codigo>
      <descripcion>${data.documento.locaciones.puertoEmbarque.descripcion}</descripcion>
    </locacion>
    <locacion>
      <nombre>PD</nombre>
      <codigo>${data.documento.locaciones.puertoDesembarque.codigo}</codigo>
      <descripcion>${data.documento.locaciones.puertoDesembarque.descripcion}</descripcion>
    </locacion>
  </Locaciones>
</Documento>`;

        const blob = new Blob([xml], { type: "application/xml" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `${data.documento.cabecera.numeroReferencia}.xml`;
        a.click();

        URL.revokeObjectURL(url);
    };

    /* ======================
       Mock Nave / Viaje
       (después vendrá de PMS)
       ====================== */
    const nave = "EVER FEAT";
    const viaje = "012S";

    return (
        <div className="min-h-screen bg-[#0F2A44] px-4 py-10">
            <div className="w-full max-w-6xl mx-auto bg-white rounded-3xl shadow-2xl p-8">

                {/* ======================
            HEADER BL
           ====================== */}
                <div className="mb-10 border-b pb-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

                        <div>
                            <h1 className="text-2xl font-semibold text-[#0F2A44]">
                                Completar BL EXPO
                            </h1>
                            <p className="text-sm text-slate-500 mt-1">
                                Nave <strong>{nave}</strong> · Viaje <strong>{viaje}</strong>
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <span className="text-sm text-slate-500">BL</span>
                            <span className="px-4 py-2 rounded-lg bg-slate-100 text-[#0F2A44] font-semibold">
                                {blNumber}
                            </span>
                            <button
                                onClick={() => navigate("/expo")}
                                className="ml-4 text-sm text-slate-500 hover:text-[#0F2A44]"
                            >
                                ← Volver al listado
                            </button>
                        </div>

                    </div>
                </div>

                {/* ======================
            STEPPER
           ====================== */}
                <div className="flex items-center justify-between mb-10">
                    {steps.map((label, index) => {
                        const stepNumber = index + 1;
                        const active = step === stepNumber;
                        const completed = step > stepNumber;

                        return (
                            <div key={label} className="flex-1 flex items-center">
                                <div
                                    className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold
                    ${completed ? "bg-[#0F2A44] text-white" : ""}
                    ${active && !completed ? "border-2 border-[#0F2A44] text-[#0F2A44]" : ""}
                    ${!active && !completed ? "bg-slate-200 text-slate-500" : ""}
                  `}
                                >
                                    {stepNumber}
                                </div>
                                {index < steps.length - 1 && (
                                    <div className="flex-1 h-px bg-slate-300 mx-2" />
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* ======================
            PASO 1 – DATOS BL
           ====================== */}
                {step === 1 && (
                    <>
                        <h2 className="text-xl font-semibold text-[#0F2A44] mb-2">
                            Paso 1 · General (SIDEMAR)
                        </h2>
                        <p className="text-sm text-slate-500 mb-8">
                            Campos obligatorios para validación del BL en Aduana
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            {/* BL Number (readonly) */}
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">
                                    Número de BL
                                </label>
                                <input
                                    type="text"
                                    value={expoData.documento.cabecera.numeroReferencia}
                                    disabled
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-slate-100 text-slate-500 cursor-not-allowed"
                                />
                            </div>

                            {/* Tipo acción */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Tipo de acción
                                    <span className="text-red-600 ml-1">*</span>
                                    <span className="ml-2 text-xs text-red-500">Requerido SIDEMAR</span>
                                </label>
                                <select
                                    value={expoData.documento.cabecera.tipoAccion}
                                    onChange={(e) =>
                                        updateField("documento.cabecera.tipoAccion", e.target.value)
                                    }
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                >
                                    <option value="M">Modificación (M)</option>
                                    <option value="I">Ingreso (I)</option>
                                </select>
                            </div>

                            {/* Nave */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Nave
                                    <span className="text-red-600 ml-1">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={expoData.documento.transporte.nombreNave}
                                    onChange={(e) =>
                                        updateField(
                                            "documento.transporte.nombreNave",
                                            e.target.value
                                        )
                                    }
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                    placeholder="Ej: EVER FEAT"
                                />
                            </div>

                            {/* Viaje */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Viaje
                                    <span className="text-red-600 ml-1">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={expoData.documento.transporte.viaje}
                                    onChange={(e) =>
                                        updateField(
                                            "documento.transporte.viaje",
                                            e.target.value
                                        )
                                    }
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                    placeholder="Ej: 028W"
                                />
                            </div>

                            {/* Fecha Emisión BL */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Fecha emisión BL
                                    <span className="text-red-600 ml-1">*</span>
                                </label>
                                <input
                                    type="date"
                                    value={expoData.documento.fechas.fechaEmisionBL}
                                    onChange={(e) =>
                                        updateField(
                                            "documento.fechas.fechaEmisionBL",
                                            e.target.value
                                        )
                                    }
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                />
                            </div>

                            {/* Fecha Zarpe */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Fecha zarpe
                                    <span className="text-red-600 ml-1">*</span>
                                </label>
                                <input
                                    type="datetime-local"
                                    value={expoData.documento.fechas.fechaZarpe}
                                    onChange={(e) =>
                                        updateField(
                                            "documento.fechas.fechaZarpe",
                                            e.target.value
                                        )
                                    }
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                />
                            </div>

                            {/* Fecha Embarque */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Fecha embarque
                                    <span className="text-red-600 ml-1">*</span>
                                </label>
                                <input
                                    type="datetime-local"
                                    value={expoData.documento.fechas.fechaEmbarque}
                                    onChange={(e) =>
                                        updateField(
                                            "documento.fechas.fechaEmbarque",
                                            e.target.value
                                        )
                                    }
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                />


                            </div>



                        </div>
                    </>
                )}

                {step === 2 && (
                    <>
                        <h2 className="text-xl font-semibold text-[#0F2A44] mb-2">
                            Paso 2 · Transporte / Itinerario
                        </h2>
                        <p className="text-sm text-slate-500 mb-8">
                            Información obligatoria del transporte para validación en Aduana
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            {/* Sentido operación (fijo EXPO) */}
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">
                                    Sentido de operación
                                </label>
                                <input
                                    type="text"
                                    value="Salida (S)"
                                    disabled
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-slate-100 text-slate-500 cursor-not-allowed"
                                />
                            </div>

                            {/* Servicio */}
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">
                                    Servicio
                                </label>
                                <select
                                    value={expoData.documento.transporte.service}
                                    onChange={(e) =>
                                        updateField(
                                            "documento.transporte.service",
                                            e.target.value
                                        )
                                    }
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                >
                                    <option value="LINER">LINER</option>
                                    <option value="TRAMP">TRAMP</option>
                                </select>
                            </div>

                            {/* Tipo servicio */}
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">
                                    Tipo de servicio
                                </label>
                                <select
                                    value={expoData.documento.transporte.tipoServicio}
                                    onChange={(e) =>
                                        updateField(
                                            "documento.transporte.tipoServicio",
                                            e.target.value
                                        )
                                    }
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                >
                                    <option value="FCL/FCL">FCL / FCL</option>
                                    <option value="LCL/LCL">LCL / LCL</option>
                                    <option value="BB">Break Bulk</option>
                                </select>
                            </div>

                            {/* Condición transporte */}
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">
                                    Condición de transporte
                                </label>
                                <select
                                    value={expoData.documento.transporte.condTransporte}
                                    onChange={(e) =>
                                        updateField(
                                            "documento.transporte.condTransporte",
                                            e.target.value
                                        )
                                    }
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                >
                                    <option value="HH">House / House (HH)</option>
                                    <option value="HP">House / Pier (HP)</option>
                                    <option value="PH">Pier / House (PH)</option>
                                    <option value="PP">Pier / Pier (PP)</option>
                                </select>
                            </div>

                            {/* Puerto de embarque */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Puerto de embarque (POL)
                                    <span className="text-red-600 ml-1">*</span>
                                    <span className="ml-2 text-xs text-red-500">Requerido SIDEMAR</span>
                                </label>
                                <input
                                    type="text"
                                    value={expoData.documento.locaciones.puertoEmbarque.codigo}
                                    onChange={(e) =>
                                        updateField(
                                            "documento.locaciones.puertoEmbarque.codigo",
                                            e.target.value
                                        )
                                    }
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                    placeholder="Ej: CLVAP"
                                />
                            </div>

                            {/* Puerto de descarga */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Puerto de descarga (POD)
                                    <span className="text-red-600 ml-1">*</span>
                                    <span className="ml-2 text-xs text-red-500">Requerido SIDEMAR</span>
                                </label>
                                <input
                                    type="text"
                                    value={expoData.documento.locaciones.puertoDesembarque.codigo}
                                    onChange={(e) =>
                                        updateField(
                                            "documento.locaciones.puertoDesembarque.codigo",
                                            e.target.value
                                        )
                                    }
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                    placeholder="Ej: TWKHH"
                                />
                            </div>

                        </div>
                    </>
                )}
                {step === 3 && (
                    <>
                        <h2 className="text-xl font-semibold text-[#0F2A44] mb-2">
                            Paso 3 · Locaciones
                        </h2>
                        <p className="text-sm text-slate-500 mb-8">
                            Puertos y lugares asociados al BL
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            {/* Lugar Emisión */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Lugar emisión BL (LE)
                                </label>
                                <input
                                    type="text"
                                    value={expoData.documento.locaciones.lugarEmision.codigo}
                                    disabled
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-slate-100"
                                />
                            </div>

                            {/* Puerto embarque */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Puerto embarque (PE)
                                    <span className="text-red-600 ml-1">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={expoData.documento.locaciones.puertoEmbarque.codigo}
                                    onChange={(e) =>
                                        updateField(
                                            "documento.locaciones.puertoEmbarque.codigo",
                                            e.target.value
                                        )
                                    }
                                    placeholder="Ej: CLVAP"
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                />
                            </div>

                            {/* Puerto desembarque */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Puerto desembarque (PD)
                                    <span className="text-red-600 ml-1">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={expoData.documento.locaciones.puertoDesembarque.codigo}
                                    onChange={(e) =>
                                        updateField(
                                            "documento.locaciones.puertoDesembarque.codigo",
                                            e.target.value
                                        )
                                    }
                                    placeholder="Ej: TWKHH"
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                />
                            </div>

                            {/* Lugar destino final */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Lugar destino final (LD)
                                </label>
                                <input
                                    type="text"
                                    value={expoData.documento.locaciones.lugarDestinoFinal.codigo}
                                    onChange={(e) =>
                                        updateField(
                                            "documento.locaciones.lugarDestinoFinal.codigo",
                                            e.target.value
                                        )
                                    }
                                    placeholder="Opcional"
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                />
                            </div>

                        </div>
                    </>
                )}
                {step === 4 && (
                    <>
                        <h2 className="text-xl font-semibold text-[#0F2A44] mb-2">
                            Paso 4 · Participantes
                        </h2>
                        <p className="text-sm text-slate-500 mb-8">
                            Datos de las partes involucradas en el BL (SIDEMAR)
                        </p>

                        <div className="space-y-10">

                            {/* ======================
          EMISOR (EMI)
         ====================== */}
                            <div>
                                <h3 className="font-semibold text-[#0F2A44] mb-4">
                                    Emisor del BL (EMI) <span className="text-red-600">*</span>
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <input
                                        type="text"
                                        value={expoData.documento.participantes.emisor.nombre}
                                        disabled
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-slate-100"
                                    />

                                    <input
                                        type="text"
                                        placeholder="RUT"
                                        value={expoData.documento.participantes.emisor.valorId}
                                        onChange={(e) =>
                                            updateField(
                                                "documento.participantes.emisor.valorId",
                                                e.target.value
                                            )
                                        }
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                    />
                                </div>
                            </div>

                            {/* ======================
          SHIPPER / EMB
         ====================== */}
                            <div>
                                <h3 className="font-semibold text-[#0F2A44] mb-4">
                                    Shipper / Embarcador (EMB) <span className="text-red-600">*</span>
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <input
                                        type="text"
                                        placeholder="Nombre del Shipper"
                                        value={expoData.documento.participantes.embarcador.nombre}
                                        onChange={(e) =>
                                            updateField(
                                                "documento.participantes.embarcador.nombre",
                                                e.target.value
                                            )
                                        }
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                    />

                                    <input
                                        type="text"
                                        placeholder="País (ej: PY, CL)"
                                        value={expoData.documento.participantes.embarcador.pais}
                                        onChange={(e) =>
                                            updateField(
                                                "documento.participantes.embarcador.pais",
                                                e.target.value
                                            )
                                        }
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                    />
                                </div>
                            </div>

                            {/* ======================
          CONSIGNATARIO
         ====================== */}
                            <div>
                                <h3 className="font-semibold text-[#0F2A44] mb-4">
                                    Consignatario (CONS) <span className="text-red-600">*</span>
                                </h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <input
                                        type="text"
                                        placeholder="Nombre del Consignatario"
                                        value={expoData.documento.participantes.consignatario.nombre}
                                        onChange={(e) =>
                                            updateField(
                                                "documento.participantes.consignatario.nombre",
                                                e.target.value
                                            )
                                        }
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                    />

                                    <input
                                        type="text"
                                        placeholder="País (ej: TW)"
                                        value={expoData.documento.participantes.consignatario.pais}
                                        onChange={(e) =>
                                            updateField(
                                                "documento.participantes.consignatario.pais",
                                                e.target.value
                                            )
                                        }
                                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                    />
                                </div>
                            </div>

                            {/* ======================
          NOTIFY (opcional)
         ====================== */}
                            <div>
                                <h3 className="font-semibold text-slate-600 mb-4">
                                    Notify (opcional)
                                </h3>

                                <input
                                    type="text"
                                    placeholder="Nombre Notify"
                                    value={expoData.documento.participantes.notify.nombre}
                                    onChange={(e) =>
                                        updateField(
                                            "documento.participantes.notify.nombre",
                                            e.target.value
                                        )
                                    }
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                                />
                            </div>

                        </div>
                    </>
                )}
                {step === 5 && (
                    <>
                        <h2 className="text-xl font-semibold text-[#0F2A44] mb-2">
                            Paso 5 · Ítem de carga
                        </h2>
                        <p className="text-sm text-slate-500 mb-8">
                            Seleccione el número de ítem y complete la descripción de la mercancía
                        </p>

                        {/* ======================
        Selector Nº Ítem
       ====================== */}
                        <div className="mb-6 max-w-xs">
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Número de Ítem <span className="text-red-600">*</span>
                            </label>

                            <select
                                value={selectedItemIndex}
                                onChange={(e) => {
                                    const index = Number(e.target.value);

                                    // Si el ítem no existe, lo creamos
                                    if (!expoData.documento.items[index]) {
                                        const newItems = [...expoData.documento.items];
                                        newItems[index] = {
                                            numeroItem: index + 1,
                                            tipoBulto: "",
                                            descripcionMercancia: "",
                                            cantidad: 1,
                                            pesoBruto: "",
                                            unidadPeso: "KGM",
                                            volumen: "",
                                            unidadVolumen: "MTQ",
                                            cargaEnContenedor: "S",
                                            contenedores: []
                                        };
                                        updateField("documento.items", newItems);
                                    }

                                    setSelectedItemIndex(index);
                                }}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                            >
                                {expoData.documento.items.map((_, index) => (
                                    <option key={index} value={index}>
                                        Ítem {String(index + 1).padStart(3, "0")}
                                    </option>
                                ))}
                                <option value={expoData.documento.items.length}>
                                    + Nuevo ítem
                                </option>
                            </select>
                        </div>

                        {/* ======================
        Formulario Ítem
       ====================== */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                            <div>
                                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1">
                                    Tipo de bulto <span className="text-red-600">*</span>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            window.open(
                                                "https://www.aduana.cl/compendio-de-normas-anexo-51/aduana/2009-11-19/163937.html#vtxt_cuerpo_T22",
                                                "_blank"
                                            )
                                        }
                                        className="w-5 h-5 rounded-full border border-slate-400 flex items-center justify-center text-xs font-bold text-slate-600 hover:bg-slate-200"
                                        title="Ver tipos de bulto (Aduana)"
                                    >
                                        ?
                                    </button>
                                </label>

                                <input
                                    type="text"
                                    value={expoData.documento.items[selectedItemIndex]?.tipoBulto || ""}
                                    onChange={(e) =>
                                        updateField(
                                            `documento.items.${selectedItemIndex}.tipoBulto`,
                                            e.target.value
                                        )
                                    }
                                    className="w-full rounded-lg border px-3 py-2 text-sm"
                                    placeholder="Ej: 76"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Cantidad <span className="text-red-600">*</span>
                                </label>
                                <input
                                    type="number"
                                    value={expoData.documento.items[selectedItemIndex]?.cantidad || 1}
                                    onChange={(e) =>
                                        updateField(
                                            `documento.items.${selectedItemIndex}.cantidad`,
                                            e.target.value
                                        )
                                    }
                                    className="w-full rounded-lg border px-3 py-2 text-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Peso bruto (KGM) <span className="text-red-600">*</span>
                                </label>
                                <input
                                    type="number"
                                    step="0.001"
                                    value={expoData.documento.items[selectedItemIndex]?.pesoBruto || ""}
                                    onChange={(e) =>
                                        updateField(
                                            `documento.items.${selectedItemIndex}.pesoBruto`,
                                            e.target.value
                                        )
                                    }
                                    className="w-full rounded-lg border px-3 py-2 text-sm"
                                />
                            </div>

                        </div>

                        {/* Descripción */}
                        <div className="mt-6">
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Descripción de la mercancía <span className="text-red-600">*</span>
                            </label>
                            <textarea
                                rows={6}
                                value={
                                    expoData.documento.items[selectedItemIndex]?.descripcionMercancia || ""
                                }
                                onChange={(e) =>
                                    updateField(
                                        `documento.items.${selectedItemIndex}.descripcionMercancia`,
                                        e.target.value
                                    )
                                }
                                className="w-full rounded-lg border px-3 py-2 text-sm"
                                placeholder="SIDEMAR acepta una descripción por ítem"
                            />
                        </div>
                    </>
                )}
                {step === 6 && (
                    <>
                        <h2 className="text-xl font-semibold text-[#0F2A44] mb-2">
                            Paso 6 · Resumen y Generación XML
                        </h2>
                        <p className="text-sm text-slate-500 mb-8">
                            Revisa la información antes de generar el archivo para Aduana
                        </p>

                        {/* ======================
        RESUMEN GENERAL
       ====================== */}
                        <div className="space-y-6 text-sm">

                            <div className="border rounded-lg p-4">
                                <strong>BL:</strong> {expoData.documento.cabecera.numeroReferencia}
                            </div>

                            <div className="border rounded-lg p-4">
                                <strong>Nave / Viaje:</strong>{" "}
                                {expoData.documento.transporte.nombreNave} ·{" "}
                                {expoData.documento.transporte.viaje}
                            </div>

                            <div className="border rounded-lg p-4">
                                <strong>Puertos:</strong>{" "}
                                {expoData.documento.locaciones.puertoEmbarque.codigo} →{" "}
                                {expoData.documento.locaciones.puertoDesembarque.codigo}
                            </div>

                            <div className="border rounded-lg p-4">
                                <strong>Ítems:</strong> {expoData.documento.items.length}
                            </div>

                        </div>

                        {/* ======================
        VALIDACIÓN SIMPLE
       ====================== */}
                        <div className="mt-8 text-sm text-red-600">
                            {(!expoData.documento.transporte.nombreNave ||
                                !expoData.documento.transporte.viaje ||
                                !expoData.documento.locaciones.puertoEmbarque.codigo ||
                                !expoData.documento.locaciones.puertoDesembarque.codigo) && (
                                    <p>
                                        ⚠️ Faltan campos obligatorios SIDEMAR. Revisa los pasos anteriores.
                                    </p>
                                )}
                        </div>

                        {/* ======================
        BOTÓN GENERAR XML
       ====================== */}
                        <div className="mt-10">
                            <button
                                disabled={
                                    !expoData.documento.transporte.nombreNave ||
                                    !expoData.documento.transporte.viaje ||
                                    !expoData.documento.locaciones.puertoEmbarque.codigo ||
                                    !expoData.documento.locaciones.puertoDesembarque.codigo
                                }
                                onClick={() => generarXML(expoData)}
                                className="px-8 py-3 rounded-lg bg-[#0F2A44] text-white disabled:opacity-40"
                            >
                                Generar XML BL
                            </button>
                        </div>
                    </>
                )}




                {/* ======================
            BOTONES
           ====================== */}
                <div className="flex justify-between mt-12">
                    <button
                        onClick={prevStep}
                        disabled={step === 1}
                        className="px-6 py-2 rounded-lg border border-slate-300 text-slate-600 disabled:opacity-40"
                    >
                        Anterior
                    </button>

                    <button
                        onClick={nextStep}
                        className="px-6 py-2 rounded-lg bg-[#0F2A44] text-white"
                    >
                        Siguiente
                    </button>
                </div>

            </div>
        </div>
    );
};

export default Expo;
