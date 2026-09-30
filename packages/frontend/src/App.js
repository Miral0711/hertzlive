import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import DesktopApp from './desktop/DesktopApp';
import Login from './auth/Login';
import RequireAuth from './auth/RequireAuth';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/desktop/today" replace />} />
        <Route
          path="/desktop/*"
          element={(
            <RequireAuth>
              <DesktopApp />
            </RequireAuth>
          )}
        />
        <Route path="*" element={<Navigate to="/desktop/today" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
