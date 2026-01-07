import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AuthCallback() {
  const hasProcessed = useRef(false);
  const [status, setStatus] = useState('processing');

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

        setStatus('exchanging');

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

        console.log('AuthCallback: Success!', response.data);

        const { user, session_token } = response.data;
        
        // CRITICAL: Store in localStorage FIRST before any navigation
        // This is the primary auth method since cookies may not work on mobile
        if (session_token) {
          localStorage.setItem('tambola_session', session_token);
          console.log('AuthCallback: Session token stored in localStorage');
        }
        if (user) {
          localStorage.setItem('tambola_user', JSON.stringify(user));
          console.log('AuthCallback: User stored in localStorage');
        }
        
        // Mark auth as complete
        localStorage.setItem('tambola_auth_complete', 'true');
        
        setStatus('success');
        toast.success('Logged in successfully!');

        // Clear the hash AFTER storing credentials
        window.history.replaceState(null, '', '/');
        
        // Small delay to ensure localStorage is written before redirect
        await new Promise(resolve => setTimeout(resolve, 100));

        // Navigate to home - use replace to prevent back button issues
        window.location.href = '/';
        
      } catch (error) {
        console.error('AuthCallback: Error -', error);
        setStatus('error');
        
        // Clear hash on error
        window.history.replaceState(null, '', '/login');
        
        const errorMsg = error.response?.data?.detail || error.message || 'Login failed';
        toast.error(errorMsg);
        
        // Small delay before redirect
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Redirect to login
        window.location.href = '/login';
      }
    };

    // Small delay to ensure hash is properly read
    setTimeout(processSession, 100);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c]">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="mt-4 text-gray-400">
          {status === 'processing' && 'Processing...'}
          {status === 'exchanging' && 'Authenticating...'}
          {status === 'success' && 'Success! Redirecting...'}
          {status === 'error' && 'Error occurred'}
        </p>
        <p className="mt-2 text-gray-500 text-sm">Please wait...</p>
      </div>
    </div>
  );
}
