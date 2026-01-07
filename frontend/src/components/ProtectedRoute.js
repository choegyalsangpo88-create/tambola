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
        const response = await axios.get(`${API}/auth/me`, {
          withCredentials: true
        });
        setUser(response.data);
        setIsAuthenticated(true);
        
        // Update localStorage
        try {
          localStorage.setItem('tambola_user', JSON.stringify(response.data));
        } catch (e) {}
        
      } catch (error) {
        console.log('ProtectedRoute: Cookie auth failed, checking localStorage...');
        
        // Try localStorage fallback for mobile
        try {
          const storedUser = localStorage.getItem('tambola_user');
          if (storedUser) {
            const parsed = JSON.parse(storedUser);
            // Verify the stored user is still valid by making a request
            // For now, trust the localStorage
            setUser(parsed);
            setIsAuthenticated(true);
            console.log('ProtectedRoute: Using localStorage user');
            return;
          }
        } catch (e) {
          console.log('ProtectedRoute: localStorage check failed');
        }
        
        console.log('ProtectedRoute: Not authenticated, redirecting to login');
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
