import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  LogOut, Users, Ticket, Clock, CheckCircle2, XCircle, RefreshCw,
  IndianRupee, Calendar, Phone, User, AlertCircle, TrendingUp,
  LayoutDashboard, FileText, Settings
} from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Agent axios instance
const agentAxios = axios.create();
agentAxios.interceptors.request.use((config) => {
  const token = localStorage.getItem('agent_token');
  if (token) {
    config.headers['Authorization'] = `Agent ${token}`;
  }
  config.withCredentials = true;
  return config;
});

export default function AgentPanel() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [agent, setAgent] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState(null);

  // Login state
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginLoading, setLoginLoading] = useState(false);

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('agent_token');
      if (!token) {
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      const response = await agentAxios.get(`${API}/agent/verify`);
      if (response.data.valid) {
        setIsAuthenticated(true);
        setAgent(response.data.agent);
        fetchDashboard();
        fetchBookings();
      } else {
        localStorage.removeItem('agent_token');
        setIsAuthenticated(false);
      }
    } catch (error) {
      localStorage.removeItem('agent_token');
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    try {
      const response = await axios.post(`${API}/agent/login`, loginForm, { withCredentials: true });
      localStorage.setItem('agent_token', response.data.token);
      setAgent(response.data.agent);
      setIsAuthenticated(true);
      toast.success(`Welcome, ${response.data.agent.name}!`);
      fetchDashboard();
      fetchBookings();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await agentAxios.post(`${API}/agent/logout`);
    } catch (e) {
      // Ignore logout errors
      console.log('Logout error:', e);
    }
    localStorage.removeItem('agent_token');
    setIsAuthenticated(false);
    setAgent(null);
    toast.success('Logged out');
  };

  const fetchDashboard = async () => {
    try {
      const response = await agentAxios.get(`${API}/agent/dashboard`);
      setDashboard(response.data);
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    }
  };

  const fetchBookings = useCallback(async () => {
    try {
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const response = await agentAxios.get(`${API}/agent/bookings${params}`);
      setBookings(response.data.bookings);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    }
  }, [statusFilter]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchBookings();
    }
  }, [isAuthenticated, statusFilter, fetchBookings]);

  const handleMarkPaid = async (bookingId) => {
    if (!window.confirm('Confirm payment received for this booking?')) return;
    
    try {
      setActionLoading(`paid_${bookingId}`);
      await agentAxios.put(`${API}/agent/bookings/${bookingId}/mark-paid`);
      toast.success('Booking marked as paid!');
      fetchBookings();
      fetchDashboard();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to mark as paid');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking? Tickets will be released.')) return;
    
    try {
      setActionLoading(`cancel_${bookingId}`);
      await agentAxios.put(`${API}/agent/bookings/${bookingId}/cancel`);
      toast.success('Booking cancelled, tickets released');
      fetchBookings();
      fetchDashboard();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel booking');
    } finally {
      setActionLoading(null);
    }
  };

  // Show loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c]">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Show login form
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c] px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Agent Portal</h1>
            <p className="text-zinc-500 text-sm mt-1">Six Seven Tambola</p>
          </div>

          <form onSubmit={handleLogin} className="bg-zinc-900 rounded-xl p-6 space-y-4">
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Username</label>
              <Input
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                placeholder="Enter username"
                required
                className="bg-zinc-800 border-zinc-700 text-white"
                data-testid="agent-username"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 block mb-1">Password</label>
              <Input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                placeholder="Enter password"
                required
                className="bg-zinc-800 border-zinc-700 text-white"
                data-testid="agent-password"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={loginLoading}
              data-testid="agent-login-btn"
            >
              {loginLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Login'}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // Authenticated view
  return (
    <div className="min-h-screen bg-[#0a0a0c]">
      {/* Header */}
      <header className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Agent Panel</h1>
              <p className="text-xs text-zinc-500">{agent?.name} • {agent?.region?.toUpperCase()}</p>
            </div>
          </div>
          <Button onClick={handleLogout} variant="ghost" size="sm" className="text-zinc-400 hover:text-white">
            <LogOut className="w-4 h-4 mr-1" /> Logout
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="bg-zinc-900 border border-zinc-800 p-1">
            <TabsTrigger value="dashboard" className="text-xs">
              <LayoutDashboard className="w-3 h-3 mr-1" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="bookings" className="text-xs">
              <FileText className="w-3 h-3 mr-1" /> My Bookings
            </TabsTrigger>
            <TabsTrigger value="profile" className="text-xs">
              <Settings className="w-3 h-3 mr-1" /> Profile
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <span className="text-xs text-zinc-500">Pending</span>
                </div>
                <p className="text-2xl font-bold text-amber-400">{dashboard?.stats?.pending_bookings || 0}</p>
              </div>
              <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-zinc-500">Paid</span>
                </div>
                <p className="text-2xl font-bold text-emerald-400">{dashboard?.stats?.paid_bookings || 0}</p>
              </div>
              <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                <div className="flex items-center gap-2 mb-2">
                  <Ticket className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-zinc-500">Total</span>
                </div>
                <p className="text-2xl font-bold text-white">{dashboard?.stats?.total_bookings || 0}</p>
              </div>
              <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                <div className="flex items-center gap-2 mb-2">
                  <IndianRupee className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-zinc-500">Revenue</span>
                </div>
                <p className="text-2xl font-bold text-emerald-400">₹{dashboard?.stats?.total_revenue?.toLocaleString() || 0}</p>
              </div>
            </div>

            {/* Agent Info */}
            <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
              <h3 className="text-lg font-semibold text-white mb-4">Your Details</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-zinc-500">Name</p>
                  <p className="text-white font-medium">{agent?.name}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Region</p>
                  <p className="text-white font-medium capitalize">{agent?.region}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">WhatsApp</p>
                  <p className="text-white font-medium">{agent?.whatsapp_number}</p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Bookings Tab */}
          <TabsContent value="bookings" className="space-y-4">
            {/* Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-zinc-500">Filter:</span>
              {['all', 'pending', 'paid', 'cancelled'].map((status) => (
                <Button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  variant={statusFilter === status ? 'default' : 'outline'}
                  size="sm"
                  className={`h-7 text-xs ${statusFilter === status ? 'bg-blue-600' : 'border-zinc-700'}`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </Button>
              ))}
              <Button onClick={fetchBookings} variant="ghost" size="sm" className="h-7 text-xs ml-auto">
                <RefreshCw className="w-3 h-3 mr-1" /> Refresh
              </Button>
            </div>

            {/* Bookings List */}
            <div className="space-y-3">
              {bookings.length === 0 ? (
                <div className="text-center py-12 bg-zinc-900 rounded-xl">
                  <FileText className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                  <p className="text-zinc-500">No bookings found</p>
                </div>
              ) : (
                bookings.map((booking) => {
                  const gameStatus = booking.game?.status;
                  const canCancel = booking.status === 'pending' && gameStatus === 'upcoming';
                  const canMarkPaid = booking.status === 'pending' && gameStatus !== 'completed';
                  
                  return (
                    <div 
                      key={booking.booking_id} 
                      className={`bg-zinc-900 rounded-xl p-4 border-l-4 ${
                        booking.status === 'paid' ? 'border-emerald-500' :
                        booking.status === 'pending' ? 'border-amber-500' :
                        'border-zinc-600'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-white">{booking.game?.name || 'Unknown Game'}</h3>
                          <p className="text-xs text-zinc-500">
                            {booking.game?.date} • {booking.game?.time}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${
                            booking.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' :
                            booking.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-zinc-700 text-zinc-400'
                          }`}>
                            {booking.status.toUpperCase()}
                          </span>
                          <span className={`px-2 py-0.5 text-[10px] rounded-full ${
                            gameStatus === 'live' ? 'bg-red-500/20 text-red-400' :
                            gameStatus === 'upcoming' ? 'bg-blue-500/20 text-blue-400' :
                            'bg-zinc-700 text-zinc-400'
                          }`}>
                            {gameStatus?.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-sm">
                        <div>
                          <p className="text-xs text-zinc-500">Player</p>
                          <p className="text-white">{booking.user?.name || 'Unknown'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500">Phone</p>
                          <p className="text-white">{booking.player_phone || booking.user?.phone || 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500">Tickets</p>
                          <p className="text-amber-400">{booking.ticket_numbers?.join(', ') || booking.ticket_ids?.length || 0}</p>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-500">Amount</p>
                          <p className="text-emerald-400 font-medium">₹{booking.total_amount}</p>
                        </div>
                      </div>

                      {/* Expiry warning for pending */}
                      {booking.status === 'pending' && booking.expires_at && (
                        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2 mb-3">
                          <p className="text-xs text-amber-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Expires: {new Date(booking.expires_at).toLocaleString()}
                          </p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        {canMarkPaid && (
                          <Button
                            onClick={() => handleMarkPaid(booking.booking_id)}
                            disabled={actionLoading === `paid_${booking.booking_id}`}
                            size="sm"
                            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700"
                            data-testid={`mark-paid-${booking.booking_id}`}
                          >
                            {actionLoading === `paid_${booking.booking_id}` ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <><CheckCircle2 className="w-3 h-3 mr-1" /> Mark Paid</>
                            )}
                          </Button>
                        )}
                        {canCancel && (
                          <Button
                            onClick={() => handleCancel(booking.booking_id)}
                            disabled={actionLoading === `cancel_${booking.booking_id}`}
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs border-red-500/50 text-red-400 hover:bg-red-500/10"
                            data-testid={`cancel-${booking.booking_id}`}
                          >
                            {actionLoading === `cancel_${booking.booking_id}` ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <><XCircle className="w-3 h-3 mr-1" /> Cancel</>
                            )}
                          </Button>
                        )}
                        {booking.status === 'paid' && (
                          <span className="text-xs text-zinc-500 flex items-center">
                            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-400" /> Payment confirmed
                          </span>
                        )}
                        {(gameStatus === 'live' || gameStatus === 'completed') && booking.status === 'pending' && (
                          <span className="text-xs text-zinc-500 flex items-center">
                            <AlertCircle className="w-3 h-3 mr-1 text-amber-400" /> Cannot modify - game {gameStatus}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>

          {/* Profile Tab */}
          <TabsContent value="profile" className="space-y-4">
            <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
              <h3 className="text-lg font-semibold text-white mb-6">Agent Profile</h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-800 rounded-lg p-4">
                    <p className="text-xs text-zinc-500 mb-1">Agent ID</p>
                    <p className="text-white font-mono text-sm">{agent?.agent_id}</p>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-4">
                    <p className="text-xs text-zinc-500 mb-1">Username</p>
                    <p className="text-white">{agent?.username}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-800 rounded-lg p-4">
                    <p className="text-xs text-zinc-500 mb-1">Name</p>
                    <p className="text-white">{agent?.name}</p>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-4">
                    <p className="text-xs text-zinc-500 mb-1">Region</p>
                    <p className="text-white capitalize">{agent?.region}</p>
                  </div>
                </div>
                
                <div className="bg-zinc-800 rounded-lg p-4">
                  <p className="text-xs text-zinc-500 mb-1">WhatsApp Number</p>
                  <p className="text-white text-lg">{agent?.whatsapp_number}</p>
                  <p className="text-xs text-zinc-500 mt-1">Players from your region will contact you on this number</p>
                </div>
                
                <div className="bg-zinc-800 rounded-lg p-4">
                  <p className="text-xs text-zinc-500 mb-1">Assigned Country Codes</p>
                  <div className="flex gap-2 mt-1">
                    {agent?.country_codes?.map((code) => (
                      <span key={code} className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-sm">{code}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
