// frontend/src/App.tsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import OverviewPanel from "./components/OverviewPanel";

// Fallback neutre (aucune erreur d’import)
const Empty: React.FC = () => <div />;

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/overview" replace />} />
        <Route path="/overview" element={<OverviewPanel />} />
        {/* Lien vers enchères temporairement désactivé */}
        <Route path="/auctions" element={<Empty />} />
        <Route path="*" element={<Empty />} />
      </Routes>
    </BrowserRouter>
  );
}
