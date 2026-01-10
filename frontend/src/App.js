import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { useState, useEffect } from 'react';
import LoginScreen from './pages/LoginScreen';
import AuthCallback from './pages/AuthCallback';
import Dashboard from './pages/Dashboard';
import GameDetails from './pages/GameDetails';
import LiveGame from './pages/LiveGame';
import MyTickets from './pages/MyTickets';
import GameHistory from './pages/GameHistory';
import Profile from './pages/Profile';
import PastResults from './pages/PastResults';
import AdminLogin from './pages/AdminLogin';
import AdminPanel from './pages/AdminPanel';
import AgentPanel from './pages/AgentPanel';
import CreateUserGame from './pages/CreateUserGame';
import MyUserGames from './pages/MyUserGames';
import UserGameDetails from './pages/UserGameDetails';
import JoinUserGame from './pages/JoinUserGame';
import UserGamePlay from './pages/UserGamePlay';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

function AppRouter() {
  const location = useLocation();
  
  // CRITICAL: Check for session_id in hash - handles OAuth callbacks
  // This must happen BEFORE any routing to prevent redirect loops
  const hash = window.location.hash;
  if (hash?.includes('session_id=')) {
    console.log('AppRouter: OAuth callback detected, rendering AuthCallback');
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
        <Route path="/game-history/:gameId" element={<ProtectedRoute><GameHistory /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        <Route path="/past-results" element={<ProtectedRoute><PastResults /></ProtectedRoute>} />
        {/* Admin Routes - Secret URL */}
        <Route path="/control-ceo" element={<AdminLogin />} />
        <Route path="/admin-panel" element={<AdminPanel />} />
        {/* Agent Panel Route */}
        <Route path="/agent" element={<AgentPanel />} />
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
  // CRITICAL: Check for OAuth session_id on initial page load
  // This runs synchronously before render to catch OAuth callbacks immediately
  const [isOAuthCallback, setIsOAuthCallback] = useState(false);
  
  useEffect(() => {
    // Check if this is an OAuth callback on mount
    if (window.location.hash?.includes('session_id=')) {
      console.log('App: OAuth callback detected on mount');
      setIsOAuthCallback(true);
    }
    
    // Clean up auth_complete flag after it's been used
    const authComplete = localStorage.getItem('tambola_auth_complete');
    if (authComplete) {
      // Clear the flag after a short delay to ensure it's been read
      setTimeout(() => {
        localStorage.removeItem('tambola_auth_complete');
      }, 1000);
    }
  }, []);
  
  // If OAuth callback, render AuthCallback directly (outside of routing)
  if (isOAuthCallback || window.location.hash?.includes('session_id=')) {
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
