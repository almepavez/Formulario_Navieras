import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
    servicio: "", // codigo servicio (ej: WSACL)
    nave: "", // codigo nave (ej: EVLOY)
    viaje: "",
    puertoCentral: "", // codigo puerto (ej: CLVAP)
    tipoOperacion: "EX", // EX | IM | CROSS
    operadorNave: "",
    status: "En edición",
    remark: "",
    emisorDocumento: "",
    representante: "AJBROOM",
    fechaManifiestoAduana: "", // YYYY-MM-DD
    numeroManifiestoAduana: "",
  });

  const todayAtMidnightLocal = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0); // 00:00 local
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T00:00`;
  };


  // ITINERARIO (filas dinámicas) -> port = codigo puerto
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

        // set default puerto central si existe CLVAP
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

  // Validación simple
  const requiredMissing =
    !form.servicio ||
    !form.nave ||
    !form.viaje ||
    !form.puertoCentral ||
    !form.tipoOperacion ||
    !form.operadorNave ||
    !form.emisorDocumento ||
    !form.representante ||
    !form.fechaManifiestoAduana ||
    !form.numeroManifiestoAduana;

  const hasAtLeastOnePort = useMemo(
    () => itinerario.some((r) => r.port?.trim()),
    [itinerario]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (requiredMissing) {
      setError("Completa todos los campos obligatorios (*) antes de guardar.");
      return;
    }

    if (!hasAtLeastOnePort) {
      setError("Agrega al menos un puerto en el itinerario.");
      return;
    }

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
              port: r.port.trim(), // codigo puerto
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

      navigate("/manifiestos");
    } catch (err) {
      setError(err?.message || "Error al guardar el manifiesto.");
    } finally {
      setSaving(false);
    }
  };

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
          {/* DATALISTS (sugerencias filtrables) */}
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
