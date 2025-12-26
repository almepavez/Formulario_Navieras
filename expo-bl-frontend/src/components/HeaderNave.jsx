const HeaderNave = () => {
  // Datos mock EXPO (ejemplo)
  const cabecera = {
    nave: "EVER FEAT",
    viaje: "025E",
    puertoOrigen: "SAN ANTONIO, CL",
    puertoDestino: "SINGAPORE, SG",
    fechaZarpe: "25-11-2025",
    sentidoOperacion: "SALIDA (EXPO)",
    tipoServicio: "FCL/FCL",
  };

  return (
    <div className="bg-white shadow p-6 m-6 rounded-lg">
      <h2 className="text-xl font-semibold mb-4 text-gray-800">
        Cabecera de la Nave
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <Campo label="Nave" value={cabecera.nave} />
        <Campo label="Viaje" value={cabecera.viaje} />
        <Campo label="Puerto Origen" value={cabecera.puertoOrigen} />
        <Campo label="Puerto Destino" value={cabecera.puertoDestino} />
        <Campo label="Fecha Zarpe" value={cabecera.fechaZarpe} />
        <Campo label="Sentido Operación" value={cabecera.sentidoOperacion} />
        <Campo label="Tipo Servicio" value={cabecera.tipoServicio} />
      </div>
    </div>
  );
};

const Campo = ({ label, value }) => (
  <div>
    <label className="block text-sm font-medium text-gray-600 mb-1">
      {label}
    </label>
    <input
      type="text"
      value={value}
      readOnly
      className="w-full rounded border-gray-300 bg-gray-100 px-3 py-2 text-gray-800"
    />
  </div>
);

export default HeaderNave;
