import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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

const API_BASE = "http://localhost:4000";

const ManifiestoDetalle = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  // PMS upload
  const [pmsFile, setPmsFile] = useState(null);
  const [pmsUploading, setPmsUploading] = useState(false);
  const [pmsMsg, setPmsMsg] = useState("");

  // ✅ PMS info (para mostrar si ya hay PMS cargado)
  const [pmsInfo, setPmsInfo] = useState(null);

  const fetchDetalle = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/manifiestos/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
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
      setPmsInfo(json); // puede ser null
    } catch {
      setPmsInfo(null);
    }
  };

  useEffect(() => {
    fetchDetalle();
    fetchPMS();
  }, [id]);

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

      setPmsMsg("PMS cargado OK ✅");
      setPmsFile(null);

      // ✅ refrescar estado PMS para que muestre el nombre/fecha
      await fetchPMS();
    } catch (e) {
      setPmsMsg("");
      setError(e?.message || "Error subiendo PMS");
    } finally {
      setPmsUploading(false);
    }
  };

  const m = data?.manifiesto;
  const it = data?.itinerario ?? [];

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-10">
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-[#0F2A44]">
              Manifiesto #{id}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Detalle del manifiesto y su itinerario
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/manifiestos")}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50"
            >
              ← Volver
            </button>

            <button
              onClick={() => {
                fetchDetalle();
                fetchPMS();
              }}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50"
            >
              Actualizar
            </button>
          </div>
        </div>

        {loading && <div className="text-sm text-slate-600">Cargando...</div>}

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Error: {error}
          </div>
        )}

        {!loading && m && (
          <>
            {/* Card Manifiesto */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <Info label="Servicio" value={m.servicio} />
                <Info label="Nave" value={m.nave} />
                <Info label="Viaje" value={m.viaje} />

                <Info label="Puerto central" value={m.puertoCentral} />
                <Info label="Operación" value={m.tipoOperacion} />
                <Info label="Status" value={m.status} />

                <Info label="Operador nave" value={m.operadorNave} />
                <Info label="Emisor doc" value={m.emisorDocumento} />
                <Info label="Representante" value={m.representante} />

                <Info
                  label="Fecha Mfto Aduana CL"
                  value={formatDateCL(m.fechaManifiestoAduana)}
                />
                <Info
                  label="N° Mfto Aduana CL"
                  value={m.numeroManifiestoAduana}
                />
                <Info label="Remark" value={m.remark || "—"} />
              </div>
            </div>

            {/* ✅ Carga PMS */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-700">
                    Carga PMS (para este manifiesto)
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Selecciona el archivo y súbelo.
                  </p>
                </div>

                <button
                  onClick={handleUploadPMS}
                  disabled={pmsUploading || !pmsFile}
                  className="px-4 py-2 rounded-lg bg-[#0F2A44] text-white text-sm font-medium disabled:opacity-60"
                  title={!pmsFile ? "Selecciona un archivo primero" : "Subir PMS"}
                >
                  {pmsUploading ? "Subiendo..." : "Cargar PMS"}
                </button>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <input
                  type="file"
                  accept=".xml,.txt,.csv"
                  onChange={(e) => setPmsFile(e.target.files?.[0] || null)}
                  className="text-sm"
                />
                {pmsFile && (
                  <span className="text-xs text-slate-600">
                    Archivo: <span className="font-medium">{pmsFile.name}</span>
                  </span>
                )}
              </div>

              {/* ✅ Estado: ya hay PMS cargado */}
              <div className="mt-3 text-xs text-slate-600">
                {pmsInfo ? (
                  <>
                    <div>
                      PMS cargado:{" "}
                      <span className="font-medium">{pmsInfo.nombreOriginal}</span>
                    </div>
                    <div>
                      Fecha carga:{" "}
                      <span className="font-medium">
                        {formatDTCL(pmsInfo.createdAt)}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-slate-500">
                    Aún no hay PMS cargado para este manifiesto.
                  </div>
                )}
              </div>

              {pmsMsg && (
                <div className="mt-3 text-sm text-emerald-700">{pmsMsg}</div>
              )}
            </div>

            {/* Itinerario */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700">
                  Itinerario
                </h2>
                <span className="text-xs text-slate-500">Filas: {it.length}</span>
              </div>

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
                  {it.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-6 py-4">{r.orden}</td>
                      <td className="px-6 py-4">{r.port}</td>
                      <td className="px-6 py-4">{r.portType}</td>
                      <td className="px-6 py-4">{formatDTCL(r.eta)}</td>
                      <td className="px-6 py-4">{formatDTCL(r.ets)}</td>
                    </tr>
                  ))}

                  {it.length === 0 && (
                    <tr>
                      <td className="px-6 py-10 text-slate-500" colSpan={5}>
                        No hay itinerario guardado para este manifiesto.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

const Info = ({ label, value }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
    <div className="text-xs font-medium text-slate-500">{label}</div>
    <div className="text-slate-800 mt-1">{value}</div>
  </div>
);

export default ManifiestoDetalle;
