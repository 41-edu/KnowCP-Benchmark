import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { PanoramaExplorerPage } from "./pages/PanoramaExplorerPage";

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/panorama/:domain" element={<PanoramaExplorerPage />} />
        <Route path="/panorama/:domain/:topId" element={<PanoramaExplorerPage />} />
        <Route path="/panorama/:domain/:topId/:secondId" element={<PanoramaExplorerPage />} />
        <Route
          path="/panorama/:domain/:topId/:secondId/:thirdId"
          element={<PanoramaExplorerPage />}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
