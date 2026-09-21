import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import useReminders from "./hooks/useReminders";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Search from "./pages/Search";
import TopicView from "./pages/TopicView";
import UploadLearn from "./pages/UploadLearn";
import Quiz from "./pages/Quiz";
import Flashcards from "./pages/Flashcards";
import AITutor from "./pages/AITutor";
import KnowledgeGaps from "./pages/KnowledgeGaps";
import Recommendations from "./pages/Recommendations";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";

function AppRoutes() {
  const { user } = useAuth();
  useReminders();

  return (
    <Routes>
      {/* Public */}
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />

      {/* FULL-SCREEN AI Tutor — no Layout wrapper */}
      <Route
        path="/ai-tutor"
        element={
          <ProtectedRoute>
            <AITutor />
          </ProtectedRoute>
        }
      />

      {/* Everything else inside the app Layout */}
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/search" element={<Search />} />
                <Route path="/topic/:id" element={<TopicView />} />
                <Route path="/upload" element={<UploadLearn />} />
                <Route path="/quiz" element={<Quiz />} />
                <Route path="/flashcards" element={<Flashcards />} />
                <Route path="/gaps" element={<KnowledgeGaps />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/recommendations" element={<Recommendations />} />
                <Route path="/settings" element={<Settings />} />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}