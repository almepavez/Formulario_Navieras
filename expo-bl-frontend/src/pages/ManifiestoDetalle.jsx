import { useEffect, useState, useRef, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import Sidebar from "../components/Sidebar";

const formatDateCL = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy}`;
};

const formatDTCL = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy} ${hh}:${mi}`;
};



const toInputDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const toInputDatetime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
};

const API_BASE = "http://localhost:4000";

const ManifiestoDetalle = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [blCount, setBlCount] = useState(0);
  const fileInputRef = useRef(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    operadorNave: "",
    status: "",
    remark: "",
    emisorDocumento: "",
    representante: "",
    fechaManifiestoAduana: "",
    numeroManifiestoAduana: "",
    referenciaId: "",
    numeroReferencia: "",
    fechaReferencia: "",
  });

  const [itinerario, setItinerario] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [pmsFile, setPmsFile] = useState(null);
  const [pmsUploading, setPmsUploading] = useState(false);
  const [pmsMsg, setPmsMsg] = useState("");

  // Estado para referencias
  const [referencias, setReferencias] = useState([]);

  // Cargar catálogo de referencias
  useEffect(() => {
    const loadReferencias = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/mantenedores/referencias`);
        if (!res.ok) throw new Error(`Error referencias HTTP ${res.status}`);
        const data = await res.json();
        setReferencias(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("Error cargando referencias:", e);
      }
    };

    loadReferencias();
  }, []);

  useEffect(() => {
    fetchDetalle();
  }, [id]);

  // useEffect para beforeunload
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isEditing && hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isEditing, hasUnsavedChanges]);

  // Sincronizar número de referencia con número de manifiesto de aduana
  useEffect(() => {
    if (formData.numeroManifiestoAduana.trim()) {
      setFormData(prev => ({
        ...prev,
        numeroReferencia: prev.numeroManifiestoAduana
      }));
    }
  }, [formData.numeroManifiestoAduana]);

  const fetchDetalle = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/manifiestos/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);

      setBlCount(json.bls?.length || 0);
      console.log("🔍 BLs cargados:", json.bls?.length || 0, json.bls);

      const m = json.manifiesto;
      setFormData({
        operadorNave: m.operadorNave || "",
        status: m.status || "",
        remark: m.remark || "",
        emisorDocumento: m.emisorDocumento || "",
        representante: m.representante || "",
        fechaManifiestoAduana: toInputDate(m.fechaManifiestoAduana),
        numeroManifiestoAduana: m.numeroManifiestoAduana || "",
        referenciaId: m.referenciaId || "",
        numeroReferencia: m.numeroReferencia || "",
        fechaReferencia: toInputDate(m.fechaReferencia),
      });

      setItinerario(
        (json.itinerario || []).map((it) => ({
          ...it,
          eta: toInputDatetime(it.eta),
          ets: toInputDatetime(it.ets),
        }))
      );

      setHasUnsavedChanges(false);
    } catch (e) {
      console.error("❌ Error en fetchDetalle:", e);
      setError(e?.message || "Error cargando manifiesto");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isEditing && hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isEditing, hasUnsavedChanges]);

  const handleInputChange = (field, value) => {
    // Si se cambia Representante, autocompletar Emisor Doc
    if (field === "representante" && value) {
      const refSeleccionada = referencias.find(r => r.match_code === value);
      if (refSeleccionada) {
        setFormData((prev) => ({
          ...prev,
          [field]: value,
          emisorDocumento: refSeleccionada.customer_id
        }));
        setHasUnsavedChanges(true);
        return;
      }
    }

    // Si se cambia Emisor Doc, autocompletar Representante
    if (field === "emisorDocumento" && value) {
      const refSeleccionada = referencias.find(r => r.customer_id === value);
      if (refSeleccionada) {
        setFormData((prev) => ({
          ...prev,
          [field]: value,
          representante: refSeleccionada.match_code
        }));
        setHasUnsavedChanges(true);
        return;
      }
    }

    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  const handleItinerarioChange = (index, field, value) => {
    setItinerario((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    setHasUnsavedChanges(true);
  };

  const handleEdit = () => {
    setIsEditing(true);
    setHasUnsavedChanges(false);
  };

  const handleCancelEdit = async () => {
    if (hasUnsavedChanges) {
      const result = await Swal.fire({
        title: "¿Cancelar edición?",
        text: "Los cambios no guardados se perderán",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#e43a3aff",
        cancelButtonColor: "#10b981",
        confirmButtonText: "Sí, cancelar",
        cancelButtonText: "No, continuar editando",
      });

      if (!result.isConfirmed) return;
    }

    setIsEditing(false);
    await fetchDetalle();
    setHasUnsavedChanges(false);

    if (hasUnsavedChanges) {
      Swal.fire({
        title: "Cancelado",
        text: "Se han descartado los cambios",
        icon: "info",
        confirmButtonColor: "#10b981",
        timer: 2000,
      });
    }
  };

  const handleSaveChanges = async () => {
    const result = await Swal.fire({
      title: "¿Guardar cambios?",
      text: "Se actualizará el manifiesto con la información editada",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#10b981",
      cancelButtonColor: "#e43a3aff",
      confirmButtonText: "Sí, guardar",
      cancelButtonText: "Cancelar",
    });

    if (!result.isConfirmed) return;

    try {
      const payload = {
        operadorNave: formData.operadorNave,
        status: formData.status,
        remark: formData.remark,
        emisorDocumento: formData.emisorDocumento,
        representante: formData.representante,
        fechaManifiestoAduana: formData.fechaManifiestoAduana,
        numeroManifiestoAduana: formData.numeroManifiestoAduana,
        referenciaId: formData.referenciaId || null,
        numeroReferencia: formData.numeroReferencia || null,
        fechaReferencia: formData.fechaReferencia || null,
        itinerario: itinerario.map((it) => ({
          id: it.id,
          port: it.port,
          portType: it.portType,
          eta: it.eta || null,
          ets: it.ets || null,
          orden: it.orden,
        })),
      };

      const res = await fetch(`${API_BASE}/manifiestos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(errText || `HTTP ${res.status}`);
      }

      await Swal.fire({
        title: "¡Guardado!",
        text: "El manifiesto ha sido actualizado correctamente",
        icon: "success",
        confirmButtonColor: "#10b981",
        timer: 2000,
      });

      setIsEditing(false);
      setHasUnsavedChanges(false);
      await fetchDetalle();
    } catch (e) {
      Swal.fire({
        title: "Error",
        text: e?.message || "No se pudo guardar el manifiesto",
        icon: "error",
        confirmButtonColor: "#10b981",
      });
    }
  };

  const handleGoBack = async () => {
    if (isEditing && hasUnsavedChanges) {
      const result = await Swal.fire({
        title: "Cambios sin guardar",
        text: "Tienes cambios pendientes. ¿Deseas salir sin guardar?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#dc2626",
        cancelButtonColor: "#0F2A44",
        confirmButtonText: "Sí, salir sin guardar",
        cancelButtonText: "No, quedarme aquí",
      });

      if (!result.isConfirmed) return;
    }

    navigate("/manifiestos");
  };

  const handleUploadPMS = async () => {
    setPmsMsg("");
    setError("");

    if (!pmsFile) {
      setPmsMsg("Selecciona un archivo PMS primero.");
      return;
    }

    const result = await Swal.fire({
      title: "¿Procesar PMS?",
      text: "Se crearán los BLs desde el archivo. Los BLs anteriores serán eliminados.",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#10b981",
      cancelButtonColor: "#e43a3aff",
      confirmButtonText: "Sí, procesar",
      cancelButtonText: "Cancelar",
    });

    if (!result.isConfirmed) return;

    try {
      setPmsUploading(true);

      const formData = new FormData();
      formData.append('pms', pmsFile);

      const res = await fetch(`${API_BASE}/manifiestos/${id}/pms/procesar-directo`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));

        if (json.blsConErrores && json.blsConErrores.length > 0) {
          const errorList = json.blsConErrores
            .map(bl => `<li><strong>${bl.bl_number}</strong>: ${bl.errores.join(', ')}</li>`)
            .join('');

          await Swal.fire({
            title: "BLs con errores",
            html: `<ul style="text-align: left">${errorList}</ul>`,
            icon: "error",
            confirmButtonColor: "#10b981",
          });

          setPmsFile(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }

        throw new Error(json.error || `HTTP ${res.status}`);
      }

      const data = await res.json();

      const inserted = Number(data.inserted || 0);
      const reemplazados = Number(data.reemplazados || 0);
      const ignorados = Number(data.ignorados_duplicados_archivo || 0);
      const procesadosTotal = Number(data.procesados_total ?? (inserted + reemplazados));

      const blsConErrores = Array.isArray(data.blsConErrores) ? data.blsConErrores : [];

      const erroresHtml = blsConErrores.length
        ? `
          <div style="text-align:left; margin-top:10px;">
            <strong>BLs con errores:</strong>
            <ul style="margin:6px 0 0 18px;">
              ${blsConErrores
          .map(bl => `<li>${bl.bl_number} (${bl.total_errores} errores)</li>`)
          .join("")}
            </ul>
          </div>
        `
        : "";

      await Swal.fire({
        title: "¡PMS procesado!",
        icon: "success",
        html: `
          <div style="text-align:left">
            <div><strong>BLs procesados:</strong> ${procesadosTotal}</div>
            <div><strong>BLs nuevos:</strong> ${inserted}</div>
            <div><strong>BLs reemplazados:</strong> ${reemplazados}</div>
            <div><strong>Duplicados ignorados (archivo):</strong> ${ignorados}</div>
            ${erroresHtml}
          </div>
        `,
        confirmButtonColor: "#10b981",
      });

      setPmsFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      await fetchDetalle();

    } catch (e) {
      setPmsMsg("");
      setError(e?.message || "Error procesando PMS");
      await Swal.fire({
        title: "Error",
        text: e?.message || "No se pudo procesar el PMS",
        icon: "error",
        confirmButtonColor: "#10b981",
      });

      setPmsFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setPmsUploading(false);
    }
  };

  // Obtener datos de la referencia asociada al manifiesto
  const referenciaManifiesto = useMemo(() => {
    const refId = data?.manifiesto?.referenciaId || data?.manifiesto?.referencia_id;
    if (!refId) return null;
    return referencias.find(r => r.id === parseInt(refId));
  }, [referencias, data]);

  // Obtener emisor seleccionado
  const emisorSeleccionado = useMemo(() => {
    return referencias.find(r => r.customer_id === formData.emisorDocumento);
  }, [referencias, formData.emisorDocumento]);

  // Obtener representante seleccionado
  const representanteSeleccionado = useMemo(() => {
    return referencias.find(r => r.match_code === formData.representante);
  }, [referencias, formData.representante]);

  // Obtener operador nave seleccionado
