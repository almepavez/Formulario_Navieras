import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import Sidebar from "../components/Sidebar";
import ComboSelect from "../components/ComboSelect";
import { FileText, ArrowUpRight, ArrowDownLeft, X } from "lucide-react";


const API_BASE = import.meta.env.VITE_API_URL;

const estadoStyles = {
  "Activo": "bg-emerald-100 text-emerald-800 ring-emerald-200",
  "Inactivo": "bg-red-100 text-red-800 ring-red-200",
  "Enviado": "bg-orange-100 text-orange-800 ring-orange-200",
};

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

const getRegion = (region, nombre) => region ? region.toUpperCase() : (nombre || "");

const PolBadges = ({ pols, badgeClass }) => {
  if (!pols) return <span className="text-slate-400 text-xs">Cargando...</span>;
  if (pols.length === 0) return <span className="text-slate-400">—</span>;

  const grupos = {};
  pols.forEach(({ region, nombre }) => {
    const label = getRegion(region, nombre);
    if (!grupos[label]) grupos[label] = [];
    grupos[label].push(nombre);
  });

  return (
    <div className="flex flex-wrap gap-1">
      {Object.entries(grupos).map(([label, nombres]) => (
        <span
          key={label}
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}
          title={nombres.join(", ")}
        >
          {label}
        </span>
      ))}
    </div>
  );
};

