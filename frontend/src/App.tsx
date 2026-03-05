import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DiagramListPage }   from './pages/DiagramListPage';
import { DiagramEditorPage } from './pages/DiagramEditorPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                  element={<DiagramListPage />} />
        <Route path="/diagrams/:id"      element={<DiagramEditorPage />} />
        <Route path="*"                  element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
