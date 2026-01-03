import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar, Clock, Trophy, Users, Ticket, Check, Grid3X3 } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function JoinUserGame() {
  const { shareCode } = useParams();
  const navigate = useNavigate();
  
  const [game, setGame] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [playerName, setPlayerName] = useState('');
  const [selectedTickets, setSelectedTickets] = useState([]);
  const [isJoining, setIsJoining] = useState(false);
  const [joinedData, setJoinedData] = useState(null);
  const [viewMode, setViewMode] = useState('select'); // 'select' or 'random'

  useEffect(() => {
    fetchGame();
  }, [shareCode]);

  const fetchGame = async () => {
    try {
      // Fetch game details
      const gameResponse = await axios.get(`${API}/user-games/code/${shareCode}`);
      setGame(gameResponse.data);
      
      // Fetch tickets for selection
      const ticketsResponse = await axios.get(`${API}/user-games/code/${shareCode}/tickets`);
      setTickets(ticketsResponse.data.tickets || []);
    } catch (error) {
      console.error('Failed to fetch game:', error);
      toast.error('Game not found');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTicket = (ticketId) => {
    setSelectedTickets(prev => 
      prev.includes(ticketId) 
        ? prev.filter(id => id !== ticketId)
        : [...prev, ticketId]
    );
  };

  const handleJoin = async () => {
    if (!playerName.trim()) {
      toast.error('Please enter your name');
      return;
    }

    if (viewMode === 'select' && selectedTickets.length === 0) {
      toast.error('Please select at least one ticket');
      return;
    }

    setIsJoining(true);
    try {
      const payload = {
        player_name: playerName.trim(),
        ticket_count: viewMode === 'random' ? 1 : selectedTickets.length,
        ticket_ids: viewMode === 'select' ? selectedTickets : null
      };

      const response = await axios.post(
        `${API}/user-games/code/${shareCode}/join`,
        payload
      );
      
      toast.success(`Welcome ${playerName}!`);
      setJoinedData(response.data);
      
      // Store player info in localStorage for live game
      localStorage.setItem(`tambola_player_${game.user_game_id}`, JSON.stringify({
        name: playerName,
        tickets: response.data.tickets
      }));
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to join game');
    } finally {
      setIsJoining(false);
    }
  };

  const availableTickets = tickets.filter(t => !t.assigned_to);
  const bookedTickets = tickets.filter(t => t.assigned_to);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c]">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c]">
        <div className="glass-card p-8 text-center max-w-md mx-4">
          <p className="text-xl text-gray-400 mb-4">Game not found</p>
          <p className="text-gray-500">The game code may be invalid or expired.</p>
        </div>
      </div>
    );
  }

  // Show joined confirmation with tickets
  if (joinedData) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center p-4">
        <div className="glass-card p-6 md:p-8 max-w-lg w-full">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">You're In!</h1>
            <p className="text-gray-400">Welcome to {game.name}, {joinedData.player_name}!</p>
          </div>

          {/* Tickets */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-3">Your Ticket{joinedData.tickets.length > 1 ? 's' : ''}</h3>
            <div className="space-y-4">
              {joinedData.tickets.map((ticket, idx) => (
                <div key={idx} className="bg-white rounded-lg p-3">
                  <p className="text-xs text-gray-600 mb-2 font-medium">{ticket.ticket_number}</p>
                  <div className="grid grid-cols-9 gap-1">
                    {ticket.numbers.map((row, rowIdx) => (
                      row.map((num, colIdx) => (
                        <div
                          key={`${rowIdx}-${colIdx}`}
                          className={`aspect-square flex items-center justify-center text-xs font-bold rounded ${
                            num ? 'bg-amber-100 text-amber-900' : 'bg-gray-100'
                          }`}
                        >
                          {num || ''}
                        </div>
                      ))
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Game Info */}
          <div className="bg-white/5 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Calendar className="w-4 h-4" />
              <span>{game.date} at {game.time}</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">Save this page or take a screenshot of your tickets!</p>
          </div>

          {game.status === 'live' && (
            <Button
              onClick={() => navigate(`/play/${game.user_game_id}`)}
              className="w-full h-14 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 font-bold text-lg animate-pulse"
            >
              Join Live Game
            </Button>
          )}

          {game.status === 'upcoming' && (
            <p className="text-center text-gray-400 text-sm">
              Game starts on {game.date} at {game.time}. Come back then to play!
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] p-4">
      <div className="max-w-4xl mx-auto">
        {/* Game Header */}
        <div className="glass-card p-6 mb-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 flex items-center justify-center">
              <Users className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>
                {game.name}
              </h1>
              <p className="text-gray-400 text-sm">Hosted by {game.host_name}</p>
            </div>
          </div>

          {/* Game Details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white/5 rounded-lg p-3">
              <Calendar className="w-4 h-4 text-amber-500 mb-1" />
              <p className="text-xs text-gray-500">Date</p>
              <p className="text-white font-medium text-sm">{game.date}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <Clock className="w-4 h-4 text-amber-500 mb-1" />
              <p className="text-xs text-gray-500">Time</p>
              <p className="text-white font-medium text-sm">{game.time}</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <Ticket className="w-4 h-4 text-green-500 mb-1" />
              <p className="text-xs text-gray-500">Available</p>
              <p className="text-green-400 font-medium text-sm">{availableTickets.length} tickets</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <Grid3X3 className="w-4 h-4 text-blue-500 mb-1" />
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-blue-400 font-medium text-sm">{tickets.length} tickets</p>
            </div>
          </div>

          {game.prizes_description && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mt-4">
              <div className="flex items-center gap-2 mb-1">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span className="font-semibold text-amber-400 text-sm">Prizes</span>
              </div>
              <p className="text-gray-300 text-sm whitespace-pre-wrap">{game.prizes_description}</p>
            </div>
          )}
        </div>

        {/* Join Form - Name Input */}
        {game.status === 'upcoming' && (
          <>
            <div className="glass-card p-4 mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Your Name *
              </label>
              <Input
                type="text"
                placeholder="Enter your name"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 h-12"
              />
            </div>

            {/* Ticket Selection */}
            <div className="glass-card p-4 mb-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Select Your Tickets</h2>
                <span className="text-sm text-amber-400">{selectedTickets.length} selected</span>
              </div>

              {/* Tickets Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[60vh] overflow-y-auto">
                {tickets.map((ticket) => {
                  const isSelected = selectedTickets.includes(ticket.ticket_id);
                  const isBooked = !!ticket.assigned_to;
                  
                  return (
                    <div
                      key={ticket.ticket_id}
                      onClick={() => !isBooked && toggleTicket(ticket.ticket_id)}
                      className={`rounded-lg p-2 cursor-pointer transition-all border-2 ${
                        isBooked 
                          ? 'bg-gray-800/50 border-gray-700 opacity-60 cursor-not-allowed'
                          : isSelected 
                            ? 'bg-amber-500/20 border-amber-500 ring-2 ring-amber-500/50' 
                            : 'bg-white border-white/20 hover:border-amber-500/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-xs font-bold ${isBooked ? 'text-gray-500' : 'text-gray-700'}`}>
                          {ticket.ticket_number}
                        </span>
                        {isBooked && (
                          <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">
                            Booked
                          </span>
                        )}
                        {isSelected && !isBooked && (
                          <Check className="w-4 h-4 text-amber-500" />
                        )}
                      </div>
                      <div className="grid grid-cols-9 gap-0.5">
                        {ticket.numbers?.map((row, rowIdx) => (
                          row.map((num, colIdx) => (
                            <div
                              key={`${rowIdx}-${colIdx}`}
                              className={`aspect-square flex items-center justify-center text-[8px] md:text-[9px] font-bold rounded ${
                                num 
                                  ? isBooked 
                                    ? 'bg-gray-300 text-gray-600' 
                                    : 'bg-amber-100 text-amber-900' 
                                  : 'bg-gray-100'
                              }`}
                            >
                              {num || ''}
                            </div>
                          ))
                        ))}
                      </div>
                      {isBooked && ticket.assigned_to && (
                        <p className="text-[9px] text-gray-500 mt-1 truncate">👤 {ticket.assigned_to}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Book Button */}
            <Button
              onClick={handleJoin}
              disabled={isJoining || !playerName.trim() || selectedTickets.length === 0}
              className="w-full h-14 text-lg font-bold rounded-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
            >
              {isJoining ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Booking...
                </div>
              ) : (
                <><Ticket className="w-5 h-5 mr-2" /> Book {selectedTickets.length} Ticket{selectedTickets.length !== 1 ? 's' : ''}</>
              )}
            </Button>
          </>
        )}

        {game.status === 'live' && (
          <div className="glass-card p-6 text-center">
            <p className="text-yellow-400 mb-4">Game is live! Enter your name to view your tickets.</p>
            <Input
              type="text"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 h-12 mb-4"
            />
            <Button
              onClick={() => navigate(`/play/${game.user_game_id}?player=${encodeURIComponent(playerName)}`)}
              disabled={!playerName.trim()}
              className="w-full h-14 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 font-bold text-lg animate-pulse"
            >
              Join Live Game
            </Button>
          </div>
        )}

        {game.status === 'completed' && (
          <div className="glass-card p-6 text-center">
            <p className="text-gray-400">This game has ended.</p>
          </div>
        )}
      </div>
    </div>
  );
}
