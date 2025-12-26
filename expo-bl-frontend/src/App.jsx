import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Viajes from "./pages/Viajes";
import Expo from "./pages/Expo";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/viajes" element={<Viajes />} />
        <Route path="/expo/:blNumber" element={<Expo />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
