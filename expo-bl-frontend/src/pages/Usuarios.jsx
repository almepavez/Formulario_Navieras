import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  ArrowLeft,
  Shield,
  Eye,
  Users,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Sidebar from "../components/Sidebar";

const API_BASE_URL = import.meta.env.VITE_API_URL;

const Usuarios = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const token = localStorage.getItem("token");
  const usuarioActual = JSON.parse(localStorage.getItem("usuario") || "{}");

  useEffect(() => {
    cargarUsuarios();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

    const cargarUsuarios = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/usuarios`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      console.log("STATUS:", res.status);
      console.log("RESPUESTA:", data);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("ERROR fetch:", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const cambiarRol = async (id, nuevoRol) => {
    setGuardando(id);
    try {
      const res = await fetch(`${API_BASE_URL}/api/usuarios/${id}/rol`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ rol: nuevoRol }),
      });
      const data = await res.json();
      if (data.success) {
        setItems((prev) =>
          prev.map((u) => (u.id === id ? { ...u, rol: nuevoRol } : u))
        );
      }
    } finally {
      setGuardando(null);
    }
  };

  const filteredItems = items.filter((u) =>
    [u.nombre, u.email, u.rol]
      .some((val) => String(val ?? "").toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalItems = filteredItems.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = filteredItems.slice(startIndex, startIndex + itemsPerPage);

  const getPageNumbers = () => {
    const pages = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, "...", totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-6 sm:p-8 lg:p-10">
        <div className="max-w-7xl mx-auto">

          {/* Volver */}
          <button
            onClick={() => navigate("/mantenedores")}
            className="flex items-center gap-2 text-slate-500 hover:text-[#0F2A44] mb-6 text-sm transition-colors"
          >
            <ArrowLeft size={16} /> Volver a Mantenedores
          </button>

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="bg-sky-100 p-2 rounded-lg">
                <Users className="text-sky-600" size={24} />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-semibold text-[#0F2A44]">Usuarios</h1>
                <p className="text-sm text-slate-500">Gestión de roles de acceso al sistema</p>
              </div>
            </div>
          </div>

          {/* Tabla */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

            {/* Barra de búsqueda */}
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div className="relative flex-1 max-w-sm">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, email o rol..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0F2A44] focus:border-transparent"
                />
              </div>
              <span className="text-sm text-slate-500">{totalItems} usuario{totalItems !== 1 ? "s" : ""}</span>
            </div>

            {/* Tabla */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                    <th className="px-6 py-3 text-left">Usuario</th>
                    <th className="px-6 py-3 text-left">Email</th>
                    <th className="px-6 py-3 text-left">Último acceso</th>
                    <th className="px-6 py-3 text-left">Rol</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                        Cargando...
                      </td>
                    </tr>
                  ) : currentItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                        No se encontraron usuarios
                      </td>
                    </tr>
                  ) : (
                    currentItems.map((u) => {
                      const esSelf = u.id === usuarioActual.id;
                      return (
                        <tr key={u.id} className="hover:bg-slate-50 transition-colors">

                          {/* Nombre + avatar */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {u.foto_perfil ? (
                                <img src={u.foto_perfil} className="w-8 h-8 rounded-full object-cover" />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 font-semibold text-xs">
                                  {u.nombre?.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <span className="font-medium text-slate-800">
                                {u.nombre}
                                {esSelf && (
                                  <span className="ml-2 text-xs text-slate-400">(tú)</span>
                                )}
                              </span>
                            </div>
                          </td>

                          {/* Email */}
                          <td className="px-6 py-4 text-slate-500">{u.email}</td>

                          {/* Último acceso */}
                          <td className="px-6 py-4 text-slate-400">
                            {u.ultimo_acceso
                              ? String(u.ultimo_acceso).substring(0, 16).replace("T", " ")
                              : "—"}
                          </td>

                          {/* Rol */}
                          <td className="px-6 py-4">
                            {esSelf ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#0F2A44]/10 text-[#0F2A44]">
                                <Shield size={12} /> admin
                              </span>
                            ) : (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => u.rol !== "admin" && cambiarRol(u.id, "admin")}
                                  disabled={guardando === u.id || u.rol === "admin"}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all
                                    ${u.rol === "admin"
                                      ? "bg-[#0F2A44] text-white border-[#0F2A44]"
                                      : "bg-white text-slate-500 border-slate-300 hover:border-[#0F2A44] hover:text-[#0F2A44]"
                                    }`}
                                >
                                  {guardando === u.id ? (
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />
                                  ) : (
                                    <Shield size={12} />
                                  )}
                                  Admin
                                </button>
                                <button
                                  onClick={() => u.rol !== "usuario" && cambiarRol(u.id, "usuario")}
                                  disabled={guardando === u.id || u.rol === "usuario"}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-all
                                    ${u.rol === "usuario"
                                        ? "bg-slate-600 text-white border-slate-600"
                                        : "bg-white text-slate-500 border-slate-300 hover:border-slate-600 hover:text-slate-600"
                                    }`}
                                >
                                  {guardando === u.id ? (
                                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />
                                  ) : (
                                    <Eye size={12} />
                                  )}
                                  Usuario
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {!loading && totalItems > 0 && (
              <div className="border-t border-slate-200 px-6 py-4 bg-slate-50">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3 text-sm text-slate-600">
                    <span>
                      Mostrando <span className="font-semibold text-slate-900">{startIndex + 1}</span> a{" "}
                      <span className="font-semibold text-slate-900">{Math.min(startIndex + itemsPerPage, totalItems)}</span> de{" "}
                      <span className="font-semibold text-slate-900">{totalItems}</span> usuarios
                    </span>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                      className="border border-slate-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F2A44]"
                    >
                      {[10, 25, 50].map((n) => <option key={n} value={n}>{n} por página</option>)}
                    </select>
                  </div>

                  {totalPages > 1 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                        disabled={currentPage === 1}
                        className="p-2 rounded-lg border border-slate-300 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <div className="flex gap-1">
                        {getPageNumbers().map((page, i) =>
                          page === "..." ? (
                            <span key={`e-${i}`} className="px-3 py-2 text-slate-400">...</span>
                          ) : (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`min-w-[40px] px-3 py-2 rounded-lg text-sm font-medium transition ${
                                currentPage === page
                                  ? "bg-[#0F2A44] text-white"
                                  : "hover:bg-slate-100 text-slate-700"
                              }`}
                            >
                              {page}
                            </button>
                          )
                        )}
                      </div>
                      <button
                        onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-lg border border-slate-300 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Usuarios;