import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AuthCallback() {
  const navigate = useNavigate();
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent double execution in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processSession = async () => {
      try {
        // Get session_id from hash
        const currentHash = window.location.hash;
        console.log('AuthCallback: Hash:', currentHash);
        
        const hash = currentHash.substring(1);
        const params = new URLSearchParams(hash);
        const sessionId = params.get('session_id');

        console.log('AuthCallback: Session ID:', sessionId ? 'found' : 'not found');

        if (!sessionId) {
          throw new Error('No session ID found');
        }

        // Exchange session_id for session_token
        console.log('AuthCallback: Exchanging session...');
        const response = await axios.post(
          `${API}/auth/session`,
          { session_id: sessionId },
          { 
            withCredentials: true,
            headers: { 'Content-Type': 'application/json' }
          }
        );

        console.log('AuthCallback: Success!');

        // Clear the hash
        window.history.replaceState(null, '', window.location.pathname);

        const { user, session_token } = response.data;
        
        // Store in localStorage as fallback for mobile
        if (user) {
          localStorage.setItem('tambola_user', JSON.stringify(user));
        }
        if (session_token) {
          localStorage.setItem('tambola_session', session_token);
        }
        
        toast.success('Logged in successfully!');

        // Force redirect using window.location for mobile compatibility
        window.location.replace('/');
        
      } catch (error) {
        console.error('AuthCallback: Error -', error);
        
        // Clear hash on error
        window.history.replaceState(null, '', window.location.pathname);
        
        const errorMsg = error.response?.data?.detail || error.message || 'Login failed';
        toast.error(errorMsg);
        
        // Redirect to login
        window.location.replace('/login');
      }
    };

    // Small delay to ensure hash is properly read
    setTimeout(processSession, 50);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c]">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="mt-4 text-gray-400">Authenticating...</p>
        <p className="mt-2 text-gray-500 text-sm">Please wait...</p>
      </div>
    </div>
  );
}
