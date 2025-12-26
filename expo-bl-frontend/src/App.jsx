import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import ExpoList from "./pages/ExpoList";
import Expo from "./pages/Expo";


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/expo" element={<ExpoList />} />
        <Route path="/expo/:blNumber" element={<Expo />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
