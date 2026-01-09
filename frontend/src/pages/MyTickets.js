import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar, Trophy } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Get auth headers for API calls (mobile fallback)
const getAuthHeaders = () => {
  const session = localStorage.getItem('tambola_session');
  return session ? { 'Authorization': `Bearer ${session}` } : {};
};

export default function MyTickets() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [games, setGames] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMyBookings();
  }, []);

  const fetchMyBookings = async () => {
    try {
      const response = await axios.get(`${API}/bookings/my`, { 
        withCredentials: true,
        headers: getAuthHeaders()
      });
      const bookingsData = response.data;
      setBookings(bookingsData);

      // Fetch game details for each booking
      const gameIds = [...new Set(bookingsData.map(b => b.game_id))];
      const gamesData = {};
      for (const gameId of gameIds) {
        try {
          const gameResponse = await axios.get(`${API}/games/${gameId}`);
          gamesData[gameId] = gameResponse.data;
        } catch (error) {
          console.error(`Failed to fetch game ${gameId}:`, error);
        }
      }
      setGames(gamesData);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
      toast.error('Failed to load your tickets');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c]">
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] pb-20">
      {/* Header */}
      <div className="bg-[#121216] border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            data-testid="back-button"
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>
            My Tickets
          </h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {bookings.length === 0 ? (
          <div className="glass-card p-8 text-center" data-testid="no-bookings-message">
            <Trophy className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg mb-2">No tickets yet</p>
            <p className="text-gray-500 text-sm mb-6">Book tickets for upcoming games to see them here</p>
            <Button
              onClick={() => navigate('/')}
              className="rounded-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 font-bold"
              data-testid="browse-games-btn"
            >
              Browse Games
            </Button>
          </div>
        ) : (
          <div className="space-y-6" data-testid="bookings-list">
            {bookings.map((booking) => {
              const game = games[booking.game_id];
              if (!game) return null;

              return (
                <div key={booking.booking_id} className="glass-card p-6 hover-lift" data-testid={`booking-${booking.booking_id}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">{game.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Calendar className="w-4 h-4" />
                        <span>{game.date} at {game.time}</span>
                      </div>
                    </div>
                    <span
                      className={`px-3 py-1 text-xs font-bold rounded-full ${
                        booking.status === 'confirmed'
                          ? 'bg-green-500/20 text-green-500'
                          : 'bg-yellow-500/20 text-yellow-500'
                      }`}
                      data-testid={`booking-status-${booking.booking_id}`}
                    >
                      {booking.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Tickets</span>
                      <span className="text-white font-bold">{booking.ticket_ids.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-400">Total Amount</span>
                      <span className="text-amber-500 font-bold">₹{booking.total_amount.toLocaleString()}</span>
                    </div>
                    {booking.status === 'pending' && (
                      <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                        <p className="text-xs text-yellow-500">
                          Awaiting WhatsApp confirmation from admin
                        </p>
                      </div>
                    )}
                  </div>

                  {game.status === 'live' && booking.status === 'confirmed' && (
                    <Button
                      onClick={() => navigate(`/live/${game.game_id}`)}
                      className="w-full rounded-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 font-bold"
                      data-testid={`join-live-game-${booking.booking_id}`}
                    >
                      Join Live Game
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
