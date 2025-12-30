import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  PlusCircle,
  Edit2,
  Trash2,
  Search,
  X,
  Save,
  ArrowLeft,
  Anchor,
  Globe,
  Package,
  AlertCircle,
} from "lucide-react";
import Sidebar from "../components/Sidebar";

const API_BASE_URL = "http://localhost:4000";

// ✅ Clases Tailwind NO dinámicas (para que compile bien)
const colorStyles = {
  teal: {
    badgeBg: "bg-teal-100",
    badgeText: "text-teal-600",
  },
  purple: {
    badgeBg: "bg-purple-100",
    badgeText: "text-purple-600",
  },
  orange: {
    badgeBg: "bg-orange-100",
    badgeText: "text-orange-600",
  },
};

const CRUDMantenedor = () => {
  const navigate = useNavigate();
  const { tipo } = useParams();

  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ✅ Configuración ajustada a tus tablas NUEVAS
  const configs = {
    puertos: {
      title: "Puertos",
      singular: "Puerto",
      icon: Anchor,
      color: "teal",
      fields: [
        { key: "codigo", label: "Código", type: "text", required: true, placeholder: "CLVAP, CNHKG" },
        { key: "nombre", label: "Nombre", type: "text", required: true, placeholder: "VALPARAISO" },
      ],
    },
    servicios: {
      title: "Servicios",
      singular: "Servicio",
      icon: Globe,
      color: "purple",
      fields: [
        { key: "codigo", label: "Código", type: "text", required: true, placeholder: "WSA, WS6" },
        { key: "nombre", label: "Nombre", type: "text", required: true, placeholder: "South West Asia Service" },
        { key: "descripcion", label: "Descripción", type: "textarea", placeholder: "Servicio Chile - Asia" },
      ],
    },
    naves: {
      title: "Naves",
      singular: "Nave",
      icon: Package,
      color: "orange",
      fields: [
        { key: "codigo", label: "Código", type: "text", required: true, placeholder: "EVERFEAT" },
        { key: "nombre", label: "Nombre", type: "text", required: true, placeholder: "EVER FEAT" },
      ],
    },
  };

  const config = configs[tipo];
  const Icon = config?.icon;

  useEffect(() => {
    if (config) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/mantenedores/${tipo}`);
      if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);
      const data = await response.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter((item) =>
    Object.values(item).some((val) =>
      String(val ?? "").toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const handleAdd = () => {
    setEditingItem(null);
    const emptyForm = config.fields.reduce((acc, field) => ({ ...acc, [field.key]: "" }), {});
    setFormData(emptyForm);
    setIsModalOpen(true);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    // 👇 solo toma los campos que existen en config.fields (evita meter created_at, etc)
    const clean = config.fields.reduce((acc, f) => ({ ...acc, [f.key]: item[f.key] ?? "" }), {});
    setFormData(clean);
    setIsModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm(`¿Está seguro de eliminar este registro?`)) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/mantenedores/${tipo}/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Error al eliminar");
      setItems((prev) => prev.filter((it) => it.id !== id));
    } catch (err) {
      alert(`Error al eliminar: ${err.message}`);
    }
  };

  const handleSave = async () => {
    const requiredFields = config.fields.filter((f) => f.required);
    const isValid = requiredFields.every((f) => String(formData[f.key] ?? "").trim());

    if (!isValid) {
      alert("Por favor complete todos los campos obligatorios");
      return;
    }

    setLoading(true);
    try {
      const url = editingItem
        ? `${API_BASE_URL}/api/mantenedores/${tipo}/${editingItem.id}`
        : `${API_BASE_URL}/api/mantenedores/${tipo}`;

      const method = editingItem ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Error al guardar");
      }

      if (editingItem) {
        setItems((prev) =>
          prev.map((it) => (it.id === editingItem.id ? { ...it, ...formData } : it))
        );
      } else {
        await loadData();
      }

      setIsModalOpen(false);
      setFormData({});
      setEditingItem(null);
    } catch (err) {
      alert(`Error al guardar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!config) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-slate-500">Mantenedor no encontrado</p>
      </div>
    );
  }

  const badge = colorStyles[config.color] ?? colorStyles.teal;

  return (
    <div className="flex min-h-screen bg-slate-100">
      <Sidebar />

      <main className="flex-1 p-6 sm:p-8 lg:p-10">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => navigate("/mantenedores")}
              className="flex items-center gap-2 text-[#0F2A44] hover:text-[#1a3f5f] mb-4 group"
            >
              <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
              <span className="font-medium">Volver a Mantenedores</span>
            </button>

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`${badge.badgeBg} p-4 rounded-xl`}>
                  <Icon className={`${badge.badgeText}`} size={32} strokeWidth={2} />
                </div>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-semibold text-[#0F2A44]">
                    {config.title}
                  </h1>
                  <p className="text-slate-600 mt-1 text-sm">
                    {loading ? "Cargando..." : `${items.length} ${items.length === 1 ? "registro" : "registros"}`}
                  </p>
                </div>
              </div>

              <button
                onClick={handleAdd}
                disabled={loading}
                className="flex items-center gap-2 bg-[#0F2A44] text-white px-5 py-3 rounded-xl hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PlusCircle size={20} />
                Agregar {config.singular}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
              <AlertCircle className="text-red-600" size={20} />
              <div>
                <p className="text-red-800 font-semibold">Error al cargar datos</p>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Search */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={loading}
                className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F2A44] focus:border-transparent shadow-sm disabled:opacity-50"
              />
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {config.fields.map((field) => (
                      <th key={field.key} className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                        {field.label}
                      </th>
                    ))}
                    <th className="px-6 py-4 text-right text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={config.fields.length + 1} className="px-6 py-12 text-center text-slate-500">
                        Cargando...
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={config.fields.length + 1} className="px-6 py-12 text-center text-slate-500">
                        No se encontraron registros
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        {config.fields.map((field) => (
                          <td key={field.key} className="px-6 py-4 text-sm text-slate-700">
                            {field.key === "codigo" ? (
                              <span className="font-mono font-semibold text-[#0F2A44]">{item[field.key]}</span>
                            ) : field.type === "textarea" ? (
                              <span className="line-clamp-2">{item[field.key] || "-"}</span>
                            ) : (
                              item[field.key] || "-"
                            )}
                          </td>
                        ))}

                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEdit(item)}
                              className="p-2 text-[#0F2A44] hover:bg-blue-50 rounded-lg transition"
                              title="Editar"
                            >
                              <Edit2 size={18} />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                              title="Eliminar"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal */}
          {isModalOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white flex items-center justify-between p-6 border-b border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className={`${badge.badgeBg} p-2 rounded-lg`}>
                      <Icon className={`${badge.badgeText}`} size={24} />
                    </div>
                    <h2 className="text-xl sm:text-2xl font-semibold text-[#0F2A44]">
                      {editingItem ? `Editar ${config.singular}` : `Nuevo ${config.singular}`}
                    </h2>
                  </div>

                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-lg transition"
                    disabled={loading}
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {config.fields.map((field) => (
                      <div
                        key={field.key}
                        className={field.key === "nombre" || field.key === "descripcion" ? "md:col-span-2" : ""}
                      >
                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                          {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>

                        {field.type === "textarea" ? (
                          <textarea
                            value={formData[field.key] || ""}
                            onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F2A44] focus:border-transparent transition resize-none"
                            placeholder={field.placeholder || `Ingrese ${field.label.toLowerCase()}`}
                            rows={3}
                          />
                        ) : (
                          <input
                            type={field.type || "text"}
                            value={formData[field.key] || ""}
                            onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F2A44] focus:border-transparent transition"
                            placeholder={field.placeholder || `Ingrese ${field.label.toLowerCase()}`}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="sticky bottom-0 bg-slate-50 flex items-center justify-end gap-3 p-6 border-t border-slate-200">
                  <button
                    onClick={() => setIsModalOpen(false)}
                    disabled={loading}
                    className="px-6 py-3 text-slate-700 hover:bg-slate-200 rounded-xl transition font-medium disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={loading}
                    className="flex items-center gap-2 bg-[#0F2A44] text-white px-6 py-3 rounded-xl hover:opacity-90 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Save size={18} />
                        Guardar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default CRUDMantenedor;
