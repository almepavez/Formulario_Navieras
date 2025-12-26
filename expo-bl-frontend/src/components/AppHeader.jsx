
import logo from "../img/logo_broom.png";


const AppHeader = () => {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-6">
        <img
          src={logo}
          alt="Broom Group"
          className="h-10 object-contain"
        />

        <div>
          <h1 className="text-xl font-semibold text-[#0F2A44]">
            Generador XML BL
          </h1>
          <p className="text-sm text-gray-500">
            Exportación (EXPO)
          </p>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
