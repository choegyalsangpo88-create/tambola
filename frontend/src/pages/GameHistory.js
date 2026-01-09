import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, Calendar, Users, X } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Get auth headers for API calls (mobile fallback)
const getAuthHeaders = () => {
  const session = localStorage.getItem('tambola_session');
  return session ? { 'Authorization': `Bearer ${session}` } : {};
};

// Ticket Display Component
const TicketView = ({ ticket, calledNumbers = [], size = 'normal' }) => {
  const calledSet = new Set(calledNumbers);
  const cellSize = size === 'large' ? 'w-8 h-8 text-sm' : 'w-6 h-6 text-xs';
  
  return (
    <div className="bg-white rounded-lg p-2 shadow-lg">
      <div className="text-center font-bold text-gray-800 text-sm mb-1">{ticket.ticket_number}</div>
      <div className="grid grid-cols-9 gap-0.5">
        {ticket.numbers?.map((row, rowIdx) =>
          row.map((num, colIdx) => (
            <div
              key={`${rowIdx}-${colIdx}`}
              className={`
                ${cellSize} flex items-center justify-center font-bold rounded
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

export default function GameHistory() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [session, setSession] = useState(null);
  const [allTickets, setAllTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);

  useEffect(() => {
    fetchGameData();
  }, [gameId]);

  const fetchGameData = async () => {
    try {
      // Fetch game
      const gameResponse = await axios.get(`${API}/games/${gameId}`);
      setGame(gameResponse.data);

      // Fetch session
      try {
        const sessionResponse = await axios.get(`${API}/games/${gameId}/session`);
        setSession(sessionResponse.data);
      } catch (e) {
        setSession({ called_numbers: [], winners: {} });
      }

      // Fetch tickets
      const ticketsResponse = await axios.get(`${API}/games/${gameId}/tickets?page=1&limit=600`);
      setAllTickets(ticketsResponse.data.tickets);
    } catch (error) {
      console.error('Failed to fetch game data:', error);
      toast.error('Failed to load game history');
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

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c]">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Game not found</p>
          <Button onClick={() => navigate('/')} className="rounded-full">
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  const winners = session?.winners || {};
  const calledNumbers = session?.called_numbers || [];
  const bookedTickets = allTickets.filter(t => t.is_booked);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a3d2c] to-[#0a0a0c] pb-20">
      {/* Header */}
      <div className="bg-[#121216]/80 backdrop-blur-lg border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            data-testid="back-button"
            variant="ghost"
            size="icon"
            onClick={() => navigate('/my-tickets')}
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Game Results
            </h1>
            <p className="text-xs text-gray-400">{game.name}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Game Info Card */}
        <div className="glass-card p-6 mb-6">
          <div className="flex items-center justify-center mb-4">
            <div className="text-6xl">🎉</div>
          </div>
          <h2 className="text-2xl font-bold text-white text-center mb-2">Game Ended!</h2>
          <p className="text-gray-400 text-center mb-4">Congratulations to all winners!</p>
          
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="flex items-center justify-center gap-1 text-gray-400 text-xs mb-1">
                <Calendar className="w-3 h-3" />
                Date
              </div>
              <p className="text-white font-bold">{game.date}</p>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 text-gray-400 text-xs mb-1">
                <Users className="w-3 h-3" />
                Tickets Sold
              </div>
              <p className="text-white font-bold">{bookedTickets.length}</p>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 text-gray-400 text-xs mb-1">
                <Trophy className="w-3 h-3" />
                Numbers Called
              </div>
              <p className="text-white font-bold">{calledNumbers.length}</p>
            </div>
          </div>
        </div>

        {/* Winners Section */}
        {Object.keys(winners).length > 0 ? (
          <div className="glass-card p-6 mb-6">
            <h3 className="text-lg font-bold text-amber-400 mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5" />
              Winners
            </h3>
            <div className="space-y-3">
              {Object.entries(winners).map(([prize, winner]) => {
                const winningTicket = allTickets.find(t => 
                  t.ticket_id === winner.ticket_id || t.ticket_number === winner.ticket_number
                );
                const prizeAmount = game.prizes?.[prize] || 0;

                return (
                  <div 
                    key={prize}
                    className="border border-amber-500/30 rounded-xl p-4 bg-amber-500/5 hover:bg-amber-500/10 transition-colors cursor-pointer"
                    onClick={() => winningTicket && setSelectedTicket({ ...winningTicket, prize, prizeAmount, winner })}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-amber-400 font-bold">{prize}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-2xl">🏆</span>
                          <div>
                            <p className="text-white font-medium">
                              {winner.holder_name || winner.name || 'Player'}
                            </p>
                            {winner.ticket_number && (
                              <p className="text-gray-400 text-sm">({winner.ticket_number})</p>
                            )}
                          </div>
                        </div>
                      </div>
                      {prizeAmount > 0 && (
                        <div className="text-right">
                          <p className="text-green-400 font-bold text-xl">₹{prizeAmount.toLocaleString()}</p>
                          <p className="text-xs text-gray-500">Prize Money</p>
                        </div>
                      )}
                    </div>
                    {winningTicket && (
                      <p className="text-xs text-gray-400 mt-2 text-center">
                        Click to view winning ticket
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="glass-card p-6 mb-6 text-center">
            <p className="text-gray-400">No winners recorded for this game</p>
          </div>
        )}

        {/* Called Numbers Grid */}
        {calledNumbers.length > 0 && (
          <div className="glass-card p-6 mb-6">
            <h3 className="text-lg font-bold text-white mb-4">Called Numbers ({calledNumbers.length})</h3>
            <div className="grid grid-cols-10 gap-1">
              {Array.from({ length: 90 }, (_, i) => i + 1).map(num => {
                const isCalled = calledNumbers.includes(num);
                return (
                  <div
                    key={num}
                    className={`
                      w-7 h-7 flex items-center justify-center text-xs font-bold rounded
                      ${isCalled 
                        ? 'bg-green-500 text-white' 
                        : 'bg-gray-700 text-gray-500'
                      }
                    `}
                  >
                    {num}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Prize Structure */}
        {game.prizes && Object.keys(game.prizes).length > 0 && (
          <div className="glass-card p-6">
            <h3 className="text-lg font-bold text-white mb-4">Prize Structure</h3>
            <div className="space-y-2">
              {Object.entries(game.prizes).map(([prize, amount]) => {
                const isWon = prize in winners;
                return (
                  <div 
                    key={prize}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      isWon ? 'bg-green-500/10 border border-green-500/30' : 'bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isWon && <span className="text-green-400">✓</span>}
                      <span className={isWon ? 'text-green-400' : 'text-gray-400'}>{prize}</span>
                    </div>
                    <span className={`font-bold ${isWon ? 'text-green-400' : 'text-amber-500'}`}>
                      ₹{amount.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
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
              <div>
                <h3 className="text-xl font-bold text-amber-400">{selectedTicket.prize}</h3>
                <p className="text-sm text-gray-400">Winning Ticket</p>
              </div>
              <button 
                onClick={() => setSelectedTicket(null)}
                className="text-gray-500 hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-4">
              <p className="text-white font-bold">
                Winner: {selectedTicket.winner?.holder_name || selectedTicket.winner?.name || 'Player'}
              </p>
              <p className="text-sm text-gray-400">Ticket: {selectedTicket.ticket_number}</p>
              {selectedTicket.prizeAmount > 0 && (
                <p className="text-green-400 font-bold mt-2">Prize: ₹{selectedTicket.prizeAmount.toLocaleString()}</p>
              )}
            </div>

            {/* Large Ticket View */}
            <div className="bg-white rounded-lg p-4 shadow-lg">
              <div className="text-center font-bold text-gray-800 mb-2">{selectedTicket.ticket_number}</div>
              <div className="grid grid-cols-9 gap-1">
                {selectedTicket.numbers?.map((row, rowIdx) =>
                  row.map((num, colIdx) => {
                    const isCalled = calledNumbers.includes(num);
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
          </div>
        </div>
      )}
    </div>
  );
}
