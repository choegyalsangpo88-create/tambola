import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  ArrowLeft, Plus, Play, Check, Edit, TrendingUp, Trash2, X, Volume2, 
  Settings, Users, Ticket, Clock, Ban, LogOut, MessageSquare, CreditCard,
  FileText, Send, AlertCircle, CheckCircle2, IndianRupee, History, Gamepad2
} from 'lucide-react';
import { toast } from 'sonner';
import GameControlModal from '../components/GameControlModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Create axios instance with admin auth
const adminAxios = axios.create();
adminAxios.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers['Authorization'] = `Admin ${token}`;
  }
  config.withCredentials = true;
  return config;
});

adminAxios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('admin_token');
      window.location.href = '/control-ceo';
    }
    return Promise.reject(error);
  }
);

// Default dividends template
const DEFAULT_DIVIDENDS = {
  'Quick Five': { enabled: true, amount: 500 },
  'Four Corners': { enabled: true, amount: 300 },
  'Full Sheet Corner': { enabled: true, amount: 1000 },
  'Top Line': { enabled: true, amount: 200 },
  'Middle Line': { enabled: true, amount: 200 },
  'Bottom Line': { enabled: true, amount: 200 },
  '1st Full House': { enabled: true, amount: 2000 },
  '2nd Full House': { enabled: true, amount: 1000 },
  '3rd Full House': { enabled: true, amount: 5000 }
};

// WhatsApp Template Types (Meta-approved)
const WHATSAPP_TEMPLATES = [
  { id: 'booking_confirmed', name: 'Booking Confirmed', description: 'Send when payment is verified' },
  { id: 'game_reminder', name: 'Game Reminder', description: 'Send 1 hour before game starts' },
  { id: 'winner_notification', name: 'Winner Notification', description: 'Send when player wins a prize' },
  { id: 'payment_received', name: 'Payment Received', description: 'Send when payment is confirmed' }
];

// Voice options
const VOICE_OPTIONS = {
  female: [
    { value: 'nova', label: 'Nova' },
    { value: 'shimmer', label: 'Shimmer' },
    { value: 'coral', label: 'Coral' },
    { value: 'alloy', label: 'Alloy' }
  ],
  male: [
    { value: 'onyx', label: 'Onyx' },
    { value: 'echo', label: 'Echo' },
    { value: 'fable', label: 'Fable' },
    { value: 'ash', label: 'Ash' }
  ]
};

