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
        // Get session_id from hash - read it ONCE and store it
        const currentHash = window.location.hash;
        console.log('AuthCallback: Current hash:', currentHash);
        
        const hash = currentHash.substring(1);
        const params = new URLSearchParams(hash);
        const sessionId = params.get('session_id');

        console.log('AuthCallback: Session ID:', sessionId ? 'present' : 'missing');

        if (!sessionId) {
          throw new Error('No session ID found in URL');
        }

        // Exchange session_id for session_token
        console.log('AuthCallback: Exchanging session...');
        const response = await axios.post(
          `${API}/auth/session`,
          { session_id: sessionId },
          { 
            withCredentials: true,
            headers: {
              'Content-Type': 'application/json',
            }
          }
        );

        console.log('AuthCallback: Exchange successful!', response.status);

        // Clear the hash AFTER successful exchange
        window.history.replaceState(null, '', window.location.pathname);

        const user = response.data.user;
        
        // Store user in localStorage as backup for mobile
        if (user) {
          try {
            localStorage.setItem('tambola_user', JSON.stringify(user));
          } catch (e) {
            console.log('Could not store user in localStorage');
          }
        }
        
        toast.success('Logged in successfully!');

        // Use window.location for more reliable redirect on mobile
        window.location.href = '/';
        
      } catch (error) {
        console.error('AuthCallback: Error -', error);
        
        // Clear hash on error
        window.history.replaceState(null, '', window.location.pathname);
        
        const errorMsg = error.response?.data?.detail || error.message || 'Authentication failed';
        console.error('AuthCallback: Error message -', errorMsg);
        toast.error(`Login failed: ${errorMsg}`);
        
        // Redirect to login
        window.location.href = '/login';
      }
    };

    // Small delay to ensure hash is properly read on mobile
    setTimeout(processSession, 100);
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
