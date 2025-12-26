import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Plus, Play, StopCircle, Award, Check } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AdminPanel() {
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [liveGame, setLiveGame] = useState(null);
  const [session, setSession] = useState(null);

  // Create Game Form
  const [newGame, setNewGame] = useState({
    name: '',
    date: '',
    time: '',
    price: 50,
    prizes: {
      'Full House': 5000,
      '1st House': 2000,
      '2nd House': 1000,
      'Top Line': 200,
      'Middle Line': 200,
      'Bottom Line': 200,
      'Four Corner': 300,
      'Quick Five': 500,
      'Full Sheet Bonus': 1000
    }
  });

  useEffect(() => {
    fetchGames();
    fetchBookings();
  }, []);

  const fetchGames = async () => {
    try {
      const response = await axios.get(`${API}/games`);
      setGames(response.data);
      const live = response.data.find(g => g.status === 'live');
      if (live) {
        setLiveGame(live);
        fetchSession(live.game_id);
      }
    } catch (error) {
      console.error('Failed to fetch games:', error);
    }
  };

  const fetchBookings = async () => {
    try {
      const response = await axios.get(`${API}/admin/bookings`);
      setBookings(response.data);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    }
  };

  const fetchSession = async (gameId) => {
    try {
      const response = await axios.get(`${API}/games/${gameId}/session`);
      setSession(response.data);
    } catch (error) {
      console.error('Failed to fetch session:', error);
    }
  };

  const handleCreateGame = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/games`, newGame);
      toast.success('Game created successfully');
      fetchGames();
      setNewGame({
        name: '',
        date: '',
        time: '',
        price: 50,
        prizes: {
          'Full House': 5000,
          '1st House': 2000,
          '2nd House': 1000,
          'Top Line': 200,
          'Middle Line': 200,
          'Bottom Line': 200,
          'Four Corner': 300,
          'Quick Five': 500,
          'Full Sheet Bonus': 1000
        }
      });
    } catch (error) {
      console.error('Failed to create game:', error);
      toast.error('Failed to create game');
    }
  };

  const handleGenerateTickets = async (gameId) => {
    try {
      const response = await axios.post(`${API}/games/${gameId}/generate-tickets`);
      toast.success(response.data.message);
    } catch (error) {
      console.error('Failed to generate tickets:', error);
      toast.error('Failed to generate tickets');
    }
  };

  const handleStartGame = async (gameId) => {
    try {
      await axios.post(`${API}/games/${gameId}/start`);
      toast.success('Game started!');
      fetchGames();
    } catch (error) {
      console.error('Failed to start game:', error);
      toast.error('Failed to start game');
    }
  };

  const handleCallNumber = async () => {
    if (!liveGame) return;
    try {
      const response = await axios.post(`${API}/games/${liveGame.game_id}/call-number`);
      toast.success(`Number called: ${response.data.number}`);
      fetchSession(liveGame.game_id);
    } catch (error) {
      console.error('Failed to call number:', error);
      toast.error('Failed to call number');
    }
  };

  const handleEndGame = async () => {
    if (!liveGame) return;
    try {
      await axios.post(`${API}/games/${liveGame.game_id}/end`);
      toast.success('Game ended');
      setLiveGame(null);
      setSession(null);
      fetchGames();
    } catch (error) {
      console.error('Failed to end game:', error);
      toast.error('Failed to end game');
    }
  };

  const handleConfirmBooking = async (bookingId) => {
    try {
      await axios.put(`${API}/admin/bookings/${bookingId}/confirm`);
      toast.success('Booking confirmed');
      fetchBookings();
    } catch (error) {
      console.error('Failed to confirm booking:', error);
      toast.error('Failed to confirm booking');
    }
  };

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
            Admin Panel
          </h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Tabs defaultValue="create" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8 bg-[#121216]">
            <TabsTrigger value="create" data-testid="tab-create">Create Game</TabsTrigger>
            <TabsTrigger value="manage" data-testid="tab-manage">Manage Games</TabsTrigger>
            <TabsTrigger value="bookings" data-testid="tab-bookings">Bookings</TabsTrigger>
            <TabsTrigger value="live" data-testid="tab-live">Live Control</TabsTrigger>
          </TabsList>

          {/* Create Game Tab */}
          <TabsContent value="create">
            <div className="glass-card p-6 max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold text-white mb-6">Create New Game</h2>
              <form onSubmit={handleCreateGame} className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400 block mb-2">Game Name</label>
                  <Input
                    data-testid="game-name-input"
                    value={newGame.name}
                    onChange={(e) => setNewGame({ ...newGame, name: e.target.value })}
                    placeholder="e.g., Saturday Night Tambola"
                    required
                    className="bg-black/20 border-white/10 focus:border-amber-500 text-white h-12"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-400 block mb-2">Date</label>
                    <Input
                      data-testid="game-date-input"
                      type="date"
                      value={newGame.date}
                      onChange={(e) => setNewGame({ ...newGame, date: e.target.value })}
                      required
                      className="bg-black/20 border-white/10 focus:border-amber-500 text-white h-12"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 block mb-2">Time</label>
                    <Input
                      data-testid="game-time-input"
                      type="time"
                      value={newGame.time}
                      onChange={(e) => setNewGame({ ...newGame, time: e.target.value })}
                      required
                      className="bg-black/20 border-white/10 focus:border-amber-500 text-white h-12"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-400 block mb-2">Ticket Price (₹)</label>
                  <Input
                    data-testid="ticket-price-input"
                    type="number"
                    value={newGame.price}
                    onChange={(e) => setNewGame({ ...newGame, price: parseInt(e.target.value) })}
                    required
                    className="bg-black/20 border-white/10 focus:border-amber-500 text-white h-12"
                  />
                </div>
                <Button
                  data-testid="create-game-btn"
                  type="submit"
                  className="w-full h-12 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 font-bold"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Create Game
                </Button>
              </form>
            </div>
          </TabsContent>

          {/* Manage Games Tab */}
          <TabsContent value="manage">
            <div className="space-y-4" data-testid="games-list">
              {games.map((game) => (
                <div key={game.game_id} className="glass-card p-6" data-testid={`game-${game.game_id}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-2">{game.name}</h3>
                      <p className="text-sm text-gray-400">
                        {game.date} at {game.time} | ₹{game.price} per ticket
                      </p>
                      <p className="text-sm text-gray-400 mt-1">
                        Status: <span className="text-amber-500 font-bold">{game.status}</span>
                      </p>
                    </div>
                    <span className={`px-3 py-1 text-xs font-bold rounded-full ${
                      game.status === 'live' ? 'bg-red-500' :
                      game.status === 'upcoming' ? 'bg-amber-500' :
                      'bg-gray-500'
                    } text-white`}>
                      {game.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex gap-3">
                    <Button
                      data-testid={`generate-tickets-${game.game_id}`}
                      onClick={() => handleGenerateTickets(game.game_id)}
                      variant="outline"
                      size="sm"
                      className="border-white/10"
                    >
                      Generate Tickets
                    </Button>
                    {game.status === 'upcoming' && (
                      <Button
                        data-testid={`start-game-${game.game_id}`}
                        onClick={() => handleStartGame(game.game_id)}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Start Game
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Bookings Tab */}
          <TabsContent value="bookings">
            <div className="space-y-4" data-testid="bookings-list">
              {bookings.filter(b => b.status === 'pending').map((booking) => (
                <div key={booking.booking_id} className="glass-card p-6" data-testid={`booking-${booking.booking_id}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-white">{booking.user?.name}</h3>
                      <p className="text-sm text-gray-400">{booking.user?.email}</p>
                      <p className="text-sm text-gray-400 mt-2">
                        Game: {booking.game?.name}
                      </p>
                      <p className="text-sm text-gray-400">
                        Tickets: {booking.ticket_ids.length} | Amount: ₹{booking.total_amount}
                      </p>
                    </div>
                    <span className="px-3 py-1 text-xs font-bold rounded-full bg-yellow-500/20 text-yellow-500">
                      PENDING
                    </span>
                  </div>
                  <Button
                    data-testid={`confirm-booking-${booking.booking_id}`}
                    onClick={() => handleConfirmBooking(booking.booking_id)}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Confirm Booking
                  </Button>
                </div>
              ))}
              {bookings.filter(b => b.status === 'pending').length === 0 && (
                <div className="glass-card p-8 text-center">
                  <p className="text-gray-400">No pending bookings</p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Live Control Tab */}
          <TabsContent value="live">
            {liveGame && session ? (
              <div className="space-y-6">
                <div className="glass-card p-6">
                  <h2 className="text-2xl font-bold text-white mb-4">{liveGame.name}</h2>
                  <div className="flex items-center gap-4 mb-6">
                    <span className="px-4 py-2 bg-red-500 text-white font-bold rounded-full animate-pulse">
                      LIVE
                    </span>
                    <span className="text-gray-400">
                      Numbers Called: {session.called_numbers.length}/90
                    </span>
                  </div>
                  <div className="flex gap-4">
                    <Button
                      data-testid="call-number-btn"
                      onClick={handleCallNumber}
                      className="flex-1 h-16 text-lg font-bold rounded-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
                      disabled={session.called_numbers.length >= 90}
                    >
                      Call Next Number
                    </Button>
                    <Button
                      data-testid="end-game-btn"
                      onClick={handleEndGame}
                      className="flex-1 h-16 text-lg font-bold rounded-full bg-red-600 hover:bg-red-700"
                    >
                      <StopCircle className="w-5 h-5 mr-2" />
                      End Game
                    </Button>
                  </div>
                </div>

                {session.current_number && (
                  <div className="glass-card p-8 text-center">
                    <p className="text-amber-500 text-sm font-bold mb-2">CURRENT NUMBER</p>
                    <p className="text-8xl font-black text-white number-font" style={{ textShadow: '0 0 15px rgba(234, 179, 8, 0.5)' }}>
                      {session.current_number}
                    </p>
                  </div>
                )}

                <div className="glass-card p-6">
                  <h3 className="text-lg font-bold text-white mb-4">Called Numbers</h3>
                  <div className="flex flex-wrap gap-2">
                    {session.called_numbers.map((num) => (
                      <div key={num} className="w-12 h-12 flex items-center justify-center bg-amber-500 text-black font-bold rounded-lg number-font">
                        {num}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="glass-card p-8 text-center">
                <p className="text-gray-400">No live game at the moment</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
