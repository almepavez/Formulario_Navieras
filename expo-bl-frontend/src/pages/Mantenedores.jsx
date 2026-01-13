import { useNavigate } from "react-router-dom";
import { Anchor, Globe, Package } from "lucide-react";
import Sidebar from "../components/Sidebar";

const Mantenedores = () => {
  const navigate = useNavigate();

  const mantenedores = [
    {
      id: "puertos",
      title: "Puertos",
      description: "Administración de puertos de carga y descarga",
      icon: Anchor,
      color: "from-teal-500 to-teal-600",
      bgColor: "bg-teal-50",
      iconColor: "text-teal-600",
    },
    {
      id: "servicios",
      title: "Servicios",
      description: "Configuración de líneas y servicios marítimos",
      icon: Globe,
      color: "from-purple-500 to-purple-600",
      bgColor: "bg-purple-50",
      iconColor: "text-purple-600",
    },
    {
      id: "naves",
      title: "Naves",
      description: "Registro y control de embarcaciones",
      icon: Package,
      color: "from-orange-500 to-orange-600",
      bgColor: "bg-orange-50",
      iconColor: "text-orange-600",
    },
  ];

  const handleCardClick = (id) => navigate(`/mantenedores/${id}`);

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Sidebar */}
      <Sidebar />

      {/* Contenido (igual que Manifiestos) */}
      <main className="flex-1 p-6 sm:p-8 lg:p-10">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8 sm:mb-10">
            <h1 className="text-2xl sm:text-3xl font-semibold text-[#0F2A44]">
              Mantenedores
            </h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1">
              Administración de datos base del sistema
            </p>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {mantenedores.map((item) => {
              const Icon = item.icon;
              return (
              <button
                key={item.id}
                onClick={() => handleCardClick(item.id)}
                className="text-left group bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition overflow-hidden min-h-[220px] flex flex-col"
              >
                {/* HEADER (zona color fija) */}
                <div className={`relative h-20 bg-gradient-to-br ${item.color}`}>
                  {/* opcional: overlay suave para look más corporativo */}
                  <div className="absolute inset-0 opacity-70 bg-white/80" />
                </div>

                {/* BODY (zona blanca consistente) */}
                <div className="flex-1 p-5 sm:p-6 -mt-8 relative">
                  {/* Icon “flotando” siempre en el mismo lugar */}
                  <div className={`${item.bgColor} w-14 h-14 rounded-xl flex items-center justify-center ring-1 ring-black/5 mb-4`}>
                    <item.icon className={item.iconColor} size={30} strokeWidth={2} />
                  </div>

                  {/* Título fijo (1 línea) */}
                  <h2 className="text-lg font-semibold text-[#0F2A44] leading-snug line-clamp-1">
                    {item.title}
                  </h2>

                  {/* Descripción fija (2 líneas) */}
                  <p className="mt-1 text-sm text-slate-600 leading-relaxed line-clamp-2">
                    {item.description}
                  </p>

                  {/* Footer fijo abajo */}
                  <div className="mt-4 flex items-center text-sm font-medium text-[#0F2A44] gap-1 group-hover:gap-2 transition-all">
                    <span>Administrar</span>
                    <svg
                      className="w-5 h-5 group-hover:translate-x-1 transition-transform"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>

                {/* barra inferior */}
                <div className={`h-1 bg-gradient-to-r ${item.color}`} />
              </button>
              );
            })}
          </div>

          {/* Info */}
          <div className="mt-8 sm:mt-10 bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6">
            <h3 className="text-sm sm:text-base font-semibold text-[#0F2A44] mb-2">
              Información
            </h3>
            <p className="text-slate-600 text-sm">
              Los mantenedores permiten configurar y gestionar los datos base del sistema.
              Selecciona una categoría para comenzar a administrar los registros.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Mantenedores;
