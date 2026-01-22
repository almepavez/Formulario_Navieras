import { useEffect, useState } from "react";
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

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    operadorNave: "",
    status: "",
    remark: "",
    emisorDocumento: "",
    representante: "",
    fechaManifiestoAduana: "",
    numeroManifiestoAduana: "",
  });

  const [itinerario, setItinerario] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [pmsFile, setPmsFile] = useState(null);
  const [pmsUploading, setPmsUploading] = useState(false);
  const [pmsMsg, setPmsMsg] = useState("");
  const [pmsInfo, setPmsInfo] = useState(null);
  const [processingPMS, setProcessingPMS] = useState(false);

  const fetchDetalle = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/manifiestos/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);

      const m = json.manifiesto;
      setFormData({
        operadorNave: m.operadorNave || "",
        status: m.status || "",
        remark: m.remark || "",
        emisorDocumento: m.emisorDocumento || "",
        representante: m.representante || "",
        fechaManifiestoAduana: toInputDate(m.fechaManifiestoAduana),
        numeroManifiestoAduana: m.numeroManifiestoAduana || "",
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
      setError(e?.message || "Error cargando manifiesto");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchPMS = async () => {
    try {
      const res = await fetch(`${API_BASE}/manifiestos/${id}/pms`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setPmsInfo(json);
    } catch {
      setPmsInfo(null);
    }
  };

  useEffect(() => {
    fetchDetalle();
    fetchPMS();
  }, [id]);

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

    const formData = new FormData();
    formData.append("pms", pmsFile);

    try {
      setPmsUploading(true);

      const res = await fetch(`${API_BASE}/manifiestos/${id}/pms`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `HTTP ${res.status}`);
      }

      await Swal.fire({
        title: "¡PMS cargado!",
        text: "El archivo se ha subido correctamente",
        icon: "success",
        confirmButtonColor: "#10b981",
        timer: 2000,
      });

      setPmsFile(null);
      await fetchPMS();
    } catch (e) {
      setPmsMsg("");
      setError(e?.message || "Error subiendo PMS");
    } finally {
      setPmsUploading(false);
    }
  };

  // 📍 INSERTAR AQUÍ (línea ~355, después de handleUploadPMS y ANTES de handleProcessPMS)

  const handleDeletePMS = async () => {
    const result = await Swal.fire({
      title: "¿Eliminar PMS?",
      text: "Se eliminará el archivo PMS cargado. Podrás subir uno nuevo.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#e43a3aff",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`${API_BASE}/manifiestos/${id}/pms`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `HTTP ${res.status}`);
      }

      await Swal.fire({
        title: "¡PMS eliminado!",
        text: "Ahora puedes subir un nuevo archivo",
        icon: "success",
        confirmButtonColor: "#10b981",
        timer: 2000,
      });

      setPmsInfo(null);
      setPmsFile(null);
    } catch (e) {
      Swal.fire({
        title: "Error",
        text: e?.message || "No se pudo eliminar el PMS",
        icon: "error",
        confirmButtonColor: "#10b981",
      });
    }
  };

  const handleProcessPMS = async () => {
    const result = await Swal.fire({
      title: "¿Procesar PMS?",
      text: "Se crearán los BLs desde el archivo PMS. Los BLs anteriores serán eliminados.",
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#10b981",
      cancelButtonColor: "#e43a3aff",
      confirmButtonText: "Sí, procesar",
      cancelButtonText: "Cancelar",
    });

    if (!result.isConfirmed) return;

    try {
      setProcessingPMS(true);
      setError("");

      const res = await fetch(`${API_BASE}/manifiestos/${id}/pms/procesar`, {
        method: "POST",
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `HTTP ${res.status}`);
      }

      const data = await res.json();

      await Swal.fire({
        title: "¡PMS procesado!",
        html: `Se crearon <strong>${data.inserted}</strong> BL(s) correctamente`,
        icon: "success",
        confirmButtonColor: "#10b981",
        timer: 3000,
      });
    } catch (e) {
      Swal.fire({
        title: "Error al procesar PMS",
        text: e?.message || "No se pudo procesar el PMS",
        icon: "error",
        confirmButtonColor: "#10b981",
      });
      setError(e?.message || "Error procesando PMS");
    } finally {
      setProcessingPMS(false);
    }
  };

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
            </div>
          </div>
        </div>

        {isEditing && hasUnsavedChanges && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
            <span className="text-lg">⚠️</span>
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
                    <InfoReadOnly label="Operador nave" value={m.operadorNave} />
                    <InfoReadOnly label="Emisor doc" value={m.emisorDocumento} />
                    <InfoReadOnly label="Representante" value={m.representante} />
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
                    <InfoEditable
                      label="Operador nave"
                      value={formData.operadorNave}
                      onChange={(v) => handleInputChange("operadorNave", v)}
                    />
                    <InfoEditable
                      label="Emisor doc"
                      value={formData.emisorDocumento}
                      onChange={(v) => handleInputChange("emisorDocumento", v)}
                    />
                    <InfoEditable
                      label="Representante"
                      value={formData.representante}
                      onChange={(v) => handleInputChange("representante", v)}
                    />
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

            {/* Carga PMS */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-700">
                    Carga y procesamiento de PMS
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Selecciona el archivo PMS y procésalo para crear los BLs.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {!pmsInfo ? (
                    <button
                      onClick={handleUploadPMS}
                      disabled={pmsUploading || !pmsFile}
                      className="px-4 py-2 rounded-lg bg-[#0F2A44] text-white text-sm font-medium disabled:opacity-60 hover:bg-[#1a3f5f]"
                    >
                      {pmsUploading ? "Subiendo..." : "Subir archivo"}
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleProcessPMS}
                        disabled={processingPMS}
                        className="px-4 py-2 rounded-lg bg-[#0F2A44] text-white text-sm font-medium disabled:opacity-60 hover:bg-[#1a3f5f]"
                      >
                        {processingPMS ? "Procesando..." : "Procesar PMS"}
                      </button>
                      <button
                        onClick={handleDeletePMS}
                        className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
                      >
                        Eliminar PMS
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept=".xml,.txt,.csv,.pms"
                  onChange={(e) => setPmsFile(e.target.files?.[0] || null)}
                  className="text-sm"
                />
                {pmsFile && !pmsInfo && (
                  <span className="text-xs text-slate-600">
                    Seleccionado: <span className="font-medium">{pmsFile.name}</span>
                  </span>
                )}
              </div>

              {pmsInfo && (
                <div className="mt-3 text-xs text-slate-600">
                  <div className="bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200">
                    <div className="font-medium text-emerald-700">
                      Archivo cargado: {pmsInfo.nombreOriginal}
                    </div>
                    <div className="text-emerald-600 mt-1">
                      Fecha: {formatDTCL(pmsInfo.createdAt)}
                    </div>
                  </div>
                </div>
              )}

              {pmsMsg && (
                <div className="mt-3 text-sm text-emerald-700">{pmsMsg}</div>
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