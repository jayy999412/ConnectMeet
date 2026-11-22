import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { PageLoader } from './Loader.jsx';

/**
 * Guards private routes. Waits for the session restore to finish before
 * redirecting so authenticated users never bounce through /login.
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, booting } = useAuth();
  const location = useLocation();

  if (booting) return <PageLoader />;

  if (!isAuthenticated) {
    // `pathname` alone drops the query string. Invite links carry the meeting
    // code as `/join?code=XXXXX-XXXXX`, so the full path must be preserved or
    // the guest loses the code the moment they are asked to log in.
    return (
      <Navigate
        to="/login"
        state={{ from: `${location.pathname}${location.search}` }}
        replace
      />
    );
  }

  return children;
}
