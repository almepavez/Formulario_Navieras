import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Manifiestos from "./pages/Manifiestos";
import Mantenedores from "./pages/Mantenedores";
import NuevoManifiesto from "./pages/NuevoManifiesto";
import Expo from "./pages/Expo";
import ManifiestoDetalle from "./pages/ManifiestoDetalle";
import CRUDMantenedor from "./components/CRUDMantenedor";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/Manifiestos" element={<Manifiestos />} />
        <Route path="/manifiestos/nuevo" element={<NuevoManifiesto />} />
        <Route path="/expo/:blNumber" element={<Expo />} />
        <Route path="/Mantenedores" element={<Mantenedores />} />
      <Route path="/mantenedores/:tipo" element={<CRUDMantenedor />} />
        <Route path="/manifiestos/:id" element={<ManifiestoDetalle />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
