import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Progress from "./pages/Progress";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import StudyPlan from "./pages/StudyPlan";
import Quiz from "./pages/Quiz";
import AITutor from "./pages/AITutor";
import MySubjects from "./pages/MySubjects";
import MyTopics from "./pages/MyTopics";
import Placeholder from "./pages/Placeholder";

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <Login />}
      />

      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/subjects" element={<MySubjects />} />
                <Route path="/topics" element={<MyTopics />} />
                <Route path="/study-plan" element={<StudyPlan />} />
                <Route path="/quiz" element={<Quiz />} />
                <Route path="/ai-tutor" element={<AITutor />} />
                <Route path="/progress" element={<Progress />} />
                <Route
                  path="/settings"
                  element={<Placeholder title="Settings" />}
                />
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