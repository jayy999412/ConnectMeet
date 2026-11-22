import { Navigate, Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import { useAuth } from '../context/AuthContext.jsx';

/** Wrapper for public pages: marketing navbar, unless the user is logged in. */
export default function PublicLayout() {
  const { isAuthenticated } = useAuth();
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <Outlet />
    </div>
  );
}

/** Redirects already-authenticated users away from login/register. */
export function GuestRoute() {
  const { isAuthenticated, booting } = useAuth();
  if (booting) return null;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
