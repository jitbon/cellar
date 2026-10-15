import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router';
import { TooltipProvider } from './components/ui/Tooltip';
import { ResetPassword } from './pages/ResetPassword';
import { Settings } from './pages/Settings';
import { SignIn } from './pages/SignIn';
import { SignUp } from './pages/SignUp';
import { TripPlanner } from './pages/TripPlanner';
import { Trips } from './pages/Trips';
import { useAuthUser } from './state/services';

/** Signed-out users (including after session expiry) go to sign-in and return afterwards. */
function RequireAuth() {
  const { user, loading } = useAuthUser();
  const location = useLocation();
  if (loading) return <p aria-live="polite">Loading…</p>;
  if (!user) {
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/signin?returnTo=${returnTo}`} replace />;
  }
  return <Outlet />;
}

export function App() {
  return (
    <TooltipProvider>
      <Routes>
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route element={<RequireAuth />}>
          <Route path="/" element={<Trips />} />
          <Route path="/trips/:tripId" element={<TripPlanner />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </TooltipProvider>
  );
}
