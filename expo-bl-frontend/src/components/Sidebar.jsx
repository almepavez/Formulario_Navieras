import { NavLink } from "react-router-dom";
import logo from "../img/SGA Logo 3.png";

const Sidebar = () => {
  return (
    <aside className="w-64 bg-[#0F2A44] text-white flex flex-col p-6">
      
      {/* Logo */}
      <div className="flex justify-center mb-10">
        <img src={logo} alt="Broom Group" className="h-30" />
      </div>

      {/* Menú */}
      <nav className="flex flex-col gap-3 text-sm">
        <NavLink
          to="/manifiestos"
          className={({ isActive }) =>
            `px-4 py-2 rounded-lg ${
              isActive ? "bg-white/20" : "hover:bg-white/10"
            }`
          }
        >
          🚢 Viajes
        </NavLink>

        <NavLink
          to="/expo-BL"
          className={({ isActive }) =>
            `px-4 py-2 rounded-lg ${
              isActive ? "bg-white/20" : "hover:bg-white/10"
            }`
          }
        >
          📦 EXPO BL
        </NavLink>

        <NavLink
          to="#"
          className="px-4 py-2 rounded-lg opacity-40 cursor-not-allowed"
        >
          📥 IMPO BL (Próx.)
        </NavLink>

        <NavLink
           to="/mantenedores"
          className={({ isActive }) =>
            `px-4 py-2 rounded-lg ${
              isActive ? "bg-white/20" : "hover:bg-white/10"
            }`
          }
        >
          ⚙️ Mantenedores
        </NavLink>
      </nav>

      {/* Footer */}
      <div className="mt-auto text-xs opacity-60">
        © Broom Group · Uso interno
      </div>
    </aside>
  );
};

export default Sidebar;