export default function AdminPanel() {
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [bookingRequests, setBookingRequests] = useState([]);
  const [payments, setPayments] = useState([]);
  const [actionLogs, setActionLogs] = useState([]);
  const [editingGame, setEditingGame] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showTicketsModal, setShowTicketsModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifyPhone, setNotifyPhone] = useState('');
  const [notifyName, setNotifyName] = useState('');
  const [selectedGame, setSelectedGame] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [gameTickets, setGameTickets] = useState([]);
  const [ticketFilter, setTicketFilter] = useState('all');
  const [callerSettings, setCallerSettings] = useState(null);
  const [newPrefixLine, setNewPrefixLine] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showGameDetailsModal, setShowGameDetailsModal] = useState(false);
  const [gameDetails, setGameDetails] = useState(null);
  const [showGameControlModal, setShowGameControlModal] = useState(false);
  const [controlGameId, setControlGameId] = useState(null);
  const [showCreateConfirmModal, setShowCreateConfirmModal] = useState(false);
  const [pendingGameData, setPendingGameData] = useState(null);
  
  // Agent management state
  const [agents, setAgents] = useState([]);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [agentForm, setAgentForm] = useState({
    name: '',
    username: '',
    password: '',
    whatsapp_number: '',
    region: 'india',
    country_codes: ['+91']
  });

  const [gameForm, setGameForm] = useState({
    name: '',
    date: '',
    time: '',
    price: 50,
    total_tickets: 600,
    dividends: { ...DEFAULT_DIVIDENDS }
  });

  // Log admin action
  const logAction = useCallback(async (action, details) => {
    try {
      await adminAxios.post(`${API}/admin/log-action`, { action, details });
      fetchActionLogs();
    } catch (error) {
      console.error('Failed to log action:', error);
    }
  }, []);

  // Check admin authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('admin_token');
        if (!token) {
          navigate('/control-ceo');
          return;
        }
        const response = await adminAxios.get(`${API}/admin/verify`);
        if (response.data.valid) {
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('admin_token');
          navigate('/control-ceo');
        }
      } catch (error) {
        localStorage.removeItem('admin_token');
        navigate('/control-ceo');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [navigate]);

  // Fetch functions
  const fetchGames = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/games`);
      setGames(response.data);
    } catch (error) {
      console.error('Failed to fetch games:', error);
    }
  }, []);

  const fetchBookings = useCallback(async () => {
    try {
      const response = await adminAxios.get(`${API}/admin/bookings`);
      setBookings(response.data);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    }
  }, []);

  const fetchBookingRequests = useCallback(async () => {
    try {
      const response = await adminAxios.get(`${API}/admin/booking-requests`);
      setBookingRequests(response.data);
    } catch (error) {
      console.error('Failed to fetch booking requests:', error);
    }
  }, []);

  const fetchPayments = useCallback(async () => {
    try {
      const response = await adminAxios.get(`${API}/admin/payments`);
      setPayments(response.data || []);
    } catch (error) {
      console.error('Failed to fetch payments:', error);
      setPayments([]);
    }
  }, []);

  const fetchAgents = useCallback(async () => {
    try {
      const response = await adminAxios.get(`${API}/admin/agents`);
      setAgents(response.data.agents || []);
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    }
  }, []);

  const handleCreateAgent = async (e) => {
    e.preventDefault();
    try {
      await adminAxios.post(`${API}/admin/agents`, agentForm);
      toast.success('Agent created successfully!');
      setShowAgentModal(false);
      setAgentForm({ name: '', username: '', password: '', whatsapp_number: '', region: 'india', country_codes: ['+91'] });
      fetchAgents();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create agent');
    }
  };

  const handleUpdateAgent = async (agentId) => {
    try {
      await adminAxios.put(`${API}/admin/agents/${agentId}`, agentForm);
      toast.success('Agent updated!');
      setShowAgentModal(false);
      setEditingAgent(null);
      setAgentForm({ name: '', username: '', password: '', whatsapp_number: '', region: 'india', country_codes: ['+91'] });
      fetchAgents();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update agent');
    }
  };

  const handleToggleAgentStatus = async (agentId, currentStatus) => {
    try {
      await adminAxios.put(`${API}/admin/agents/${agentId}`, { is_active: !currentStatus });
      toast.success(currentStatus ? 'Agent deactivated' : 'Agent activated');
      fetchAgents();
    } catch (error) {
      toast.error('Failed to update agent status');
    }
  };

  const openEditAgentModal = (agent) => {
    setEditingAgent(agent);
    setAgentForm({
      name: agent.name,
      username: agent.username,
      password: '',
      whatsapp_number: agent.whatsapp_number,
      region: agent.region,
      country_codes: agent.country_codes || []
    });
    setShowAgentModal(true);
  };

  const fetchActionLogs = useCallback(async () => {
    try {
      const response = await adminAxios.get(`${API}/admin/action-logs`);
      setActionLogs(response.data || []);
    } catch (error) {
      console.error('Failed to fetch action logs:', error);
      setActionLogs([]);
    }
  }, []);

  const fetchCallerSettings = useCallback(async () => {
    try {
      const response = await adminAxios.get(`${API}/admin/caller-settings`);
      setCallerSettings(response.data);
    } catch (error) {
      console.error('Failed to fetch caller settings:', error);
    }
  }, []);

  const fetchGameTickets = async (gameId) => {
    try {
      const response = await adminAxios.get(`${API}/admin/games/${gameId}/tickets`);
      setGameTickets(response.data.tickets);
    } catch (error) {
      console.error('Failed to fetch game tickets:', error);
      toast.error('Failed to load tickets');
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchGames();
      fetchBookings();
      fetchBookingRequests();
      fetchPayments();
      fetchActionLogs();
      fetchCallerSettings();
      fetchAgents();
    }
  }, [isAuthenticated, fetchGames, fetchBookings, fetchBookingRequests, fetchPayments, fetchActionLogs, fetchCallerSettings, fetchAgents]);

  const handleLogout = async () => {
    await logAction('ADMIN_LOGOUT', { timestamp: new Date().toISOString() });
    localStorage.removeItem('admin_token');
    navigate('/control-ceo');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const handleCreateGame = async (e) => {
    e.preventDefault();
    
    // Prepare game data
    const prizes = {};
    Object.entries(gameForm.dividends).forEach(([name, data]) => {
      if (data.enabled) prizes[name] = data.amount;
    });

    const gameData = {
      name: gameForm.name,
      date: gameForm.date,
      time: gameForm.time,
      price: gameForm.price,
      total_tickets: gameForm.total_tickets,
      prizes
    };

    // Show confirmation modal
    setPendingGameData(gameData);
    setShowCreateConfirmModal(true);
  };

  const confirmCreateGame = async () => {
    if (!pendingGameData) return;
    
    try {
      const response = await axios.post(`${API}/games`, pendingGameData);
      
      await logAction('GAME_CREATED', { 
        game_id: response.data.game_id, 
        name: pendingGameData.name, 
        tickets: pendingGameData.total_tickets 
      });
      
      toast.success('Game created successfully!');
      fetchGames();
      resetForm();
      setShowCreateConfirmModal(false);
      setPendingGameData(null);
    } catch (error) {
      if (error.response?.data?.detail) {
        toast.error(error.response.data.detail);
      } else {
        toast.error('Failed to create game');
      }
      setShowCreateConfirmModal(false);
      setPendingGameData(null);
    }
  };

  const handleEditGame = async (e) => {
    e.preventDefault();
    try {
      const prizes = {};
      Object.entries(gameForm.dividends).forEach(([name, data]) => {
        if (data.enabled) prizes[name] = data.amount;
      });

      await axios.put(`${API}/games/${editingGame.game_id}`, {
        name: gameForm.name,
        date: gameForm.date,
        time: gameForm.time,
        price: gameForm.price,
        prizes
      });
      
      await logAction('GAME_UPDATED', { game_id: editingGame.game_id, name: gameForm.name });
      toast.success('Game updated');
      setShowEditModal(false);
      setEditingGame(null);
      fetchGames();
      resetForm();
    } catch (error) {
      toast.error('Failed to update game');
    }
  };

  const handleDeleteGame = async (force = false) => {
    if (!selectedGame) return;
    try {
      const url = force 
        ? `${API}/admin/games/${selectedGame.game_id}?force=true`
        : `${API}/admin/games/${selectedGame.game_id}`;
      await adminAxios.delete(url);
      
      await logAction('GAME_DELETED', { game_id: selectedGame.game_id, name: selectedGame.name, forced: force });
      toast.success('Game deleted');
      setShowDeleteModal(false);
      setSelectedGame(null);
      fetchGames();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete game');
    }
  };

  const handleStartGame = async (gameId) => {
    // Check if game can be started (during scheduled time)
    const game = games.find(g => g.game_id === gameId);
    if (game) {
      const gameDateTime = new Date(`${game.date}T${game.time}`);
      const now = new Date();
      const timeDiff = Math.abs(now - gameDateTime) / (1000 * 60); // difference in minutes
      
      // Allow starting 30 minutes before or after scheduled time
      if (timeDiff > 30) {
        const confirmed = window.confirm(
          `This game is scheduled for ${game.date} at ${game.time}. It's currently ${timeDiff > 60 ? Math.round(timeDiff/60) + ' hours' : Math.round(timeDiff) + ' minutes'} ${now < gameDateTime ? 'early' : 'late'}.\n\nAre you sure you want to start it now?`
        );
        if (!confirmed) return;
      }
    }
    
    try {
      await axios.post(`${API}/games/${gameId}/start`);
      await logAction('GAME_STARTED', { game_id: gameId });
      toast.success('Game started!');
      fetchGames();
    } catch (error) {
      toast.error('Failed to start game');
    }
  };

  const handleEndGame = async (gameId) => {
    const game = games.find(g => g.game_id === gameId);
    const confirmed = window.confirm(
      `Are you sure you want to end "${game?.name}"?\n\nThis action cannot be undone. The game will be marked as completed.`
    );
    if (!confirmed) return;
    
    try {
      await axios.post(`${API}/games/${gameId}/end`);
      await logAction('GAME_ENDED', { game_id: gameId, name: game?.name });
      toast.success('Game ended successfully');
      fetchGames();
    } catch (error) {
      toast.error('Failed to end game');
    }
  };

  const handleApproveRequest = async (requestId) => {
    // Find the booking request to get details for WhatsApp
    const request = pendingRequests.find(r => r.request_id === requestId);
    
    try {
      await adminAxios.put(`${API}/admin/booking-requests/${requestId}/approve`);
      await logAction('BOOKING_APPROVED', { request_id: requestId });
      toast.success('Payment approved. WhatsApp message opened.');
      
      // Open WhatsApp with confirmation message
      if (request) {
        const playerName = request.user_name || 'Player';
        const amount = request.total_amount || 0;
        const ticketCount = request.ticket_ids?.length || 0;
        const gameName = request.game?.name || 'Tambola Game';
        const bookingId = requestId;
        
        // Format phone number with country code
        let phoneNumber = request.user_phone || '';
        phoneNumber = phoneNumber.replace(/\D/g, ''); // Remove non-digits
        if (phoneNumber.startsWith('0')) {
          phoneNumber = phoneNumber.substring(1);
        }
        if (!phoneNumber.startsWith('91') && phoneNumber.length === 10) {
          phoneNumber = '91' + phoneNumber;
        }
        
        // Create confirmation message
        const message = `✅ Payment Confirmed!

Hi ${playerName},
Your payment of ₹${amount} has been confirmed.

🎟️ Tickets: ${ticketCount}
🧾 Booking ID: ${bookingId}
🎮 Game: ${gameName}

Please join the game on time.
Good luck 🍀

— SixSeven Tambola`;
        
        // Open WhatsApp in new tab
        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
        window.open(whatsappUrl, '_blank');
      }
      
      fetchBookingRequests();
      fetchBookings();
      fetchGames();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve');
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      await adminAxios.put(`${API}/admin/booking-requests/${requestId}/reject`);
      await logAction('BOOKING_REJECTED', { request_id: requestId });
      toast.success('Booking rejected');
      fetchBookingRequests();
    } catch (error) {
      toast.error('Failed to reject');
    }
  };

  const handleConfirmPayment = async (bookingId) => {
    try {
      await adminAxios.put(`${API}/admin/bookings/${bookingId}/confirm-payment`);
      await logAction('PAYMENT_CONFIRMED', { booking_id: bookingId });
      toast.success('Payment confirmed');
      fetchBookings();
      fetchPayments();
    } catch (error) {
      toast.error('Failed to confirm payment');
    }
  };

  const handleSendWhatsAppTemplate = async (templateId, recipient) => {
    // Create message based on template type
    let message = '';
    const playerName = recipient.name || 'Player';
    const gameName = recipient.game_name || 'Tambola Game';
    
    switch (templateId) {
      case 'booking_confirmed':
        message = `✅ Booking Confirmed!

Hi ${playerName},
Your booking for ${gameName} has been confirmed.

🎟️ Booking ID: ${recipient.booking_id}

Please join the game on time.
Good luck 🍀

— SixSeven Tambola`;
        break;
      case 'game_reminder':
        message = `⏰ Game Reminder!

Hi ${playerName},
${gameName} is starting soon!

Don't forget to join the game.
Good luck 🍀

— SixSeven Tambola`;
        break;
      case 'payment_received':
        message = `💰 Payment Received!

Hi ${playerName},
We've received your payment for ${gameName}.

Your tickets are confirmed.
Good luck 🍀

— SixSeven Tambola`;
        break;
      default:
        message = `Hi ${playerName},

Thank you for joining ${gameName}!

— SixSeven Tambola`;
    }
    
    // Format phone number with country code
    let phoneNumber = recipient.phone || '';
    phoneNumber = phoneNumber.replace(/\D/g, '');
    if (phoneNumber.startsWith('0')) {
      phoneNumber = phoneNumber.substring(1);
    }
    if (!phoneNumber.startsWith('91') && phoneNumber.length === 10) {
      phoneNumber = '91' + phoneNumber;
    }
    
    // Log the action
    await logAction('WHATSAPP_MESSAGE_OPENED', { 
      template_id: templateId, 
      recipient: phoneNumber,
      booking_id: recipient.booking_id 
    });
    
    // Open WhatsApp in new tab
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
    
    toast.success('WhatsApp message opened. Please tap Send.');
    setShowWhatsAppModal(false);
  };

  // Handle "Notify New Game" - opens WhatsApp with game promotion message
  const handleNotifyNewGame = async (game, recipient = null) => {
    const gameName = game.name || 'Tambola Game';
    const gameDate = game.date || 'TBD';
    const gameTime = game.time || 'TBD';
    const ticketPrice = game.price || 100;
    const bookingLink = `${window.location.origin}/game/${game.game_id}`;
    
    // If no recipient specified, open a modal to select or enter recipient
    if (!recipient) {
      setSelectedGame(game);
      setShowNotifyModal(true);
      return;
    }
    
    const playerName = recipient.name || 'Player';
    
    // Format phone number with country code
    let phoneNumber = recipient.phone || '';
    phoneNumber = phoneNumber.replace(/\D/g, '');
    if (phoneNumber.startsWith('0')) {
      phoneNumber = phoneNumber.substring(1);
    }
    if (!phoneNumber.startsWith('91') && phoneNumber.length === 10) {
      phoneNumber = '91' + phoneNumber;
    }
    
    // Create promotional message
    const message = `🎉 New Tambola Game Available!

Hi ${playerName},
A new Tambola game is now open for booking 🎟️

🎮 Game: ${gameName}
🗓 Date: ${gameDate}
🕒 Time: ${gameTime}
💰 Ticket Price: ₹${ticketPrice}

Book your tickets now 👇
${bookingLink}

Good luck 🍀
— SixSeven Tambola`;
    
    // Log the action
    await logAction('NEW_GAME_NOTIFICATION_OPENED', { 
      game_id: game.game_id,
      recipient: phoneNumber
    });
    
    // Open WhatsApp in new tab
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
    
    toast.success('WhatsApp notification opened. Please tap Send.');
  };

  // Handle bulk notify - notify all confirmed players from previous games
  const handleBulkNotifyNewGame = async (game) => {
    // Get all unique players from confirmed bookings
    const uniquePlayers = new Map();
    bookings
      .filter(b => b.status === 'confirmed' && b.user?.phone)
      .forEach(b => {
        if (!uniquePlayers.has(b.user.phone)) {
          uniquePlayers.set(b.user.phone, {
            name: b.user.name || 'Player',
            phone: b.user.phone
          });
        }
      });
    
    if (uniquePlayers.size === 0) {
      toast.error('No players with phone numbers found');
      return;
    }
    
    // Show confirmation
    const playerCount = uniquePlayers.size;
    if (!window.confirm(`This will open ${playerCount} WhatsApp windows. Continue?`)) {
      return;
    }
    
    // Open WhatsApp for each player (with small delay to prevent blocking)
    const players = Array.from(uniquePlayers.values());
    for (let i = 0; i < Math.min(players.length, 10); i++) { // Limit to 10 to prevent spam
      setTimeout(() => {
        handleNotifyNewGame(game, players[i]);
      }, i * 500);
    }
    
    if (players.length > 10) {
      toast.info(`Opened first 10 of ${players.length} players. Open more manually.`);
    }
  };

  const handleCancelTicket = async (ticketId) => {
    if (!window.confirm('Cancel this ticket?')) return;
    try {
      await adminAxios.post(`${API}/admin/tickets/${ticketId}/cancel`);
      await logAction('TICKET_CANCELLED', { ticket_id: ticketId });
      toast.success('Ticket cancelled');
      if (selectedGame) fetchGameTickets(selectedGame.game_id);
      fetchGames();
    } catch (error) {
      toast.error('Failed to cancel');
    }
  };

  const handleUpdateTicketHolder = async (ticketId, newName) => {
    try {
      await adminAxios.put(`${API}/admin/tickets/${ticketId}/holder`, { holder_name: newName });
      await logAction('TICKET_HOLDER_UPDATED', { ticket_id: ticketId, new_name: newName });
      toast.success('Holder updated');
      if (selectedGame) fetchGameTickets(selectedGame.game_id);
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  const handleUpdateCallerSettings = async (updates) => {
    try {
      const response = await adminAxios.put(`${API}/admin/caller-settings`, updates);
      setCallerSettings(response.data);
      await logAction('CALLER_SETTINGS_UPDATED', updates);
      toast.success('Settings updated');
    } catch (error) {
      toast.error('Failed to update settings');
    }
  };

  const handleAddPrefixLine = async () => {
    if (!newPrefixLine.trim()) return;
    try {
      await adminAxios.post(`${API}/admin/caller-settings/prefix-lines?line=${encodeURIComponent(newPrefixLine)}`);
      setNewPrefixLine('');
      fetchCallerSettings();
      toast.success('Prefix line added');
    } catch (error) {
      toast.error('Failed to add');
    }
  };

  const handleDeletePrefixLine = async (index) => {
    try {
      await adminAxios.delete(`${API}/admin/caller-settings/prefix-lines/${index}`);
      fetchCallerSettings();
      toast.success('Deleted');
    } catch (error) {
      toast.error('Failed');
    }
  };

  const openEditModal = (game) => {
    setEditingGame(game);
    const dividends = { ...DEFAULT_DIVIDENDS };
    Object.keys(dividends).forEach(key => {
      dividends[key].enabled = game.prizes?.hasOwnProperty(key);
      dividends[key].amount = game.prizes?.[key] || dividends[key].amount;
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

  const openGameDetailsModal = async (game) => {
    setSelectedGame(game);
    const stats = getGameStats(game);
    
    // Fetch game session for winners if game is live or completed
    let winners = {};
    if (game.status === 'live' || game.status === 'completed') {
      try {
        const sessionRes = await axios.get(`${API}/games/${game.game_id}/session`);
        winners = sessionRes.data.winners || {};
      } catch (e) {
        console.log('No session found');
      }
    }
    
    setGameDetails({
      ...game,
      stats,
      winners
    });
    setShowGameDetailsModal(true);
  };

  const openGameControlModal = (game) => {
    setControlGameId(game.game_id);
    setShowGameControlModal(true);
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

  const toggleDividend = (name) => {
    setGameForm(prev => ({
      ...prev,
      dividends: {
        ...prev.dividends,
        [name]: { ...prev.dividends[name], enabled: !prev.dividends[name].enabled }
      }
    }));
  };

  const updateDividendAmount = (name, amount) => {
    setGameForm(prev => ({
      ...prev,
      dividends: {
        ...prev.dividends,
        [name]: { ...prev.dividends[name], amount: parseInt(amount) || 0 }
      }
    }));
  };

  const getGameStats = (game) => {
    const gameBookings = bookings.filter(b => b.game_id === game.game_id);
    const totalBooked = gameBookings.reduce((sum, b) => sum + (b.ticket_ids?.length || 0), 0);
    const confirmedBookings = gameBookings.filter(b => b.status === 'confirmed');
    const confirmedTickets = confirmedBookings.reduce((sum, b) => sum + (b.ticket_ids?.length || 0), 0);
    const revenue = confirmedBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0);
    return {
      totalBooked,
      confirmedTickets,
      revenue,
      soldPercentage: ((confirmedTickets / (game.ticket_count || 1)) * 100).toFixed(1)
    };
  };

  const filteredTickets = gameTickets.filter(t => {
    if (ticketFilter === 'booked') return t.is_booked;
    if (ticketFilter === 'available') return !t.is_booked;
    return true;
  });

  const pendingRequests = bookingRequests.filter(r => r.status === 'pending');

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Minimal Header */}
      <header className="border-b border-zinc-800 sticky top-0 z-50 bg-zinc-950/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="text-zinc-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold text-white">Admin Panel</h1>
          {pendingRequests.length > 0 && (
            <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-medium rounded-full">
              {pendingRequests.length}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-zinc-400 hover:text-white">
              <LogOut className="w-4 h-4 mr-1" /> Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="games" className="w-full">
          <TabsList className="grid w-full grid-cols-7 mb-6 bg-zinc-900 p-1 rounded-lg">
            <TabsTrigger value="games" className="text-xs">Games</TabsTrigger>
            <TabsTrigger value="requests" className="text-xs relative">
              Requests
              {pendingRequests.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-[10px] rounded-full flex items-center justify-center">
                  {pendingRequests.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="payments" className="text-xs">Payments</TabsTrigger>
            <TabsTrigger value="agents" className="text-xs">Agents</TabsTrigger>
            <TabsTrigger value="whatsapp" className="text-xs">WhatsApp</TabsTrigger>
            <TabsTrigger value="logs" className="text-xs">Logs</TabsTrigger>
            <TabsTrigger value="settings" className="text-xs">Settings</TabsTrigger>
          </TabsList>

          {/* Games Tab */}
          <TabsContent value="games" className="space-y-6">
            {/* Create Game Form */}
            <div className="bg-zinc-900 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-500" />
                Create New Game
              </h2>
              <form onSubmit={handleCreateGame} className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="col-span-2">
                    <label className="text-xs text-zinc-500 block mb-1">Game Name</label>
                    <Input
                      value={gameForm.name}
                      onChange={(e) => setGameForm({ ...gameForm, name: e.target.value })}
                      placeholder="Saturday Night Game"
                      required
                      className="bg-zinc-800 border-zinc-700 text-white h-10"
                      data-testid="create-game-name"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">Date</label>
                    <Input
                      type="date"
                      value={gameForm.date}
                      onChange={(e) => setGameForm({ ...gameForm, date: e.target.value })}
                      required
                      className="bg-zinc-800 border-zinc-700 text-white h-10"
                      data-testid="create-game-date"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">Time</label>
                    <Input
                      type="time"
                      value={gameForm.time}
                      onChange={(e) => setGameForm({ ...gameForm, time: e.target.value })}
                      required
                      className="bg-zinc-800 border-zinc-700 text-white h-10"
                      data-testid="create-game-time"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">Tickets (Full Sheets × 6)</label>
                    <Input
                      type="number"
                      value={gameForm.total_tickets}
                      onChange={(e) => setGameForm({ ...gameForm, total_tickets: Math.ceil(parseInt(e.target.value) / 6) * 6 })}
                      min="6"
                      step="6"
                      required
                      className="bg-zinc-800 border-zinc-700 text-white h-10"
                      data-testid="create-game-tickets"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-500 block mb-1">Price per Ticket (₹)</label>
                    <Input
                      type="number"
                      value={gameForm.price}
                      onChange={(e) => setGameForm({ ...gameForm, price: parseInt(e.target.value) })}
                      required
                      className="bg-zinc-800 border-zinc-700 text-white h-10"
                      data-testid="create-game-price"
                    />
                  </div>
                </div>

                {/* Dividends Grid */}
                <div>
                  <label className="text-xs text-zinc-500 block mb-2">Prize Configuration</label>
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                    {Object.entries(gameForm.dividends).map(([name, data]) => (
                      <div 
                        key={name} 
                        className={`p-2 rounded-lg border cursor-pointer transition-all ${
                          data.enabled 
                            ? 'bg-amber-500/10 border-amber-500/50' 
                            : 'bg-zinc-800 border-zinc-700'
                        }`}
                        onClick={() => toggleDividend(name)}
                        data-testid={`dividend-${name.replace(/\s+/g, '-').toLowerCase()}`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className={`w-3 h-3 rounded-full border-2 ${data.enabled ? 'bg-amber-500 border-amber-500' : 'border-zinc-500'}`} />
                          <span className="text-[10px] text-zinc-300 truncate">{name}</span>
                        </div>
                        {data.enabled && (
                          <Input
                            type="number"
                            value={data.amount}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => updateDividendAmount(name, e.target.value)}
                            className="bg-zinc-900 border-zinc-600 text-white h-7 text-xs"
                            placeholder="₹"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <Button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold h-10" data-testid="create-game-submit">
                  <Plus className="w-4 h-4 mr-1" /> Create Game
                </Button>
              </form>
            </div>

            {/* Manage Games Section */}
            <div className="bg-zinc-900 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-amber-500" />
                Manage Games
              </h2>
              
              {games.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                  <p className="text-zinc-500 text-sm">No games created yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Section Headers */}
                  <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-xs text-zinc-500 border-b border-zinc-800">
                    <div className="col-span-3">Game</div>
                    <div className="col-span-2">Date & Time</div>
                    <div className="col-span-2">Tickets</div>
                    <div className="col-span-2">Revenue</div>
                    <div className="col-span-1">Status</div>
                    <div className="col-span-2 text-right">Actions</div>
                  </div>
                  
                  {/* Games List */}
                  {games.map((game) => {
                    const stats = getGameStats(game);
                    const isScheduledTime = () => {
                      const now = new Date();
                      const gameDateTime = new Date(`${game.date}T${game.time}`);
                      const diffMins = (now - gameDateTime) / (1000 * 60);
                      return diffMins >= -30 && diffMins <= 120; // 30 min before to 2 hours after
                    };
                    
                    return (
                      <div 
                        key={game.game_id} 
                        className={`bg-zinc-800/50 rounded-lg p-4 border-l-4 ${
                          game.status === 'live' ? 'border-red-500' :
                          game.status === 'upcoming' ? 'border-amber-500' :
                          'border-zinc-600'
                        }`}
                        data-testid={`game-card-${game.game_id}`}
                      >
                        {/* Mobile View */}
                        <div className="md:hidden space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold text-white">{game.name}</h3>
                              <p className="text-xs text-zinc-500">{game.date} • {game.time}</p>
                            </div>
                            <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                              game.status === 'live' ? 'bg-red-500/20 text-red-400 animate-pulse' :
                              game.status === 'upcoming' ? 'bg-amber-500/20 text-amber-400' :
                              'bg-zinc-700 text-zinc-400'
                            }`}>
                              {game.status.toUpperCase()}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-4 text-xs">
                            <span className="text-zinc-400">
                              <Ticket className="w-3 h-3 inline mr-1" />
                              {stats.confirmedTickets}/{game.ticket_count}
                            </span>
                            <span className="text-emerald-400">
                              <IndianRupee className="w-3 h-3 inline" />
                              {stats.revenue.toLocaleString()}
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap gap-2">
                            <Button 
                              onClick={() => openGameDetailsModal(game)} 
                              variant="outline" 
                              size="sm" 
                              className="h-7 text-xs border-zinc-700"
                              data-testid={`view-details-${game.game_id}`}
                            >
                              <FileText className="w-3 h-3 mr-1" /> Details
                            </Button>
                            
                            <Button 
                              onClick={() => openGameControlModal(game)} 
                              variant="outline" 
                              size="sm" 
                              className="h-7 text-xs border-amber-500/50 text-amber-400"
                              data-testid={`game-control-mobile-${game.game_id}`}
                            >
                              <Gamepad2 className="w-3 h-3 mr-1" /> Control
                            </Button>
                            
                            {game.status === 'upcoming' && (
                              <>
                                <Button 
                                  onClick={() => handleStartGame(game.game_id)} 
                                  size="sm" 
                                  className={`h-7 text-xs ${isScheduledTime() ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-zinc-600 hover:bg-zinc-500'}`}
                                  data-testid={`start-game-${game.game_id}`}
                                >
                                  <Play className="w-3 h-3 mr-1" /> Start
                                </Button>
                                <Button 
                                  onClick={() => handleNotifyNewGame(game)} 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-7 text-xs border-green-500/50 text-green-400 hover:bg-green-500/10"
                                  data-testid={`notify-game-${game.game_id}`}
                                >
                                  <MessageSquare className="w-3 h-3 mr-1" /> Notify
                                </Button>
                                <Button 
                                  onClick={() => openEditModal(game)} 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-7 text-xs border-zinc-700"
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                              </>
                            )}
                            
                            {game.status === 'live' && (
                              <>
                                <Button 
                                  onClick={() => navigate(`/live/${game.game_id}`)} 
                                  size="sm" 
                                  className="h-7 text-xs bg-red-600 hover:bg-red-700"
                                >
                                  <Play className="w-3 h-3 mr-1" /> View Live
                                </Button>
                                <Button 
                                  onClick={() => handleEndGame(game.game_id)} 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-7 text-xs border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
                                  data-testid={`end-game-${game.game_id}`}
                                >
                                  <Check className="w-3 h-3 mr-1" /> End
                                </Button>
                              </>
                            )}
                            
                            {game.status !== 'completed' && (
                              <Button 
                                onClick={() => { setSelectedGame(game); setShowDeleteModal(true); }} 
                                variant="outline" 
                                size="sm" 
                                className="h-7 text-xs border-red-500/50 text-red-400 hover:bg-red-500/10"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        {/* Desktop View */}
                        <div className="hidden md:grid grid-cols-12 gap-4 items-center">
                          <div className="col-span-3">
                            <h3 className="font-semibold text-white truncate">{game.name}</h3>
                            <p className="text-xs text-zinc-500">₹{game.price}/ticket</p>
                          </div>
                          
                          <div className="col-span-2">
                            <p className="text-sm text-white">{game.date}</p>
                            <p className="text-xs text-zinc-500">{game.time}</p>
                          </div>
                          
                          <div className="col-span-2">
                            <div className="flex items-center gap-2">
                              <Ticket className="w-4 h-4 text-zinc-500" />
                              <div>
                                <p className="text-sm text-white">{stats.confirmedTickets} / {game.ticket_count}</p>
                                <div className="w-20 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-amber-500 rounded-full transition-all"
                                    style={{ width: `${stats.soldPercentage}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="col-span-2">
                            <p className="text-sm text-emerald-400 font-medium">
                              <IndianRupee className="w-3 h-3 inline" />
                              {stats.revenue.toLocaleString()}
                            </p>
                          </div>
                          
                          <div className="col-span-1">
                            <span className={`px-2 py-1 text-[10px] font-semibold rounded-full ${
                              game.status === 'live' ? 'bg-red-500/20 text-red-400 animate-pulse' :
                              game.status === 'upcoming' ? 'bg-amber-500/20 text-amber-400' :
                              'bg-zinc-700 text-zinc-400'
                            }`}>
                              {game.status === 'live' ? '● LIVE' : game.status.toUpperCase()}
                            </span>
                          </div>
                          
                          <div className="col-span-2 flex justify-end gap-1">
                            <Button 
                              onClick={() => openGameDetailsModal(game)} 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 w-7 p-0 text-zinc-400 hover:text-white"
                              title="View Details"
                            >
                              <FileText className="w-4 h-4" />
                            </Button>
                            
                            <Button 
                              onClick={() => openGameControlModal(game)} 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 w-7 p-0 text-amber-400 hover:text-amber-300"
                              title="Game Control"
                              data-testid={`game-control-${game.game_id}`}
                            >
                              <Gamepad2 className="w-4 h-4" />
                            </Button>
                            
                            {game.status === 'upcoming' && (
                              <>
                                <Button 
                                  onClick={() => handleStartGame(game.game_id)} 
                                  size="sm" 
                                  className={`h-7 text-xs ${isScheduledTime() ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-zinc-600 hover:bg-zinc-500'}`}
                                  title={isScheduledTime() ? 'Start Game' : 'Start Game (Outside scheduled time)'}
                                >
                                  <Play className="w-3 h-3 mr-1" /> Start
                                </Button>
                                <Button 
                                  onClick={() => handleNotifyNewGame(game)} 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-7 w-7 p-0 text-green-400 hover:text-green-300"
                                  title="Notify Players"
                                  data-testid={`notify-game-desktop-${game.game_id}`}
                                >
                                  <MessageSquare className="w-4 h-4" />
                                </Button>
                                <Button 
                                  onClick={() => openEditModal(game)} 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-7 w-7 p-0 text-zinc-400 hover:text-white"
                                  title="Edit Game"
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            
                            {game.status === 'live' && (
                              <>
                                <Button 
                                  onClick={() => navigate(`/live/${game.game_id}`)} 
                                  size="sm" 
                                  className="h-7 text-xs bg-red-600 hover:bg-red-700"
                                >
                                  <Play className="w-3 h-3 mr-1" /> Live
                                </Button>
                                <Button 
                                  onClick={() => handleEndGame(game.game_id)} 
                                  variant="outline" 
                                  size="sm" 
                                  className="h-7 text-xs border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
                                  title="End Game"
                                >
                                  <Check className="w-3 h-3" /> End
                                </Button>
                              </>
                            )}
                            
                            {game.status !== 'completed' && (
                              <Button 
                                onClick={() => { setSelectedGame(game); setShowDeleteModal(true); }} 
                                variant="ghost" 
                                size="sm" 
                                className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                                title="Delete Game"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                            
                            {game.status === 'completed' && (
                              <span className="text-xs text-zinc-500 italic">Read-only</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Requests Tab */}
          <TabsContent value="requests" className="space-y-4">
            <h3 className="text-sm font-semibold text-white">Pending Approval</h3>
            {pendingRequests.length === 0 ? (
              <div className="bg-zinc-900 rounded-xl p-8 text-center">
                <Clock className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                <p className="text-zinc-500 text-sm">No pending requests</p>
              </div>
            ) : (
              pendingRequests.map((req) => (
                <div key={req.request_id} className="bg-zinc-900 rounded-xl p-4 border-l-2 border-amber-500">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-semibold text-white">{req.user_name}</h4>
                      <p className="text-xs text-zinc-500">{req.user_email}</p>
                      <p className="text-xs text-amber-400 mt-1">{req.game?.name} • {req.ticket_ids?.length} tickets • ₹{req.total_amount}</p>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-500/20 text-amber-400">
                      PENDING
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => handleApproveRequest(req.request_id)} size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700">
                      <Check className="w-3 h-3 mr-1" /> Approve
                    </Button>
                    <Button onClick={() => handleRejectRequest(req.request_id)} variant="outline" size="sm" className="h-7 text-xs border-red-500/50 text-red-400 hover:bg-red-500/10">
                      <X className="w-3 h-3 mr-1" /> Reject
                    </Button>
                    <Button 
                      onClick={() => { 
                        setSelectedBooking({ 
                          phone: req.user_phone, 
                          name: req.user_name, 
                          booking_id: req.request_id,
                          game_name: req.game?.name 
                        }); 
                        setShowWhatsAppModal(true); 
                      }} 
                      variant="outline" 
                      size="sm" 
                      className="h-7 text-xs border-green-500/50 text-green-400 hover:bg-green-500/10"
                    >
                      <MessageSquare className="w-3 h-3 mr-1" /> WhatsApp
                    </Button>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-4">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-zinc-900 rounded-xl p-4">
                <p className="text-xs text-zinc-500">Total Revenue</p>
                <p className="text-2xl font-bold text-emerald-400">
                  ₹{bookings.filter(b => b.status === 'confirmed').reduce((s, b) => s + (b.total_amount || 0), 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-zinc-900 rounded-xl p-4">
                <p className="text-xs text-zinc-500">Pending Payments</p>
                <p className="text-2xl font-bold text-amber-400">
                  {bookings.filter(b => b.status === 'pending').length}
                </p>
              </div>
              <div className="bg-zinc-900 rounded-xl p-4">
                <p className="text-xs text-zinc-500">Confirmed</p>
                <p className="text-2xl font-bold text-white">
                  {bookings.filter(b => b.status === 'confirmed').length}
                </p>
              </div>
            </div>

            <h3 className="text-sm font-semibold text-white">Recent Bookings</h3>
            <div className="space-y-2">
              {bookings.slice(0, 20).map((booking) => (
                <div key={booking.booking_id} className="bg-zinc-900 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <span className="text-white text-sm">{booking.user?.name || 'Unknown'}</span>
                    <span className="text-zinc-500 text-xs ml-2">{booking.game?.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-amber-400 text-sm font-medium">₹{booking.total_amount}</span>
                    {booking.status === 'pending' ? (
                      <Button onClick={() => handleConfirmPayment(booking.booking_id)} size="sm" className="h-6 text-[10px] bg-emerald-600">
                        <Check className="w-3 h-3 mr-0.5" /> Confirm
                      </Button>
                    ) : (
                      <span className="px-2 py-0.5 text-[10px] rounded bg-emerald-500/20 text-emerald-400">PAID</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* Agents Tab */}
          <TabsContent value="agents" className="space-y-6">
            {/* Header with Add Agent button */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">Regional Agents</h2>
              <Button 
                onClick={() => { setEditingAgent(null); setAgentForm({ name: '', username: '', password: '', whatsapp_number: '', region: 'india', country_codes: ['+91'] }); setShowAgentModal(true); }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-1" /> Add Agent
              </Button>
            </div>

            {/* Info Banner */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-blue-400">Multi-Region Agent System</h4>
                  <p className="text-xs text-blue-400/80 mt-1">
                    Agents are assigned to players based on their phone number country code. Players are redirected to the agent&apos;s WhatsApp for manual payment verification.
                  </p>
                </div>
              </div>
            </div>

            {/* Agents Table */}
            <div className="bg-zinc-900 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-800">
                    <tr className="text-xs text-zinc-500 uppercase">
                      <th className="px-4 py-3 text-left">Agent</th>
                      <th className="px-4 py-3 text-left">Region</th>
                      <th className="px-4 py-3 text-left">Country Codes</th>
                      <th className="px-4 py-3 text-left">WhatsApp</th>
                      <th className="px-4 py-3 text-left">Bookings</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {agents.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-4 py-8 text-center text-zinc-500">
                          <Users className="w-10 h-10 mx-auto mb-2 text-zinc-600" />
                          No agents configured yet
                        </td>
                      </tr>
                    ) : (
                      agents.map((agent) => (
                        <tr key={agent.agent_id} className="hover:bg-zinc-800/50">
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-white font-medium">{agent.name}</p>
                              <p className="text-xs text-zinc-500">@{agent.username}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs capitalize">
                              {agent.region}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              {agent.country_codes?.map((code) => (
                                <span key={code} className="px-2 py-0.5 bg-zinc-800 text-zinc-300 rounded text-xs">
                                  {code}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-zinc-300">{agent.whatsapp_number}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-amber-400">{agent.pending_bookings || 0}</span>
                              <span className="text-zinc-600">/</span>
                              <span className="text-zinc-400">{agent.total_bookings || 0}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${
                              agent.is_active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                              {agent.is_active ? 'ACTIVE' : 'INACTIVE'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                onClick={() => openEditAgentModal(agent)}
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-zinc-400 hover:text-white"
                              >
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button
                                onClick={() => handleToggleAgentStatus(agent.agent_id, agent.is_active)}
                                variant="ghost"
                                size="sm"
                                className={`h-7 text-xs ${agent.is_active ? 'text-red-400 hover:text-red-300' : 'text-emerald-400 hover:text-emerald-300'}`}
                              >
                                {agent.is_active ? <Ban className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Region Assignment Info */}
            <div className="bg-zinc-900 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-white mb-4">Region Assignment Rules</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-zinc-800 rounded-lg p-4">
                  <p className="text-xs text-zinc-500 mb-1">India (+91)</p>
                  <p className="text-lg font-bold text-white">
                    {agents.filter(a => a.region === 'india' && a.is_active).length} agents
                  </p>
                </div>
                <div className="bg-zinc-800 rounded-lg p-4">
                  <p className="text-xs text-zinc-500 mb-1">France (+33)</p>
                  <p className="text-lg font-bold text-white">
                    {agents.filter(a => a.region === 'france' && a.is_active).length} agents
                  </p>
                </div>
                <div className="bg-zinc-800 rounded-lg p-4">
                  <p className="text-xs text-zinc-500 mb-1">Canada (+1)</p>
                  <p className="text-lg font-bold text-white">
                    {agents.filter(a => a.region === 'canada' && a.is_active).length} agents
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* WhatsApp Tab */}
          <TabsContent value="whatsapp" className="space-y-4">
            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <MessageSquare className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-green-400">WhatsApp Messages</h4>
                  <p className="text-xs text-green-400/80 mt-1">
                    Messages open via WhatsApp deep links. You must manually tap Send in WhatsApp.
                    Works on both desktop (WhatsApp Web) and mobile (WhatsApp App).
                  </p>
                </div>
              </div>
            </div>

            <h3 className="text-sm font-semibold text-white">Message Templates</h3>
            <div className="grid grid-cols-2 gap-3">
              {WHATSAPP_TEMPLATES.map((template) => (
                <div key={template.id} className="bg-zinc-900 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-4 h-4 text-green-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">{template.name}</h4>
                      <p className="text-xs text-zinc-500 mt-0.5">{template.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <h3 className="text-sm font-semibold text-white mt-6">Send to Players</h3>
            <div className="bg-zinc-900 rounded-xl p-4">
              <p className="text-xs text-zinc-500 mb-3">Select a confirmed booking to send WhatsApp notification</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {bookings.filter(b => b.status === 'confirmed' && b.user?.phone).slice(0, 10).map((booking) => (
                  <div key={booking.booking_id} className="flex items-center justify-between p-2 bg-zinc-800 rounded-lg">
                    <div>
                      <span className="text-white text-sm">{booking.user?.name}</span>
                      <span className="text-zinc-500 text-xs ml-2">{booking.user?.phone}</span>
                    </div>
                    <Button 
                      onClick={() => { 
                        setSelectedBooking({ 
                          phone: booking.user?.phone, 
                          name: booking.user?.name,
                          booking_id: booking.booking_id,
                          game_name: booking.game?.name
                        }); 
                        setShowWhatsAppModal(true); 
                      }}
                      size="sm" 
                      className="h-6 text-[10px] bg-green-600 hover:bg-green-700"
                    >
                      <Send className="w-3 h-3 mr-1" /> Send
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Action Logs</h3>
              <span className="text-xs text-zinc-500">{actionLogs.length} actions logged</span>
            </div>
            <div className="bg-zinc-900 rounded-xl p-4 max-h-[500px] overflow-y-auto">
              {actionLogs.length === 0 ? (
                <div className="text-center py-8">
                  <History className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                  <p className="text-zinc-500 text-sm">No actions logged yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {actionLogs.slice(0, 50).map((log, index) => (
                    <div key={index} className="flex items-start gap-3 p-2 bg-zinc-800 rounded-lg">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                        log.action?.includes('DELETE') || log.action?.includes('REJECT') ? 'bg-red-500/20' :
                        log.action?.includes('APPROVE') || log.action?.includes('CONFIRM') ? 'bg-emerald-500/20' :
                        'bg-zinc-700'
                      }`}>
                        <FileText className={`w-3 h-3 ${
                          log.action?.includes('DELETE') || log.action?.includes('REJECT') ? 'text-red-400' :
                          log.action?.includes('APPROVE') || log.action?.includes('CONFIRM') ? 'text-emerald-400' :
                          'text-zinc-400'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-white font-medium">{log.action}</p>
                        <p className="text-[10px] text-zinc-500 truncate">{JSON.stringify(log.details)}</p>
                        <p className="text-[10px] text-zinc-600">{new Date(log.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <div className="bg-zinc-900 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Volume2 className="w-5 h-5 text-amber-500" />
                <h3 className="text-sm font-semibold text-white">Caller Voice</h3>
              </div>

              {callerSettings && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-zinc-800 rounded-lg">
                    <span className="text-sm text-white">Voice Announcements</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={callerSettings.enabled}
                        onChange={(e) => handleUpdateCallerSettings({ enabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-zinc-700 rounded-full peer peer-checked:bg-amber-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                    </label>
                  </div>

                  <div>
                    <label className="text-xs text-zinc-500 block mb-2">Voice</label>
                    <div className="flex gap-2">
                      {['female', 'male'].map((gender) => (
                        <button
                          key={gender}
                          onClick={() => handleUpdateCallerSettings({ gender })}
                          className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                            callerSettings.gender === gender ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-white'
                          }`}
                        >
                          {gender === 'female' ? '👩 Female' : '👨 Male'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-zinc-500 block mb-2">Style</label>
                    <div className="grid grid-cols-4 gap-2">
                      {VOICE_OPTIONS[callerSettings.gender || 'female'].map((voice) => (
                        <button
                          key={voice.value}
                          onClick={() => handleUpdateCallerSettings({ voice: voice.value })}
                          className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                            callerSettings.voice === voice.value ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-white'
                          }`}
                        >
                          {voice.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-zinc-500 block mb-2">Speed</label>
                    <div className="flex gap-2">
                      {[{ v: 0.8, l: 'Slow' }, { v: 1.0, l: 'Normal' }, { v: 1.3, l: 'Fast' }].map((s) => (
                        <button
                          key={s.v}
                          onClick={() => handleUpdateCallerSettings({ speed: s.v })}
                          className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                            callerSettings.speed === s.v ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-white'
                          }`}
                        >
                          {s.l}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-zinc-500 block mb-2">Prefix Lines</label>
                    <div className="space-y-1 max-h-32 overflow-y-auto mb-2">
                      {callerSettings.prefix_lines?.map((line, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 bg-zinc-800 rounded-lg">
                          <span className="text-xs text-white flex-1">{line}</span>
                          <Button onClick={() => handleDeletePrefixLine(i)} variant="ghost" size="icon" className="h-5 w-5 text-red-400">
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={newPrefixLine}
                        onChange={(e) => setNewPrefixLine(e.target.value)}
                        placeholder="Add prefix line..."
                        className="bg-zinc-800 border-zinc-700 text-white h-8 text-xs"
                        onKeyPress={(e) => e.key === 'Enter' && handleAddPrefixLine()}
                      />
                      <Button onClick={handleAddPrefixLine} size="sm" className="h-8 bg-amber-500 hover:bg-amber-600">
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Edit Game Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">Edit Game</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditGame} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Input value={gameForm.name} onChange={(e) => setGameForm({ ...gameForm, name: e.target.value })} required className="bg-zinc-800 border-zinc-700 text-white" />
              </div>
              <Input type="date" value={gameForm.date} onChange={(e) => setGameForm({ ...gameForm, date: e.target.value })} required className="bg-zinc-800 border-zinc-700 text-white" />
              <Input type="time" value={gameForm.time} onChange={(e) => setGameForm({ ...gameForm, time: e.target.value })} required className="bg-zinc-800 border-zinc-700 text-white" />
              <Input type="number" value={gameForm.price} onChange={(e) => setGameForm({ ...gameForm, price: parseInt(e.target.value) })} required className="bg-zinc-800 border-zinc-700 text-white" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(gameForm.dividends).map(([name, data]) => (
                <div key={name} className={`p-2 rounded-lg border cursor-pointer ${data.enabled ? 'bg-amber-500/10 border-amber-500/50' : 'bg-zinc-800 border-zinc-700'}`} onClick={() => toggleDividend(name)}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className={`w-2.5 h-2.5 rounded-full ${data.enabled ? 'bg-amber-500' : 'bg-zinc-600'}`} />
                    <span className="text-[10px] text-zinc-300">{name}</span>
                  </div>
                  {data.enabled && (
                    <Input type="number" value={data.amount} onClick={(e) => e.stopPropagation()} onChange={(e) => updateDividendAmount(name, e.target.value)} className="bg-zinc-900 border-zinc-600 text-white h-6 text-xs" />
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setShowEditModal(false)} className="flex-1 border-zinc-700">Cancel</Button>
              <Button type="submit" className="flex-1 bg-amber-500 hover:bg-amber-600">Update</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Game?</DialogTitle>
          </DialogHeader>
          <p className="text-zinc-400 text-sm">Delete <span className="text-white font-medium">{selectedGame?.name}</span>? This cannot be undone.</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)} className="flex-1 border-zinc-700">Cancel</Button>
            <Button onClick={() => handleDeleteGame(selectedGame?.status === 'live')} className="flex-1 bg-red-600 hover:bg-red-700">Delete</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Game Confirmation Modal */}
      <Dialog open={showCreateConfirmModal} onOpenChange={setShowCreateConfirmModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Confirm Game Creation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-zinc-400 text-sm">Please review the game details before creating:</p>
            
            {pendingGameData && (
              <div className="bg-zinc-800 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Name:</span>
                  <span className="text-white font-medium">{pendingGameData.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Date:</span>
                  <span className="text-white">{pendingGameData.date}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Time:</span>
                  <span className="text-white">{pendingGameData.time}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Tickets:</span>
                  <span className="text-white">{pendingGameData.total_tickets}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Price:</span>
                  <span className="text-amber-500 font-bold">₹{pendingGameData.price}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Prize Pool:</span>
                  <span className="text-green-500 font-bold">
                    ₹{Object.values(pendingGameData.prizes || {}).reduce((a, b) => a + b, 0).toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <p className="text-amber-400 text-xs">
                ⚠️ A game with the same name, date, and time cannot be created twice.
              </p>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowCreateConfirmModal(false);
                  setPendingGameData(null);
                }} 
                className="flex-1 border-zinc-700"
              >
                Cancel
              </Button>
              <Button 
                onClick={confirmCreateGame} 
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-bold"
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Confirm & Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tickets Modal */}
      <Dialog open={showTicketsModal} onOpenChange={setShowTicketsModal}>
        <DialogContent className="max-w-3xl bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white">Tickets - {selectedGame?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 mb-4">
            {['all', 'booked', 'available'].map((f) => (
              <Button key={f} onClick={() => setTicketFilter(f)} variant={ticketFilter === f ? 'default' : 'outline'} size="sm" className={ticketFilter === f ? 'bg-amber-500' : 'border-zinc-700'}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Button>
            ))}
            <span className="ml-auto text-xs text-zinc-500">{filteredTickets.length} tickets</span>
          </div>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {filteredTickets.slice(0, 50).map((t) => (
              <div key={t.ticket_id} className={`p-2 rounded-lg flex items-center justify-between ${t.is_booked ? 'bg-amber-500/10' : 'bg-zinc-800'}`}>
                <div>
                  <span className="text-white text-sm">{t.ticket_number}</span>
                  {t.is_booked && <span className="text-amber-400 text-xs ml-2">→ {t.holder_name || 'Unknown'}</span>}
                </div>
                {t.is_booked && (
                  <div className="flex gap-1">
                    <Button onClick={() => { const n = prompt('New name:', t.holder_name); if (n) handleUpdateTicketHolder(t.ticket_id, n); }} variant="ghost" size="sm" className="h-6 text-[10px]">
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button onClick={() => handleCancelTicket(t.ticket_id)} variant="ghost" size="sm" className="h-6 text-[10px] text-red-400">
                      <Ban className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* WhatsApp Template Modal */}
      <Dialog open={showWhatsAppModal} onOpenChange={setShowWhatsAppModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-green-400" />
              Send WhatsApp Message
            </DialogTitle>
          </DialogHeader>
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 mb-4">
            <p className="text-xs text-green-400">
              <CheckCircle2 className="w-3 h-3 inline mr-1" />
              Opens WhatsApp with pre-filled message. You must tap Send.
            </p>
          </div>
          <p className="text-sm text-zinc-400 mb-4">
            Sending to: <span className="text-white font-medium">{selectedBooking?.name}</span> ({selectedBooking?.phone})
          </p>
          <div className="space-y-2">
            {WHATSAPP_TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => handleSendWhatsAppTemplate(template.id, selectedBooking)}
                className="w-full p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-left transition-all flex items-center justify-between"
              >
                <div>
                  <span className="text-sm text-white font-medium">{template.name}</span>
                  <p className="text-xs text-zinc-500 mt-0.5">{template.description}</p>
                </div>
                <Send className="w-4 h-4 text-green-400" />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Notify New Game Modal */}
      <Dialog open={showNotifyModal} onOpenChange={(open) => { 
        setShowNotifyModal(open); 
        if (!open) { setNotifyPhone(''); setNotifyName(''); }
      }}>
        <DialogContent className="bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-green-400" />
              Notify New Game
            </DialogTitle>
          </DialogHeader>
          
          {selectedGame && (
            <div className="space-y-4">
              {/* Game Info */}
              <div className="bg-zinc-800 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-white">{selectedGame.name}</h4>
                <p className="text-xs text-zinc-400">{selectedGame.date} at {selectedGame.time} • ₹{selectedGame.price}/ticket</p>
              </div>
              
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                <p className="text-xs text-green-400">
                  <CheckCircle2 className="w-3 h-3 inline mr-1" />
                  Opens WhatsApp with game announcement. You must tap Send.
                </p>
              </div>
              
              {/* Manual Entry */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-white">Send to a player</h4>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Player name"
                    value={notifyName}
                    onChange={(e) => setNotifyName(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                  <Input
                    placeholder="Phone (e.g. 9876543210)"
                    value={notifyPhone}
                    onChange={(e) => setNotifyPhone(e.target.value)}
                    className="bg-zinc-800 border-zinc-700 text-white"
                  />
                </div>
                <Button 
                  onClick={() => {
                    if (!notifyPhone.trim()) {
                      toast.error('Please enter a phone number');
                      return;
                    }
                    handleNotifyNewGame(selectedGame, { 
                      name: notifyName || 'Player', 
                      phone: notifyPhone 
                    });
                    setNotifyPhone('');
                    setNotifyName('');
                    setShowNotifyModal(false);
                  }}
                  className="w-full bg-green-600 hover:bg-green-700"
                  disabled={!notifyPhone.trim()}
                >
                  <Send className="w-4 h-4 mr-2" /> Open WhatsApp
                </Button>
              </div>
              
              {/* Quick Send to Previous Players */}
              {bookings.filter(b => b.status === 'confirmed' && b.user?.phone).length > 0 && (
                <div className="space-y-3 pt-3 border-t border-zinc-700">
                  <h4 className="text-sm font-semibold text-white">Or notify previous players</h4>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {(() => {
                      const uniquePlayers = new Map();
                      bookings
                        .filter(b => b.status === 'confirmed' && b.user?.phone)
                        .forEach(b => {
                          if (!uniquePlayers.has(b.user.phone)) {
                            uniquePlayers.set(b.user.phone, {
                              name: b.user.name || 'Player',
                              phone: b.user.phone
                            });
                          }
                        });
                      return Array.from(uniquePlayers.values()).slice(0, 10).map((player, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            handleNotifyNewGame(selectedGame, player);
                            setShowNotifyModal(false);
                          }}
                          className="w-full p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-left transition-all flex items-center justify-between"
                        >
                          <div>
                            <span className="text-sm text-white">{player.name}</span>
                            <p className="text-xs text-zinc-500">{player.phone}</p>
                          </div>
                          <Send className="w-4 h-4 text-green-400" />
                        </button>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Game Details Modal */}
      <Dialog open={showGameDetailsModal} onOpenChange={setShowGameDetailsModal}>
        <DialogContent className="max-w-2xl bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-500" />
              Game Details
            </DialogTitle>
          </DialogHeader>
          
          {gameDetails && (
            <div className="space-y-4">
              {/* Game Info Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">{gameDetails.name}</h3>
                  <p className="text-sm text-zinc-400">{gameDetails.date} at {gameDetails.time}</p>
                </div>
                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                  gameDetails.status === 'live' ? 'bg-red-500/20 text-red-400' :
                  gameDetails.status === 'upcoming' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-zinc-700 text-zinc-400'
                }`}>
                  {gameDetails.status.toUpperCase()}
                </span>
              </div>
              
              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-zinc-800 rounded-lg p-3">
                  <p className="text-xs text-zinc-500">Total Tickets</p>
                  <p className="text-lg font-bold text-white">{gameDetails.ticket_count}</p>
                </div>
                <div className="bg-zinc-800 rounded-lg p-3">
                  <p className="text-xs text-zinc-500">Tickets Sold</p>
                  <p className="text-lg font-bold text-amber-400">{gameDetails.stats?.confirmedTickets || 0}</p>
                </div>
                <div className="bg-zinc-800 rounded-lg p-3">
                  <p className="text-xs text-zinc-500">Price per Ticket</p>
                  <p className="text-lg font-bold text-white">₹{gameDetails.price}</p>
                </div>
                <div className="bg-zinc-800 rounded-lg p-3">
                  <p className="text-xs text-zinc-500">Revenue</p>
                  <p className="text-lg font-bold text-emerald-400">₹{gameDetails.stats?.revenue?.toLocaleString() || 0}</p>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="bg-zinc-800 rounded-lg p-3">
                <div className="flex justify-between text-xs text-zinc-500 mb-1">
                  <span>Tickets Sold</span>
                  <span>{gameDetails.stats?.soldPercentage || 0}%</span>
                </div>
                <div className="w-full h-2 bg-zinc-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber-500 rounded-full transition-all"
                    style={{ width: `${gameDetails.stats?.soldPercentage || 0}%` }}
                  />
                </div>
              </div>
              
              {/* Prizes Configuration */}
              <div className="bg-zinc-800 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-white mb-2">Prize Configuration</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {Object.entries(gameDetails.prizes || {}).map(([prize, amount]) => (
                    <div key={prize} className="flex justify-between items-center p-2 bg-zinc-900 rounded">
                      <span className="text-xs text-zinc-400">{prize}</span>
                      <span className="text-xs text-amber-400 font-medium">₹{amount}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Winners (if any) */}
              {gameDetails.winners && Object.keys(gameDetails.winners).length > 0 && (
                <div className="bg-zinc-800 rounded-lg p-3">
                  <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                    Winners
                  </h4>
                  <div className="space-y-2">
                    {Object.entries(gameDetails.winners).map(([prize, winner]) => (
                      <div key={prize} className="flex justify-between items-center p-2 bg-zinc-900 rounded">
                        <div>
                          <span className="text-xs text-amber-400 font-medium">{prize}</span>
                          <p className="text-sm text-white">{winner.holder_name || winner.user_name || 'Unknown'}</p>
                        </div>
                        <span className="text-xs text-zinc-500">{winner.ticket_id}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-zinc-800">
                <Button 
                  onClick={() => { openTicketsModal(gameDetails); setShowGameDetailsModal(false); }}
                  variant="outline"
                  className="flex-1 border-zinc-700"
                >
                  <Ticket className="w-4 h-4 mr-1" /> View Tickets
                </Button>
                
                {gameDetails.status === 'upcoming' && (
                  <Button 
                    onClick={() => { handleStartGame(gameDetails.game_id); setShowGameDetailsModal(false); }}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Play className="w-4 h-4 mr-1" /> Start Game
                  </Button>
                )}
                
                {gameDetails.status === 'live' && (
                  <>
                    <Button 
                      onClick={() => { navigate(`/live/${gameDetails.game_id}`); }}
                      className="flex-1 bg-red-600 hover:bg-red-700"
                    >
                      <Play className="w-4 h-4 mr-1" /> View Live
                    </Button>
                    <Button 
                      onClick={() => { handleEndGame(gameDetails.game_id); setShowGameDetailsModal(false); }}
                      variant="outline"
                      className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
                    >
                      <Check className="w-4 h-4 mr-1" /> End Game
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Game Control Modal */}
      <GameControlModal
        isOpen={showGameControlModal}
        onClose={() => setShowGameControlModal(false)}
        gameId={controlGameId}
        onUpdate={fetchGames}
      />

      {/* Agent Create/Edit Modal */}
      <Dialog open={showAgentModal} onOpenChange={setShowAgentModal}>
        <DialogContent className="max-w-md bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              {editingAgent ? 'Edit Agent' : 'Create Agent'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); editingAgent ? handleUpdateAgent(editingAgent.agent_id) : handleCreateAgent(e); }} className="space-y-4">
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Name</label>
              <Input
                value={agentForm.name}
                onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })}
                placeholder="Agent Name"
                required
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Username</label>
              <Input
                value={agentForm.username}
                onChange={(e) => setAgentForm({ ...agentForm, username: e.target.value })}
                placeholder="username"
                required
                disabled={!!editingAgent}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Password {editingAgent && '(leave blank to keep)'}</label>
              <Input
                type="password"
                value={agentForm.password}
                onChange={(e) => setAgentForm({ ...agentForm, password: e.target.value })}
                placeholder={editingAgent ? '••••••••' : 'Password'}
                required={!editingAgent}
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">WhatsApp Number (with country code)</label>
              <Input
                value={agentForm.whatsapp_number}
                onChange={(e) => setAgentForm({ ...agentForm, whatsapp_number: e.target.value })}
                placeholder="+918837489781"
                required
                className="bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Region</label>
              <select
                value={agentForm.region}
                onChange={(e) => {
                  const region = e.target.value;
                  const codes = region === 'india' ? ['+91'] : region === 'france' ? ['+33'] : region === 'canada' ? ['+1'] : [];
                  setAgentForm({ ...agentForm, region, country_codes: codes });
                }}
                className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-md px-3 py-2 text-sm"
              >
                <option value="india">India (+91)</option>
                <option value="france">France (+33)</option>
                <option value="canada">Canada (+1)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Assigned Country Codes</label>
              <div className="flex gap-2">
                {agentForm.country_codes?.map((code) => (
                  <span key={code} className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-sm">{code}</span>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowAgentModal(false)} className="flex-1 border-zinc-700">
                Cancel
              </Button>
              <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">
                {editingAgent ? 'Update' : 'Create'} Agent
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
