import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import StudyPlan from "./pages/StudyPlan";
import Quiz from "./pages/Quiz";
import AITutor from "./pages/AITutor";

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/study-plan" element={<StudyPlan />} />
        <Route path="/quiz" element={<Quiz />} />
        <Route path="/ai-tutor" element={<AITutor />} />
      </Routes>
    </BrowserRouter>
  );
}