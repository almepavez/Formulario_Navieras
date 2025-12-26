import Sidebar from "../components/Sidebar";

const viajesMock = [
  {
    id: "EVERFEAT-028W",
    nave: "EVER FEAT",
    viaje: "028W",
    fechaZarpe: "25-11-2025",
    estado: "En edición"
  },
  {
    id: "EVERGOLD-031E",
    nave: "EVER GOLD",
    viaje: "031E",
    fechaZarpe: "02-12-2025",
    estado: "Enviado a Aduana"
  }
];

const Viajes = () => {
  return (
    <div className="flex min-h-screen bg-slate-100">
      
      {/* Sidebar */}
      <Sidebar />

      {/* Contenido */}
      <main className="flex-1 p-10">
        <h1 className="text-2xl font-semibold text-[#0F2A44] mb-6">
          Viajes
        </h1>

        <p className="text-sm text-slate-500 mb-8">
          Selecciona un viaje para gestionar sus BL de exportación
        </p>

        {/* Tabla */}
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="text-left px-6 py-3">Nave</th>
                <th className="text-left px-6 py-3">Viaje</th>
                <th className="text-left px-6 py-3">Zarpe</th>
                <th className="text-left px-6 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {viajesMock.map(v => (
                <tr
                  key={v.id}
                  className="border-t hover:bg-slate-50 cursor-pointer"
                >
                  <td className="px-6 py-4">{v.nave}</td>
                  <td className="px-6 py-4 font-medium">{v.viaje}</td>
                  <td className="px-6 py-4">{v.fechaZarpe}</td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
                      {v.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
};

export default Viajes;
