import { useState } from "react";
import { useNavigate } from "react-router-dom";const Mantenedores = () => {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-[#0F2A44] mb-2">
        Mantenedores
      </h1>
      <p className="text-sm text-slate-500 mb-8">
        Administración de datos base del sistema
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

        <Card title="Navieras" />
        <Card title="Puertos" />
        <Card title="Servicios" />
        <Card title="Naves" />

      </div>
    </div>
  );
};

const Card = ({ title }) => (
  <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200 hover:shadow-md transition">
    <h2 className="text-lg font-medium text-[#0F2A44] mb-2">
      {title}
    </h2>
    <p className="text-sm text-slate-500 mb-4">
      Gestión de {title.toLowerCase()}
    </p>
    <button className="text-sm text-[#0F2A44] font-medium hover:underline">
      Entrar →
    </button>
  </div>
);

export default Mantenedores;
