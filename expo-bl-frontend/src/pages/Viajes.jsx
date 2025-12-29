import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";

const manifiestosMock = [
  {
    id: "EVERFEAT-028W",
    service: "EVERGREEN",
    nave: "EVER FEAT",
    viaje: "028W",
    puertoCentral: "Valparaíso",
    ets: "25-11-2025",
    estado: "En edición",
    numeroManifiestoAduana: "",
  },
  {
    id: "EVERGOLD-031E",
    service: "EVERGREEN",
    nave: "EVER GOLD",
    viaje: "031E",
    puertoCentral: "Valparaíso",
    ets: "02-12-2025",
    estado: "Enviado a Aduana",
    numeroManifiestoAduana: "123456",
  },
];

const estadoStyles = {
  "En edición": "bg-amber-100 text-amber-800 ring-amber-200",
  "En revisión": "bg-blue-100 text-blue-800 ring-blue-200",
  "Enviado a Aduana": "bg-emerald-100 text-emerald-800 ring-emerald-200",
  Cerrado: "bg-slate-200 text-slate-700 ring-slate-300",
};

const Manifiestos = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-slate-100">
      {/* Sidebar */}
      <Sidebar />

      {/* Contenido */}
      <main className="flex-1 p-10">
        {/* Header + CTA */}
        <div className="flex items-start justify-between gap-6 mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-[#0F2A44]">
              Manifiestos (EXPO)
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Selecciona un manifiesto para gestionar sus BL de exportación
            </p>
          </div>

          <button
            onClick={() => navigate("/manifiestos/nuevo")}
            className="px-4 py-2 rounded-lg bg-[#0F2A44] text-white text-sm font-medium hover:opacity-90"
          >
            + Crear manifiesto
          </button>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-6 py-3 font-semibold">Service</th>
                <th className="text-left px-6 py-3 font-semibold">Nave</th>
                <th className="text-left px-6 py-3 font-semibold">Viaje</th>
                <th className="text-left px-6 py-3 font-semibold">Puerto central</th>
                <th className="text-left px-6 py-3 font-semibold">ETS</th>
                <th className="text-left px-6 py-3 font-semibold">Manifiesto Aduana</th>
                <th className="text-left px-6 py-3 font-semibold">Estado</th>
              </tr>
            </thead>

            <tbody>
              {manifiestosMock.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => navigate(`/manifiestos/${m.id}`)}
                  className="border-t hover:bg-slate-50 cursor-pointer"
                >
                  <td className="px-6 py-4">{m.service}</td>
                  <td className="px-6 py-4">{m.nave}</td>
                  <td className="px-6 py-4 font-medium">{m.viaje}</td>
                  <td className="px-6 py-4">{m.puertoCentral}</td>
                  <td className="px-6 py-4">{m.ets}</td>
                  <td className="px-6 py-4">
                    {m.numeroManifiestoAduana ? (
                      <span className="font-medium text-slate-700">
                        {m.numeroManifiestoAduana}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={[
                        "inline-flex items-center px-3 py-1 rounded-full text-xs ring-1",
                        estadoStyles[m.estado] ?? "bg-slate-100 text-slate-700 ring-slate-200",
                      ].join(" ")}
                    >
                      {m.estado}
                    </span>
                  </td>
                </tr>
              ))}

              {manifiestosMock.length === 0 && (
                <tr>
                  <td className="px-6 py-10 text-slate-500" colSpan={7}>
                    No hay manifiestos aún. Crea uno para comenzar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
};

export default Manifiestos;
