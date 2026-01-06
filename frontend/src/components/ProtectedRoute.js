import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ProtectedRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // CRITICAL: If we have a session_id in the hash, don't redirect to login!
    // This is a Google OAuth callback - let App.js handle it
    const hash = window.location.hash;
    if (hash?.includes('session_id=')) {
      console.log('ProtectedRoute: Detected session_id in hash, skipping auth check');
      return; // Don't do anything, let the router handle it
    }

    // If user data passed from AuthCallback, skip auth check
    if (location.state?.user) {
      // Use a microtask to avoid synchronous state update within effect
      queueMicrotask(() => {
        setUser(location.state.user);
        setIsAuthenticated(true);
      });
      return;
    }

    const checkAuth = async () => {
      try {
        const response = await axios.get(`${API}/auth/me`, {
          withCredentials: true
        });
        setUser(response.data);
        setIsAuthenticated(true);
      } catch (error) {
        setIsAuthenticated(false);
        // Preserve hash when redirecting to login (important for OAuth callbacks)
        const currentHash = window.location.hash;
        navigate('/login' + (currentHash || ''), { replace: true });
      }
    };

    checkAuth();
  }, [navigate, location.state]);

  // If we have session_id in hash, show loading while router figures it out
  const hash = window.location.hash;
  if (hash?.includes('session_id=')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-400">Processing login...</p>
        </div>
      </div>
    );
  }

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return children;
}
