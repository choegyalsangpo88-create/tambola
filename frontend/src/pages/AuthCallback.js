import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AuthCallback() {
  const hasProcessed = useRef(false);
  const [status, setStatus] = useState('processing');
  const [errorDetails, setErrorDetails] = useState('');

  useEffect(() => {
    // Prevent double execution in StrictMode
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const processSession = async () => {
      try {
        // Get session_id from hash
        const currentHash = window.location.hash;
        console.log('AuthCallback: Full URL:', window.location.href);
        console.log('AuthCallback: Hash:', currentHash);
        console.log('AuthCallback: Origin:', window.location.origin);
        console.log('AuthCallback: Backend URL:', BACKEND_URL);
        
        const hash = currentHash.substring(1);
        const params = new URLSearchParams(hash);
        const sessionId = params.get('session_id');

        console.log('AuthCallback: Session ID:', sessionId ? 'found' : 'not found');

        if (!sessionId) {
          throw new Error('No session ID found in URL hash');
        }

        setStatus('exchanging');

        // Exchange session_id for session_token
        console.log('AuthCallback: Calling API:', `${API}/auth/session`);
        
        const response = await axios.post(
          `${API}/auth/session`,
          { session_id: sessionId },
          { 
            withCredentials: true,
            headers: { 'Content-Type': 'application/json' },
            timeout: 15000 // 15 second timeout
          }
        );

        console.log('AuthCallback: API Response received');
        console.log('AuthCallback: Response status:', response.status);

        const { user, session_token } = response.data;
        
        if (!session_token) {
          throw new Error('No session token received from server');
        }
        
        // CRITICAL: Store in localStorage FIRST before any navigation
        // This is the primary auth method since cookies may not work on mobile Safari
        localStorage.setItem('tambola_session', session_token);
        console.log('AuthCallback: Session token stored in localStorage');
        
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
        
        // Longer delay for mobile Safari to ensure localStorage is written
        await new Promise(resolve => setTimeout(resolve, 300));

        // Navigate to home - use replace to prevent back button issues
        window.location.href = '/';
        
      } catch (error) {
        console.error('AuthCallback: Error -', error);
        console.error('AuthCallback: Error response:', error.response?.data);
        console.error('AuthCallback: Error status:', error.response?.status);
        
        setStatus('error');
        
        // Build detailed error message
        let errorMsg = 'Login failed';
        if (error.response?.data?.detail) {
          errorMsg = error.response.data.detail;
        } else if (error.message) {
          errorMsg = error.message;
        }
        
        // Check for CORS errors
        if (error.message?.includes('Network Error') || error.code === 'ERR_NETWORK') {
          errorMsg = 'Network error - please check your connection';
          setErrorDetails('CORS or network issue detected');
        }
        
        setErrorDetails(errorMsg);
        toast.error(errorMsg);
        
        // Clear hash on error
        window.history.replaceState(null, '', '/login');
        
        // Longer delay before redirect to show error
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Redirect to login
        window.location.href = '/login';
      }
    };

    // Small delay to ensure hash is properly read (important for mobile)
    setTimeout(processSession, 200);
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
        {status === 'error' && errorDetails && (
          <p className="mt-2 text-red-400 text-sm">{errorDetails}</p>
        )}
        <p className="mt-2 text-gray-500 text-sm">Please wait...</p>
      </div>
    </div>
  );
}
