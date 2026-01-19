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
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);

  // FORM manifiesto (guardamos CÓDIGOS)
  const [form, setForm] = useState({
    servicio: "",
    nave: "",
    viaje: "",
    puertoCentral: "",
    tipoOperacion: "EX",
    operadorNave: "",
    status: "En edición",
    remark: "",
    emisorDocumento: "",
    representante: "AJBROOM",
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

  // ITINERARIO (filas dinámicas)
  const [itinerario, setItinerario] = useState([
    { port: "", portType: "LOAD", eta: todayAtMidnightLocal(), ets: todayAtMidnightLocal() },
  ]);

  // Cargar catálogos
  useEffect(() => {
    const loadCatalogs = async () => {
      setLoadingCatalogs(true);
      setError("");
      try {
        const [sRes, nRes, pRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/mantenedores/servicios`),
          fetch(`${API_BASE_URL}/api/mantenedores/naves`),
          fetch(`${API_BASE_URL}/api/mantenedores/puertos`),
        ]);

        if (!sRes.ok) throw new Error(`Error servicios HTTP ${sRes.status}`);
        if (!nRes.ok) throw new Error(`Error naves HTTP ${nRes.status}`);
        if (!pRes.ok) throw new Error(`Error puertos HTTP ${pRes.status}`);

        const [sData, nData, pData] = await Promise.all([
          sRes.json(),
          nRes.json(),
          pRes.json(),
        ]);

        setServicios(Array.isArray(sData) ? sData : []);
        setNaves(Array.isArray(nData) ? nData : []);
        setPuertos(Array.isArray(pData) ? pData : []);

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

  const onChange = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const addRow = () =>
    setItinerario((prev) => [
      ...prev,
      { port: "", portType: "LOAD", eta: todayAtMidnightLocal(), ets: todayAtMidnightLocal() },
    ]);

  const removeRow = (idx) =>
    setItinerario((prev) => prev.filter((_, i) => i !== idx));

  const updateRow = (idx, key, value) =>
    setItinerario((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));

  // 🆕 Función para validar campos obligatorios y obtener lista de faltantes
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

    return missing;
  };

  const hasAtLeastOnePort = useMemo(
    () => itinerario.some((r) => r.port?.trim()),
    [itinerario]
  );

  // 🆕 Construir resumen del manifiesto para mostrar en confirmación
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

    return `
      <div style="text-align: left; font-size: 14px;">
        <p><strong>Servicio:</strong> ${form.servicio}${servicioObj ? ` - ${servicioObj.nombre}` : ""}</p>
        <p><strong>Nave:</strong> ${form.nave}${naveObj ? ` - ${naveObj.nombre}` : ""}</p>
        <p><strong>Viaje:</strong> ${form.viaje}</p>
        <p><strong>Puerto Central:</strong> ${form.puertoCentral}${puertoCentralObj ? ` - ${puertoCentralObj.nombre}` : ""}</p>
        <p><strong>Operación:</strong> ${form.tipoOperacion}</p>
        <p><strong>Operador Nave:</strong> ${form.operadorNave}</p>
        <p><strong>Fecha Mfto Aduana:</strong> ${form.fechaManifiestoAduana}</p>
        <p><strong>N° Mfto Aduana:</strong> ${form.numeroManifiestoAduana}</p>
        <hr style="margin: 12px 0; border: none; border-top: 1px solid #e2e8f0;">
        <p><strong>Puertos en itinerario:</strong></p>
        <div style="padding-left: 12px; font-size: 13px;">${puertosItinerario || "Ninguno"}</div>
      </div>
    `;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // 🆕 PASO 1: Validar campos obligatorios
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

    // 🆕 PASO 2: Validar que haya al menos un puerto en itinerario
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

    // 🆕 PASO 3: Mostrar confirmación con resumen
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

    // 🆕 PASO 4: Proceder con la creación
    try {
      setSaving(true);

      const res = await fetch(`${API_BASE_URL}/manifiestos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
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

      // 🆕 Mostrar éxito con opción de ir al manifiesto creado
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

      // Navegar según la opción elegida
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

  // 🆕 Protección al salir sin guardar (opcional)
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
            Cargando servicios, naves y puertos...
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

            <Field label="Operación (EX/IM/CROSS) *">
              <select
                value={form.tipoOperacion}
                onChange={onChange("tipoOperacion")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="EX">EX</option>
                <option value="IM">IM</option>
                <option value="CROSS">CROSS</option>
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

            <Field label="Operador Nave (código) *">
              <input
                value={form.operadorNave}
                onChange={onChange("operadorNave")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Ej: 006011"
              />
            </Field>

            <Field label="Emisor Doc (código) *">
              <input
                value={form.emisorDocumento}
                onChange={onChange("emisorDocumento")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Ej: 000001"
              />
            </Field>

            <Field label="Representante *">
              <input
                value={form.representante}
                onChange={onChange("representante")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Ej: AJBROOM"
              />
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

          {/* ITINERARIO */}
          <div className="mt-10">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-700">
                Itinerario (Puertos)
              </h2>
              <button
                type="button"
                onClick={addRow}
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
                          onChange={(e) => updateRow(idx, "port", e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          placeholder="Escribe código (ej: CLVAP)"
                        />
                      </td>

                      <td className="px-4 py-2">
                        <select
                          value={row.portType}
                          onChange={(e) => updateRow(idx, "portType", e.target.value)}
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
                          onChange={(e) => updateRow(idx, "eta", e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                        />
                      </td>

                      <td className="px-4 py-2">
                        <input
                          type="datetime-local"
                          value={row.ets}
                          onChange={(e) => updateRow(idx, "ets", e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                        />
                      </td>

                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeRow(idx)}
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