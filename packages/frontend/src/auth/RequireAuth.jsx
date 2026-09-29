import { Navigate, useLocation } from 'react-router-dom';
import { isAuthenticated } from './authClient';

// Wraps the existing /desktop/* route (see App.js) so every page under it — Today,
// Dashboard, Projects, Sites, Chats, Schedule, People, Resources, Files, Vendors,
// Samples, Templates, Settings — requires a real signed-in session, without each
// page needing its own guard.
export default function RequireAuth({ children }) {
  const location = useLocation();
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return children;
}
