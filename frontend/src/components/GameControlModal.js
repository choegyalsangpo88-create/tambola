import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, Users, MessageSquare, History, Ticket, IndianRupee,
  Send, Clock, CheckCircle2, AlertCircle, RefreshCw, Lock, 
  Play, Calendar, User, Phone, Eye, XCircle, Check, Trophy, Award
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Admin axios instance
const adminAxios = axios.create();
adminAxios.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers['Authorization'] = `Admin ${token}`;
  }
  config.withCredentials = true;
  return config;
});

export default function GameControlModal({ isOpen, onClose, gameId, onUpdate }) {
  const [loading, setLoading] = useState(true);
  const [controlData, setControlData] = useState(null);
  const [sendingAction, setSendingAction] = useState(null);
  const [winnersData, setWinnersData] = useState(null);
  const [viewingTicket, setViewingTicket] = useState(null);

  const fetchControlData = useCallback(async () => {
    if (!gameId) return;
    
    try {
      setLoading(true);
      const response = await adminAxios.get(`${API}/admin/games/${gameId}/control`);
      setControlData(response.data);
    } catch (error) {
      console.error('Failed to fetch game control data:', error);
      toast.error('Failed to load game data');
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  const fetchWinnersData = useCallback(async () => {
    if (!gameId) return;
    try {
      const response = await adminAxios.get(`${API}/admin/games/${gameId}/winners`);
      setWinnersData(response.data);
    } catch (error) {
      console.error('Failed to fetch winners data:', error);
    }
  }, [gameId]);

  useEffect(() => {
    if (isOpen && gameId) {
      fetchControlData();
      fetchWinnersData();
    }
  }, [isOpen, gameId, fetchControlData, fetchWinnersData]);

  const handleSendWinnerAnnouncement = async (prizeType, winnerId, ticketId) => {
    try {
      setSendingAction(`winner_${prizeType}`);
      await adminAxios.post(`${API}/admin/games/${gameId}/whatsapp/winner-announcement`, {
        game_id: gameId,
        prize_type: prizeType,
        winner_user_id: winnerId,
        ticket_id: ticketId
      });
      toast.success(`Winner announcement sent for ${prizeType}!`);
      fetchWinnersData();
      fetchControlData();
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send winner announcement');
    } finally {
      setSendingAction(null);
    }
  };

  const handleConfirmPayment = async (bookingId) => {
    try {
      setSendingAction(`payment_${bookingId}`);
      const response = await adminAxios.put(`${API}/admin/bookings/${bookingId}/confirm-payment`);
      if (response.data.whatsapp_sent) {
        toast.success('Payment confirmed & WhatsApp sent!');
      } else {
        toast.success('Payment confirmed!');
      }
      fetchControlData();
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to confirm payment');
    } finally {
      setSendingAction(null);
    }
  };

  const handleSendBookingConfirmation = async (bookingId) => {
    try {
      setSendingAction(`confirm_${bookingId}`);
      await adminAxios.post(`${API}/admin/games/${gameId}/whatsapp/booking-confirmation`, {
        booking_id: bookingId
      });
      toast.success('Booking confirmation sent!');
      fetchControlData();
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send confirmation');
    } finally {
      setSendingAction(null);
    }
  };

  const handleSendGameReminder = async () => {
    try {
      setSendingAction('reminder');
      await adminAxios.post(`${API}/admin/games/${gameId}/whatsapp/game-reminder`);
      toast.success('Game reminder sent to all players!');
      fetchControlData();
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send reminder');
    } finally {
      setSendingAction(null);
    }
  };

  const handleSendJoinLink = async (userId) => {
    try {
      setSendingAction(`join_${userId}`);
      await adminAxios.post(`${API}/admin/games/${gameId}/whatsapp/join-link`, {
        game_id: gameId,
        user_id: userId
      });
      toast.success('Join link sent!');
      fetchControlData();
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send join link');
    } finally {
      setSendingAction(null);
    }
  };

  if (!isOpen) return null;

  const game = controlData?.game;
  const ticketSummary = controlData?.ticket_summary;
  const bookings = controlData?.bookings || [];
  const whatsappStatus = controlData?.whatsapp_status;
  const whatsappLogs = controlData?.whatsapp_logs || [];
  const controlLogs = controlData?.control_logs || [];
  const hasSoldTickets = controlData?.has_sold_tickets;

  // Helper to get status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'sent': return 'text-emerald-400 bg-emerald-500/20';
      case 'delivered': return 'text-blue-400 bg-blue-500/20';
      case 'failed': return 'text-red-400 bg-red-500/20';
      default: return 'text-zinc-400 bg-zinc-500/20';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-zinc-900 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-500" />
            Game Control
            {hasSoldTickets && (
              <span className="ml-2 px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full flex items-center gap-1">
                <Lock className="w-3 h-3" /> Locked
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : controlData ? (
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4 bg-zinc-800 p-1 rounded-lg">
              <TabsTrigger value="info" className="text-xs" data-testid="tab-info">
                <FileText className="w-3 h-3 mr-1" /> Info
              </TabsTrigger>
              <TabsTrigger value="bookings" className="text-xs" data-testid="tab-bookings">
                <Users className="w-3 h-3 mr-1" /> Bookings
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="text-xs" data-testid="tab-whatsapp">
                <MessageSquare className="w-3 h-3 mr-1" /> WhatsApp
              </TabsTrigger>
              <TabsTrigger value="logs" className="text-xs" data-testid="tab-logs">
                <History className="w-3 h-3 mr-1" /> Logs
              </TabsTrigger>
            </TabsList>

            {/* A. Game Info (Read-Only) */}
            <TabsContent value="info" className="space-y-4">
              <div className="bg-zinc-800 rounded-lg p-4">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white">{game?.name}</h3>
                    <div className="flex items-center gap-3 mt-1 text-sm text-zinc-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" /> {game?.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" /> {game?.time}
                      </span>
                    </div>
                  </div>
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                    game?.status === 'live' ? 'bg-red-500/20 text-red-400' :
                    game?.status === 'upcoming' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-zinc-700 text-zinc-400'
                  }`}>
                    {game?.status?.toUpperCase()}
                  </span>
                </div>

                {hasSoldTickets && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 mb-4">
                    <div className="flex items-start gap-2">
                      <Lock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-amber-400">Game Details Locked</p>
                        <p className="text-xs text-amber-400/70">Cannot edit game details after tickets are sold.</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-zinc-900 rounded-lg p-3">
                    <p className="text-xs text-zinc-500">Total Tickets</p>
                    <p className="text-lg font-bold text-white">{ticketSummary?.total}</p>
                  </div>
                  <div className="bg-zinc-900 rounded-lg p-3">
                    <p className="text-xs text-zinc-500">Confirmed</p>
                    <p className="text-lg font-bold text-emerald-400">{ticketSummary?.confirmed}</p>
                  </div>
                  <div className="bg-zinc-900 rounded-lg p-3">
                    <p className="text-xs text-zinc-500">Price/Ticket</p>
                    <p className="text-lg font-bold text-white">₹{game?.price}</p>
                  </div>
                  <div className="bg-zinc-900 rounded-lg p-3">
                    <p className="text-xs text-zinc-500">Revenue</p>
                    <p className="text-lg font-bold text-emerald-400">₹{ticketSummary?.revenue?.toLocaleString()}</p>
                  </div>
                </div>

                {/* Prizes */}
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-white mb-2">Prize Configuration</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(game?.prizes || {}).map(([prize, amount]) => (
                      <div key={prize} className="flex justify-between items-center p-2 bg-zinc-900 rounded text-xs">
                        <span className="text-zinc-400">{prize}</span>
                        <span className="text-amber-400 font-medium">₹{amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* B. Bookings Management Section */}
            <TabsContent value="bookings" className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-zinc-800 rounded-lg p-3">
                  <p className="text-xs text-zinc-500">Total Bookings</p>
                  <p className="text-xl font-bold text-white">{bookings.length}</p>
                </div>
                <div className="bg-zinc-800 rounded-lg p-3">
                  <p className="text-xs text-zinc-500">Pending Payment</p>
                  <p className="text-xl font-bold text-amber-400">{bookings.filter(b => b.status === 'pending').length}</p>
                </div>
                <div className="bg-zinc-800 rounded-lg p-3">
                  <p className="text-xs text-zinc-500">Paid</p>
                  <p className="text-xl font-bold text-emerald-400">{bookings.filter(b => b.status === 'confirmed').length}</p>
                </div>
                <div className="bg-zinc-800 rounded-lg p-3">
                  <p className="text-xs text-zinc-500">Revenue</p>
                  <p className="text-xl font-bold text-emerald-400">₹{ticketSummary?.revenue?.toLocaleString()}</p>
                </div>
              </div>

              {/* Bookings Table */}
              <div className="bg-zinc-800 rounded-lg overflow-hidden">
                <div className="p-3 border-b border-zinc-700">
                  <h4 className="text-sm font-semibold text-white">Bookings ({bookings.length})</h4>
                </div>
                
                {bookings.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                    <p className="text-zinc-500 text-sm">No bookings yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-900">
                        <tr className="text-xs text-zinc-500 uppercase">
                          <th className="px-3 py-2 text-left">Player</th>
                          <th className="px-3 py-2 text-left">Phone</th>
                          <th className="px-3 py-2 text-left">Tickets</th>
                          <th className="px-3 py-2 text-left">Payment</th>
                          <th className="px-3 py-2 text-left">WA Opt-in</th>
                          <th className="px-3 py-2 text-left">WA Status</th>
                          <th className="px-3 py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-700">
                        {bookings.map((booking) => (
                          <tr key={booking.booking_id} className="hover:bg-zinc-800/50">
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center">
                                  <User className="w-4 h-4 text-zinc-400" />
                                </div>
                                <span className="text-white font-medium">{booking.user?.name || 'Unknown'}</span>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <span className="text-zinc-400 flex items-center gap-1">
                                <Phone className="w-3 h-3" />
                                {booking.user?.phone ? `****${booking.user.phone.slice(-4)}` : 'N/A'}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-1">
                                <Ticket className="w-3 h-3 text-zinc-500" />
                                <span className="text-white">{booking.ticket_numbers?.join(', ') || booking.ticket_ids?.length || 0}</span>
                                <Button
                                  onClick={() => setViewingTicket(booking)}
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0 ml-1 text-zinc-500 hover:text-white"
                                  title="View ticket details"
                                >
                                  <Eye className="w-3 h-3" />
                                </Button>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${
                                booking.status === 'confirmed' 
                                  ? 'bg-emerald-500/20 text-emerald-400' 
                                  : 'bg-amber-500/20 text-amber-400'
                              }`}>
                                {booking.status === 'confirmed' ? 'PAID' : 'PENDING'}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${
                                booking.whatsapp_opt_in 
                                  ? 'bg-green-500/20 text-green-400' 
                                  : 'bg-red-500/20 text-red-400'
                              }`}>
                                {booking.whatsapp_opt_in ? 'YES' : 'NO'}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              {booking.confirmation_sent ? (
                                <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${getStatusColor(booking.whatsapp_message_status || 'sent')}`}>
                                  {(booking.whatsapp_message_status || 'SENT').toUpperCase()}
                                </span>
                              ) : (
                                <span className="text-zinc-500 text-xs">—</span>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex justify-end gap-1">
                                {booking.status === 'pending' && (
                                  <Button
                                    onClick={() => handleConfirmPayment(booking.booking_id)}
                                    size="sm"
                                    className="h-6 text-[10px] bg-emerald-600 hover:bg-emerald-700"
                                    disabled={sendingAction === `payment_${booking.booking_id}`}
                                    data-testid={`approve-payment-${booking.booking_id}`}
                                  >
                                    {sendingAction === `payment_${booking.booking_id}` ? (
                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <><Check className="w-3 h-3 mr-1" /> Approve</>
                                    )}
                                  </Button>
                                )}
                                {booking.status === 'confirmed' && !booking.confirmation_sent && booking.whatsapp_opt_in && (
                                  <Button
                                    onClick={() => handleSendBookingConfirmation(booking.booking_id)}
                                    size="sm"
                                    className="h-6 text-[10px] bg-green-600 hover:bg-green-700"
                                    disabled={sendingAction === `confirm_${booking.booking_id}`}
                                  >
                                    {sendingAction === `confirm_${booking.booking_id}` ? (
                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <><MessageSquare className="w-3 h-3 mr-1" /> Send WA</>
                                    )}
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Note about auto-send */}
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-green-400">
                      <strong>Auto WhatsApp:</strong> When you approve a payment, a booking confirmation is automatically sent via WhatsApp (if user has opted in).
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* C. WhatsApp Controls */}
            <TabsContent value="whatsapp" className="space-y-4">
              {/* Info Banner */}
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-400">WhatsApp Business Policy</p>
                    <p className="text-xs text-green-400/70">Messages use pre-approved Twilio templates only. No custom text. No bulk resend.</p>
                  </div>
                </div>
              </div>

              {/* Send Game Reminder Button */}
              <div className="bg-zinc-800 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  Game Reminder
                </h4>
                <p className="text-xs text-zinc-400 mb-3">
                  Send reminder to all confirmed players (with WhatsApp opt-in). Can only be sent once, within 24 hours of game time.
                </p>
                <Button
                  onClick={handleSendGameReminder}
                  disabled={whatsappStatus?.reminder_sent || !whatsappStatus?.can_send_reminder || sendingAction === 'reminder'}
                  className={`w-full h-10 ${
                    whatsappStatus?.reminder_sent 
                      ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed' 
                      : whatsappStatus?.can_send_reminder 
                        ? 'bg-green-600 hover:bg-green-700 text-white' 
                        : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                  }`}
                  data-testid="send-game-reminder-btn"
                >
                  {sendingAction === 'reminder' ? (
                    <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
                  ) : whatsappStatus?.reminder_sent ? (
                    <><CheckCircle2 className="w-4 h-4 mr-2" /> Reminder Sent</>
                  ) : !whatsappStatus?.can_send_reminder ? (
                    <><Lock className="w-4 h-4 mr-2" /> Not Available (24hr window)</>
                  ) : (
                    <><Send className="w-4 h-4 mr-2" /> Send Game Reminder</>
                  )}
                </Button>
                {whatsappStatus?.reminder_sent && whatsappStatus?.reminder_sent_at && (
                  <p className="text-xs text-zinc-500 mt-2 text-center">
                    Sent on {new Date(whatsappStatus.reminder_sent_at).toLocaleString()}
                  </p>
                )}
              </div>

              {/* Per-User Join Link */}
              <div className="bg-zinc-800 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                  <Play className="w-4 h-4 text-blue-500" />
                  Send Join Link (Manual)
                </h4>
                <p className="text-xs text-zinc-400 mb-3">
                  Send game join link to individual players. Can be resent as needed.
                </p>

                {bookings.filter(b => b.status === 'confirmed' && b.whatsapp_opt_in).length === 0 ? (
                  <p className="text-zinc-500 text-sm text-center py-4">No confirmed bookings with WhatsApp opt-in</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {bookings.filter(b => b.status === 'confirmed' && b.whatsapp_opt_in).map((booking) => (
                      <div key={booking.booking_id} className="flex items-center justify-between p-2 bg-zinc-900 rounded-lg">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-zinc-500" />
                          <span className="text-sm text-white">{booking.user?.name}</span>
                        </div>
                        <Button
                          onClick={() => handleSendJoinLink(booking.user_id)}
                          disabled={sendingAction === `join_${booking.user_id}`}
                          size="sm"
                          className="h-7 text-xs bg-blue-600 hover:bg-blue-700"
                          data-testid={`send-join-link-${booking.user_id}`}
                        >
                          {sendingAction === `join_${booking.user_id}` ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <><Send className="w-3 h-3 mr-1" /> Send Link</>
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* D. WhatsApp Logs */}
            <TabsContent value="logs" className="space-y-4">
              {/* WhatsApp Logs Table */}
              <div className="bg-zinc-800 rounded-lg overflow-hidden">
                <div className="p-3 border-b border-zinc-700 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-green-500" />
                    WhatsApp Message Logs (Immutable)
                  </h4>
                  <span className="text-xs text-zinc-500">{whatsappLogs.length} messages</span>
                </div>
                
                {whatsappLogs.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
                    <p className="text-zinc-500 text-sm">No messages sent yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-900">
                        <tr className="text-xs text-zinc-500 uppercase">
                          <th className="px-3 py-2 text-left">User</th>
                          <th className="px-3 py-2 text-left">Game ID</th>
                          <th className="px-3 py-2 text-left">Template</th>
                          <th className="px-3 py-2 text-left">Status</th>
                          <th className="px-3 py-2 text-left">Timestamp</th>
                          <th className="px-3 py-2 text-left">Failure Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-700">
                        {whatsappLogs.map((log, idx) => (
                          <tr key={idx} className="hover:bg-zinc-800/50">
                            <td className="px-3 py-2 text-white">{log.recipient_name}</td>
                            <td className="px-3 py-2 text-zinc-400 text-xs font-mono">{log.game_id?.slice(0, 8)}...</td>
                            <td className="px-3 py-2">
                              <span className="text-xs text-zinc-300 capitalize">{log.template_name || log.message_type?.replace(/_/g, ' ')}</span>
                            </td>
                            <td className="px-3 py-2">
                              <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${getStatusColor(log.status)}`}>
                                {log.status?.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-zinc-400 text-xs">
                              {new Date(log.sent_at).toLocaleString()}
                            </td>
                            <td className="px-3 py-2">
                              {log.failure_reason ? (
                                <span className="text-xs text-red-400">{log.failure_reason}</span>
                              ) : (
                                <span className="text-zinc-600">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Activity Logs */}
              <div className="bg-zinc-800 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <History className="w-4 h-4 text-amber-500" />
                  Activity Log ({controlLogs.length})
                </h4>
                {controlLogs.length === 0 ? (
                  <p className="text-zinc-500 text-sm text-center py-4">No activity recorded yet</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {controlLogs.map((log, idx) => (
                      <div key={idx} className="flex items-start gap-2 p-2 bg-zinc-900 rounded-lg">
                        <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-3 h-3 text-zinc-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white font-medium">
                            {log.action?.replace(/_/g, ' ')}
                          </p>
                          <p className="text-[10px] text-zinc-500">
                            {Object.entries(log.details || {}).map(([k, v]) => `${k}: ${v}`).join(' • ')}
                          </p>
                          <p className="text-[10px] text-zinc-600">
                            {new Date(log.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="text-center py-8">
            <AlertCircle className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
            <p className="text-zinc-500">Failed to load game data</p>
          </div>
        )}

        {/* Ticket Details Modal */}
        {viewingTicket && (
          <Dialog open={!!viewingTicket} onOpenChange={() => setViewingTicket(null)}>
            <DialogContent className="max-w-md bg-zinc-900 border-zinc-800">
              <DialogHeader>
                <DialogTitle className="text-white flex items-center gap-2">
                  <Ticket className="w-5 h-5 text-amber-500" />
                  Ticket Details
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="bg-zinc-800 rounded-lg p-3">
                  <p className="text-xs text-zinc-500 mb-1">Player</p>
                  <p className="text-white font-medium">{viewingTicket.user?.name}</p>
                </div>
                <div className="bg-zinc-800 rounded-lg p-3">
                  <p className="text-xs text-zinc-500 mb-1">Ticket Numbers</p>
                  <p className="text-amber-400 font-mono text-lg">{viewingTicket.ticket_numbers?.join(', ')}</p>
                </div>
                <div className="bg-zinc-800 rounded-lg p-3">
                  <p className="text-xs text-zinc-500 mb-1">Amount</p>
                  <p className="text-emerald-400 font-medium">₹{viewingTicket.total_amount}</p>
                </div>
                <div className="bg-zinc-800 rounded-lg p-3">
                  <p className="text-xs text-zinc-500 mb-2">Ticket Grid Preview</p>
                  <div className="grid grid-cols-1 gap-2">
                    {viewingTicket.tickets?.slice(0, 2).map((ticket, idx) => (
                      <div key={idx} className="bg-zinc-900 p-2 rounded">
                        <p className="text-[10px] text-zinc-500 mb-1">Ticket {ticket.ticket_number}</p>
                        <div className="grid grid-cols-9 gap-1 text-[10px]">
                          {ticket.numbers?.flat().map((num, i) => (
                            <span 
                              key={i} 
                              className={`w-5 h-5 flex items-center justify-center rounded ${
                                num ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-800 text-zinc-600'
                              }`}
                            >
                              {num || '·'}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                    {viewingTicket.tickets?.length > 2 && (
                      <p className="text-xs text-zinc-500 text-center">+{viewingTicket.tickets.length - 2} more tickets</p>
                    )}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
