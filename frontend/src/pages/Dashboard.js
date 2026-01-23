import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Home, Ticket, User, Trophy, Calendar, Users, Award, Plus, QrCode, X, Clock, AlertCircle, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Get auth headers for API calls (mobile fallback)
const getAuthHeaders = () => {
  const session = localStorage.getItem('tambola_session');
  return session ? { 'Authorization': `Bearer ${session}` } : {};
};

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [liveGames, setLiveGames] = useState([]);
  const [recentlyCompleted, setRecentlyCompleted] = useState([]);
  const [upcomingGames, setUpcomingGames] = useState([]);
  const [pendingBookings, setPendingBookings] = useState([]);
  const [activeTab, setActiveTab] = useState('home');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const navigate = useNavigate();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchUser();
    fetchGames();
    fetchPendingBookings();
    
    // Poll every 30 seconds to check for game status changes
    const interval = setInterval(() => {
      fetchGames();
      fetchPendingBookings();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, { 
        withCredentials: true,
        headers: getAuthHeaders()
      });
      setUser(response.data);
      // Update localStorage
      localStorage.setItem('tambola_user', JSON.stringify(response.data));
    } catch (error) {
      console.error('Failed to fetch user:', error);
      // Try to get from localStorage
      const storedUser = localStorage.getItem('tambola_user');
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch (e) {
          // Parse error - ignore
        }
      }
    }
  };

  const fetchGames = async () => {
    try {
      const response = await axios.get(`${API}/games`);
      const games = response.data;
      setLiveGames(games.filter(g => g.status === 'live'));
      setRecentlyCompleted(games.filter(g => g.status === 'completed'));
      setUpcomingGames(games.filter(g => g.status === 'upcoming'));
    } catch (error) {
      console.error('Failed to fetch games:', error);
      toast.error('Failed to load games');
    }
  };

  const fetchPendingBookings = async () => {
    try {
      const response = await axios.get(`${API}/booking-requests/my`, {
        withCredentials: true,
        headers: getAuthHeaders()
      });
      // Filter only pending bookings and enrich with game info
      const pending = response.data.filter(b => b.status === 'pending');
      
      // Fetch game info for each booking
      const enrichedBookings = await Promise.all(
        pending.map(async (booking) => {
          try {
            const gameRes = await axios.get(`${API}/games/${booking.game_id}`);
            return {
              ...booking,
              game: gameRes.data
            };
          } catch {
            return booking;
          }
        })
      );
      
      setPendingBookings(enrichedBookings);
    } catch (error) {
      console.error('Failed to fetch pending bookings:', error);
    }
  };

  const handleCancelBooking = async (requestId) => {
    if (!window.confirm('Are you sure you want to cancel this booking? Your tickets will be released.')) {
      return;
    }
    
    try {
      await axios.delete(`${API}/booking-requests/${requestId}`, {
        withCredentials: true,
        headers: getAuthHeaders()
      });
      toast.success('Booking cancelled successfully');
      fetchPendingBookings();
    } catch (error) {
      console.error('Failed to cancel booking:', error);
      toast.error(error.response?.data?.detail || 'Failed to cancel booking');
    }
  };

  const handleEditBooking = async (requestId, gameId) => {
    // First cancel the current booking to release tickets
    try {
      await axios.delete(`${API}/booking-requests/${requestId}`, {
        withCredentials: true,
        headers: getAuthHeaders()
      });
      toast.success('Booking cancelled - select new tickets');
      // Navigate to game page to select new tickets
      navigate(`/game/${gameId}`);
    } catch (error) {
      console.error('Failed to edit booking:', error);
      toast.error(error.response?.data?.detail || 'Failed to edit booking');
    }
  };

  const handleNavigation = (path) => {
    navigate(path);
  };

  const handleJoinGame = () => {
    if (!joinCode.trim()) {
      toast.error('Please enter a game code');
      return;
    }
    navigate(`/join/${joinCode.trim().toUpperCase()}`);
    setShowJoinModal(false);
    setJoinCode('');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c]">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#121216] via-[#1a1a20] to-[#121216] border-b border-amber-500/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-5 flex items-center justify-between">
          <div>
            <h1 
              className="text-3xl font-black tracking-tight bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent drop-shadow-lg"
              style={{ fontFamily: "'Playfair Display', Georgia, serif", letterSpacing: '-0.02em' }}
            >
              67tambola
            </h1>
            {user && (
              <p 
                className="text-base text-gray-300 mt-1 font-medium"
                style={{ fontFamily: "'Outfit', sans-serif" }}
              >
                Welcome, <span className="text-amber-400 font-semibold">{user.name}</span>
              </p>
            )}
          </div>
          <Button
            data-testid="profile-button"
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => handleNavigation('/profile')}
          >
            <User className="w-6 h-6 text-amber-500" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        {/* Create & Join Game Buttons - Compact */}
        <div className="flex gap-3 mb-6">
          <Button
            onClick={() => navigate('/create-game')}
            className="flex-1 h-12 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 font-semibold"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Game
          </Button>
          <Button
            onClick={() => setShowJoinModal(true)}
            variant="outline"
            className="flex-1 h-12 rounded-xl border-2 border-amber-500/50 text-amber-400 hover:bg-amber-500/10 font-semibold"
          >
            <QrCode className="w-4 h-4 mr-2" />
            Join Game
          </Button>
        </div>

        {/* Join Game Modal */}
        {showJoinModal && (
          <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowJoinModal(false)}>
            <div className="bg-[#1a1a1e] rounded-2xl p-6 w-full max-w-sm border border-white/10" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white">Join Game</h3>
                <Button variant="ghost" size="icon" onClick={() => setShowJoinModal(false)} className="h-8 w-8 text-gray-400">
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <p className="text-sm text-gray-400 mb-4">Enter the 6-digit game code shared by the host</p>
              <Input
                type="text"
                placeholder="Enter game code (e.g., ABC123)"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                className="h-14 text-center text-2xl tracking-[0.3em] bg-white/5 border-white/10 text-white placeholder:text-gray-500 placeholder:text-sm placeholder:tracking-normal mb-4"
                maxLength={6}
              />
              <Button
                onClick={handleJoinGame}
                disabled={joinCode.length < 4}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 font-bold"
              >
                Join Game
              </Button>
              <p className="text-xs text-gray-500 text-center mt-3">
                Or scan the QR code shared by the host
              </p>
            </div>
          </div>
        )}

        {/* Live Games */}
        {liveGames.length > 0 && (
          <div className="mb-10" data-testid="live-games-section">
            <h2 className="text-2xl md:text-3xl font-semibold text-white mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>
              <Trophy className="inline w-7 h-7 text-amber-500 mr-2" />
              Live Games
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {liveGames.map((game) => (
                <div
                  key={game.game_id}
                  className="glass-card p-6 min-w-[300px] hover-lift cursor-pointer"
                  data-testid={`live-game-${game.game_id}`}
                  onClick={() => navigate(`/live/${game.game_id}`)}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-white">{game.name}</h3>
                    <span className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
                      LIVE
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mb-4">
                    Prize Pool: ₹{game.prize_pool.toLocaleString()}
                  </p>
                  <Button
                    data-testid={`join-live-game-${game.game_id}`}
                    className="w-full rounded-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 font-bold"
                  >
                    Join Now
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recently Completed Games (within 5 mins) */}
        {recentlyCompleted.length > 0 && (
          <div className="mb-10" data-testid="recently-completed-section">
            <h2 className="text-2xl md:text-3xl font-semibold text-white mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>
              <Clock className="inline w-7 h-7 text-emerald-500 mr-2" />
              Just Ended
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {recentlyCompleted.map((game) => (
                <div
                  key={game.game_id}
                  className="glass-card p-6 min-w-[300px] hover-lift cursor-pointer border-2 border-emerald-500/30"
                  data-testid={`completed-game-${game.game_id}`}
                  onClick={() => navigate(`/live/${game.game_id}`)}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-white">{game.name}</h3>
                    <span className="px-3 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full">
                      ENDED
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mb-2">
                    Prize Pool: ₹{game.prize_pool.toLocaleString()}
                  </p>
                  <p className="text-emerald-400 text-xs mb-4">
                    Results available • Moving to archive soon
                  </p>
                  <Button
                    data-testid={`view-results-${game.game_id}`}
                    className="w-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 font-bold"
                  >
                    View Results
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending Tickets Section */}
        {pendingBookings.length > 0 && (
          <div className="mb-10" data-testid="pending-tickets-section">
            <h2 className="text-2xl md:text-3xl font-semibold text-white mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>
              <AlertCircle className="inline w-7 h-7 text-orange-500 mr-2" />
              Pending Tickets
            </h2>
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 mb-4">
              <p className="text-orange-300 text-sm">
                You have pending bookings awaiting payment confirmation. Complete payment or cancel to book new tickets.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingBookings.map((booking) => (
                <div
                  key={booking.request_id}
                  className="glass-card p-5 border-2 border-orange-500/30 hover-lift"
                  data-testid={`pending-booking-${booking.request_id}`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-white truncate pr-2">
                      {booking.game?.name || 'Tambola Game'}
                    </h3>
                    <span className="px-2 py-1 bg-orange-500/20 text-orange-400 text-xs font-bold rounded-full whitespace-nowrap">
                      PENDING
                    </span>
                  </div>
                  
                  <div className="space-y-2 text-sm text-gray-400 mb-4">
                    <div className="flex items-center gap-2">
                      <Ticket className="w-4 h-4 text-orange-500" />
                      <span>{booking.ticket_ids?.length || 0} tickets selected</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-orange-500" />
                      <span>Amount: ₹{booking.total_amount}</span>
                    </div>
                    {booking.game && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-orange-500" />
                        <span>{booking.game.date} at {booking.game.time}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-orange-500" />
                      <span>Booked: {new Date(booking.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => navigate(`/game/${booking.game_id}`)}
                      className="flex-1 h-10 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 font-semibold text-sm"
                    >
                      Complete Payment
                    </Button>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditBooking(booking.request_id, booking.game_id);
                      }}
                      variant="outline"
                      className="h-10 px-3 rounded-xl border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                      title="Edit - Select new tickets"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancelBooking(booking.request_id);
                      }}
                      variant="outline"
                      className="h-10 px-3 rounded-xl border-red-500/50 text-red-400 hover:bg-red-500/10"
                      title="Cancel booking"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Games */}
        <div data-testid="upcoming-games-section">
          <h2 className="text-2xl md:text-3xl font-semibold text-white mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>
            <Calendar className="inline w-7 h-7 text-amber-500 mr-2" />
            Upcoming Games
          </h2>
          {upcomingGames.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <p className="text-gray-400">No upcoming games at the moment</p>
              <p className="text-sm text-gray-500 mt-2">Check back soon!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingGames.map((game) => (
                <div
                  key={game.game_id}
                  className="glass-card p-6 hover-lift cursor-pointer"
                  data-testid={`upcoming-game-${game.game_id}`}
                  onClick={() => navigate(`/game/${game.game_id}`)}
                >
                  <h3 className="text-xl font-bold text-white mb-3">{game.name}</h3>
                  <div className="space-y-2 text-sm text-gray-400 mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-amber-500" />
                      <span>{game.date} at {game.time}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-500" />
                      <span>Prize Pool: ₹{game.prize_pool.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-amber-500" />
                      <span>{game.available_tickets}/{game.ticket_count} Available</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Ticket className="w-4 h-4 text-amber-500" />
                      <span>₹{game.price} per ticket</span>
                    </div>
                  </div>
                  <Button
                    data-testid={`select-tickets-${game.game_id}`}
                    className="w-full rounded-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 font-bold"
                  >
                    Select Tickets
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#121216] border-t border-white/10 safe-area-pb">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-around">
          <button
            data-testid="nav-home"
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
              activeTab === 'home' ? 'text-amber-500' : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => setActiveTab('home')}
          >
            <Home className="w-5 h-5" />
            <span className="text-xs font-medium">Home</span>
          </button>
          <button
            data-testid="nav-my-games"
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
              activeTab === 'games' ? 'text-amber-500' : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => {
              setActiveTab('games');
              handleNavigation('/my-games');
            }}
          >
            <Users className="w-5 h-5" />
            <span className="text-xs font-medium">My Games</span>
          </button>
          <button
            data-testid="nav-my-tickets"
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
              activeTab === 'tickets' ? 'text-amber-500' : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => {
              setActiveTab('tickets');
              handleNavigation('/my-tickets');
            }}
          >
            <Ticket className="w-5 h-5" />
            <span className="text-xs font-medium">Tickets</span>
          </button>
          <button
            data-testid="nav-past-results"
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
              activeTab === 'results' ? 'text-amber-500' : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => {
              setActiveTab('results');
              handleNavigation('/past-results');
            }}
          >
            <Trophy className="w-5 h-5" />
            <span className="text-xs font-medium">Results</span>
          </button>
        </div>
      </div>
    </div>
  );
}
