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
    // Prevent double execution
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processSession = async () => {
      try {
        // Get session_id from hash
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const sessionId = params.get('session_id');

        console.log('AuthCallback: Processing session_id:', sessionId ? 'found' : 'not found');

        if (!sessionId) {
          throw new Error('No session ID found');
        }

        // Clear the hash IMMEDIATELY to prevent re-triggering
        window.history.replaceState(null, '', window.location.pathname);

        // Exchange session_id for session_token
        const response = await axios.post(
          `${API}/auth/session`,
          { session_id: sessionId },
          { withCredentials: true }
        );

        console.log('AuthCallback: Session exchange successful');

        const user = response.data.user;
        
        toast.success('Logged in successfully!');

        // Small delay to ensure cookie is set before redirect
        setTimeout(() => {
          // Navigate to dashboard with user data
          navigate('/', { state: { user }, replace: true });
        }, 100);
      } catch (error) {
        console.error('Auth error:', error);
        // Clear hash on error too
        window.history.replaceState(null, '', window.location.pathname);
        toast.error('Authentication failed. Please try again.');
        navigate('/login', { replace: true });
      }
    };

    processSession();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c]">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="mt-4 text-gray-400">Authenticating...</p>
      </div>
    </div>
  );
}
