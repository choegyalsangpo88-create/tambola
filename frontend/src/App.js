import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import LoginScreen from './pages/LoginScreen';
import AuthCallback from './pages/AuthCallback';
import Dashboard from './pages/Dashboard';
import GameDetails from './pages/GameDetails';
import LiveGame from './pages/LiveGame';
import MyTickets from './pages/MyTickets';
import Profile from './pages/Profile';
import PastResults from './pages/PastResults';
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
  // Detect session_id synchronously during render (NOT in useEffect)
  if (location.hash?.includes('session_id=')) {
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
        <Route path="/admin" element={<ProtectedRoute><AdminPanel /></ProtectedRoute>} />
        {/* User Game Routes */}
        <Route path="/create-game" element={<ProtectedRoute><CreateUserGame /></ProtectedRoute>} />
        <Route path="/my-games" element={<ProtectedRoute><MyUserGames /></ProtectedRoute>} />
        <Route path="/my-games/:userGameId" element={<ProtectedRoute><UserGameDetails /></ProtectedRoute>} />
        <Route path="/user-game-play/:userGameId" element={<ProtectedRoute><UserGamePlay /></ProtectedRoute>} />
        {/* Public Join Route - No auth required */}
        <Route path="/join/:shareCode" element={<JoinUserGame />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <Toaster position="top-right" />
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  );
}

export default App;
