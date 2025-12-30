import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Ship, Anchor, Globe, Package } from "lucide-react";
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
      iconColor: "text-teal-600"
    },
    {
      id: "servicios",
      title: "Servicios",
      description: "Configuración de líneas y servicios marítimos",
      icon: Globe,
      color: "from-purple-500 to-purple-600",
      bgColor: "bg-purple-50",
      iconColor: "text-purple-600"
    },
    {
      id: "naves",
      title: "Naves",
      description: "Registro y control de embarcaciones",
      icon: Package,
      color: "from-orange-500 to-orange-600",
      bgColor: "bg-orange-50",
      iconColor: "text-orange-600"
    }
  ];

  const handleCardClick = (id) => {
    navigate(`/mantenedores/${id}`);
  };

  return (
    <div className="flex">
    {/* Sidebar */}
    <Sidebar /> 
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
        
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-[#0F2A44] mb-3">
            Mantenedores
          </h1>
          <p className="text-lg text-slate-600">
            Administración de datos base del sistema
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {mantenedores.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                onClick={() => handleCardClick(item.id)}
                className="group relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer overflow-hidden transform hover:-translate-y-2"
              >
                {/* Gradient Background */}
                <div className={`absolute top-0 left-0 right-0 h-32 bg-gradient-to-br ${item.color} opacity-10 group-hover:opacity-20 transition-opacity`}></div>
                
                {/* Content */}
                <div className="relative p-6">
                  {/* Icon */}
                  <div className={`${item.bgColor} w-16 h-16 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon className={`${item.iconColor}`} size={32} strokeWidth={2} />
                  </div>

                  {/* Text */}
                  <h2 className="text-xl font-bold text-[#0F2A44] mb-2 group-hover:text-[#1a3f5f] transition-colors">
                    {item.title}
                  </h2>
                  <p className="text-sm text-slate-600 leading-relaxed mb-4">
                    {item.description}
                  </p>

                  {/* Arrow Button */}
                  <div className="flex items-center text-sm font-semibold text-[#0F2A44] group-hover:text-[#1a3f5f] group-hover:gap-2 transition-all">
                    <span>Administrar</span>
                    <svg 
                      className="w-5 h-5 transform group-hover:translate-x-1 transition-transform" 
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>

                {/* Hover Effect Border */}
                <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${item.color} transform scale-x-0 group-hover:scale-x-100 transition-transform`}></div>
              </div>
            );
          })}
        </div>

        {/* Info Section */}
        <div className="mt-12 bg-white rounded-xl shadow-md p-6 border-l-4 border-[#0F2A44]">
          <h3 className="text-lg font-semibold text-[#0F2A44] mb-2">
            ℹ️ Información
          </h3>
          <p className="text-slate-600 text-sm">
            Los mantenedores permiten configurar y gestionar los datos base del sistema. 
            Selecciona una categoría para comenzar a administrar los registros.
          </p>
        </div>
      </div>
    </div>
    </div>
  );
};

export default Mantenedores;