import { useNavigate } from "react-router-dom";
import logoBroom from "../img/logo_broom.png";

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0F2A44] flex items-center justify-center px-4">
      
      {/* Card tipo login */}
     <div className="
  w-full
  max-w-sm
  bg-white
  rounded-3xl
  shadow-2xl
  px-8
  py-10
  text-center
  animate-fade-in
">

        
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img
            src={logoBroom}
            alt="Broom Group"
            className="h-12 object-contain"
          />
        </div>

        {/* Texto */}
        <h1 className="text-xl font-semibold text-[#0F2A44]">
          Generador XML BL
        </h1>

<p className="text-sm text-slate-500 mt-3 mb-10">
          ¿Qué operación desea realizar?
        </p>

        {/* Botones */}
        <div className="space-y-4">

          {/* EXPO */}
          <button
            onClick={() => navigate("/expo")}
            className="
              w-full
              rounded-xl
              bg-[#0F2A44]
              text-white
              py-3
              font-semibold
              transition
              hover:bg-[#123A5C]
              hover:shadow-md
            "
          >
            EXPO
          </button>

          {/* IMPO */}
          <button
            disabled
            className="
              w-full
              rounded-xl
              bg-slate-200
              text-slate-400
              py-3
              font-semibold
              cursor-not-allowed
            "
          >
            IMPO · Próximamente
          </button>

        </div>
      </div>
    </div>
  );
};

export default Home;
