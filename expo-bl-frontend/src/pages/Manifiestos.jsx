import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import Sidebar from "../components/Sidebar";
import { FileText, Trash2, ArrowUpRight, ArrowDownLeft } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL;

const estadoStyles = {
  "Activo": "bg-emerald-100 text-emerald-800 ring-emerald-200",
  "Inactivo": "bg-red-100 text-red-800 ring-red-200",
  "Enviado": "bg-orange-100 text-orange-800 ring-orange-200",
};

// POL badges
const POL_BADGE_EXPO = "bg-orange-100 text-orange-700 ring-1 ring-orange-200";
const POL_BADGE_IMPO = "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200";

const formatDateCL = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

// Fecha + hora local para updated_at
const formatDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy} ${hh}:${min}`;
};

// Mapa de prefijos de país → región agrupada
// Mapa de nombre de puerto → etiqueta agrupada
const REGION_MAP = {
  // Oriente
  "SHANGHAI": "Oriente",
  "NINGBO": "Oriente",
  "QINGDAO": "Oriente",
  "TIANJIN": "Oriente",
  "TIANJIN XINGANG": "Oriente",
  "NANJING": "Oriente",
  "WUHAN": "Oriente",
  "LIANYUNGANG": "Oriente",
  "GUANGZHOU": "Oriente",
  "SHENZHEN": "Oriente",
  "YANTIAN": "Oriente",
  "CHIWAN": "Oriente",
  "NANSHA": "Oriente",
  "XIAMEN": "Oriente",
  "FUZHOU": "Oriente",
  "DALIAN": "Oriente",
  "HONG KONG": "Oriente",
  "KAOHSIUNG": "Oriente",
  "BUSAN": "Oriente",
  "INCHEON": "Oriente",
  "TOKYO": "Oriente",
  "YOKOHAMA": "Oriente",
  "NAGOYA": "Oriente",
  "OSAKA": "Oriente",
  "KOBE": "Oriente",
  "SINGAPORE": "Oriente",
  "PORT KELANG": "Oriente",
  "TANJUNG PELEPAS": "Oriente",
  "JAKARTA": "Oriente",
  "SURABAYA": "Oriente",
  "MANILA": "Oriente",
  "HO CHI MINH": "Oriente",
  "CAT LAI": "Oriente",
  "HAIPHONG": "Oriente",
  "BANGKOK": "Oriente",
  "LAEM CHABANG": "Oriente",
  "COLOMBO": "Oriente",
  "CHENNAI": "Oriente",
  "NHAVA SHEVA": "Oriente",
  "MUNDRA": "Oriente",
  "CALCUTTA": "Oriente",
  "CALCUTTA - KOLKATA": "Oriente",
  "KOLKATA": "Oriente",
  "KARACHI": "Oriente",
  "CHITTAGONG": "Oriente",
  // México
  "MANZANILLO": "México",
  "LAZARO CARDENAS": "México",
  "LÁZARO CÁRDENAS": "México",
  "ENSENADA": "México",
  "VERACRUZ": "México",
  // Guatemala
  "QUETZAL": "Guatemala",
  "PUERTO QUETZAL": "Guatemala",
  // Colombia
  "BUENAVENTURA": "Colombia",
  "CARTAGENA": "Colombia",
  // Perú
  "CALLAO": "Perú",
};

const getRegion = (polName) => {
  if (!polName) return polName;
  const key = polName.trim().toUpperCase();
  // Buscar coincidencia exacta (case-insensitive)
  const found = Object.keys(REGION_MAP).find(
    (k) => k.toUpperCase() === key
  );
  return found ? REGION_MAP[found].toUpperCase() : polName;
};

const PolBadges = ({ pols, badgeClass }) => {
  if (!pols) return <span className="text-slate-400 text-xs">Cargando...</span>;
  if (pols.length === 0) return <span className="text-slate-400">—</span>;

  const regiones = [...new Set(pols.map(getRegion))];

  return (
    <div className="flex flex-wrap gap-1">
      {regiones.map((region) => (
        <span
          key={region}
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}
          title={pols.filter((p) => getRegion(p) === region).join(", ")}
        >
          {region}
        </span>
      ))}
    </div>
  );
};

const Manifiestos = () => {
  const navigate = useNavigate();
  const [manifiestos, setManifiestos] = useState([]);
  const [polsMap, setPolsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [tipoOpFilter, setTipoOpFilter] = useState("TODOS");

  const fetchManifiestos = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/manifiestos`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const lista = Array.isArray(data) ? data : [];
      setManifiestos(lista);
      setSelected(new Set());

      if (lista.length > 0) {
        const results = await Promise.allSettled(
          lista.map((m) =>
            fetch(`${API_BASE}/api/manifiestos/${m.id}/bls`)
              .then((r) => r.ok ? r.json() : [])
              .then((bls) => {
                const pols = [
                  ...new Set(
                    (Array.isArray(bls) ? bls : [])
                      .map((bl) => bl.puerto_embarque)
                      .filter(Boolean)
                  ),
                ];
                return { id: m.id, pols };
              })
          )
        );
        const map = {};
        results.forEach((r) => {
          if (r.status === "fulfilled") map[r.value.id] = r.value.pols;
        });
        setPolsMap(map);
      }
    } catch (e) {
      setError(e?.message || "Error desconocido");
      setManifiestos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchManifiestos(); }, []);

  const filteredManifiestos = manifiestos.filter((m) => {
    if (tipoOpFilter === "TODOS") return true;
    return m.tipoOperacion?.toUpperCase() === tipoOpFilter;
  });

  const countExpo = manifiestos.filter(m => m.tipoOperacion?.toUpperCase() === "S").length;
  const countImpo = manifiestos.filter(m => m.tipoOperacion?.toUpperCase() === "I").length;

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filteredManifiestos.length) setSelected(new Set());
    else setSelected(new Set(filteredManifiestos.map((m) => m.id)));
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
      const res = await fetch(`${API_BASE}/api/manifiestos/eliminar-multiples`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al eliminar");

      const { resultados } = data;
      let mensaje = "";
      if (resultados.eliminados.length > 0)
        mensaje += `<strong>${resultados.eliminados.length} eliminado(s)</strong><br>`;
      if (resultados.conBLs.length > 0) {
        mensaje += `<strong>${resultados.conBLs.length} no se pudieron eliminar</strong> (tienen BLs asociados)<br>`;
        mensaje += `<ul class="text-left text-sm mt-2 ml-4">`;
        resultados.conBLs.forEach(({ id, totalBLs }) => {
          mensaje += `<li>Manifiesto #${id}: ${totalBLs} BL(s)</li>`;
        });
        mensaje += `</ul>`;
      }
      if (resultados.noEncontrados.length > 0)
        mensaje += `<strong>${resultados.noEncontrados.length} no encontrado(s)</strong><br>`;

      await Swal.fire({
        title: resultados.eliminados.length > 0 ? "Operación completada" : "No se eliminó nada",
        html: mensaje,
        icon: resultados.eliminados.length > 0 ? "success" : "info",
        confirmButtonColor: "#0F2A44",
      });

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

  // Badge tipo operación
  const TipoOpBadge = ({ tipo }) => {
    if (tipo?.toUpperCase() === "S")
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-700">
          <ArrowUpRight size={11} /> EXPO
        </span>
      );
    if (tipo?.toUpperCase() === "I")
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-700">
          <ArrowDownLeft size={11} /> IMPO
        </span>
      );

    return <span className="text-slate-400 text-xs">—</span>;
  };

  // Pill filtro
  const TipoOpPill = ({ value, label, count, icon: Icon, color }) => {
    const active = tipoOpFilter === value;
    return (
      <button
        onClick={() => setTipoOpFilter(value)}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all border ${active ? `${color.active} shadow-sm` : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700"
          }`}
      >
        {Icon && <Icon size={15} />}
        {label}
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${active ? color.badge : "bg-slate-100 text-slate-500"}`}>
          {count}
        </span>
      </button>
    );
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-10 min-h-screen bg-slate-100">

        {/* Header */}
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-[#0F2A44]">Manifiestos</h1>
            <p className="text-sm text-slate-500 mt-1">
              Selecciona un manifiesto para gestionar sus BLs
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleDeleteSelected}
              disabled={selected.size === 0}
              className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar {selected.size > 0 && `(${selected.size})`}
            </button>
            <button
              onClick={fetchManifiestos}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50"
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

        {/* Pills */}
        <div className="flex items-center gap-2 flex-wrap mb-6">
          <TipoOpPill
            value="TODOS" label="Todos" count={manifiestos.length}
            color={{ active: "bg-slate-800 text-white border-slate-800", badge: "bg-white/20 text-white" }}
          />
          <TipoOpPill
            value="S" label="EXPO" count={countExpo} icon={ArrowUpRight}
            color={{ active: "bg-orange-500 text-white border-orange-500", badge: "bg-white/20 text-white" }}
          />
          <TipoOpPill
            value="I" label="IMPO" count={countImpo} icon={ArrowDownLeft}
            color={{ active: "bg-indigo-600 text-white border-indigo-600", badge: "bg-white/20 text-white" }}
          />
        </div>

        {loading && <div className="text-sm text-slate-600 mb-4">Cargando manifiestos...</div>}
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
                    checked={filteredManifiestos.length > 0 && selected.size === filteredManifiestos.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-[#0F2A44] focus:ring-2 focus:ring-[#0F2A44]"
                  />
                </th>
                <th className="text-left px-6 py-3 font-semibold">Nave</th>
                <th className="text-left px-6 py-3 font-semibold">Viaje</th>
                <th className="text-left px-6 py-3 font-semibold">POL</th>
                <th className="text-left px-6 py-3 font-semibold">P. Central</th>
                <th className="text-left px-6 py-3 font-semibold">Operación</th>
                <th className="text-left px-6 py-3 font-semibold">N° Mfto Aduana</th>
                <th className="text-left px-6 py-3 font-semibold">Últ. actualiz.</th>
                <th className="text-left px-6 py-3 font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
       {!loading &&
  filteredManifiestos.map((m) => {
    const isExpo = m.tipoOperacion?.toUpperCase() === "S";
    const badgeClass = isExpo ? POL_BADGE_EXPO : POL_BADGE_IMPO;
    return (
      <tr
        key={m.id}
        className={`border-t hover:bg-slate-50 ${selected.has(m.id) ? "bg-blue-50" : ""}`}
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
        <td className="px-6 py-4 cursor-pointer" onClick={() => navigate(`/manifiestos/${m.id}`)}>
          {m.nave}
        </td>
        <td className="px-6 py-4 font-medium cursor-pointer" onClick={() => navigate(`/manifiestos/${m.id}`)}>
          {m.viaje}
        </td>
        <td className="px-6 py-4 cursor-pointer" onClick={() => navigate(`/manifiestos/${m.id}`)}>
          <PolBadges pols={polsMap[m.id]} badgeClass={badgeClass} />
        </td>
        {/* ✅ Puerto Central — nuevo, va después de POL */}
        <td className="px-6 py-4 cursor-pointer" onClick={() => navigate(`/manifiestos/${m.id}`)}>
          {m.puertoCentral
            ? <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}>
                {m.puertoCentral}
              </span>
            : <span className="text-slate-400">—</span>
          }
        </td>
        <td className="px-6 py-4 cursor-pointer" onClick={() => navigate(`/manifiestos/${m.id}`)}>
          <TipoOpBadge tipo={m.tipoOperacion} />
        </td>
        <td className="px-6 py-4 cursor-pointer" onClick={() => navigate(`/manifiestos/${m.id}`)}>
          {m.numeroManifiestoAduana ? (
            <span className="font-medium text-slate-700">{m.numeroManifiestoAduana}</span>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </td>
        <td className="px-6 py-4 text-slate-500 text-xs cursor-pointer whitespace-nowrap" onClick={() => navigate(`/manifiestos/${m.id}`)}>
          {formatDateTime(m.updatedAt)}
        </td>
        <td className="px-6 py-4">
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/manifiestos/${m.id}/generar-xml`); }}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 flex items-center gap-1"
          >
            <FileText className="w-4 h-4" />
            Generar XMLs
          </button>
        </td>
      </tr>
    );
  })}

              {!loading && filteredManifiestos.length === 0 && (
                <tr>
                  <td className="px-6 py-10 text-slate-500" colSpan={9}>
                    {manifiestos.length === 0
                      ? "No hay manifiestos aún. Crea uno para comenzar."
                      : "No hay manifiestos para el filtro seleccionado."}
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