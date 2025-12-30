import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";

const NuevoManifiesto = () => {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // FORM manifiesto
  const [form, setForm] = useState({
    servicio: "",
    nave: "",
    viaje: "",
    puertoCentral: "Valparaíso",
    tipoOperacion: "EX", // EX | IM | CROSS
    operadorNave: "",
    status: "En edición",
    remark: "",
    emisorDocumento: "",
    representante: "AJBROOM",
    fechaManifiestoAduana: "", // YYYY-MM-DD
    numeroManifiestoAduana: "",
  });

  // ITINERARIO (filas dinámicas)
  const [itinerario, setItinerario] = useState([
    { port: "", portType: "LOAD", eta: "", ets: "" }, // eta/ets = datetime-local (string)
  ]);

  const onChange = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const addRow = () =>
    setItinerario((prev) => [
      ...prev,
      { port: "", portType: "LOAD", eta: "", ets: "" },
    ]);

  const removeRow = (idx) =>
    setItinerario((prev) => prev.filter((_, i) => i !== idx));

  const updateRow = (idx, key, value) =>
    setItinerario((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r))
    );

  // Validación simple: campos principales obligatorios
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

  // Guardar (por ahora manda también "itinerario" al backend)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (requiredMissing) {
      setError("Completa todos los campos obligatorios (*) antes de guardar.");
      return;
    }

    // Si quieres, exigir al menos 1 puerto con nombre:
    const hasAtLeastOnePort = itinerario.some((r) => r.port?.trim());
    if (!hasAtLeastOnePort) {
      setError("Agrega al menos un puerto en el itinerario.");
      return;
    }

    try {
      setSaving(true);

      // ⚠️ Esto requiere que exista POST /manifiestos en tu API.
      const res = await fetch("http://localhost:4000/manifiestos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          itinerario: itinerario
            .filter((r) => r.port.trim())
            .map((r, i) => ({
              port: r.port.trim(),
              portType: r.portType, // LOAD | DISCHARGE
              eta: r.eta || null,   // "YYYY-MM-DDTHH:mm" o null
              ets: r.ets || null,
              orden: i + 1,
            })),
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `HTTP ${res.status}`);
      }

      // const created = await res.json();
      // navigate(`/manifiestos/${created.id}`);
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

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field label="Servicio *">
              <input
                value={form.servicio}
                onChange={onChange("servicio")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Ej: EVERGREEN"
              />
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
                value={form.nave}
                onChange={onChange("nave")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Ej: EVER FEAT"
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
                value={form.puertoCentral}
                onChange={onChange("puertoCentral")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Ej: Valparaíso"
              />
            </Field>

            <Field label="Operador Nave (código) *">
              <input
                value={form.operadorNave}
                onChange={onChange("operadorNave")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Ej: OP123"
              />
            </Field>

            <Field label="Emisor Doc (código) *">
              <input
                value={form.emisorDocumento}
                onChange={onChange("emisorDocumento")}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                placeholder="Ej: EMI456"
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
                placeholder="Ej: MFT-889922"
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
                          value={row.port}
                          onChange={(e) => updateRow(idx, "port", e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          placeholder="Ej: Valparaíso"
                        />
                      </td>

                      <td className="px-4 py-2">
                        <select
                          value={row.portType}
                          onChange={(e) =>
                            updateRow(idx, "portType", e.target.value)
                          }
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
              Puedes agregar, editar o eliminar filas. ETA/ETS pueden quedar vacíos.
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
    <label className="block text-xs font-medium text-slate-600 mb-2">
      {label}
    </label>
    {children}
  </div>
);

export default NuevoManifiesto;
