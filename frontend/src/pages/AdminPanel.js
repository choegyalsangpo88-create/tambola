import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Plus, Play, Check, Info, Edit, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Default dividends template
const DEFAULT_DIVIDENDS = {
  'Quick Five': { enabled: true, amount: 500 },
  'Four Corners': { enabled: true, amount: 300 },
  'Full Sheet Bonus': { enabled: true, amount: 1000 },
  'Top Line': { enabled: true, amount: 200 },
  'Middle Line': { enabled: true, amount: 200 },
  'Bottom Line': { enabled: true, amount: 200 },
  '1st Full House': { enabled: true, amount: 2000 },
  '2nd Full House': { enabled: true, amount: 1000 },
  '3rd Full House': { enabled: true, amount: 5000 }
};

export default function AdminPanel() {
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [editingGame, setEditingGame] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);

  // Create/Edit Game Form
  const [gameForm, setGameForm] = useState({
    name: '',
    date: '',
    time: '',
    price: 50,
    total_tickets: 600,
    dividends: { ...DEFAULT_DIVIDENDS }
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
      // Convert dividends to prize structure
      const prizes = {};
      Object.entries(gameForm.dividends).forEach(([name, data]) => {
        if (data.enabled) {
          prizes[name] = data.amount;
        }
      });

      await axios.post(`${API}/games`, {
        name: gameForm.name,
        date: gameForm.date,
        time: gameForm.time,
        price: gameForm.price,
        total_tickets: gameForm.total_tickets,
        prizes
      });
      
      toast.success('Game created successfully');
      fetchGames();
      resetForm();
    } catch (error) {
      console.error('Failed to create game:', error);
      toast.error('Failed to create game');
    }
  };

  const handleEditGame = async (e) => {
    e.preventDefault();
    try {
      const prizes = {};
      Object.entries(gameForm.dividends).forEach(([name, data]) => {
        if (data.enabled) {
          prizes[name] = data.amount;
        }
      });

      await axios.put(`${API}/games/${editingGame.game_id}`, {
        name: gameForm.name,
        date: gameForm.date,
        time: gameForm.time,
        price: gameForm.price,
        prizes
      });
      
      toast.success('Game updated successfully');
      setShowEditModal(false);
      setEditingGame(null);
      fetchGames();
      resetForm();
    } catch (error) {
      console.error('Failed to update game:', error);
      toast.error('Failed to update game');
    }
  };

  const openEditModal = (game) => {
    setEditingGame(game);
    
    // Convert prizes to dividends format
    const dividends = { ...DEFAULT_DIVIDENDS };
    Object.keys(dividends).forEach(key => {
      dividends[key].enabled = game.prizes.hasOwnProperty(key);
      dividends[key].amount = game.prizes[key] || dividends[key].amount;
    });

    setGameForm({
      name: game.name,
      date: game.date,
      time: game.time,
      price: game.price,
      total_tickets: game.ticket_count || 600,
      dividends
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    setGameForm({
      name: '',
      date: '',
      time: '',
      price: 50,
      total_tickets: 600,
      dividends: { ...DEFAULT_DIVIDENDS }
    });
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
      toast.success('Game will start automatically at scheduled time!');
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
      fetchGames();
    } catch (error) {
      console.error('Failed to confirm booking:', error);
      toast.error('Failed to confirm booking');
    }
  };

  const toggleDividend = (dividendName) => {
    setGameForm(prev => ({
      ...prev,
      dividends: {
        ...prev.dividends,
        [dividendName]: {
          ...prev.dividends[dividendName],
          enabled: !prev.dividends[dividendName].enabled
        }
      }
    }));
  };

  const updateDividendAmount = (dividendName, amount) => {
    setGameForm(prev => ({
      ...prev,
      dividends: {
        ...prev.dividends,
        [dividendName]: {
          ...prev.dividends[dividendName],
          amount: parseInt(amount) || 0
        }
      }
    }));
  };

  // Calculate game statistics
  const getGameStats = (game) => {
    const gameBookings = bookings.filter(b => b.game_id === game.game_id);
    const totalBooked = gameBookings.reduce((sum, b) => sum + b.ticket_ids.length, 0);
    const confirmedBookings = gameBookings.filter(b => b.status === 'confirmed');
    const confirmedTickets = confirmedBookings.reduce((sum, b) => sum + b.ticket_ids.length, 0);
    const revenue = confirmedBookings.reduce((sum, b) => sum + b.total_amount, 0);

    return {
      totalBooked,
      confirmedTickets,
      pendingTickets: totalBooked - confirmedTickets,
      revenue,
      soldPercentage: ((confirmedTickets / game.ticket_count) * 100).toFixed(1)
    };
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
              <p>Games start automatically at scheduled time with voice announcements. Numbers called every 10 seconds with traditional Tambola names.</p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="create" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8 bg-[#121216]">
            <TabsTrigger value="create" data-testid="tab-create">Create Game</TabsTrigger>
            <TabsTrigger value="manage" data-testid="tab-manage">Manage Games</TabsTrigger>
            <TabsTrigger value="bookings" data-testid="tab-bookings">Bookings & Stats</TabsTrigger>
          </TabsList>

          {/* Create Game Tab */}
          <TabsContent value="create">
            <div className="glass-card p-6 max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-white mb-2">Create New Game</h2>
              <p className="text-sm text-gray-400 mb-6">Configure your Tambola game</p>
              <form onSubmit={handleCreateGame} className="space-y-6">
                {/* Basic Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="text-sm text-gray-400 block mb-2">Game Name</label>
                    <Input
                      data-testid="game-name-input"
                      value={gameForm.name}
                      onChange={(e) => setGameForm({ ...gameForm, name: e.target.value })}
                      placeholder="e.g., Saturday Night Tambola"
                      required
                      className="bg-black/20 border-white/10 focus:border-amber-500 text-white h-12"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 block mb-2">Date</label>
                    <Input
                      data-testid="game-date-input"
                      type="date"
                      value={gameForm.date}
                      onChange={(e) => setGameForm({ ...gameForm, date: e.target.value })}
                      required
                      className="bg-black/20 border-white/10 focus:border-amber-500 text-white h-12"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 block mb-2">Time</label>
                    <Input
                      data-testid="game-time-input"
                      type="time"
                      value={gameForm.time}
                      onChange={(e) => setGameForm({ ...gameForm, time: e.target.value })}
                      required
                      className="bg-black/20 border-white/10 focus:border-amber-500 text-white h-12"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 block mb-2">Total Tickets</label>
                    <Input
                      data-testid="total-tickets-input"
                      type="number"
                      value={gameForm.total_tickets}
                      onChange={(e) => setGameForm({ ...gameForm, total_tickets: parseInt(e.target.value) })}
                      min="6"
                      step="6"
                      required
                      className="bg-black/20 border-white/10 focus:border-amber-500 text-white h-12"
                    />
                    <p className="text-xs text-gray-500 mt-1">Must be multiple of 6 (Full Sheets)</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 block mb-2">Ticket Price (₹)</label>
                    <Input
                      data-testid="ticket-price-input"
                      type="number"
                      value={gameForm.price}
                      onChange={(e) => setGameForm({ ...gameForm, price: parseInt(e.target.value) })}
                      required
                      className="bg-black/20 border-white/10 focus:border-amber-500 text-white h-12"
                    />
                  </div>
                </div>

                {/* Dividends Selection */}
                <div>
                  <h3 className="text-lg font-bold text-white mb-3">Select Dividends (Prizes)</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(gameForm.dividends).map(([name, data]) => (
                      <div key={name} className="p-3 bg-white/5 rounded-lg border border-white/10">
                        <div className="flex items-center gap-3 mb-2">
                          <input
                            type="checkbox"
                            checked={data.enabled}
                            onChange={() => toggleDividend(name)}
                            className="w-4 h-4"
                            data-testid={`dividend-${name}`}
                          />
                          <label className="text-white font-medium text-sm flex-1">{name}</label>
                        </div>
                        {data.enabled && (
                          <Input
                            type="number"
                            value={data.amount}
                            onChange={(e) => updateDividendAmount(name, e.target.value)}
                            placeholder="Amount"
                            className="bg-black/20 border-white/10 text-white h-9 text-sm"
                          />
                        )}
                      </div>
                    ))}
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
              {games.map((game) => {
                const stats = getGameStats(game);
                return (
                  <div key={game.game_id} className="glass-card p-6" data-testid={`game-${game.game_id}`}>
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-white mb-2">{game.name}</h3>
                        <p className="text-sm text-gray-400">
                          {game.date} at {game.time} | ₹{game.price} per ticket
                        </p>
                        <p className="text-sm text-gray-400 mt-1">
                          Status: <span className="text-amber-500 font-bold">{game.status}</span>
                        </p>
                        <div className="flex gap-4 mt-2 text-xs">
                          <span className="text-emerald-400">Sold: {stats.confirmedTickets}/{game.ticket_count} ({stats.soldPercentage}%)</span>
                          <span className="text-yellow-400">Pending: {stats.pendingTickets}</span>
                          <span className="text-amber-500">Revenue: ₹{stats.revenue.toLocaleString()}</span>
                        </div>
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
                      {game.status === 'upcoming' && (
                        <Button
                          onClick={() => openEditModal(game)}
                          variant="outline"
                          size="sm"
                          className="border-white/10"
                          data-testid={`edit-game-${game.game_id}`}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          Edit Game
                        </Button>
                      )}
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
                          Activate Game
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* Bookings Tab */}
          <TabsContent value="bookings">
            {/* Game-wise Statistics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {games.filter(g => g.status !== 'completed').map(game => {
                const stats = getGameStats(game);
                return (
                  <div key={game.game_id} className="glass-card p-4 border-l-4 border-amber-500">
                    <h4 className="font-bold text-white mb-2">{game.name}</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Sold:</span>
                        <span className="text-emerald-400 font-bold">{stats.confirmedTickets}/{game.ticket_count}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Pending:</span>
                        <span className="text-yellow-400 font-bold">{stats.pendingTickets}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Revenue:</span>
                        <span className="text-amber-500 font-bold">₹{stats.revenue.toLocaleString()}</span>
                      </div>
                      <div className="mt-2 pt-2 border-t border-white/10">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-400 font-bold">{stats.soldPercentage}% Sold</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pending Bookings */}
            <h3 className="text-xl font-bold text-white mb-4">Pending Bookings</h3>
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
                          <span className="text-xs font-bold text-amber-500">🎉 Full Sheet: {booking.full_sheet_id}</span>
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

      {/* Edit Game Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#121216] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">Edit Game</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditGame} className="space-y-6 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-sm text-gray-400 block mb-2">Game Name</label>
                <Input
                  value={gameForm.name}
                  onChange={(e) => setGameForm({ ...gameForm, name: e.target.value })}
                  required
                  className="bg-black/20 border-white/10 text-white h-12"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-2">Date</label>
                <Input
                  type="date"
                  value={gameForm.date}
                  onChange={(e) => setGameForm({ ...gameForm, date: e.target.value })}
                  required
                  className="bg-black/20 border-white/10 text-white h-12"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-2">Time</label>
                <Input
                  type="time"
                  value={gameForm.time}
                  onChange={(e) => setGameForm({ ...gameForm, time: e.target.value })}
                  required
                  className="bg-black/20 border-white/10 text-white h-12"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-2">Ticket Price (₹)</label>
                <Input
                  type="number"
                  value={gameForm.price}
                  onChange={(e) => setGameForm({ ...gameForm, price: parseInt(e.target.value) })}
                  required
                  className="bg-black/20 border-white/10 text-white h-12"
                />
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-white mb-3">Update Dividends</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(gameForm.dividends).map(([name, data]) => (
                  <div key={name} className="p-3 bg-white/5 rounded-lg border border-white/10">
                    <div className="flex items-center gap-3 mb-2">
                      <input
                        type="checkbox"
                        checked={data.enabled}
                        onChange={() => toggleDividend(name)}
                        className="w-4 h-4"
                      />
                      <label className="text-white font-medium text-sm flex-1">{name}</label>
                    </div>
                    {data.enabled && (
                      <Input
                        type="number"
                        value={data.amount}
                        onChange={(e) => updateDividendAmount(name, e.target.value)}
                        className="bg-black/20 border-white/10 text-white h-9 text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditModal(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 font-bold"
              >
                Update Game
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
