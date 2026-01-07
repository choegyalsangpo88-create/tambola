import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { useState, useEffect } from 'react';
import LoginScreen from './pages/LoginScreen';
import AuthCallback from './pages/AuthCallback';
import Dashboard from './pages/Dashboard';
import GameDetails from './pages/GameDetails';
import LiveGame from './pages/LiveGame';
import MyTickets from './pages/MyTickets';
import Profile from './pages/Profile';
import PastResults from './pages/PastResults';
import AdminLogin from './pages/AdminLogin';
import AdminPanel from './pages/AdminPanel';
import CreateUserGame from './pages/CreateUserGame';
import MyUserGames from './pages/MyUserGames';
import UserGameDetails from './pages/UserGameDetails';
import JoinUserGame from './pages/JoinUserGame';
import UserGamePlay from './pages/UserGamePlay';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

function AppRouter() {
  const location = useLocation();
  
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  // Check for session_id in hash - catches OAuth callbacks
  const hash = location.hash || window.location.hash;
  if (hash?.includes('session_id=')) {
    return <AuthCallback />;
  }
  
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/game/:gameId" element={<ProtectedRoute><GameDetails /></ProtectedRoute>} />
        <Route path="/live/:gameId" element={<ProtectedRoute><LiveGame /></ProtectedRoute>} />
        <Route path="/my-tickets" element={<ProtectedRoute><MyTickets /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/past-results" element={<ProtectedRoute><PastResults /></ProtectedRoute>} />
        {/* Admin Routes - Secret URL */}
        <Route path="/control-ceo" element={<AdminLogin />} />
        <Route path="/admin-panel" element={<AdminPanel />} />
        {/* User Game Routes */}
        <Route path="/create-game" element={<ProtectedRoute><CreateUserGame /></ProtectedRoute>} />
        <Route path="/my-games" element={<ProtectedRoute><MyUserGames /></ProtectedRoute>} />
        <Route path="/my-games/:userGameId" element={<ProtectedRoute><UserGameDetails /></ProtectedRoute>} />
        <Route path="/user-game-play/:userGameId" element={<ProtectedRoute><UserGamePlay /></ProtectedRoute>} />
        {/* Public Join Route - No auth required */}
        <Route path="/join/:shareCode" element={<JoinUserGame />} />
        {/* Public Play Route for user games - No auth required */}
        <Route path="/play/:userGameId" element={<UserGamePlay />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <Toaster position="top-right" />
    </>
  );
}

function App() {
  // Check for OAuth session_id on EVERY render, not just initial
  // This is critical because the redirect happens as a full page navigation
  const [showAuthCallback, setShowAuthCallback] = useState(false);
  
  useEffect(() => {
    // Check hash on mount AND on hashchange events
    const checkForSessionId = () => {
      if (window.location.hash?.includes('session_id=')) {
        setShowAuthCallback(true);
      }
    };
    
    // Check immediately
    checkForSessionId();
    
    // Listen for hash changes (for OAuth redirects)
    window.addEventListener('hashchange', checkForSessionId);
    
    return () => {
      window.removeEventListener('hashchange', checkForSessionId);
    };
  }, []);
  
  // Also check synchronously on render (for initial page load with hash)
  const hasHashSessionId = window.location.hash?.includes('session_id=');
  
  if (showAuthCallback || hasHashSessionId) {
    return (
      <BrowserRouter>
        <AuthCallback />
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  );
}

export default App;
