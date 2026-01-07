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
    // If user data passed from AuthCallback, use it directly
    if (location.state?.user) {
      Promise.resolve().then(() => {
        setUser(location.state.user);
        setIsAuthenticated(true);
      });
      return;
    }

    const checkAuth = async () => {
      try {
        // First try cookie-based auth
        const response = await axios.get(`${API}/auth/me`, {
          withCredentials: true
        });
        setUser(response.data);
        setIsAuthenticated(true);
        localStorage.setItem('tambola_user', JSON.stringify(response.data));
        
      } catch (error) {
        console.log('ProtectedRoute: Cookie auth failed, trying localStorage...');
        
        // Try localStorage session token
        const storedSession = localStorage.getItem('tambola_session');
        const storedUser = localStorage.getItem('tambola_user');
        
        if (storedSession && storedUser) {
          try {
            // Verify with backend using Authorization header
            const response = await axios.get(`${API}/auth/me`, {
              headers: { 'Authorization': `Bearer ${storedSession}` }
            });
            setUser(response.data);
            setIsAuthenticated(true);
            console.log('ProtectedRoute: localStorage auth successful');
            return;
          } catch (e) {
            console.log('ProtectedRoute: localStorage session invalid');
            localStorage.removeItem('tambola_session');
            localStorage.removeItem('tambola_user');
          }
        }
        
        setIsAuthenticated(false);
        navigate('/login', { replace: true });
      }
    };

    checkAuth();
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
