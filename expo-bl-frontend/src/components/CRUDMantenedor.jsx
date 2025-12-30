import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { PlusCircle, Edit2, Trash2, Search, X, Save, ArrowLeft, Anchor, Globe, Package, AlertCircle } from "lucide-react";
import Sidebar from "../components/Sidebar";

// ⚙️ CONFIGURACIÓN - Cambia esta URL según tu entorno
const API_BASE_URL = "http://localhost:4000";

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

  // Configuración de cada mantenedor (ajustada a tu BD)
  const configs = {
    puertos: {
      title: "Puertos",
      singular: "Puerto",
      icon: Anchor,
      color: "teal",
      fields: [
        { key: "codigo", label: "Código", type: "text", required: true, placeholder: "CLVAP, CNHKG" },
        { key: "nombre", label: "Nombre del Puerto", type: "text", required: true, placeholder: "VALPARAISO" },
        { key: "pais", label: "País", type: "text", required: true, placeholder: "Chile" },
      ]
    },
    servicios: {
      title: "Servicios",
      singular: "Servicio",
      icon: Globe,
      color: "purple",
      fields: [
        { key: "codigo", label: "Código", type: "text", required: true, placeholder: "WSA, WS6" },
        { key: "nombre", label: "Nombre del Servicio", type: "text", required: true, placeholder: "South West Asia Service" },
        { key: "descripcion", label: "Descripción", type: "textarea", placeholder: "Servicio Chile - Asia" },
        { key: "frecuencia", label: "Frecuencia", type: "text", placeholder: "Weekly, Bi-weekly" },
      ]
    },
    naves: {
      title: "Naves",
      singular: "Nave",
      icon: Package,
      color: "orange",
      fields: [
        { key: "nombre", label: "Nombre de la Nave", type: "text", required: true, placeholder: "EVER FEAT" },
        { key: "imo", label: "Número IMO", type: "text", placeholder: "IMO9876543" },
        { key: "bandera", label: "Bandera", type: "text", placeholder: "Panamá" },
        { key: "capacidad_teus", label: "Capacidad (TEUs)", type: "number", placeholder: "14000" },
      ]
    }
  };

  const config = configs[tipo];
  const Icon = config?.icon;

  // 🔄 Cargar datos desde la API
  useEffect(() => {
    if (config) {
      loadData();
    }
  }, [tipo]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/mantenedores/${tipo}`);
      if (!response.ok) throw new Error(`Error ${response.status}: ${response.statusText}`);
      const data = await response.json();
      setItems(data);
    } catch (err) {
      setError(err.message);
      console.error("Error cargando datos:", err);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item =>
    Object.values(item).some(val =>
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
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
    setFormData(item);
    setIsModalOpen(true);
  };

  // 🗑️ DELETE - Eliminar registro
  const handleDelete = async (id) => {
    if (!window.confirm(`¿Está seguro de eliminar este registro?`)) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/mantenedores/${tipo}/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Error al eliminar");

      // Actualizar la lista localmente
      setItems(items.filter(item => item.id !== id));
    } catch (err) {
      alert(`Error al eliminar: ${err.message}`);
      console.error("Error:", err);
    }
  };

  // 💾 POST/PUT - Crear o actualizar registro
  const handleSave = async () => {
    // Validación básica
    const requiredFields = config.fields.filter(f => f.required);
    const isValid = requiredFields.every(field => formData[field.key]?.trim());

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
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al guardar");
      }

      const savedData = await response.json();

      // Actualizar la lista localmente
      if (editingItem) {
        setItems(items.map(item => item.id === editingItem.id ? { ...formData, id: item.id } : item));
      } else {
        // Recargar para obtener el ID correcto del servidor
        await loadData();
      }
      
      setIsModalOpen(false);
      setFormData({});
    } catch (err) {
      alert(`Error al guardar: ${err.message}`);
      console.error("Error:", err);
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

  return (
     <div className="flex">
    {/* Sidebar */}
    <Sidebar /> 
<div className="flex-1 min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
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
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`bg-${config.color}-100 p-4 rounded-xl`}>
                <Icon className={`text-${config.color}-600`} size={32} strokeWidth={2} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-[#0F2A44]">
                  {config.title}
                </h1>
                <p className="text-slate-600 mt-1">
                  {loading ? "Cargando..." : `${items.length} ${items.length === 1 ? 'registro' : 'registros'}`}
                </p>
              </div>
            </div>
            <button
              onClick={handleAdd}
              disabled={loading}
              className="flex items-center gap-2 bg-[#0F2A44] text-white px-6 py-3 rounded-xl hover:bg-[#1a3f5f] transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <PlusCircle size={20} />
              Agregar {config.singular}
            </button>
          </div>
        </div>

        {/* Error Message */}
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
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
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
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200">
                <tr>
                  {config.fields.map(field => (
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
                    <td colSpan={config.fields.length + 1} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-400">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0F2A44] mb-3"></div>
                        <p className="text-lg font-medium">Cargando datos...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={config.fields.length + 1} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center text-slate-400">
                        <Icon size={48} strokeWidth={1} className="mb-3" />
                        <p className="text-lg font-medium">No se encontraron registros</p>
                        <p className="text-sm mt-1">
                          {searchTerm ? "Intenta con otra búsqueda" : "Agrega un nuevo registro para comenzar"}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      {config.fields.map(field => (
                        <td key={field.key} className="px-6 py-4 text-sm text-slate-700">
                          {field.key === 'codigo' ? (
                            <span className="font-mono font-semibold text-[#0F2A44]">{item[field.key]}</span>
                          ) : field.type === 'textarea' ? (
                            <span className="line-clamp-2">{item[field.key] || '-'}</span>
                          ) : (
                            item[field.key] || '-'
                          )}
                        </td>
                      ))}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(item)}
                            className="p-2 text-[#0F2A44] hover:bg-blue-50 rounded-lg transition-all"
                            title="Editar"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
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
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white flex items-center justify-between p-6 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className={`bg-${config.color}-100 p-2 rounded-lg`}>
                  <Icon className={`text-${config.color}-600`} size={24} />
                </div>
                <h2 className="text-2xl font-bold text-[#0F2A44]">
                  {editingItem ? `Editar ${config.singular}` : `Nuevo ${config.singular}`}
                </h2>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-lg transition-all"
                disabled={loading}
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {config.fields.map(field => (
                  <div key={field.key} className={field.key === 'nombre' || field.key === 'descripcion' ? 'md:col-span-2' : ''}>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                    </label>
                    {field.type === "textarea" ? (
                      <textarea
                        value={formData[field.key] || ""}
                        onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F2A44] focus:border-transparent transition-all resize-none"
                        placeholder={field.placeholder || `Ingrese ${field.label.toLowerCase()}`}
                        rows={3}
                      />
                    ) : (
                      <input
                        type={field.type || "text"}
                        value={formData[field.key] || ""}
                        onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                        className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0F2A44] focus:border-transparent transition-all"
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
                className="px-6 py-3 text-slate-700 hover:bg-slate-200 rounded-xl transition-all font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex items-center gap-2 bg-[#0F2A44] text-white px-6 py-3 rounded-xl hover:bg-[#1a3f5f] transition-all shadow-lg hover:shadow-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed"
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
    </div>
  );
};

export default CRUDMantenedor;