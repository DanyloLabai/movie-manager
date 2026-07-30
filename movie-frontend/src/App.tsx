import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Watchlist from "./pages/Watchlist";
import Search from "./pages/Search";
import AiChat from "./pages/AiChat";
import DailyQuiz from "./pages/DailyQuiz";
import MovieDetails from "./pages/MovieDetails";
import ChangePassword from "./pages/ChangePassword";
import VerifyEmail from "./pages/VerifyEmail";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import PublicProfile from "./pages/PublicProfile";
import ActorDetails from "./pages/ActorDetails";
import Top100 from "./pages/Top100";
import Notifications from "./pages/Notifications";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";
import Discover from "./pages/Discover";
import { ApiNotification } from "./components/ApiNotification";
import BottomNav from "./components/BottomNav";
import Sidebar, { SIDEBAR_PADDING_CLASS } from "./components/layout/Sidebar";
import type { JSX } from "react";

const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#12100e]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#c8963c]"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function AppRoutes() {
  const location = useLocation();

  return (
    <div key={location.pathname} className="animate-page-in">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />

        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route path="/user/:id" element={<PublicProfile />} />

        <Route
          path="/top100/:type"
          element={
            <ProtectedRoute>
              <Top100 />
            </ProtectedRoute>
          }
        />

        <Route
          path="/change-password"
          element={
            <ProtectedRoute>
              <ChangePassword />
            </ProtectedRoute>
          }
        />

        <Route
          path="/search"
          element={
            <ProtectedRoute>
              <Search />
            </ProtectedRoute>
          }
        />

        <Route
          path="/watchlist"
          element={
            <ProtectedRoute>
              <Watchlist />
            </ProtectedRoute>
          }
        />

        <Route
          path="/discover"
          element={
            <ProtectedRoute>
              <Discover />
            </ProtectedRoute>
          }
        />

        <Route
          path="/ai-chat"
          element={
            <ProtectedRoute>
              <AiChat />
            </ProtectedRoute>
          }
        />

        <Route
          path="/quiz"
          element={
            <ProtectedRoute>
              <DailyQuiz />
            </ProtectedRoute>
          }
        />

        <Route
          path="/movie/:id"
          element={
            <ProtectedRoute>
              <MovieDetails />
            </ProtectedRoute>
          }
        />

        <Route
          path="/actor/:id"
          element={
            <ProtectedRoute>
              <ActorDetails />
            </ProtectedRoute>
          }
        />

        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <Notifications />
            </ProtectedRoute>
          }
        />

        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <Admin />
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<Navigate to="/search" replace />} />
        <Route path="*" element={<Navigate to="/search" replace />} />
      </Routes>
    </div>
  );
}

function AppShell() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-[100dvh] bg-[#12100e] text-[#f0e6cc] font-sans overscroll-none selection:bg-[#c8963c] selection:text-[#12100e]">
      <ApiNotification />
      {isAuthenticated && <Sidebar />}
      <div className={isAuthenticated ? SIDEBAR_PADDING_CLASS : undefined}>
        <AppRoutes />
      </div>
      {isAuthenticated && <BottomNav />}
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

export default App;
