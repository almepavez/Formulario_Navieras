import { useNavigate } from "react-router-dom";

const mockBLs = [
  {
    id: 1,
    nave: "EVER FEAT",
    viaje: "028W",
    bl: "SCL500494400",
    puertoEmbarque: "GUAM",
    puertoDescarga: "SHANGHAI",
    fecha: "11-12-2025",
    estado: "Pendiente"
  },
  {
    id: 2,
    nave: "EVER FEAT",
    viaje: "028W",
    bl: "SCL500542700",
    puertoEmbarque: "GUAM",
    puertoDescarga: "HONG KONG",
    fecha: "11-12-2025",
    estado: "XML OK"
  }
];

const ExpoList = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0F2A44] px-10 py-12">
      <div className="max-w-6xl mx-auto bg-white rounded-3xl shadow-xl p-8">

        <h1 className="text-2xl font-semibold text-[#0F2A44] mb-6">
          Exportación · Listado de BLs
        </h1>

        <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="p-3 text-left">Nave</th>
              <th className="p-3 text-left">Viaje</th>
              <th className="p-3 text-left">BL</th>
              <th className="p-3 text-left">P. Embarque</th>
              <th className="p-3 text-left">P. Descarga</th>
              <th className="p-3 text-left">Fecha</th>
              <th className="p-3 text-left">Estado</th>
              <th className="p-3 text-center">Acción</th>
            </tr>
          </thead>

          <tbody>
            {mockBLs.map(bl => (
              <tr key={bl.id} className="border-t">
                <td className="p-3">{bl.nave}</td>
                <td className="p-3">{bl.viaje}</td>
                <td className="p-3 font-medium">{bl.bl}</td>
                <td className="p-3">{bl.puertoEmbarque}</td>
                <td className="p-3">{bl.puertoDescarga}</td>
                <td className="p-3">{bl.fecha}</td>
                <td className="p-3">
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      bl.estado === "XML OK"
                        ? "bg-green-100 text-green-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {bl.estado}
                  </span>
                </td>
                <td className="p-3 text-center">
                  <button
                    onClick={() => navigate(`/expo/${bl.bl}`)}
                    className="px-4 py-1 rounded bg-[#0F2A44] text-white text-xs"
                  >
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

      </div>
    </div>
  );
};

export default ExpoList;