const operadorNaveSeleccionado = useMemo(() => {
  return referencias.find(r => r.customer_id === formData.operadorNave);
}, [referencias, formData.operadorNave]);

  const m = data?.manifiesto;

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-10">
        <div className="mb-6">
          <button
            onClick={handleGoBack}
            className="text-sm text-slate-500 hover:text-slate-800 mb-4 inline-block"
          >
            ← Volver al listado
          </button>

          <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="text-2xl font-semibold text-[#0F2A44]">
                Manifiesto #{id}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Detalle del manifiesto y su itinerario
              </p>
            </div>

            <div className="flex items-center gap-3">
              {!isEditing ? (
                <button
                  onClick={handleEdit}
                  className="px-4 py-2 rounded-lg bg-[#0F2A44] text-white text-sm font-medium hover:bg-[#1a3f5f]"
                >
                  Editar
                </button>
              ) : (
                <>
                  <button
                    onClick={handleCancelEdit}
                    className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveChanges}
                    className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
                  >
                    Guardar cambios
                  </button>
                </>


              )}
              <button
                onClick={() => navigate(`/manifiestos/${id}/carga-suelta/nuevo`)}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 whitespace-nowrap flex items-center gap-2 flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nueva Carga Suelta
              </button>
            </div>
          </div>
        </div>

        {isEditing && hasUnsavedChanges && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
            <span className="font-medium">Tienes cambios sin guardar</span>
          </div>
        )}

        {loading && <div className="text-sm text-slate-600">Cargando...</div>}

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Error: {error}
          </div>
        )}

        {!loading && m && (
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <InfoReadOnly label="Servicio" value={m.servicio} />
                <InfoReadOnly label="Nave" value={m.nave} />
                <InfoReadOnly label="Viaje" value={m.viaje} />
                <InfoReadOnly label="Puerto central" value={m.puertoCentral} />
                <InfoReadOnly label="Operación" value={m.tipoOperacion} />

                {!isEditing ? (
                  <>
                    <InfoReadOnly label="Status" value={m.status} />
                    <InfoReadOnly
                      label="Operador nave"
                      value={
                        operadorNaveSeleccionado
                          ? `${m.operadorNave} — ${operadorNaveSeleccionado.nombre_emisor}`
                          : m.operadorNave
                      }
                    />
                    <InfoReadOnly
                      label="Emisor doc"
                      value={
                        emisorSeleccionado
                          ? emisorSeleccionado.nombre_emisor
                          : m.emisorDocumento
                      }
                    />
                    <InfoReadOnly
                      label="Representante"
                      value={
                        representanteSeleccionado
                          ? `${m.representante} — ${representanteSeleccionado.nombre_emisor}`
                          : m.representante
                      }
                    />
                    <InfoReadOnly
                      label="Fecha Mfto Aduana CL"
                      value={formatDateCL(m.fechaManifiestoAduana)}
                    />
                    <InfoReadOnly
                      label="N° Mfto Aduana CL"
                      value={m.numeroManifiestoAduana}
                    />
                    <InfoReadOnly label="Remark" value={m.remark || "—"} />
                  </>
                ) : (
                  <>
                    <InfoEditableSelect
                      label="Status"
                      value={formData.status}
                      onChange={(v) => handleInputChange("status", v)}
                      options={[
                        { value: "Activo", label: "Activo" },
                        { value: "Inactivo", label: "Inactivo" },
                        { value: "Enviado", label: "Enviado" }
                      ]}
                    />

                    {/* 🆕 Operador Nave */}
                    <div className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-3">
                      <div className="text-xs font-medium text-slate-700">Operador nave</div>
                      <select
                        value={formData.operadorNave}
                        onChange={(e) => handleInputChange("operadorNave", e.target.value)}
                        className="w-full mt-1 px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="">-- Selecciona --</option>
                        {referencias.map((ref) => (
                          <option key={ref.id} value={ref.customer_id}>
                            {ref.customer_id} — {ref.nombre_emisor}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 🆕 Emisor Doc - NOMBRE EN SELECT, CUSTOMER ID ABAJO */}
                    <div className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-3">
                      <div className="text-xs font-medium text-slate-700">Emisor doc</div>
                      <select
                        value={formData.emisorDocumento}
                        onChange={(e) => handleInputChange("emisorDocumento", e.target.value)}
                        className="w-full mt-1 px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="">-- Selecciona --</option>
                        {referencias.map((ref) => (
                          <option key={ref.id} value={ref.customer_id}>
                            {ref.nombre_emisor}
                          </option>
                        ))}
                      </select>
                      {emisorSeleccionado && (
                        <p className="mt-1 text-[10px] text-slate-500">
                          Customer ID: {emisorSeleccionado.customer_id} | RUT: {emisorSeleccionado.rut}
                        </p>
                      )}
                    </div>

                    {/* 🆕 Representante */}
                    <div className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-3">
                      <div className="text-xs font-medium text-slate-700">Representante</div>
                      <select
                        value={formData.representante}
                        onChange={(e) => handleInputChange("representante", e.target.value)}
                        className="w-full mt-1 px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="">-- Selecciona --</option>
                        {referencias.map((ref) => (
                          <option key={ref.id} value={ref.match_code}>
                            {ref.match_code} — {ref.nombre_emisor}
                          </option>
                        ))}
                      </select>
                      {representanteSeleccionado && (
                        <p className="mt-1 text-[10px] text-slate-500">
                          Customer ID: {representanteSeleccionado.customer_id} | RUT: {representanteSeleccionado.rut}
                        </p>
                      )}
                    </div>

                    <InfoEditableDate
                      label="Fecha Mfto Aduana CL"
                      value={formData.fechaManifiestoAduana}
                      onChange={(v) => handleInputChange("fechaManifiestoAduana", v)}
                    />
                    <InfoEditable
                      label="N° Mfto Aduana CL"
                      value={formData.numeroManifiestoAduana}
                      onChange={(v) => handleInputChange("numeroManifiestoAduana", v)}
                    />
                    <InfoEditable
                      label="Remark"
                      value={formData.remark}
                      onChange={(v) => handleInputChange("remark", v)}
                    />
                  </>
                )}
              </div>
            </div>

            {/* Carga PMS + Generar XML */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-slate-700">
                  Gestión de BLs
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Procesa archivos PMS o genera el XML del manifiesto
                </p>
              </div>

              <div className="flex items-center gap-3">
                {/* Input de archivo OCULTO */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xml,.txt,.csv,.pms,.dat"
                  onChange={(e) => setPmsFile(e.target.files?.[0] || null)}
                  className="hidden"
                  disabled={pmsUploading}
                  id="pms-file-input"
                />

                {/* Botón personalizado para seleccionar archivo */}
                <label
                  htmlFor="pms-file-input"
                  className={`flex-1 px-4 py-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-slate-700 text-sm font-medium hover:bg-slate-100 cursor-pointer transition-colors flex items-center gap-2 ${pmsUploading ? 'opacity-60 cursor-not-allowed' : ''
                    }`}
                >
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="truncate">
                    {pmsFile ? pmsFile.name : 'Seleccionar archivo PMS'}
                  </span>
                  {pmsFile && (
                    <span className="text-slate-400 text-xs ml-auto flex-shrink-0">
                      ({(pmsFile.size / 1024).toFixed(1)} KB)
                    </span>
                  )}
                </label>

                {/* Botón Procesar PMS */}
                <button
                  onClick={handleUploadPMS}
                  disabled={pmsUploading || !pmsFile}
                  className="px-4 py-2 rounded-lg bg-[#0F2A44] text-white text-sm font-medium disabled:opacity-60 hover:bg-[#1a3f5f] whitespace-nowrap flex-shrink-0"
                >
                  {pmsUploading ? "Procesando..." : "Procesar PMS"}
                </button>

                {/* Botón Generar XML */}
                <button
                  onClick={() => navigate(`/manifiestos/${id}/generar-xml`)}
                  disabled={blCount === 0}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-emerald-700 whitespace-nowrap flex items-center gap-2 flex-shrink-0"
                  title={blCount === 0 ? "No hay BLs para generar XML" : `${blCount} BL(s) listos`}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Generar XML
                  {blCount > 0 && (
                    <span className="bg-white text-emerald-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                      {blCount}
                    </span>
                  )}
                </button>
              </div>

              {/* Mensaje de éxito */}
              {pmsMsg && (
                <div className="mt-3 text-sm text-emerald-700 bg-emerald-50 px-3 py-2 rounded-lg">
                  {pmsMsg}
                </div>
              )}

              {/* Estado de BLs */}
              {blCount > 0 && (
                <div className="mt-3 text-xs text-slate-700 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Este manifiesto tiene <span className="font-semibold">{blCount} BL(s)</span> cargados
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700">
                  Itinerario
                </h2>
                <span className="text-xs text-slate-500">
                  Filas: {itinerario.length}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="text-left px-6 py-3 font-semibold">Orden</th>
                      <th className="text-left px-6 py-3 font-semibold">PORT</th>
                      <th className="text-left px-6 py-3 font-semibold">TYPE</th>
                      <th className="text-left px-6 py-3 font-semibold">ETA</th>
                      <th className="text-left px-6 py-3 font-semibold">ETS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itinerario.map((r, idx) => (
                      <tr key={r.id} className="border-t">
                        <td className="px-6 py-4">{r.orden}</td>
                        <td className="px-6 py-4">{r.port}</td>
                        <td className="px-6 py-4">{r.portType}</td>
                        <td className="px-6 py-4">
                          {!isEditing ? (
                            formatDTCL(r.eta)
                          ) : (
                            <input
                              type="datetime-local"
                              value={r.eta || ""}
                              onChange={(e) =>
                                handleItinerarioChange(idx, "eta", e.target.value)
                              }
                              className="px-2 py-1 border border-slate-300 rounded text-sm"
                            />
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {!isEditing ? (
                            formatDTCL(r.ets)
                          ) : (
                            <input
                              type="datetime-local"
                              value={r.ets || ""}
                              onChange={(e) =>
                                handleItinerarioChange(idx, "ets", e.target.value)
                              }
                              className="px-2 py-1 border border-slate-300 rounded text-sm"
                            />
                          )}
                        </td>
                      </tr>
                    ))}

                    {itinerario.length === 0 && (
                      <tr>
                        <td className="px-6 py-10 text-slate-500" colSpan={5}>
                          No hay itinerario guardado para este manifiesto.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sección de Referencia - DESPUÉS DEL ITINERARIO */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mt-6">
              <div className="mb-4">
                <h2 className="text-sm font-semibold text-slate-700">
                  Referencia del Manifiesto
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Información de la referencia asociada a este manifiesto
                </p>
              </div>

              {!isEditing ? (
                // ✅ MODO LECTURA
                referenciaManifiesto ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
                      <InfoReadOnly
                        label="Número de Referencia"
                        value={m.numeroReferencia || "—"}
                      />
                      <InfoReadOnly
                        label="Emisor / Agencia"
                        value={`${referenciaManifiesto.match_code} - ${referenciaManifiesto.nombre_emisor}`}
                      />
                      <InfoReadOnly
                        label="Fecha de Referencia"
                        value={formatDateCL(m.fechaReferencia)}
                      />
                    </div>

                    <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                      <p className="text-xs font-medium text-slate-700 mb-2">
                        Información completa de la referencia:
                      </p>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600">
                        <div><span className="font-medium">Tipo Referencia:</span> REF</div>
                        <div><span className="font-medium">Tipo Documento:</span> MFTO</div>
                        <div><span className="font-medium">RUT Emisor:</span> {referenciaManifiesto.rut}</div>
                        <div><span className="font-medium">Tipo ID:</span> {referenciaManifiesto.tipo_id_emisor}</div>
                        <div><span className="font-medium">País:</span> {referenciaManifiesto.pais}</div>
                        <div><span className="font-medium">Nacionalidad:</span> {referenciaManifiesto.nacion_id}</div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-slate-500 italic">
                    No hay referencia asociada a este manifiesto
                  </div>
                )
              ) : (
                // 🆕 MODO EDICIÓN
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-4">
                    {/* 🆕 Selector de Referencia */}
                    <div className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-3">
                      <div className="text-xs font-medium text-slate-700">Referencia</div>
                      <select
                        value={formData.referenciaId || ""}
                        onChange={(e) => {
                          const refId = e.target.value;
                          handleInputChange("referenciaId", refId);

                          // Si selecciona una referencia, auto-completar número
                          if (refId) {
                            const ref = referencias.find(r => r.id === parseInt(refId));
                            if (ref) {
                              handleInputChange("numeroReferencia", ref.match_code);
                            }
                          } else {
                            handleInputChange("numeroReferencia", "");
                            handleInputChange("fechaReferencia", "");
                          }
                        }}
                        className="w-full mt-1 px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Sin referencia</option>
                        {referencias.map(r => (
                          <option key={r.id} value={r.id}>
                            {r.match_code} - {r.nombre_emisor}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 🆕 Número de Referencia - SINCRONIZADO */}
                    <div className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-3">
                      <div className="text-xs font-medium text-slate-700">N° Referencia</div>
                      <input
                        type="text"
                        value={formData.numeroReferencia}
                        disabled
                        className="w-full mt-1 px-2 py-1 border border-slate-300 rounded text-sm bg-slate-100 text-slate-500 cursor-not-allowed"
                        placeholder="Se sincroniza con N° Mfto Aduana CL"
                      />
                      <p className="mt-1 text-[10px] text-slate-500">
                        ✓ Sincronizado automáticamente con N° Mfto Aduana CL
                      </p>
                    </div>

                    {/* 🆕 Fecha de Referencia */}
                    <InfoEditableDate
                      label="Fecha Referencia"
                      value={formData.fechaReferencia}
                      onChange={(v) => handleInputChange("fechaReferencia", v)}
                    />
                  </div>

                  {/* Vista previa de la referencia seleccionada */}
                  {formData.referenciaId && (
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-xs font-medium text-blue-800 mb-2">
                        Vista previa de la referencia seleccionada:
                      </p>
                      {(() => {
                        const refSeleccionada = referencias.find(r => r.id === parseInt(formData.referenciaId));
                        return refSeleccionada ? (
                          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-blue-700">
                            <div><span className="font-medium">RUT Emisor:</span> {refSeleccionada.rut}</div>
                            <div><span className="font-medium">Tipo ID:</span> {refSeleccionada.tipo_id_emisor}</div>
                            <div><span className="font-medium">País:</span> {refSeleccionada.pais}</div>
                            <div><span className="font-medium">Nacionalidad:</span> {refSeleccionada.nacion_id}</div>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  )}
                </>
              )}

            </div>
          </>
        )}
      </main>
    </div>
  );
};

const InfoReadOnly = ({ label, value }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
    <div className="text-xs font-medium text-slate-500">{label}</div>
    <div className="text-slate-800 mt-1">{value || "—"}</div>
  </div>
);

const InfoEditable = ({ label, value, onChange }) => (
  <div className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-3">
    <div className="text-xs font-medium text-slate-700">{label}</div>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full mt-1 px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
);

const InfoEditableDate = ({ label, value, onChange }) => (
  <div className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-3">
    <div className="text-xs font-medium text-slate-700">{label}</div>
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full mt-1 px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
);

const InfoEditableSelect = ({ label, value, onChange, options }) => (
  <div className="rounded-xl border border-blue-300 bg-blue-50 px-4 py-3">
    <div className="text-xs font-medium text-slate-700">{label}</div>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full mt-1 px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </div>
);

export default ManifiestoDetalle;