import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Plus, Play, Check, Info } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AdminPanel() {
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [bookings, setBookings] = useState([]);

  // Create Game Form
  const [newGame, setNewGame] = useState({
    name: '',
    date: '',
    time: '',
    price: 50,
    prizes: {
      'Quick Five': 500,
      'Four Corners': 300,
      'Top Line': 200,
      'Middle Line': 200,
      'Bottom Line': 200,
      '1st House': 2000,
      '2nd House': 1000,
      'Full House': 5000,
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
          'Quick Five': 500,
          'Four Corners': 300,
          'Top Line': 200,
          'Middle Line': 200,
          'Bottom Line': 200,
          '1st House': 2000,
          '2nd House': 1000,
          'Full House': 5000,
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
      toast.success('Game will start automatically at scheduled time with voice announcements!');
      fetchGames();
    } catch (error) {
      console.error('Failed to start game:', error);
      toast.error('Failed to start game');
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
        {/* Info Banner */}
        <div className="glass-card p-4 mb-6 border-amber-500/30" data-testid="game-info-banner">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-300">
              <p className="font-bold text-amber-500 mb-1">📢 Automatic Game Management</p>
              <p>Games will start automatically at the scheduled time with voice announcements. Numbers will be called automatically every 10 seconds with traditional Tambola call names (e.g., "22 - Two Little Ducks", "88 - Two Fat Ladies"). Simply create the game, generate tickets, and confirm bookings!</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="create" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8 bg-[#121216]">
            <TabsTrigger value="create" data-testid="tab-create">Create Game</TabsTrigger>
            <TabsTrigger value="manage" data-testid="tab-manage">Manage Games</TabsTrigger>
            <TabsTrigger value="bookings" data-testid="tab-bookings">Bookings</TabsTrigger>
          </TabsList>

          {/* Create Game Tab */}
          <TabsContent value="create">
            <div className="glass-card p-6 max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold text-white mb-2">Create New Game</h2>
              <p className="text-sm text-gray-400 mb-6">Game will auto-start at scheduled time with voice caller</p>
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
                    <label className="text-sm text-gray-400 block mb-2">Time (Auto-start)</label>
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
                
                {/* Prize Structure Info */}
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <p className="text-sm font-bold text-amber-500 mb-2">🏆 Prize Structure (Authentic Tambola Rules)</p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-300">
                    <div>• Quick Five: ₹500</div>
                    <div>• Four Corners: ₹300</div>
                    <div>• Top Line: ₹200</div>
                    <div>• Middle Line: ₹200</div>
                    <div>• Bottom Line: ₹200</div>
                    <div>• 1st House: ₹2,000</div>
                    <div>• 2nd House: ₹1,000</div>
                    <div>• Full House: ₹5,000</div>
                    <div className="col-span-2 text-amber-400 font-bold">• Full Sheet Bonus: ₹1,000 (Book all 6 tickets of a sheet!)</div>
                  </div>
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
                      <p className="text-xs text-gray-500 mt-2">
                        📋 600 tickets = 100 Full Sheets (6 tickets each) | Available: {game.available_tickets}
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
                      Generate 600 Tickets (100 Full Sheets)
                    </Button>
                    {game.status === 'upcoming' && (
                      <Button
                        data-testid={`start-game-${game.game_id}`}
                        onClick={() => handleStartGame(game.game_id)}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Play className="w-4 h-4 mr-2" />
                        Activate Game
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
                      {booking.has_full_sheet_bonus && (
                        <div className="mt-2 inline-flex items-center px-3 py-1 bg-amber-500/20 border border-amber-500/50 rounded-full">
                          <span className="text-xs font-bold text-amber-500">🎉 Full Sheet Bonus: {booking.full_sheet_id}</span>
                        </div>
                      )}
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
                    Confirm Booking (WhatsApp Paid)
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
        </Tabs>
      </div>
    </div>
  );
}
