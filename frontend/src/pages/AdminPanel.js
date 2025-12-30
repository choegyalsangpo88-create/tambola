import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Plus, Play, Check, Info, Edit, TrendingUp, Trash2, X, Volume2, Settings, Users, Ticket, Clock, Ban } from 'lucide-react';
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

// Voice options
const VOICE_OPTIONS = {
  female: [
    { value: 'nova', label: 'Nova (Energetic)' },
    { value: 'shimmer', label: 'Shimmer (Bright)' },
    { value: 'coral', label: 'Coral (Warm)' },
    { value: 'alloy', label: 'Alloy (Neutral)' }
  ],
  male: [
    { value: 'onyx', label: 'Onyx (Deep)' },
    { value: 'echo', label: 'Echo (Smooth)' },
    { value: 'fable', label: 'Fable (Expressive)' },
    { value: 'ash', label: 'Ash (Clear)' }
  ]
};

export default function AdminPanel() {
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [bookingRequests, setBookingRequests] = useState([]);
  const [editingGame, setEditingGame] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showTicketsModal, setShowTicketsModal] = useState(false);
  const [selectedGame, setSelectedGame] = useState(null);
  const [gameTickets, setGameTickets] = useState([]);
  const [ticketFilter, setTicketFilter] = useState('all');
  const [callerSettings, setCallerSettings] = useState(null);
  const [newPrefixLine, setNewPrefixLine] = useState('');

  // Create/Edit Game Form
  const [gameForm, setGameForm] = useState({
    name: '',
    date: '',
    time: '',
    price: 50,
    total_tickets: 600,
    dividends: { ...DEFAULT_DIVIDENDS }
  });

  // Fetch functions
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

  const fetchBookingRequests = async () => {
    try {
      const response = await axios.get(`${API}/admin/booking-requests`);
      setBookingRequests(response.data);
    } catch (error) {
      console.error('Failed to fetch booking requests:', error);
    }
  };

  const fetchCallerSettings = async () => {
    try {
      const response = await axios.get(`${API}/admin/caller-settings`);
      setCallerSettings(response.data);
    } catch (error) {
      console.error('Failed to fetch caller settings:', error);
    }
  };

  const fetchGameTickets = async (gameId) => {
    try {
      const response = await axios.get(`${API}/admin/games/${gameId}/tickets`);
      setGameTickets(response.data.tickets);
    } catch (error) {
      console.error('Failed to fetch game tickets:', error);
      toast.error('Failed to load tickets');
    }
  };

  useEffect(() => {
    fetchGames();
    fetchBookings();
    fetchBookingRequests();
    fetchCallerSettings();
  }, []);

  const handleCreateGame = async (e) => {
    e.preventDefault();
    try {
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
      
      toast.success('Game created with tickets generated automatically!');
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

  const handleDeleteGame = async () => {
    if (!selectedGame) return;
    try {
      await axios.delete(`${API}/admin/games/${selectedGame.game_id}`);
      toast.success('Game deleted successfully');
      setShowDeleteModal(false);
      setSelectedGame(null);
      fetchGames();
    } catch (error) {
      console.error('Failed to delete game:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete game');
    }
  };

  const openEditModal = (game) => {
    setEditingGame(game);
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

  const openTicketsModal = async (game) => {
    setSelectedGame(game);
    await fetchGameTickets(game.game_id);
    setShowTicketsModal(true);
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

  const handleApproveRequest = async (requestId) => {
    try {
      await axios.put(`${API}/admin/booking-requests/${requestId}/approve`);
      toast.success('Booking request approved!');
      fetchBookingRequests();
      fetchBookings();
      fetchGames();
    } catch (error) {
      console.error('Failed to approve request:', error);
      toast.error(error.response?.data?.detail || 'Failed to approve');
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      await axios.put(`${API}/admin/booking-requests/${requestId}/reject`);
      toast.success('Booking request rejected');
      fetchBookingRequests();
    } catch (error) {
      console.error('Failed to reject request:', error);
      toast.error('Failed to reject');
    }
  };

  const handleCancelTicket = async (ticketId) => {
    if (!window.confirm('Are you sure you want to cancel this ticket?')) return;
    try {
      await axios.post(`${API}/admin/tickets/${ticketId}/cancel`);
      toast.success('Ticket cancelled');
      if (selectedGame) fetchGameTickets(selectedGame.game_id);
      fetchGames();
    } catch (error) {
      console.error('Failed to cancel ticket:', error);
      toast.error(error.response?.data?.detail || 'Failed to cancel');
    }
  };

  const handleUpdateTicketHolder = async (ticketId, newName) => {
    try {
      await axios.put(`${API}/admin/tickets/${ticketId}/holder`, { holder_name: newName });
      toast.success('Holder name updated');
      if (selectedGame) fetchGameTickets(selectedGame.game_id);
    } catch (error) {
      console.error('Failed to update holder:', error);
      toast.error('Failed to update');
    }
  };

  const handleUpdateCallerSettings = async (updates) => {
    try {
      const response = await axios.put(`${API}/admin/caller-settings`, updates);
      setCallerSettings(response.data);
      toast.success('Caller settings updated');
    } catch (error) {
      console.error('Failed to update settings:', error);
      toast.error('Failed to update settings');
    }
  };

  const handleAddPrefixLine = async () => {
    if (!newPrefixLine.trim()) return;
    try {
      await axios.post(`${API}/admin/caller-settings/prefix-lines?line=${encodeURIComponent(newPrefixLine)}`);
      setNewPrefixLine('');
      fetchCallerSettings();
      toast.success('Prefix line added');
    } catch (error) {
      toast.error('Failed to add prefix line');
    }
  };

  const handleDeletePrefixLine = async (index) => {
    try {
      await axios.delete(`${API}/admin/caller-settings/prefix-lines/${index}`);
      fetchCallerSettings();
      toast.success('Prefix line deleted');
    } catch (error) {
      toast.error('Failed to delete prefix line');
    }
  };

  const handleResetPrefixLines = async () => {
    try {
      await axios.post(`${API}/admin/caller-settings/reset-prefix-lines`);
      fetchCallerSettings();
      toast.success('Prefix lines reset to defaults');
    } catch (error) {
      toast.error('Failed to reset');
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

  const filteredTickets = gameTickets.filter(t => {
    if (ticketFilter === 'booked') return t.is_booked;
    if (ticketFilter === 'available') return !t.is_booked;
    return true;
  });

  const pendingRequests = bookingRequests.filter(r => r.status === 'pending');

  return (
    <div className="min-h-screen bg-[#0a0a0c] pb-20">
      {/* Header */}
      <div className="bg-[#121216] border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Admin Panel
          </h1>
          {pendingRequests.length > 0 && (
            <span className="ml-auto px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
              {pendingRequests.length} Pending
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Tabs defaultValue="create" className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-8 bg-[#121216]">
            <TabsTrigger value="create">Create</TabsTrigger>
            <TabsTrigger value="manage">Manage</TabsTrigger>
            <TabsTrigger value="requests" className="relative">
              Requests
              {pendingRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {pendingRequests.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="bookings">Bookings</TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="w-4 h-4" />
            </TabsTrigger>
          </TabsList>

          {/* Create Game Tab */}
          <TabsContent value="create">
            <div className="glass-card p-6 max-w-4xl mx-auto">
              <h2 className="text-2xl font-bold text-white mb-2">Create New Game</h2>
              <p className="text-sm text-gray-400 mb-6">Tickets will be auto-generated on creation</p>
              <form onSubmit={handleCreateGame} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="text-sm text-gray-400 block mb-2">Game Name</label>
                    <Input
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
                      type="number"
                      value={gameForm.price}
                      onChange={(e) => setGameForm({ ...gameForm, price: parseInt(e.target.value) })}
                      required
                      className="bg-black/20 border-white/10 focus:border-amber-500 text-white h-12"
                    />
                  </div>
                </div>

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
                  type="submit"
                  className="w-full h-12 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 font-bold"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Create Game (Auto-generates Tickets)
                </Button>
              </form>
            </div>
          </TabsContent>

          {/* Manage Games Tab */}
          <TabsContent value="manage">
            <div className="space-y-4">
              {games.map((game) => {
                const stats = getGameStats(game);
                return (
                  <div key={game.game_id} className="glass-card p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-white mb-2">{game.name}</h3>
                        <p className="text-sm text-gray-400">
                          {game.date} at {game.time} | ₹{game.price}/ticket
                        </p>
                        <p className="text-sm text-gray-400 mt-1">
                          Tickets: <span className="text-amber-500">{game.ticket_count}</span> | 
                          Available: <span className="text-green-400">{game.available_tickets}</span>
                        </p>
                        <div className="flex gap-4 mt-2 text-xs">
                          <span className="text-emerald-400">Sold: {stats.confirmedTickets} ({stats.soldPercentage}%)</span>
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
                    <div className="flex flex-wrap gap-2">
                      {game.status === 'upcoming' && (
                        <>
                          <Button onClick={() => openEditModal(game)} variant="outline" size="sm" className="border-white/10">
                            <Edit className="w-4 h-4 mr-1" /> Edit
                          </Button>
                          <Button onClick={() => handleStartGame(game.game_id)} size="sm" className="bg-green-600 hover:bg-green-700">
                            <Play className="w-4 h-4 mr-1" /> Start
                          </Button>
                          <Button onClick={() => { setSelectedGame(game); setShowDeleteModal(true); }} variant="outline" size="sm" className="border-red-500/50 text-red-400 hover:bg-red-500/10">
                            <Trash2 className="w-4 h-4 mr-1" /> Delete
                          </Button>
                        </>
                      )}
                      <Button onClick={() => openTicketsModal(game)} variant="outline" size="sm" className="border-white/10">
                        <Ticket className="w-4 h-4 mr-1" /> Manage Tickets
                      </Button>
                      {game.status === 'live' && (
                        <Button onClick={() => navigate(`/live/${game.game_id}`)} size="sm" className="bg-red-600 hover:bg-red-700">
                          <Play className="w-4 h-4 mr-1" /> Go to Live
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* Booking Requests Tab (Approval Workflow) */}
          <TabsContent value="requests">
            <h3 className="text-xl font-bold text-white mb-4">Pending Ticket Requests</h3>
            <div className="space-y-4">
              {pendingRequests.length === 0 ? (
                <div className="glass-card p-8 text-center">
                  <Clock className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                  <p className="text-gray-400">No pending requests</p>
                </div>
              ) : (
                pendingRequests.map((req) => (
                  <div key={req.request_id} className="glass-card p-6 border-l-4 border-yellow-500">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="text-lg font-bold text-white">{req.user_name}</h4>
                        <p className="text-sm text-gray-400">{req.user_email}</p>
                        {req.user_phone && <p className="text-sm text-gray-400">{req.user_phone}</p>}
                        <p className="text-sm text-amber-400 mt-2">
                          Game: {req.game?.name}
                        </p>
                        <p className="text-sm text-gray-400">
                          {req.ticket_ids.length} tickets | ₹{req.total_amount}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Requested: {new Date(req.created_at).toLocaleString()}
                        </p>
                      </div>
                      <span className="px-3 py-1 text-xs font-bold rounded-full bg-yellow-500/20 text-yellow-400">
                        PENDING
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => handleApproveRequest(req.request_id)} size="sm" className="bg-green-600 hover:bg-green-700">
                        <Check className="w-4 h-4 mr-1" /> Approve
                      </Button>
                      <Button onClick={() => handleRejectRequest(req.request_id)} variant="outline" size="sm" className="border-red-500/50 text-red-400 hover:bg-red-500/10">
                        <X className="w-4 h-4 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Processed Requests */}
            <h3 className="text-xl font-bold text-white mt-8 mb-4">Processed Requests</h3>
            <div className="space-y-2">
              {bookingRequests.filter(r => r.status !== 'pending').slice(0, 10).map((req) => (
                <div key={req.request_id} className={`glass-card p-4 border-l-4 ${req.status === 'approved' ? 'border-green-500' : 'border-red-500'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-white font-medium">{req.user_name}</span>
                      <span className="text-gray-400 text-sm ml-2">- {req.game?.name}</span>
                      <span className="text-gray-500 text-xs ml-2">({req.ticket_ids.length} tickets)</span>
                    </div>
                    <span className={`px-2 py-1 text-xs font-bold rounded ${req.status === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {req.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Bookings Tab */}
          <TabsContent value="bookings">
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
                        <span className="text-gray-400">Revenue:</span>
                        <span className="text-amber-500 font-bold">₹{stats.revenue.toLocaleString()}</span>
                      </div>
                      <div className="mt-2 pt-2 border-t border-white/10">
                        <TrendingUp className="w-4 h-4 text-emerald-400 inline mr-1" />
                        <span className="text-emerald-400 font-bold">{stats.soldPercentage}% Sold</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <h3 className="text-xl font-bold text-white mb-4">Confirmed Bookings</h3>
            <div className="space-y-2">
              {bookings.filter(b => b.status === 'confirmed').slice(0, 20).map((booking) => (
                <div key={booking.booking_id} className="glass-card p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-white font-medium">{booking.user?.name}</span>
                      <span className="text-gray-400 text-sm ml-2">- {booking.game?.name}</span>
                      <span className="text-amber-400 text-sm ml-2">₹{booking.total_amount}</span>
                    </div>
                    <span className="px-2 py-1 text-xs font-bold rounded bg-green-500/20 text-green-400">
                      CONFIRMED
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Settings Tab (Caller Voice) */}
          <TabsContent value="settings">
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="glass-card p-6">
                <div className="flex items-center gap-3 mb-6">
                  <Volume2 className="w-6 h-6 text-amber-500" />
                  <h2 className="text-2xl font-bold text-white">Caller Voice Settings</h2>
                </div>

                {callerSettings && (
                  <div className="space-y-6">
                    {/* Enable/Disable */}
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                      <div>
                        <p className="text-white font-medium">Voice Announcements</p>
                        <p className="text-sm text-gray-400">Enable AI voice for number calling</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={callerSettings.enabled}
                          onChange={(e) => handleUpdateCallerSettings({ enabled: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-700 rounded-full peer peer-checked:bg-amber-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all"></div>
                      </label>
                    </div>

                    {/* Gender */}
                    <div>
                      <label className="text-sm text-gray-400 block mb-2">Voice Gender</label>
                      <div className="flex gap-3">
                        {['female', 'male'].map((gender) => (
                          <button
                            key={gender}
                            onClick={() => handleUpdateCallerSettings({ gender })}
                            className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                              callerSettings.gender === gender
                                ? 'bg-amber-500 text-black'
                                : 'bg-white/5 text-white hover:bg-white/10'
                            }`}
                          >
                            {gender === 'female' ? '👩 Female' : '👨 Male'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Voice */}
                    <div>
                      <label className="text-sm text-gray-400 block mb-2">Voice Style</label>
                      <div className="grid grid-cols-2 gap-2">
                        {VOICE_OPTIONS[callerSettings.gender || 'female'].map((voice) => (
                          <button
                            key={voice.value}
                            onClick={() => handleUpdateCallerSettings({ voice: voice.value })}
                            className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                              callerSettings.voice === voice.value
                                ? 'bg-amber-500 text-black'
                                : 'bg-white/5 text-white hover:bg-white/10'
                            }`}
                          >
                            {voice.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Speed */}
                    <div>
                      <label className="text-sm text-gray-400 block mb-2">Speaking Speed</label>
                      <div className="flex gap-2">
                        {[{ value: 0.8, label: 'Slow' }, { value: 1.0, label: 'Normal' }, { value: 1.3, label: 'Fast' }].map((speed) => (
                          <button
                            key={speed.value}
                            onClick={() => handleUpdateCallerSettings({ speed: speed.value })}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                              callerSettings.speed === speed.value
                                ? 'bg-amber-500 text-black'
                                : 'bg-white/5 text-white hover:bg-white/10'
                            }`}
                          >
                            {speed.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom Prefix Lines */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm text-gray-400">Custom Prefix Lines</label>
                        <Button onClick={handleResetPrefixLines} variant="ghost" size="sm" className="text-xs text-gray-400">
                          Reset to Defaults
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500 mb-3">These lines will be randomly spoken before each number</p>
                      
                      <div className="space-y-2 max-h-48 overflow-y-auto mb-3">
                        {callerSettings.prefix_lines?.map((line, index) => (
                          <div key={index} className="flex items-center gap-2 p-2 bg-white/5 rounded-lg">
                            <span className="text-white text-sm flex-1">&ldquo;{line}&rdquo;</span>
                            <Button onClick={() => handleDeletePrefixLine(index)} variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:bg-red-500/10">
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-2">
                        <Input
                          value={newPrefixLine}
                          onChange={(e) => setNewPrefixLine(e.target.value)}
                          placeholder="Add a custom line or joke..."
                          className="bg-black/20 border-white/10 text-white"
                          onKeyPress={(e) => e.key === 'Enter' && handleAddPrefixLine()}
                        />
                        <Button onClick={handleAddPrefixLine} className="bg-amber-500 hover:bg-amber-600">
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
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
                <Input value={gameForm.name} onChange={(e) => setGameForm({ ...gameForm, name: e.target.value })} required className="bg-black/20 border-white/10 text-white h-12" />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-2">Date</label>
                <Input type="date" value={gameForm.date} onChange={(e) => setGameForm({ ...gameForm, date: e.target.value })} required className="bg-black/20 border-white/10 text-white h-12" />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-2">Time</label>
                <Input type="time" value={gameForm.time} onChange={(e) => setGameForm({ ...gameForm, time: e.target.value })} required className="bg-black/20 border-white/10 text-white h-12" />
              </div>
              <div>
                <label className="text-sm text-gray-400 block mb-2">Ticket Price (₹)</label>
                <Input type="number" value={gameForm.price} onChange={(e) => setGameForm({ ...gameForm, price: parseInt(e.target.value) })} required className="bg-black/20 border-white/10 text-white h-12" />
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-3">Update Dividends</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(gameForm.dividends).map(([name, data]) => (
                  <div key={name} className="p-3 bg-white/5 rounded-lg border border-white/10">
                    <div className="flex items-center gap-3 mb-2">
                      <input type="checkbox" checked={data.enabled} onChange={() => toggleDividend(name)} className="w-4 h-4" />
                      <label className="text-white font-medium text-sm flex-1">{name}</label>
                    </div>
                    {data.enabled && (
                      <Input type="number" value={data.amount} onChange={(e) => updateDividendAmount(name, e.target.value)} className="bg-black/20 border-white/10 text-white h-9 text-sm" />
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setShowEditModal(false)} className="flex-1">Cancel</Button>
              <Button type="submit" className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 font-bold">Update Game</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="bg-[#121216] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">Delete Game?</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-gray-400">Are you sure you want to delete <span className="text-white font-bold">{selectedGame?.name}</span>?</p>
            <p className="text-red-400 text-sm mt-2">This will also delete all tickets and bookings for this game. This action cannot be undone.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleDeleteGame} className="flex-1 bg-red-600 hover:bg-red-700">
              <Trash2 className="w-4 h-4 mr-2" /> Delete Game
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Tickets Modal */}
      <Dialog open={showTicketsModal} onOpenChange={setShowTicketsModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#121216] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">
              Manage Tickets - {selectedGame?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex gap-2 mb-4">
            {['all', 'booked', 'available'].map((filter) => (
              <Button
                key={filter}
                onClick={() => setTicketFilter(filter)}
                variant={ticketFilter === filter ? 'default' : 'outline'}
                size="sm"
                className={ticketFilter === filter ? 'bg-amber-500' : 'border-white/10'}
              >
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </Button>
            ))}
            <span className="ml-auto text-sm text-gray-400">
              Showing {filteredTickets.length} tickets
            </span>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredTickets.slice(0, 50).map((ticket) => (
              <div key={ticket.ticket_id} className={`p-3 rounded-lg border ${ticket.is_booked ? 'bg-amber-500/10 border-amber-500/30' : 'bg-white/5 border-white/10'}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-white font-medium">{ticket.ticket_number}</span>
                    <span className="text-gray-500 text-xs ml-2">({ticket.full_sheet_id})</span>
                    {ticket.is_booked && (
                      <span className="text-amber-400 text-sm ml-3">
                        → {ticket.holder_name || ticket.holder?.name || 'Unknown'}
                      </span>
                    )}
                  </div>
                  {ticket.is_booked && (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          const newName = prompt('Enter new holder name:', ticket.holder_name || ticket.holder?.name);
                          if (newName) handleUpdateTicketHolder(ticket.ticket_id, newName);
                        }}
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                      >
                        <Edit className="w-3 h-3 mr-1" /> Edit
                      </Button>
                      <Button
                        onClick={() => handleCancelTicket(ticket.ticket_id)}
                        variant="ghost"
                        size="sm"
                        className="text-xs text-red-400 hover:bg-red-500/10"
                      >
                        <Ban className="w-3 h-3 mr-1" /> Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {filteredTickets.length > 50 && (
              <p className="text-center text-gray-500 text-sm py-2">
                Showing 50 of {filteredTickets.length} tickets
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
