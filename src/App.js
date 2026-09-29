import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import DesktopApp from './desktop/DesktopApp';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/desktop/today" replace />} />
        <Route path="/desktop/*" element={<DesktopApp />} />
        <Route path="*" element={<Navigate to="/desktop/today" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
