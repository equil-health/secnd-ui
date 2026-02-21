import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ReportPage from './pages/ReportPage';
import HistoryPage from './pages/HistoryPage';
import DemoPage from './pages/medsecondopinion_ui';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<DemoPage />} />
      <Route path="/app" element={<HomePage />} />
      <Route path="/report/:id" element={<ReportPage />} />
      <Route path="/history" element={<HistoryPage />} />
    </Routes>
  );
}
