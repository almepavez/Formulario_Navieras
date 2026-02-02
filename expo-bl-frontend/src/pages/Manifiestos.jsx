import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import Sidebar from "../components/Sidebar";
import { FileText, Trash2 } from "lucide-react";

const estadoStyles = {
  "Activo": "bg-emerald-100 text-emerald-800 ring-emerald-200",
  "Inactivo": "bg-red-100 text-red-800 ring-red-200",
  "Enviado": "bg-orange-100 text-orange-800 ring-orange-200",
};

const formatDateCL = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy}`;
};

const Manifiestos = () => {
  const navigate = useNavigate();
  const [manifiestos, setManifiestos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(new Set());

  const fetchManifiestos = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("http://localhost:4000/manifiestos");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setManifiestos(Array.isArray(data) ? data : []);
      setSelected(new Set()); // Limpiar selección al recargar
    } catch (e) {
      setError(e?.message || "Error desconocido");
      setManifiestos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchManifiestos();
  }, []);

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === manifiestos.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(manifiestos.map((m) => m.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selected.size === 0) {
      await Swal.fire({
        title: "Sin selección",
        text: "Debes seleccionar al menos un manifiesto para eliminar",
        icon: "warning",
        confirmButtonColor: "#0F2A44",
      });
      return;
    }

    const result = await Swal.fire({
      title: "¿Eliminar manifiestos?",
      html: `
        <p>Estás a punto de eliminar <strong>${selected.size} manifiesto(s)</strong>.</p>
        <p class="text-sm text-slate-500 mt-2">Solo se eliminarán los que no tengan BLs asociados.</p>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#64748b",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch("http://localhost:4000/manifiestos/eliminar-multiples", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al eliminar");
      }

      const { resultados } = data;

      // Construir mensaje detallado
      let mensaje = "";
      if (resultados.eliminados.length > 0) {
        mensaje += `✅ <strong>${resultados.eliminados.length} eliminado(s)</strong><br>`;
      }
      if (resultados.conBLs.length > 0) {
        mensaje += `⚠️ <strong>${resultados.conBLs.length} no se pudieron eliminar</strong> (tienen BLs asociados)<br>`;
        mensaje += `<ul class="text-left text-sm mt-2 ml-4">`;
        resultados.conBLs.forEach(({ id, totalBLs }) => {
          mensaje += `<li>Manifiesto #${id}: ${totalBLs} BL(s)</li>`;
        });
        mensaje += `</ul>`;
      }
      if (resultados.noEncontrados.length > 0) {
        mensaje += `❌ <strong>${resultados.noEncontrados.length} no encontrado(s)</strong><br>`;
      }

      await Swal.fire({
        title: resultados.eliminados.length > 0 ? "Operación completada" : "No se eliminó nada",
        html: mensaje,
        icon: resultados.eliminados.length > 0 ? "success" : "info",
        confirmButtonColor: "#0F2A44",
      });

      // Recargar lista
      await fetchManifiestos();

    } catch (err) {
      await Swal.fire({
        title: "Error",
        text: err?.message || "No se pudieron eliminar los manifiestos",
        icon: "error",
        confirmButtonColor: "#0F2A44",
      });
    }
  };

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-10">
        {/* Header + CTA */}
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-[#0F2A44]">
              Manifiestos (EXPO)
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Selecciona un manifiesto para gestionar sus BL de exportación
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDeleteSelected}
              disabled={selected.size === 0}
              className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              title={selected.size === 0 ? "Selecciona manifiestos para eliminar" : `Eliminar ${selected.size} manifiesto(s)`}
            >
              <Trash2 className="w-4 h-4" />
              Eliminar {selected.size > 0 && `(${selected.size})`}
            </button>

            <button
              onClick={fetchManifiestos}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50"
              title="Actualizar"
            >
              Actualizar
            </button>

            <button
              onClick={() => navigate("/manifiestos/nuevo")}
              className="px-4 py-2 rounded-lg bg-[#0F2A44] text-white text-sm font-medium hover:opacity-90"
            >
              + Crear manifiesto
            </button>
          </div>
        </div>

        {/* Estado carga/error */}
        {loading && (
          <div className="text-sm text-slate-600 mb-4">Cargando manifiestos...</div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Error al cargar: <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Tabla */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-6 py-3">
                  <input
                    type="checkbox"
                    checked={manifiestos.length > 0 && selected.size === manifiestos.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-[#0F2A44] focus:ring-2 focus:ring-[#0F2A44]"
                  />
                </th>
                <th className="text-left px-6 py-3 font-semibold">Servicio</th>
                <th className="text-left px-6 py-3 font-semibold">Nave</th>
                <th className="text-left px-6 py-3 font-semibold">Viaje</th>
                <th className="text-left px-6 py-3 font-semibold">Puerto central</th>
                <th className="text-left px-6 py-3 font-semibold">Operación</th>
                <th className="text-left px-6 py-3 font-semibold">Fecha Mfto</th>
                <th className="text-left px-6 py-3 font-semibold">N° Mfto Aduana</th>
                <th className="text-left px-6 py-3 font-semibold">Status</th>
                <th className="text-left px-6 py-3 font-semibold">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {!loading &&
                manifiestos.map((m) => (
                  <tr
                    key={m.id}
                    className={`border-t hover:bg-slate-50 ${selected.has(m.id) ? "bg-blue-50" : ""
                      }`}
                  >
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selected.has(m.id)}
                        onChange={() => toggleSelect(m.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 rounded border-slate-300 text-[#0F2A44] focus:ring-2 focus:ring-[#0F2A44]"
                      />
                    </td>
                    <td
                      className="px-6 py-4 cursor-pointer"
                      onClick={() => navigate(`/manifiestos/${m.id}`)}
                    >
                      {m.servicio}
                    </td>
                    <td
                      className="px-6 py-4 cursor-pointer"
                      onClick={() => navigate(`/manifiestos/${m.id}`)}
                    >
                      {m.nave}
                    </td>
                    <td
                      className="px-6 py-4 font-medium cursor-pointer"
                      onClick={() => navigate(`/manifiestos/${m.id}`)}
                    >
                      {m.viaje}
                    </td>
                    <td
                      className="px-6 py-4 cursor-pointer"
                      onClick={() => navigate(`/manifiestos/${m.id}`)}
                    >
                      {m.puertoCentral}
                    </td>
                    <td
                      className="px-6 py-4 cursor-pointer"
                      onClick={() => navigate(`/manifiestos/${m.id}`)}
                    >
                      {m.tipoOperacion}
                    </td>
                    <td
                      className="px-6 py-4 cursor-pointer"
                      onClick={() => navigate(`/manifiestos/${m.id}`)}
                    >
                      {formatDateCL(m.fechaManifiestoAduana)}
                    </td>
                    <td
                      className="px-6 py-4 cursor-pointer"
                      onClick={() => navigate(`/manifiestos/${m.id}`)}
                    >
                      {m.numeroManifiestoAduana ? (
                        <span className="font-medium text-slate-700">
                          {m.numeroManifiestoAduana}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td
                      className="px-6 py-4 cursor-pointer"
                      onClick={() => navigate(`/manifiestos/${m.id}`)}
                    >
                      <span
                        className={[
                          "inline-flex items-center px-3 py-1 rounded-full text-xs ring-1",
                          estadoStyles[m.status] ??
                          "bg-slate-100 text-slate-700 ring-slate-200",
                        ].join(" ")}
                      >
                        {m.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/manifiestos/${m.id}/generar-xml`);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 flex items-center gap-1"
                      >
                        <FileText className="w-4 h-4" />
                        Generar XMLs
                      </button>
                    </td>
                  </tr>
                ))}

              {!loading && manifiestos.length === 0 && (
                <tr>
                  <td className="px-6 py-10 text-slate-500" colSpan={10}>
                    No hay manifiestos aún. Crea uno para comenzar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
};

export default Manifiestos;