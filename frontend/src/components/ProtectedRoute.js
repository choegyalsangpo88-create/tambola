import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function ProtectedRoute({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const authCheckDone = useRef(false);

  useEffect(() => {
    // Prevent duplicate auth checks
    if (authCheckDone.current) return;

    const checkAuth = async () => {
      console.log('ProtectedRoute: Checking auth...');
      
      // If user data passed from navigation state, use it directly
      if (location.state?.user) {
        console.log('ProtectedRoute: Using user from navigation state');
        setUser(location.state.user);
        setIsAuthenticated(true);
        authCheckDone.current = true;
        return;
      }

      // PRIORITY 1: Check localStorage first (most reliable for mobile)
      const storedSession = localStorage.getItem('tambola_session');
      const storedUser = localStorage.getItem('tambola_user');
      
      console.log('ProtectedRoute: localStorage session exists:', !!storedSession);
      
      if (storedSession) {
        try {
          // Verify with backend using Authorization header
          const response = await axios.get(`${API}/auth/me`, {
            headers: { 'Authorization': `Bearer ${storedSession}` },
            withCredentials: true
          });
          console.log('ProtectedRoute: localStorage auth successful');
          setUser(response.data);
          setIsAuthenticated(true);
          localStorage.setItem('tambola_user', JSON.stringify(response.data));
          authCheckDone.current = true;
          return;
        } catch (e) {
          console.log('ProtectedRoute: localStorage session invalid, clearing...');
          localStorage.removeItem('tambola_session');
          localStorage.removeItem('tambola_user');
          localStorage.removeItem('tambola_auth_complete');
        }
      }

      // PRIORITY 2: Try cookie-based auth
      try {
        console.log('ProtectedRoute: Trying cookie auth...');
        const response = await axios.get(`${API}/auth/me`, {
          withCredentials: true
        });
        console.log('ProtectedRoute: Cookie auth successful');
        setUser(response.data);
        setIsAuthenticated(true);
        localStorage.setItem('tambola_user', JSON.stringify(response.data));
        authCheckDone.current = true;
        return;
      } catch (error) {
        console.log('ProtectedRoute: Cookie auth failed');
      }

      // No valid auth found - redirect to login
      console.log('ProtectedRoute: No valid auth, redirecting to login');
      authCheckDone.current = true;
      setIsAuthenticated(false);
      navigate('/login', { replace: true });
    };

    // Small delay to allow AuthCallback to complete if coming from OAuth
    const authComplete = localStorage.getItem('tambola_auth_complete');
    const delay = authComplete ? 0 : 200;
    
    setTimeout(() => {
      checkAuth();
    }, delay);
  }, [navigate, location.state]);

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
