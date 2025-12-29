import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Manifiestos from "./pages/Manifiestos";
import NuevoManifiesto from "./pages/NuevoManifiesto";
import Expo from "./pages/Expo";
import ManifiestoDetalle from "./pages/ManifiestoDetalle";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/Manifiestos" element={<Manifiestos />} />
        <Route path="/manifiestos/nuevo" element={<NuevoManifiesto />} />
        <Route path="/expo/:blNumber" element={<Expo />} />
        <Route path="/manifiestos/:id" element={<ManifiestoDetalle />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
