import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import Sidebar from "../components/Sidebar";

const API_BASE_URL = "http://localhost:4000";

const NuevoManifiesto = () => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Catálogos (mantenedores)
  const [servicios, setServicios] = useState([]);
  const [naves, setNaves] = useState([]);
  const [puertos, setPuertos] = useState([]);
  const [referencias, setReferencias] = useState([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);

  // FORM manifiesto
  const [form, setForm] = useState({
    servicio: "",
    nave: "",
    viaje: "",
    puertoCentral: "",
    tipoOperacion: "S",
    operadorNave: "",
    status: "En edición",
    remark: "",
    emisorDocumento: "",
    representante: "",
    fechaManifiestoAduana: "",
    numeroManifiestoAduana: "",
  });

  const todayAtMidnightLocal = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T00:00`;
  };

  const todayDateOnly = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  // ITINERARIO
  const [itinerario, setItinerario] = useState([
    { port: "", portType: "LOAD", eta: todayAtMidnightLocal(), ets: todayAtMidnightLocal() },
  ]);

  // REFERENCIA (simplificada - solo se selecciona el emisor)
  const [referencia, setReferencia] = useState({
    referenciaId: "", // ← ID de la referencia seleccionada
    numeroReferencia: "", // ← Número sincronizado con numeroManifiestoAduana
    fecha: todayDateOnly(),
  });

  // Cargar catálogos
  useEffect(() => {
    const loadCatalogs = async () => {
      setLoadingCatalogs(true);
      setError("");
      try {
        const [sRes, nRes, pRes, rRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/mantenedores/servicios`),
          fetch(`${API_BASE_URL}/api/mantenedores/naves`),
          fetch(`${API_BASE_URL}/api/mantenedores/puertos`),
          fetch(`${API_BASE_URL}/api/mantenedores/referencias`),
        ]);

        if (!sRes.ok) throw new Error(`Error servicios HTTP ${sRes.status}`);
        if (!nRes.ok) throw new Error(`Error naves HTTP ${nRes.status}`);
        if (!pRes.ok) throw new Error(`Error puertos HTTP ${pRes.status}`);
        if (!rRes.ok) throw new Error(`Error referencias HTTP ${rRes.status}`);

        const [sData, nData, pData, rData] = await Promise.all([
          sRes.json(),
          nRes.json(),
          pRes.json(),
          rRes.json(),
        ]);

        setServicios(Array.isArray(sData) ? sData : []);
        setNaves(Array.isArray(nData) ? nData : []);
        setPuertos(Array.isArray(pData) ? pData : []);
        setReferencias(Array.isArray(rData) ? rData : []);

        const hasCLVAP = Array.isArray(pData) && pData.some((x) => x.codigo === "CLVAP");
        setForm((prev) => ({
          ...prev,
          puertoCentral: prev.puertoCentral || (hasCLVAP ? "CLVAP" : ""),
        }));
      } catch (e) {
        setError(e?.message || "Error cargando mantenedores");
      } finally {
        setLoadingCatalogs(false);
      }
    };

    loadCatalogs();
  }, []);

  // Sincronizar número de referencia con número de manifiesto de aduana
  useEffect(() => {
    if (form.numeroManifiestoAduana.trim()) {
      setReferencia(prev => ({ 
        ...prev, 
        numeroReferencia: form.numeroManifiestoAduana 
      }));
    }
  }, [form.numeroManifiestoAduana]);

  const onChange = (key) => (e) => {
    const value = e.target.value;
    
    // Si se selecciona Representante, autocompletar Emisor Doc
    if (key === "representante" && value) {
      const refSeleccionada = referencias.find(r => r.match_code === value);
      if (refSeleccionada) {
        setForm((prev) => ({ 
          ...prev, 
          [key]: value,
          emisorDocumento: refSeleccionada.customer_id 
        }));
        return;
      }
    }
    
    // Si se selecciona Emisor Doc, autocompletar Representante
    if (key === "emisorDocumento" && value) {
      const refSeleccionada = referencias.find(r => r.customer_id === value);
      if (refSeleccionada) {
        setForm((prev) => ({ 
          ...prev, 
          [key]: value,
          representante: refSeleccionada.match_code 
        }));
        return;
      }
    }
    
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // Itinerario helpers
  const addItinerarioRow = () =>
    setItinerario((prev) => [
      ...prev,
      { port: "", portType: "LOAD", eta: todayAtMidnightLocal(), ets: todayAtMidnightLocal() },
    ]);

  const removeItinerarioRow = (idx) =>
    setItinerario((prev) => prev.filter((_, i) => i !== idx));

  const updateItinerarioRow = (idx, key, value) =>
    setItinerario((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));

  // Referencia helper
  const updateReferencia = (key, value) =>
    setReferencia((prev) => ({ ...prev, [key]: value }));

  // Obtener datos de la referencia seleccionada
  const referenciaSeleccionada = useMemo(() => {
    return referencias.find(r => r.id === parseInt(referencia.referenciaId));
  }, [referencias, referencia.referenciaId]);

  // Obtener datos del emisor seleccionado
  const emisorSeleccionado = useMemo(() => {
    return referencias.find(r => r.customer_id === form.emisorDocumento);
  }, [referencias, form.emisorDocumento]);

  // Obtener datos del representante seleccionado
  const representanteSeleccionado = useMemo(() => {
    return referencias.find(r => r.match_code === form.representante);
  }, [referencias, form.representante]);

  // Validaciones
  const getMissingFields = () => {
    const missing = [];

    if (!form.servicio.trim()) missing.push("Servicio");
    if (!form.nave.trim()) missing.push("Nave");
    if (!form.viaje.trim()) missing.push("Viaje");
    if (!form.puertoCentral.trim()) missing.push("Puerto central");
    if (!form.tipoOperacion) missing.push("Tipo de operación");
    if (!form.operadorNave.trim()) missing.push("Operador Nave");
    if (!form.emisorDocumento.trim()) missing.push("Emisor Doc");
    if (!form.representante.trim()) missing.push("Representante");
    if (!form.fechaManifiestoAduana) missing.push("Fecha Mfto Aduana CL");
    if (!form.numeroManifiestoAduana.trim()) missing.push("Nro Mfto Aduana CL");

    // Referencia es obligatoria
    if (!referencia.referenciaId) missing.push("Referencia: Emisor");

    return missing;
  };

  const hasAtLeastOnePort = useMemo(
    () => itinerario.some((r) => r.port?.trim()),
    [itinerario]
  );

  // Resumen para confirmación
  const buildSummary = () => {
    const servicioObj = servicios.find((s) => s.codigo === form.servicio);
    const naveObj = naves.find((n) => n.codigo === form.nave);
    const puertoCentralObj = puertos.find((p) => p.codigo === form.puertoCentral);

    const puertosItinerario = itinerario
      .filter((r) => r.port.trim())
      .map((r) => {
        const puerto = puertos.find((p) => p.codigo === r.port);
        return `${r.port}${puerto ? ` (${puerto.nombre})` : ""} - ${r.portType}`;
      })
      .join("<br>");

    const referenciaHtml = referenciaSeleccionada 
      ? `<span style="display:block; padding: 4px 0; border-bottom: 1px solid #e2e8f0;">
          <strong>REF / MFTO</strong> &nbsp;
          N°: ${referencia.numeroReferencia} &nbsp;
          Fecha: ${referencia.fecha} &nbsp;
          Emisor: ${referenciaSeleccionada.nombre_emisor} &nbsp;
          RUT: ${referenciaSeleccionada.rut}
        </span>`
      : '<span style="color: #ef4444;">No seleccionada</span>';

    const emisorHtml = emisorSeleccionado
      ? `${form.emisorDocumento} (${emisorSeleccionado.nombre_emisor})`
      : form.emisorDocumento;

    const representanteHtml = representanteSeleccionado
      ? `${form.representante} (${representanteSeleccionado.nombre_emisor})`
      : form.representante;

    return `
      <div style="text-align: left; font-size: 14px;">
        <p><strong>Servicio:</strong> ${form.servicio}${servicioObj ? ` - ${servicioObj.nombre}` : ""}</p>
        <p><strong>Nave:</strong> ${form.nave}${naveObj ? ` - ${naveObj.nombre}` : ""}</p>
        <p><strong>Viaje:</strong> ${form.viaje}</p>
        <p><strong>Puerto Central:</strong> ${form.puertoCentral}${puertoCentralObj ? ` - ${puertoCentralObj.nombre}` : ""}</p>
        <p><strong>Operación:</strong> ${form.tipoOperacion}</p>
        <p><strong>Operador Nave:</strong> ${form.operadorNave}</p>
        <p><strong>Emisor Documento:</strong> ${emisorHtml}</p>
        <p><strong>Representante:</strong> ${representanteHtml}</p>
        <p><strong>Fecha Mfto Aduana:</strong> ${form.fechaManifiestoAduana}</p>
        <p><strong>N° Mfto Aduana:</strong> ${form.numeroManifiestoAduana}</p>
        <hr style="margin: 12px 0; border: none; border-top: 1px solid #e2e8f0;">
        <p><strong>Puertos en itinerario:</strong></p>
        <div style="padding-left: 12px; font-size: 13px;">${puertosItinerario || "Ninguno"}</div>
        <hr style="margin: 12px 0; border: none; border-top: 1px solid #e2e8f0;">
        <p><strong>Referencia:</strong></p>
        <div style="padding-left: 12px; font-size: 13px;">${referenciaHtml}</div>
      </div>
    `;
  };

  // Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const missingFields = getMissingFields();
    if (missingFields.length > 0) {
      await Swal.fire({
        title: "Campos obligatorios faltantes",
        html: `
          <p style="margin-bottom: 12px;">Por favor completa los siguientes campos antes de continuar:</p>
          <ul style="text-align: left; padding-left: 24px; color: #dc2626;">
            ${missingFields.map((field) => `<li><strong>${field}</strong></li>`).join("")}
          </ul>
        `,
        icon: "warning",
        confirmButtonColor: "#0F2A44",
        confirmButtonText: "Entendido",
      });
      return;
    }

    if (!hasAtLeastOnePort) {
      await Swal.fire({
        title: "Itinerario vacío",
        text: "Debes agregar al menos un puerto en el itinerario.",
        icon: "warning",
        confirmButtonColor: "#0F2A44",
        confirmButtonText: "Entendido",
      });
      return;
    }

    const result = await Swal.fire({
      title: "Revisar información del manifiesto",
      html: `
        <div style="margin-bottom: 16px;">
          <p style="color: #64748b; margin-bottom: 12px;">
            Por favor verifica que toda la información sea correcta antes de crear el manifiesto:
          </p>
          ${buildSummary()}
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#10b981",
      cancelButtonColor: "#eb4e4eff",
      confirmButtonText: "Sí, crear manifiesto",
      cancelButtonText: "Cancelar",
      width: "600px",
      customClass: {
        htmlContainer: "swal-summary-container",
      },
    });

    if (!result.isConfirmed) return;

    try {
      setSaving(true);

      const res = await fetch(`${API_BASE_URL}/manifiestos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          referenciaId: parseInt(referencia.referenciaId),
          numeroReferencia: referencia.numeroReferencia,
          fechaReferencia: referencia.fecha,
          itinerario: itinerario
            .filter((r) => r.port.trim())
            .map((r, i) => ({
              port: r.port.trim(),
              portType: r.portType,
              eta: r.eta || null,
              ets: r.ets || null,
              orden: i + 1,
            })),
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }

      const data = await res.json();

      const successResult = await Swal.fire({
        title: "¡Manifiesto creado!",
        html: `
          <p>El manifiesto se ha creado correctamente.</p>
          <p style="margin-top: 8px; color: #64748b; font-size: 14px;">
            ID del manifiesto: <strong>#${data.id}</strong>
          </p>
        `,
        icon: "success",
        confirmButtonColor: "#0F2A44",
        showCancelButton: true,
        confirmButtonText: "Ver manifiesto",
        cancelButtonText: "Volver a lista",
      });

      if (successResult.isConfirmed) {
        navigate(`/manifiestos/${data.id}`);
      } else {
        navigate("/manifiestos");
      }
    } catch (err) {
      await Swal.fire({
        title: "Error al crear manifiesto",
        text: err?.message || "No se pudo guardar el manifiesto. Por favor intenta nuevamente.",
        icon: "error",
        confirmButtonColor: "#0F2A44",
      });
      setError(err?.message || "Error al guardar el manifiesto.");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const hasData =
      form.servicio ||
      form.nave ||
      form.viaje ||
      form.operadorNave ||
      form.numeroManifiestoAduana;

    const handleBeforeUnload = (e) => {
      if (hasData && !saving) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [form, saving]);

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-10">
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-[#0F2A44]">
              Crear manifiesto (SGA)
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Completa el contexto antes de cargar el PMS.
            </p>
          </div>

          <button
            onClick={() => navigate("/manifiestos")}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50"
          >
            ← Volver
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loadingCatalogs && (
          <div className="mb-4 text-sm text-slate-600">
            Cargando servicios, naves, puertos y referencias...
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8"
        >
          {/* DATALISTS */}
          <datalist id="serviciosList">
            {servicios.map((s) => (
              <option key={s.id} value={s.codigo}>
                {s.codigo} — {s.nombre}
              </option>
            ))}
          </datalist>

          <datalist id="navesList">
            {naves.map((n) => (
              <option key={n.id} value={n.codigo}>
                {n.codigo} — {n.nombre}
              </option>
            ))}
          </datalist>

          <datalist id="puertosList">
            {puertos.map((p) => (
              <option key={p.id} value={p.codigo}>
                {p.codigo} — {p.nombre}
              </option>
            ))}
          </datalist>

          {/* ── CAMPOS PRINCIPALES ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field label="Servicio *">
              <input
                list="serviciosList"
                value={form.servicio}
                onChange={onChange("servicio")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Escribe para buscar (ej: WSACL)"
              />
              <Hint text="Tip: escribe el código (WSACL) y te sugiere el nombre." />
            </Field>

            <Field label="Operación *">
              <select
                value={form.tipoOperacion}
                onChange={onChange("tipoOperacion")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="S">S (Salida/Exportación)</option>
                <option value="I">I (Ingreso/Importación)</option>
                <option value="TR">TR (Tránsito)</option>
                <option value="TRB">TRB (Transbordo)</option>
              </select>
            </Field>

            <Field label="Nave *">
              <input
                list="navesList"
                value={form.nave}
                onChange={onChange("nave")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Escribe para buscar (ej: EVLOY)"
              />
            </Field>

            <Field label="Viaje *">
              <input
                value={form.viaje}
                onChange={onChange("viaje")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Ej: 028W"
              />
            </Field>

            <Field label="Puerto central *">
              <input
                list="puertosList"
                value={form.puertoCentral}
                onChange={onChange("puertoCentral")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Escribe para buscar (ej: CLVAP)"
              />
            </Field>

            <Field label="Operador Nave (Customer ID) *">
              <input
                list="operadorNaveList"
                value={form.operadorNave}
                onChange={onChange("operadorNave")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Selecciona o escribe (ej: 060321)"
              />
              <datalist id="operadorNaveList">
                {referencias.map((ref) => (
                  <option key={ref.id} value={ref.customer_id}>
                    {ref.customer_id} — {ref.nombre_emisor}
                  </option>
                ))}
              </datalist>
              {referencias.find(r => r.customer_id === form.operadorNave) && (
                <Hint text={`${referencias.find(r => r.customer_id === form.operadorNave).nombre_emisor}`} />
              )}
            </Field>

            <Field label="Emisor Doc (Customer ID) *">
              <select
                value={form.emisorDocumento}
                onChange={onChange("emisorDocumento")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="">-- Selecciona un emisor --</option>
                {referencias.map((ref) => (
                  <option key={ref.id} value={ref.customer_id}>
                    {ref.customer_id}
                  </option>
                ))}
              </select>
              {emisorSeleccionado && (
                <Hint text={`${emisorSeleccionado.nombre_emisor} | Match: ${emisorSeleccionado.match_code} | RUT: ${emisorSeleccionado.rut}`} />
              )}
            </Field>

            <Field label="Representante *">
              <select
                value={form.representante}
                onChange={onChange("representante")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="">-- Selecciona un representante --</option>
                {referencias.map((ref) => (
                  <option key={ref.id} value={ref.match_code}>
                    {ref.match_code} - {ref.nombre_emisor}
                  </option>
                ))}
              </select>
              {representanteSeleccionado && (
                <Hint text={`Customer ID: ${representanteSeleccionado.customer_id} | RUT: ${representanteSeleccionado.rut}`} />
              )}
            </Field>

            <Field label="Fecha Mfto Aduana CL *">
              <input
                type="date"
                value={form.fechaManifiestoAduana}
                onChange={onChange("fechaManifiestoAduana")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              />
            </Field>

            <Field label="Nro Mfto Aduana CL *">
              <input
                value={form.numeroManifiestoAduana}
                onChange={onChange("numeroManifiestoAduana")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Ej: 261001"
              />
            </Field>

            <Field label="Status *">
              <select
                value={form.status}
                onChange={onChange("status")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option>En edición</option>
                <option>En revisión</option>
                <option>Enviado a Aduana</option>
                <option>Cerrado</option>
              </select>
            </Field>

            <Field label="Remark">
              <textarea
                value={form.remark}
                onChange={onChange("remark")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm min-h-[42px]"
                placeholder="Observaciones (opcional)"
              />
            </Field>
          </div>

          {/* ── ITINERARIO ── */}
          <div className="mt-10">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-700">
                Itinerario (Puertos)
              </h2>
              <button
                type="button"
                onClick={addItinerarioRow}
                className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50"
              >
                + Agregar puerto
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">PORT</th>
                    <th className="text-left px-4 py-3 font-semibold">PORT TYPE</th>
                    <th className="text-left px-4 py-3 font-semibold">ETA</th>
                    <th className="text-left px-4 py-3 font-semibold">ETS</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>

                <tbody>
                  {itinerario.map((row, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="px-4 py-2">
                        <input
                          list="puertosList"
                          value={row.port}
                          onChange={(e) => updateItinerarioRow(idx, "port", e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          placeholder="Escribe código (ej: CLVAP)"
                        />
                      </td>

                      <td className="px-4 py-2">
                        <select
                          value={row.portType}
                          onChange={(e) => updateItinerarioRow(idx, "portType", e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                        >
                          <option value="LOAD">LOAD</option>
                          <option value="DISCHARGE">DISCHARGE</option>
                        </select>
                      </td>

                      <td className="px-4 py-2">
                        <input
                          type="datetime-local"
                          value={row.eta}
                          onChange={(e) => updateItinerarioRow(idx, "eta", e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                        />
                      </td>

                      <td className="px-4 py-2">
                        <input
                          type="datetime-local"
                          value={row.ets}
                          onChange={(e) => updateItinerarioRow(idx, "ets", e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                        />
                      </td>

                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeItinerarioRow(idx)}
                          disabled={itinerario.length === 1}
                          className="px-3 py-2 rounded-lg text-xs font-medium border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50"
                          title="Eliminar fila"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-slate-500 mt-2">
              Puedes escribir para filtrar. ETA/ETS pueden quedar vacíos.
            </p>
          </div>

          {/* ── REFERENCIA (simplificada) ── */}
          <div className="mt-10">
            <div className="mb-3">
              <h2 className="text-sm font-semibold text-slate-700">
                Referencia del Manifiesto
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                El número de referencia se sincroniza automáticamente con el N° de Manifiesto Aduana CL.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Field label="Número de Referencia">
                <input
                  value={referencia.numeroReferencia}
                  disabled
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-slate-50 text-slate-500"
                  placeholder="Se genera automáticamente"
                />
                <Hint text="Sincronizado con N° Mfto Aduana CL" />
              </Field>

              <Field label="Emisor / Agencia *">
                <select
                  value={referencia.referenciaId}
                  onChange={(e) => updateReferencia("referenciaId", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="">-- Selecciona un emisor --</option>
                  {referencias.map((ref) => (
                    <option key={ref.id} value={ref.id}>
                      {ref.match_code} - {ref.nombre_emisor}
                    </option>
                  ))}
                </select>
                {referenciaSeleccionada && (
                  <Hint text={`RUT: ${referenciaSeleccionada.rut}`} />
                )}
              </Field>

              <Field label="Fecha de Referencia">
                <input
                  type="date"
                  value={referencia.fecha}
                  onChange={(e) => updateReferencia("fecha", e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                />
              </Field>
            </div>

            {referenciaSeleccionada && (
              <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-xs font-medium text-slate-700 mb-2">
                  Información completa de la referencia:
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-slate-600">
                  <div><span className="font-medium">Tipo Referencia:</span> REF</div>
                  <div><span className="font-medium">Tipo Documento:</span> MFTO</div>
                  <div><span className="font-medium">RUT Emisor:</span> {referenciaSeleccionada.rut}</div>
                  <div><span className="font-medium">Tipo ID:</span> {referenciaSeleccionada.tipo_id_emisor}</div>
                  <div><span className="font-medium">País:</span> {referenciaSeleccionada.pais}</div>
                  <div><span className="font-medium">Nacionalidad:</span> {referenciaSeleccionada.nacion_id}</div>
                </div>
              </div>
            )}
          </div>

          {/* ── FOOTER ── */}
          <div className="mt-8 flex items-center justify-between">
            <p className="text-xs text-slate-500">(*) Campos obligatorios</p>

            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-lg bg-[#0F2A44] text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Guardando..." : "Guardar manifiesto"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};

const Field = ({ label, children }) => (
  <div>
    <label className="block text-xs font-medium text-slate-600 mb-2">{label}</label>
    {children}
  </div>
);

const Hint = ({ text }) => (
  <p className="mt-1 text-[11px] text-slate-500">{text}</p>
);

export default NuevoManifiesto;