const Manifiestos = () => {
  const navigate = useNavigate();
  const [manifiestos, setManifiestos]   = useState([]);
  const [polsMap, setPolsMap]           = useState({});
  const [blsMap, setBlsMap]             = useState({});
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState("");

  // ── Filtros ──────────────────────────────────────────────────────────────
  const [tipoOpFilter,  setTipoOpFilter]  = useState("TODOS");
  const [searchTerm,    setSearchTerm]    = useState("");
  const [naveFilter,    setNaveFilter]    = useState("TODOS");
  const [viajeFilter,   setViajeFilter]   = useState("TODOS");
  const [polFilter,     setPolFilter]     = useState("TODOS");

  const fetchManifiestos = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/manifiestos`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const lista = Array.isArray(data) ? data : [];
      setManifiestos(lista);

      if (lista.length > 0) {
        const results = await Promise.allSettled(
          lista.map((m) =>
            fetch(`${API_BASE}/api/manifiestos/${m.id}/bls`)
              .then((r) => r.ok ? r.json() : [])
              .then((bls) => {
                const blsArray = Array.isArray(bls) ? bls : [];
                const pols = blsArray
                  .map((bl) => ({
                    region: bl.region_puerto_embarque || null,
                    nombre: bl.puerto_embarque || null,
                  }))
                  .filter((p) => p.nombre)
                  .filter((p, i, arr) =>
                    arr.findIndex((x) => (x.region || x.nombre) === (p.region || p.nombre)) === i
                  );
                const blNumbers = blsArray.map(bl => bl.bl_number).filter(Boolean);
                return { id: m.id, pols, blNumbers };
              })
          )
        );
        const map = {};
        const blMap = {};
        results.forEach((r) => {
          if (r.status === "fulfilled") {
            map[r.value.id]   = r.value.pols;
            blMap[r.value.id] = r.value.blNumbers;
          }
        });
        setPolsMap(map);
        setBlsMap(blMap);
      }
    } catch (e) {
      setError(e?.message || "Error desconocido");
      setManifiestos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchManifiestos(); }, []);

  // ── Opciones únicas para los ComboSelect ────────────────────────────────
  const naves   = [...new Set(manifiestos.map(m => m.nave).filter(Boolean))].sort();
  const viajes  = [...new Set(manifiestos.map(m => m.viaje).filter(Boolean))].sort();

  // POLs: extraídos del polsMap ya cargado
  const polsOpciones = [...new Set(
    Object.values(polsMap)
      .flat()
      .map(({ region, nombre }) => getRegion(region, nombre))
      .filter(Boolean)
  )].sort();

  // ── Filtrado ─────────────────────────────────────────────────────────────
  const filteredManifiestos = manifiestos.filter((m) => {
    const matchesTipoOp = tipoOpFilter === "TODOS" || m.tipoOperacion?.toUpperCase() === tipoOpFilter;

    const matchesSearch = !searchTerm || (
      (m.nave   || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.viaje  || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.numeroManifiestoAduana || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (blsMap[m.id] || []).some(bl => bl.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const matchesNave  = naveFilter  === "TODOS" || m.nave  === naveFilter;
    const matchesViaje = viajeFilter === "TODOS" || m.viaje === viajeFilter;

    const matchesPol = polFilter === "TODOS" || (
      (polsMap[m.id] || []).some(({ region, nombre }) =>
        getRegion(region, nombre) === polFilter
      )
    );

    return matchesTipoOp && matchesSearch && matchesNave && matchesViaje && matchesPol;
  });

  const hayFiltrosActivos =
    tipoOpFilter !== "TODOS" || searchTerm ||
    naveFilter !== "TODOS" || viajeFilter !== "TODOS" || polFilter !== "TODOS";

  // ── Paginación ───────────────────────────────────────────────────────────
  const [currentPage,  setCurrentPage]  = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => { setCurrentPage(1); },
    [tipoOpFilter, searchTerm, naveFilter, viajeFilter, polFilter, itemsPerPage]);

  const totalPages         = Math.ceil(filteredManifiestos.length / itemsPerPage);
  const startIndex         = (currentPage - 1) * itemsPerPage;
  const currentManifiestos = filteredManifiestos.slice(startIndex, startIndex + itemsPerPage);

  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else if (currentPage <= 3) {
      [1, 2, 3, 4, 5, "...", totalPages].forEach(p => pages.push(p));
    } else if (currentPage >= totalPages - 2) {
      [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages].forEach(p => pages.push(p));
    } else {
      [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages].forEach(p => pages.push(p));
    }
    return pages;
  };

  const limpiarFiltros = () => {
    setTipoOpFilter("TODOS");
    setSearchTerm("");
    setNaveFilter("TODOS");
    setViajeFilter("TODOS");
    setPolFilter("TODOS");
  };

  const countExpo = manifiestos.filter(m => m.tipoOperacion?.toUpperCase() === "S").length;
  const countImpo = manifiestos.filter(m => m.tipoOperacion?.toUpperCase() === "I").length;


  const TipoOpBadge = ({ tipo }) => {
    if (tipo?.toUpperCase() === "S")
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-700"><ArrowUpRight size={11} /> EXPO</span>;
    if (tipo?.toUpperCase() === "I")
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-700"><ArrowDownLeft size={11} /> IMPO</span>;
    return <span className="text-slate-400 text-xs">—</span>;
  };

  const TipoOpPill = ({ value, label, count, icon: Icon, color }) => {
    const active = tipoOpFilter === value;
    return (
      <button
        onClick={() => setTipoOpFilter(value)}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all border ${active ? `${color.active} shadow-sm` : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700"}`}
      >
        {Icon && <Icon size={15} />}
        {label}
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${active ? color.badge : "bg-slate-100 text-slate-500"}`}>{count}</span>
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
            <p className="text-sm text-slate-500 mt-1">Selecciona un manifiesto para gestionar sus BLs</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchManifiestos}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50">
              Actualizar
            </button>
            <button onClick={() => navigate("/manifiestos/nuevo")}
              className="px-4 py-2 rounded-lg bg-[#0F2A44] text-white text-sm font-medium hover:opacity-90">
              + Crear manifiesto
            </button>
          </div>
        </div>

        {/* Pills EXPO / IMPO */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <TipoOpPill value="TODOS" label="Todos" count={manifiestos.length}
            color={{ active: "bg-slate-800 text-white border-slate-800", badge: "bg-white/20 text-white" }} />
          <TipoOpPill value="S" label="EXPO" count={countExpo} icon={ArrowUpRight}
            color={{ active: "bg-orange-500 text-white border-orange-500", badge: "bg-white/20 text-white" }} />
          <TipoOpPill value="I" label="IMPO" count={countImpo} icon={ArrowDownLeft}
            color={{ active: "bg-indigo-600 text-white border-indigo-600", badge: "bg-white/20 text-white" }} />
        </div>

        {/* Filtros secundarios */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 mb-4">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Búsqueda libre */}
            <input
              type="text"
              placeholder="Buscar nave, viaje, N° manifiesto, BL..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="flex-1 min-w-[200px] px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0F2A44] focus:border-[#0F2A44] outline-none"
            />

            <ComboSelect
              value={naveFilter === "TODOS" ? "" : naveFilter}
              onChange={v => setNaveFilter(v || "TODOS")}
              options={[{ value: "", label: "Todas las naves" }, ...naves.map(n => ({ value: n, label: n }))]}
              placeholder="Todas las naves"
            />

            <ComboSelect
              value={viajeFilter === "TODOS" ? "" : viajeFilter}
              onChange={v => setViajeFilter(v || "TODOS")}
              options={[{ value: "", label: "Todos los viajes" }, ...viajes.map(v => ({ value: v, label: v }))]}
              placeholder="Todos los viajes"
            />

            <ComboSelect
              value={polFilter === "TODOS" ? "" : polFilter}
              onChange={v => setPolFilter(v || "TODOS")}
              options={[{ value: "", label: "Todos los POL" }, ...polsOpciones.map(p => ({ value: p, label: p }))]}
              placeholder="Todos los POL"
            />

            {hayFiltrosActivos && (
              <button onClick={limpiarFiltros} title="Limpiar filtros"
                className="flex-shrink-0 p-2 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors">
                <X size={16} />
              </button>
            )}
          </div>

          {/* Contador */}
          {!loading && (
            <p className="text-xs text-slate-500 mt-2">
              Mostrando{" "}
              <span className="font-semibold">{Math.min(startIndex + 1, filteredManifiestos.length)}</span>
              {" "}–{" "}
              <span className="font-semibold">{Math.min(startIndex + itemsPerPage, filteredManifiestos.length)}</span>
              {" "}de{" "}
              <span className="font-semibold">{filteredManifiestos.length}</span> manifiestos
              {hayFiltrosActivos && <span className="text-slate-400"> (filtrado de {manifiestos.length} total)</span>}
            </p>
          )}
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
              {!loading && currentManifiestos.map((m) => {
                const isExpo = m.tipoOperacion?.toUpperCase() === "S";
                const badgeClass = isExpo ? POL_BADGE_EXPO : POL_BADGE_IMPO;
                return (
                  <tr key={m.id} className="border-t hover:bg-slate-50">
                    <td className="px-6 py-4 cursor-pointer" onClick={() => navigate(`/manifiestos/${m.id}`)}>{m.nave}</td>
                    <td className="px-6 py-4 font-medium cursor-pointer" onClick={() => navigate(`/manifiestos/${m.id}`)}>{m.viaje}</td>
                    <td className="px-6 py-4 cursor-pointer" onClick={() => navigate(`/manifiestos/${m.id}`)}>
                      <PolBadges pols={polsMap[m.id]} badgeClass={badgeClass} />
                    </td>
                    <td className="px-6 py-4 cursor-pointer" onClick={() => navigate(`/manifiestos/${m.id}`)}>
                      {m.puertoCentral
                        ? <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}>{m.puertoCentral}</span>
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-6 py-4 cursor-pointer" onClick={() => navigate(`/manifiestos/${m.id}`)}>
                      <TipoOpBadge tipo={m.tipoOperacion} />
                    </td>
                    <td className="px-6 py-4 cursor-pointer" onClick={() => navigate(`/manifiestos/${m.id}`)}>
                      {m.numeroManifiestoAduana
                        ? <span className="font-medium text-slate-700">{m.numeroManifiestoAduana}</span>
                        : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs cursor-pointer whitespace-nowrap" onClick={() => navigate(`/manifiestos/${m.id}`)}>
                      {formatDateTime(m.updatedAt)}
                    </td>
                    <td className="px-6 py-4">
                      <button onClick={(e) => { e.stopPropagation(); navigate(`/manifiestos/${m.id}/generar-xml`); }}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700 flex items-center gap-1">
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
                      : "No hay manifiestos para los filtros seleccionados."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {!loading && totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between gap-4 flex-wrap">
            {/* Items por página */}
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <span>Mostrar:</span>
              <ComboSelect
                value={String(itemsPerPage)}
                onChange={v => setItemsPerPage(Number(v))}
                options={[
                  { value: "10",  label: "10" },
                  { value: "25",  label: "25" },
                  { value: "50",  label: "50" },
                  { value: "100", label: "100" },
                ]}
              />
              <span className="text-slate-400">por página</span>
            </div>

            {/* Botones de página */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                ← Anterior
              </button>

              {getPageNumbers().map((page, idx) =>
                page === "..." ? (
                  <span key={`ellipsis-${idx}`} className="px-2 py-1.5 text-slate-400 text-sm">…</span>
                ) : (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === page
                        ? "bg-[#0F2A44] text-white"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {page}
                  </button>
                )
              )}

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Manifiestos;