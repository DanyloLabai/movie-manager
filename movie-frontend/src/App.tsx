import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Watchlist from "./pages/Watchlist";
import Search from "./pages/Search";
import AiChat from "./pages/AiChat";

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-900 text-white font-sans">
        <Routes>
          {/* За замовчуванням ведемо на пошук */}
          <Route path="/" element={<Navigate to="/search" replace />} />

          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/search" element={<Search />} />
          <Route path="/watchlist" element={<Watchlist />} />
          <Route path="/ai-chat" element={<AiChat />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
