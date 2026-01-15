import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { 
  FileText, 
  Ship, 
  Package,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut
} from "lucide-react";
import logo from "../img/SGA Logo 3.png";

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // El sidebar está expandido si no está colapsado O si está en hover
  const isExpanded = !isCollapsed || isHovered;

  const handleLogout = () => {
    // Limpiar token del localStorage
    localStorage.removeItem("token");
    localStorage.removeItem("usuario");
    
    // Redirigir al login
    navigate("/login");
  };

  return (
    <aside 
      className={`bg-[#0F2A44] text-white flex flex-col transition-all duration-300 ease-in-out ${
        isExpanded ? "w-64" : "w-20"
      }`}
      onMouseEnter={() => isCollapsed && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header con logo y botón */}
      <div className="p-6 border-b border-white/10 relative">
        <div className="flex justify-center mb-2">
          {isExpanded ? (
            <img src={logo} alt="Broom Group" className="h-25" />
          ) : (
            <img src={logo} alt="Broom Group" className="h-20 w-15 object-contain" />
          )}
        </div>
        
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-white/10 transition-colors"
          title={isCollapsed ? "Expandir" : "Colapsar"}
        >
          {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* Menú */}
      <nav className="flex-1 p-4 space-y-2">
        <NavLink
          to="/manifiestos"
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 rounded-lg transition-all group relative ${
              isActive ? "bg-white/15 text-white font-medium" : "text-slate-300 hover:bg-white/10 hover:text-white"
            }`
          }
          title={!isExpanded ? "Manifiestos" : ""}
        >
          <FileText size={20} className="flex-shrink-0" />
          {isExpanded && <span className="text-sm">Manifiestos</span>}
          
          {/* Tooltip cuando está colapsado Y NO en hover */}
          {!isExpanded && (
            <div className="absolute left-full ml-2 px-3 py-2 bg-slate-800 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
              Manifiestos
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-slate-800"></div>
            </div>
          )}
        </NavLink>

        <NavLink
          to="/expo-bl"
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 rounded-lg transition-all group relative ${
              isActive || location.pathname.startsWith('/expo/') 
                ? "bg-white/15 text-white font-medium" 
                : "text-slate-300 hover:bg-white/10 hover:text-white"
            }`
          }
          title={!isExpanded ? "EXPO BL" : ""}
        >
          <Ship size={20} className="flex-shrink-0" />
          {isExpanded && <span className="text-sm">EXPO BL</span>}
          
          {/* Tooltip cuando está colapsado Y NO en hover */}
          {!isExpanded && (
            <div className="absolute left-full ml-2 px-3 py-2 bg-slate-800 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
              EXPO BL
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-slate-800"></div>
            </div>
          )}
        </NavLink>

        <div
          className="flex items-center gap-3 px-4 py-3 rounded-lg opacity-50 cursor-not-allowed relative group"
          title={!isExpanded ? "IMPO BL (Próximamente)" : "Próximamente"}
        >
          <Package size={20} className="flex-shrink-0" />
          
          {isExpanded && (
            <>
              <span className="text-sm">IMPO BL</span>
              <span className="ml-auto text-xs bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded">
                Próx.
              </span>
            </>
          )}
          
          {/* Tooltip cuando está colapsado Y NO en hover */}
          {!isExpanded && (
            <div className="absolute left-full ml-2 px-3 py-2 bg-slate-800 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
              IMPO BL
              <span className="block text-xs text-yellow-300 mt-1">Próximamente</span>
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-slate-800"></div>
            </div>
          )}
        </div>

        <NavLink
          to="/mantenedores"
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 rounded-lg transition-all group relative ${
              isActive ? "bg-white/15 text-white font-medium" : "text-slate-300 hover:bg-white/10 hover:text-white"
            }`
          }
          title={!isExpanded ? "Mantenedores" : ""}
        >
          <Settings size={20} className="flex-shrink-0" />
          {isExpanded && <span className="text-sm">Mantenedores</span>}
          
          {/* Tooltip cuando está colapsado Y NO en hover */}
          {!isExpanded && (
            <div className="absolute left-full ml-2 px-3 py-2 bg-slate-800 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
              Mantenedores
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-slate-800"></div>
            </div>
          )}
        </NavLink>
      </nav>

      {/* Footer con Logout */}
      <div className="p-4 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-lg transition-all group relative w-full text-slate-300 hover:bg-red-500/20 hover:text-red-400"
          title={!isExpanded ? "Cerrar Sesión" : ""}
        >
          <LogOut size={20} className="flex-shrink-0" />
          {isExpanded && <span className="text-sm">Cerrar Sesión</span>}
          
          {/* Tooltip cuando está colapsado */}
          {!isExpanded && (
            <div className="absolute left-full ml-2 px-3 py-2 bg-slate-800 text-white text-sm rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
              Cerrar Sesión
              <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-slate-800"></div>
            </div>
          )}
        </button>

        {isExpanded && (
          <div className="mt-3 text-xs text-slate-400 text-center">
            © Broom Group · Uso interno
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;