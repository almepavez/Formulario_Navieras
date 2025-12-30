import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Manifiestos from "./pages/Manifiestos";
import Mantenedores from "./pages/Mantenedores";
import Expo from "./pages/Expo";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/Manifiestos" element={<Manifiestos />} />
        <Route path="/expo/:blNumber" element={<Expo />} />
        <Route path="/Mantenedores" element={<Mantenedores />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
