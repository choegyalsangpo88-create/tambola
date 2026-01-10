import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Calendar, Trophy, Clock, CheckCircle, Eye, X, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Get auth headers for API calls (mobile fallback)
const getAuthHeaders = () => {
  const session = localStorage.getItem('tambola_session');
  return session ? { 'Authorization': `Bearer ${session}` } : {};
};

// Ticket Display Component
const TicketView = ({ ticket, calledNumbers = [] }) => {
  const calledSet = new Set(calledNumbers);
  
  return (
    <div className="bg-white rounded-lg p-2 shadow-lg">
      <div className="text-center font-bold text-gray-800 text-sm mb-1">{ticket.ticket_number}</div>
      <div className="grid grid-cols-9 gap-0.5">
        {ticket.numbers?.map((row, rowIdx) =>
          row.map((num, colIdx) => (
            <div
              key={`${rowIdx}-${colIdx}`}
              className={`
                w-6 h-6 flex items-center justify-center text-xs font-bold rounded
                ${num === null 
                  ? 'bg-gray-100' 
                  : calledSet.has(num)
                    ? 'bg-green-500 text-white'
                    : 'bg-amber-100 text-gray-800'
                }
              `}
            >
              {num || ''}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default function MyTickets() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [games, setGames] = useState({});
  const [sessions, setSessions] = useState({});
  const [tickets, setTickets] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedBookings, setExpandedBookings] = useState({});
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [activeTab, setActiveTab] = useState('upcoming'); // upcoming, live, completed

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

      // Fetch game details and tickets for each booking
      const gameIds = [...new Set(bookingsData.map(b => b.game_id))];
      const gamesData = {};
      const sessionsData = {};
      const ticketsData = {};

      for (const gameId of gameIds) {
        try {
          // Fetch game
          const gameResponse = await axios.get(`${API}/games/${gameId}`);
          gamesData[gameId] = gameResponse.data;

          // Fetch session for called numbers
          try {
            const sessionResponse = await axios.get(`${API}/games/${gameId}/session`);
            sessionsData[gameId] = sessionResponse.data;
          } catch (e) {
            sessionsData[gameId] = { called_numbers: [], winners: {} };
          }

          // Fetch tickets
          const ticketsResponse = await axios.get(`${API}/games/${gameId}/tickets?page=1&limit=600`);
          ticketsData[gameId] = ticketsResponse.data.tickets;
        } catch (error) {
          console.error(`Failed to fetch data for game ${gameId}:`, error);
        }
      }

      setGames(gamesData);
      setSessions(sessionsData);
      setTickets(ticketsData);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
      toast.error('Failed to load your tickets');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (bookingId) => {
    setExpandedBookings(prev => ({
      ...prev,
      [bookingId]: !prev[bookingId]
    }));
  };

  const getGameStatus = (game) => {
    if (!game) return 'unknown';
    if (game.status === 'completed') return 'completed';
    if (game.status === 'live') return 'live';
    return 'upcoming';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'live': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'completed': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      default: return 'bg-green-500/20 text-green-400 border-green-500/30';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'live': return <Clock className="w-3 h-3 animate-pulse" />;
      case 'completed': return <CheckCircle className="w-3 h-3" />;
      default: return <Calendar className="w-3 h-3" />;
    }
  };

  // Sort and filter bookings
  const sortedBookings = [...bookings].sort((a, b) => {
    const gameA = games[a.game_id];
    const gameB = games[b.game_id];
    if (!gameA || !gameB) return 0;

    const statusOrder = { upcoming: 0, live: 1, completed: 2 };
    const statusA = getGameStatus(gameA);
    const statusB = getGameStatus(gameB);

    if (statusOrder[statusA] !== statusOrder[statusB]) {
      return statusOrder[statusA] - statusOrder[statusB];
    }

    // Within same status, sort by date
    return new Date(gameA.date + ' ' + gameA.time) - new Date(gameB.date + ' ' + gameB.time);
  });

  const filteredBookings = sortedBookings.filter(booking => {
    const game = games[booking.game_id];
    if (!game) return false;
    const status = getGameStatus(game);
    return activeTab === 'all' || status === activeTab;
  });

  const tabCounts = {
    upcoming: sortedBookings.filter(b => getGameStatus(games[b.game_id]) === 'upcoming').length,
    live: sortedBookings.filter(b => getGameStatus(games[b.game_id]) === 'live').length,
    completed: sortedBookings.filter(b => getGameStatus(games[b.game_id]) === 'completed').length,
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

        {/* Tabs */}
        <div className="flex gap-2 px-4 pb-3">
          {['upcoming', 'live', 'completed'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeTab === tab
                  ? 'bg-amber-500 text-black'
                  : 'bg-white/10 text-gray-400 hover:bg-white/20'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)} ({tabCounts[tab]})
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {filteredBookings.length === 0 ? (
          <div className="glass-card p-8 text-center" data-testid="no-bookings-message">
            <Trophy className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg mb-2">No {activeTab} tickets</p>
            <p className="text-gray-500 text-sm mb-6">
              {activeTab === 'upcoming' && 'Book tickets for upcoming games to see them here'}
              {activeTab === 'live' && 'No live games with your tickets right now'}
              {activeTab === 'completed' && 'Your completed game tickets will appear here'}
            </p>
            <Button
              onClick={() => navigate('/')}
              className="rounded-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 font-bold"
            >
              Browse Games
            </Button>
          </div>
        ) : (
          <div className="space-y-4" data-testid="bookings-list">
            {filteredBookings.map((booking) => {
              const game = games[booking.game_id];
              const session = sessions[booking.game_id] || { called_numbers: [], winners: {} };
              const gameTickets = tickets[booking.game_id] || [];
              const myTicketsList = gameTickets.filter(t => booking.ticket_ids.includes(t.ticket_id));
              const isExpanded = expandedBookings[booking.booking_id];
              const gameStatus = getGameStatus(game);

              if (!game) return null;

              return (
                <div 
                  key={booking.booking_id} 
                  className="glass-card overflow-hidden" 
                  data-testid={`booking-${booking.booking_id}`}
                >
                  {/* Header */}
                  <div 
                    className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => toggleExpanded(booking.booking_id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 text-xs font-bold rounded-full flex items-center gap-1 border ${getStatusColor(gameStatus)}`}>
                            {getStatusIcon(gameStatus)}
                            {gameStatus.toUpperCase()}
                          </span>
                          {booking.has_full_sheet_bonus && (
                            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                              FULL SHEET
                            </span>
                          )}
                        </div>
                        <h3 className="text-lg font-bold text-white">{game.name}</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <Calendar className="w-4 h-4" />
                          <span>{game.date} at {game.time}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-amber-500 font-bold">{booking.ticket_ids.length} tickets</span>
                        {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                      </div>
                    </div>

                    {/* Quick Stats for Completed Games */}
                    {gameStatus === 'completed' && Object.keys(session.winners || {}).length > 0 && (
                      <div className="mt-3 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                        <p className="text-xs text-amber-400 font-medium">
                          🏆 {Object.keys(session.winners).length} prizes claimed
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t border-white/10 p-4 bg-black/20">
                      {/* Game Results (for completed games) */}
                      {gameStatus === 'completed' && Object.keys(session.winners || {}).length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-sm font-bold text-amber-400 mb-2">🏆 Winners</h4>
                          <div className="grid gap-2">
                            {Object.entries(session.winners).map(([prize, winner]) => (
                              <div key={prize} className="flex items-center justify-between p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                <div>
                                  <span className="text-amber-400 font-bold text-sm">{prize}</span>
                                  <p className="text-white text-xs">
                                    {winner.holder_name || winner.name || 'Player'}
                                    {winner.ticket_number && <span className="text-gray-400 ml-1">({winner.ticket_number})</span>}
                                  </p>
                                </div>
                                {game.prizes?.[prize] && (
                                  <span className="text-green-400 font-bold text-sm">₹{game.prizes[prize].toLocaleString()}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* My Tickets */}
                      <div>
                        <h4 className="text-sm font-bold text-white mb-2">My Tickets</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {myTicketsList.map(ticket => (
                            <div 
                              key={ticket.ticket_id}
                              className="cursor-pointer hover:scale-105 transition-transform"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTicket({ ...ticket, game, session });
                              }}
                            >
                              <TicketView 
                                ticket={ticket} 
                                calledNumbers={session.called_numbers || []} 
                              />
                              <div className="mt-1 flex items-center justify-center gap-1 text-xs text-gray-400">
                                <Eye className="w-3 h-3" />
                                Click to view
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="mt-4 flex gap-2">
                        {gameStatus === 'live' && booking.status === 'confirmed' && (
                          <Button
                            onClick={() => navigate(`/live/${game.game_id}`)}
                            className="flex-1 rounded-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 font-bold"
                          >
                            Join Live Game
                          </Button>
                        )}
                        {gameStatus === 'completed' && (
                          <Button
                            onClick={() => navigate(`/game-history/${game.game_id}`)}
                            className="flex-1 rounded-full bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 font-bold"
                          >
                            View Full Results
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Ticket Modal */}
      {selectedTicket && (
        <div 
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedTicket(null)}
        >
          <div 
            className="bg-[#1a1a1e] rounded-2xl p-6 max-w-sm w-full"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">{selectedTicket.ticket_number}</h3>
              <button 
                onClick={() => setSelectedTicket(null)}
                className="text-gray-500 hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-400">{selectedTicket.game?.name}</p>
              <p className="text-xs text-gray-500">{selectedTicket.game?.date} at {selectedTicket.game?.time}</p>
            </div>

            {/* Large Ticket View */}
            <div className="bg-white rounded-lg p-4 shadow-lg mb-4">
              <div className="grid grid-cols-9 gap-1">
                {selectedTicket.numbers?.map((row, rowIdx) =>
                  row.map((num, colIdx) => {
                    const isCalled = selectedTicket.session?.called_numbers?.includes(num);
                    return (
                      <div
                        key={`${rowIdx}-${colIdx}`}
                        className={`
                          w-8 h-8 flex items-center justify-center text-sm font-bold rounded
                          ${num === null 
                            ? 'bg-gray-100' 
                            : isCalled
                              ? 'bg-green-500 text-white'
                              : 'bg-amber-100 text-gray-800'
                          }
                        `}
                      >
                        {num || ''}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Stats */}
            {selectedTicket.session?.called_numbers?.length > 0 && (
              <div className="text-center text-sm text-gray-400">
                <span className="text-green-400 font-bold">
                  {selectedTicket.numbers?.flat().filter(n => n && selectedTicket.session.called_numbers.includes(n)).length}
                </span>
                /15 numbers called
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
