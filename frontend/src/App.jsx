import { Routes, Route, Navigate } from 'react-router-dom';
import PublicLayout, { GuestRoute } from './layouts/PublicLayout.jsx';
import DashboardLayout from './layouts/DashboardLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import CreateMeeting from './pages/CreateMeeting.jsx';
import JoinMeeting from './pages/JoinMeeting.jsx';
import MeetingRoom from './pages/MeetingRoom.jsx';
import MeetingHistory from './pages/MeetingHistory.jsx';
import Profile from './pages/Profile.jsx';
import Settings from './pages/Settings.jsx';
import NotFound from './pages/NotFound.jsx';

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route element={<PublicLayout />}>
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>
        <Route path="/" element={<LandingPage />} />
        {/* Public on purpose: invite links must open for people with no
            account. The page itself handles both guests and signed-in users. */}
        <Route path="/join" element={<JoinMeeting />} />
      </Route>

      {/* Authenticated app shell */}
      <Route
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/meetings/new" element={<CreateMeeting />} />
        <Route path="/meetings/history" element={<MeetingHistory />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      {/* The meeting room renders full-screen (no sidebar) */}
      <Route
        path="/room/:meetingId"
        element={
          <ProtectedRoute>
            <MeetingRoom />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
