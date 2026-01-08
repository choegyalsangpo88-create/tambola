import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  FileText, Users, MessageSquare, History, Ticket, IndianRupee,
  Send, Clock, CheckCircle2, AlertCircle, RefreshCw, Lock, 
  Play, Calendar, User, Phone, Mail
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

  useEffect(() => {
    if (isOpen && gameId) {
      fetchControlData();
    }
  }, [isOpen, gameId, fetchControlData]);

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

  const handleConfirmPayment = async (bookingId) => {
    try {
      setSendingAction(`payment_${bookingId}`);
      await adminAxios.put(`${API}/admin/bookings/${bookingId}/confirm-payment`);
      toast.success('Payment confirmed!');
      fetchControlData();
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to confirm payment');
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
              <TabsTrigger value="tickets" className="text-xs" data-testid="tab-tickets">
                <Users className="w-3 h-3 mr-1" /> Tickets
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

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-900 rounded-lg p-3">
                    <p className="text-xs text-zinc-500">Price per Ticket</p>
                    <p className="text-lg font-bold text-white">₹{game?.price}</p>
                  </div>
                  <div className="bg-zinc-900 rounded-lg p-3">
                    <p className="text-xs text-zinc-500">Prize Pool</p>
                    <p className="text-lg font-bold text-emerald-400">₹{game?.prize_pool?.toLocaleString()}</p>
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

            {/* B. Ticket Sales Summary */}
            <TabsContent value="tickets" className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-zinc-800 rounded-lg p-3">
                  <p className="text-xs text-zinc-500">Total Tickets</p>
                  <p className="text-xl font-bold text-white">{ticketSummary?.total}</p>
                </div>
                <div className="bg-zinc-800 rounded-lg p-3">
                  <p className="text-xs text-zinc-500">Booked</p>
                  <p className="text-xl font-bold text-amber-400">{ticketSummary?.booked}</p>
                </div>
                <div className="bg-zinc-800 rounded-lg p-3">
                  <p className="text-xs text-zinc-500">Confirmed</p>
                  <p className="text-xl font-bold text-emerald-400">{ticketSummary?.confirmed}</p>
                </div>
                <div className="bg-zinc-800 rounded-lg p-3">
                  <p className="text-xs text-zinc-500">Revenue</p>
                  <p className="text-xl font-bold text-emerald-400">₹{ticketSummary?.revenue?.toLocaleString()}</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="bg-zinc-800 rounded-lg p-3">
                <div className="flex justify-between text-xs text-zinc-500 mb-1">
                  <span>Sales Progress</span>
                  <span>{((ticketSummary?.confirmed / ticketSummary?.total) * 100 || 0).toFixed(1)}%</span>
                </div>
                <div className="w-full h-2 bg-zinc-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber-500 rounded-full transition-all"
                    style={{ width: `${(ticketSummary?.confirmed / ticketSummary?.total) * 100 || 0}%` }}
                  />
                </div>
              </div>

              {/* Bookings List */}
              <div className="bg-zinc-800 rounded-lg p-3">
                <h4 className="text-sm font-semibold text-white mb-3">Bookings ({bookings.length})</h4>
                {bookings.length === 0 ? (
                  <p className="text-zinc-500 text-sm text-center py-4">No bookings yet</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {bookings.map((booking) => (
                      <div key={booking.booking_id} className="flex items-center justify-between p-2 bg-zinc-900 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
                            <User className="w-4 h-4 text-zinc-400" />
                          </div>
                          <div>
                            <p className="text-sm text-white">{booking.user?.name || 'Unknown'}</p>
                            <p className="text-xs text-zinc-500">{booking.ticket_ids?.length || 0} tickets • ₹{booking.total_amount}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 text-[10px] rounded-full ${
                            booking.status === 'confirmed' ? 'bg-emerald-500/20 text-emerald-400' :
                            booking.status === 'pending' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-zinc-700 text-zinc-400'
                          }`}>
                            {booking.status?.toUpperCase()}
                          </span>
                          {booking.status === 'pending' && (
                            <Button
                              onClick={() => handleConfirmPayment(booking.booking_id)}
                              size="sm"
                              className="h-6 text-[10px] bg-emerald-600 hover:bg-emerald-700"
                              disabled={sendingAction === `payment_${booking.booking_id}`}
                            >
                              {sendingAction === `payment_${booking.booking_id}` ? (
                                <RefreshCw className="w-3 h-3 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                              )}
                              Confirm
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                    <p className="text-xs text-green-400/70">Messages use pre-approved Twilio templates only. No custom text.</p>
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
                  Send reminder to all confirmed players. Can only be sent once, within 24 hours of game time.
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

              {/* Per-Booking Actions */}
              <div className="bg-zinc-800 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-500" />
                  Player Actions
                </h4>
                <p className="text-xs text-zinc-400 mb-3">
                  Send individual messages to players.
                </p>

                {bookings.length === 0 ? (
                  <p className="text-zinc-500 text-sm text-center py-4">No bookings to message</p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {bookings.filter(b => b.user?.phone).map((booking) => (
                      <div key={booking.booking_id} className="p-3 bg-zinc-900 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
                              <User className="w-4 h-4 text-zinc-400" />
                            </div>
                            <div>
                              <p className="text-sm text-white">{booking.user?.name}</p>
                              <p className="text-[10px] text-zinc-500 flex items-center gap-1">
                                <Phone className="w-3 h-3" /> {booking.user?.phone?.slice(-4) ? `****${booking.user.phone.slice(-4)}` : 'N/A'}
                              </p>
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 text-[10px] rounded-full ${
                            booking.status === 'confirmed' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                          }`}>
                            {booking.status?.toUpperCase()}
                          </span>
                        </div>
                        
                        <div className="flex gap-2">
                          {/* Send Booking Confirmation - only for confirmed bookings, once */}
                          <Button
                            onClick={() => handleSendBookingConfirmation(booking.booking_id)}
                            disabled={booking.status !== 'confirmed' || booking.confirmation_sent || sendingAction === `confirm_${booking.booking_id}`}
                            size="sm"
                            className={`flex-1 h-7 text-[10px] ${
                              booking.confirmation_sent 
                                ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed' 
                                : booking.status !== 'confirmed'
                                  ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                                  : 'bg-emerald-600 hover:bg-emerald-700'
                            }`}
                            data-testid={`send-confirmation-${booking.booking_id}`}
                          >
                            {sendingAction === `confirm_${booking.booking_id}` ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : booking.confirmation_sent ? (
                              <><CheckCircle2 className="w-3 h-3 mr-1" /> Sent</>
                            ) : booking.status !== 'confirmed' ? (
                              <><Lock className="w-3 h-3 mr-1" /> Pay First</>
                            ) : (
                              <><Send className="w-3 h-3 mr-1" /> Confirmation</>
                            )}
                          </Button>

                          {/* Send Join Link - can resend */}
                          <Button
                            onClick={() => handleSendJoinLink(booking.user_id)}
                            disabled={sendingAction === `join_${booking.user_id}`}
                            size="sm"
                            className="flex-1 h-7 text-[10px] bg-blue-600 hover:bg-blue-700"
                            data-testid={`send-join-link-${booking.user_id}`}
                          >
                            {sendingAction === `join_${booking.user_id}` ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <><Play className="w-3 h-3 mr-1" /> Join Link</>
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* D. Logs */}
            <TabsContent value="logs" className="space-y-4">
              {/* WhatsApp Logs */}
              <div className="bg-zinc-800 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-green-500" />
                  WhatsApp Messages ({whatsappLogs.length})
                </h4>
                {whatsappLogs.length === 0 ? (
                  <p className="text-zinc-500 text-sm text-center py-4">No messages sent yet</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {whatsappLogs.map((log, idx) => (
                      <div key={idx} className="flex items-start gap-2 p-2 bg-zinc-900 rounded-lg">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                          log.status === 'sent' ? 'bg-green-500/20' : 'bg-red-500/20'
                        }`}>
                          {log.status === 'sent' ? (
                            <CheckCircle2 className="w-3 h-3 text-green-400" />
                          ) : (
                            <AlertCircle className="w-3 h-3 text-red-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white font-medium capitalize">
                            {log.message_type?.replace(/_/g, ' ')}
                          </p>
                          <p className="text-[10px] text-zinc-500">
                            To: {log.recipient_name} • {new Date(log.sent_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Control Logs */}
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
      </DialogContent>
    </Dialog>
  );
}
