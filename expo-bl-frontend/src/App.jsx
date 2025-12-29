import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Manifiestos from "./pages/Manifiestos";
import Expo from "./pages/Expo";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/Manifiestos" element={<Manifiestos />} />
        <Route path="/expo/:blNumber" element={<Expo />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
