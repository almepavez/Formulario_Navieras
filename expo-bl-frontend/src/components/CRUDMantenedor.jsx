import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Swal from "sweetalert2";
import {
  PlusCircle,
  Edit2,
  Search,
  X,
  Save,
  ArrowLeft,
  Anchor,
  Globe,
  Package,
  Box,
  AlertCircle,
  PackageSearch,
} from "lucide-react";
import Sidebar from "../components/Sidebar";

const API_BASE_URL = "http://localhost:4000";

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
  blue: {
    badgeBg: "bg-blue-100",
    badgeText: "text-blue-600",
  },
  emerald: {
    badgeBg: "bg-emerald-100",
    badgeText: "text-emerald-600",
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
    "tipo-bulto": {
      title: "Tipos de Bulto",
      singular: "Tipo de Bulto",
      icon: Box,
      color: "blue",
      fields: [
        { 
          key: "tipo_cnt", 
          label: "Tipo Contenedor", 
          type: "text", 
          required: true, 
          placeholder: "Ej: 45R1, 22G1, 45G1" 
        },
        { 
          key: "tipo_bulto", 
          label: "Tipo Bulto", 
          type: "text", 
          required: true, 
          placeholder: "Ej: 76, 73, 78" 
        },
        { 
          key: "activo", 
          label: "Estado", 
          type: "select",
          options: [
            { value: 1, label: "Activo" },
            { value: 0, label: "Inactivo" }
          ],
          required: true 
        },
      ],
    },
    "empaque-contenedores": {
      title: "Tipo de Embalaje",
      singular: "Palabra Clave",
      icon: PackageSearch,
      color: "emerald",
      fields: [
        { 
          key: "token", 
          label: "Palabra Clave", 
          type: "text", 
          required: true, 
          placeholder: "Ej: CASE, CARTON, PALLET, BAG, DRUM",
          helpText: "Palabra que identifica el tipo de empaque en archivos PMS (se guarda en MAYÚSCULAS)"
        },
        { 
          key: "activo", 
          label: "Estado", 
          type: "select",
          options: [
            { value: 1, label: "Activo" },
            { value: 0, label: "Inactivo" }
          ],
          required: true 
        },
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
    const emptyForm = config.fields.reduce((acc, field) => {
      if (field.key === "activo") {
        return { ...acc, [field.key]: 1 };
      }
      return { ...acc, [field.key]: "" };
    }, {});
    setFormData(emptyForm);
    setIsModalOpen(true);
  };

  const handleEdit = (item) => {
    setEditingItem(item);
    const clean = config.fields.reduce((acc, f) => {
      if (f.key === "activo") {
        return { ...acc, [f.key]: Number(item[f.key] ?? 1) };
      }
      return { ...acc, [f.key]: item[f.key] ?? "" };
    }, {});
    setFormData(clean);
    setIsModalOpen(true);
  };

  const validateForm = () => {
    const requiredFields = config.fields.filter((f) => f.required);
    const missingFields = requiredFields.filter((f) => {
      const value = formData[f.key];
      if (f.type === "select") return value === undefined || value === null || value === "";
      return !String(value ?? "").trim();
    });

    if (missingFields.length > 0) {
      Swal.fire({
        title: "⚠️ Campos obligatorios faltantes",
        html: `
          <p style="margin-bottom: 12px;">Por favor completa los siguientes campos:</p>
          <ul style="text-align: left; padding-left: 24px; color: #dc2626;">
            ${missingFields.map((field) => `<li><strong>${field.label}</strong></li>`).join("")}
          </ul>
        `,
        icon: "warning",
        confirmButtonColor: "#0F2A44",
        confirmButtonText: "Entendido",
      });
      return false;
    }

    return true;
  };

  const buildSummary = () => {
    return `
      <div style="text-align: left; font-size: 14px;">
        ${config.fields
          .map((field) => {
            let value = formData[field.key];
            
            if (field.type === "select" && field.options) {
              const option = field.options.find(opt => opt.value === formData[field.key]);
              value = option ? option.label : value;
            } else {
              value = value || "—";
            }
            
            return `<p><strong>${field.label}:</strong> ${value}</p>`;
          })
          .join("")}
      </div>
    `;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    const action = editingItem ? "actualizar" : "crear";
    const result = await Swal.fire({
      title: `¿${action === "crear" ? "Crear" : "Actualizar"} ${config.singular}?`,
      html: `
        <div style="margin-bottom: 16px;">
          <p style="color: #64748b; margin-bottom: 12px;">
            Verifica que la información sea correcta:
          </p>
          ${buildSummary()}
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#62c755ff",
      cancelButtonColor: "#ff5353ff",
      confirmButtonText: `Sí, ${action}`,
      cancelButtonText: "Cancelar",
      width: "500px",
    });

    if (!result.isConfirmed) return;

    setLoading(true);
    try {
      const url = editingItem
        ? `${API_BASE_URL}/api/mantenedores/${tipo}/${editingItem.id}`
        : `${API_BASE_URL}/api/mantenedores/${tipo}`;

      const method = editingItem ? "PUT" : "POST";

      const dataToSend = { ...formData };
      if (dataToSend.activo !== undefined) {
        dataToSend.activo = Number(dataToSend.activo);
      }

      console.log('📤 Enviando:', { url, method, data: dataToSend });

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
      }

      await Swal.fire({
        title: "✅ ¡Guardado!",
        text: `${config.singular} ${action === "crear" ? "creado" : "actualizado"} correctamente`,
        icon: "success",
        confirmButtonColor: "#0F2A44",
        timer: 2000,
      });

      await loadData();

      setIsModalOpen(false);
      setFormData({});
      setEditingItem(null);
    } catch (err) {
      console.error('❌ Error al guardar:', err);
      await Swal.fire({
        title: "❌ Error al guardar",
        text: err.message || "No se pudo guardar el registro",
        icon: "error",
        confirmButtonColor: "#0F2A44",
      });
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

          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
            <div className="text-sm">
              <p className="text-blue-800 font-semibold mb-1">Información importante</p>
              <p className="text-blue-700">
                Los registros <strong>no se pueden eliminar</strong> porque pueden estar siendo utilizados en manifiestos o BLs. 
                Solo puedes crear nuevos o editar los existentes.
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
              <AlertCircle className="text-red-600" size={20} />
              <div>
                <p className="text-red-800 font-semibold">Error al cargar datos</p>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            </div>
          )}

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
                        {searchTerm ? "No se encontraron resultados para tu búsqueda" : "No hay registros aún"}
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                        {config.fields.map((field) => (
                          <td key={field.key} className="px-6 py-4 text-sm text-slate-700">
                            {field.key === "codigo" || field.key === "tipo_cnt" || field.key === "tipo_bulto" || field.key === "token" ? (
                              <span className="font-mono font-semibold text-[#0F2A44]">{item[field.key]}</span>
                            ) : field.key === "activo" ? (
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                item[field.key] === 1 || item[field.key] === "1" 
                                  ? "bg-green-100 text-green-700" 
                                  : "bg-red-100 text-red-700"
                              }`}>
                                {item[field.key] === 1 || item[field.key] === "1" ? "Activo" : "Inactivo"}
                              </span>
                            ) : field.type === "textarea" ? (
                              <span className="line-clamp-2">{item[field.key] || "—"}</span>
                            ) : (
                              item[field.key] || "—"
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
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

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
                        ) : field.type === "select" ? (
                          <select
                            value={formData[field.key] ?? ""}
                            onChange={(e) => setFormData({ ...formData, [field.key]: Number(e.target.value) })}
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F2A44] focus:border-transparent transition"
                          >
                            <option value="">Seleccione...</option>
                            {field.options?.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={field.type || "text"}
                            value={formData[field.key] || ""}
                            onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                            className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F2A44] focus:border-transparent transition"
                            placeholder={field.placeholder || `Ingrese ${field.label.toLowerCase()}`}
                          />
                        )}

                        {field.helpText && (
                          <p className="mt-1 text-xs text-slate-500">{field.helpText}</p>
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