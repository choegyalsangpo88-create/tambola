import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, Volume2, VolumeX, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';
import { getCallName } from '@/utils/tambolaCallNames';
import confetti from 'canvas-confetti';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function LiveGame() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [session, setSession] = useState(null);
  const [myTickets, setMyTickets] = useState([]);
  const [allBookedTickets, setAllBookedTickets] = useState([]);
  const [markedNumbers, setMarkedNumbers] = useState(new Set());
  const [topPlayers, setTopPlayers] = useState([]);
  const [previousWinners, setPreviousWinners] = useState({});
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [ticketZoom, setTicketZoom] = useState(2); // 1 = small (4 per row), 2 = medium (2 per row), 3 = large (1 per row)
  const pollInterval = useRef(null);
  const audioRef = useRef(null);

  // Confetti celebration
  const celebrateWinner = (prizeType) => {
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.6 },
      colors: ['#FCD34D', '#F59E0B', '#D97706', '#10B981']
    });
    
    toast.success(`🎉 ${prizeType} Winner!`, {
      duration: 5000,
      style: {
        background: 'linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%)',
        color: '#000',
        fontWeight: 'bold'
      }
    });
  };

  const playNumberSound = () => {
    if (soundEnabled && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  };

  useEffect(() => {
    fetchGameData();
    fetchMyTickets();
    fetchAllBookedTickets();

    pollInterval.current = setInterval(() => {
      fetchSession();
      calculateTopPlayers();
    }, 3000);

    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, [gameId]);

  useEffect(() => {
    if (session && session.called_numbers) {
      setMarkedNumbers(new Set(session.called_numbers));
      
      if (session.winners) {
        const currentWinners = Object.keys(session.winners);
        const previousWinnerKeys = Object.keys(previousWinners);
        const newWinnerPrizes = currentWinners.filter(prize => !previousWinnerKeys.includes(prize));
        
        if (newWinnerPrizes.length > 0) {
          newWinnerPrizes.forEach(prize => celebrateWinner(prize));
        }
        setPreviousWinners(session.winners);
      }
      
      if (session.current_number && session.current_number !== previousWinners.lastNumber) {
        playNumberSound();
        setPreviousWinners(prev => ({ ...prev, lastNumber: session.current_number }));
      }
    }
  }, [session]);

  const fetchGameData = async () => {
    try {
      const response = await axios.get(`${API}/games/${gameId}`);
      setGame(response.data);
      fetchSession();
    } catch (error) {
      console.error('Failed to fetch game:', error);
    }
  };

  const fetchSession = async () => {
    try {
      const response = await axios.get(`${API}/games/${gameId}/session`);
      setSession(response.data);
    } catch (error) {
      console.error('Failed to fetch session:', error);
    }
  };

  const fetchMyTickets = async () => {
    try {
      const bookingsResponse = await axios.get(`${API}/bookings/my`, { withCredentials: true });
      const myGameBookings = bookingsResponse.data.filter(b => b.game_id === gameId && b.status === 'confirmed');
      
      if (myGameBookings.length > 0) {
        const ticketIds = myGameBookings.flatMap(b => b.ticket_ids);
        const ticketsResponse = await axios.get(`${API}/games/${gameId}/tickets?page=1&limit=600`);
        const allTickets = ticketsResponse.data.tickets;
        const myTicketsData = allTickets.filter(t => ticketIds.includes(t.ticket_id));
        setMyTickets(myTicketsData);
      }
    } catch (error) {
      console.error('Failed to fetch my tickets:', error);
    }
  };

  const fetchAllBookedTickets = async () => {
    try {
      const ticketsResponse = await axios.get(`${API}/games/${gameId}/tickets?page=1&limit=600`);
      const bookedTickets = ticketsResponse.data.tickets.filter(t => t.is_booked && t.booking_status === 'confirmed');
      setAllBookedTickets(bookedTickets);
    } catch (error) {
      console.error('Failed to fetch booked tickets:', error);
    }
  };

  const calculateTopPlayers = () => {
    if (!session || !allBookedTickets.length) return;

    const calledSet = new Set(session.called_numbers);
    const playerProgress = {};

    allBookedTickets.forEach(ticket => {
      const oderId = ticket.user_id || ticket.booked_by_name;
      const userId = ticket.user_id || ticket.booked_by_name;
      if (!userId) return;

      let markedCount = 0;
      ticket.numbers.forEach(row => {
        row.forEach(num => {
          if (num && calledSet.has(num)) markedCount++;
        });
      });

      if (!playerProgress[userId]) {
        playerProgress[userId] = { name: ticket.booked_by_name || `Player ${String(userId).slice(-4)}`, totalMarked: 0 };
      }
      playerProgress[userId].totalMarked += markedCount;
    });

    const sortedPlayers = Object.values(playerProgress)
      .sort((a, b) => b.totalMarked - a.totalMarked)
      .slice(0, 5);

    setTopPlayers(sortedPlayers);
  };

  // Get ball color based on number range
  const getBallColor = (num) => {
    if (!num) return 'from-gray-400 to-gray-600';
    if (num <= 10) return 'from-red-400 to-red-600';
    if (num <= 20) return 'from-orange-400 to-orange-600';
    if (num <= 30) return 'from-yellow-400 to-yellow-600';
    if (num <= 40) return 'from-green-400 to-green-600';
    if (num <= 50) return 'from-teal-400 to-teal-600';
    if (num <= 60) return 'from-cyan-400 to-cyan-600';
    if (num <= 70) return 'from-blue-400 to-blue-600';
    if (num <= 80) return 'from-indigo-400 to-indigo-600';
    return 'from-purple-400 to-purple-600';
  };

  if (!game || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c]">
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a3d2c] to-[#0a0a0c]">
      {/* Audio */}
      <audio ref={audioRef} src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGD0fPTgjMGHm7A7+OZTA0OVqzl7K1aFwlInN/zxmwlBSp9zPLdjTkIGGS38+OXRQwRX7fn77hjGQc9k9TxwXEcBip6yO7glT0KFF24+fGmXRoJQ5vd88dxKAYrdMnx3I0+ChljuO3nnEcNElWv5OysWxYLSJvf88lwKAUrdsrw3Y0/ChVhuvDmnUgOElu05+ytXBcLS5zf88hwJwYreMnw3I5AChZivPDmnUkOElm05u6sXBgLTZve8slxJQYrecrw3Y5AChZivPDlnUoOE1u15u6rXBcLS5vc9MlxJgYse8nw3Y5AChZivPDlnUoOE1u15u6rXBcLS5vc9MlxJgYse8nw3Y5AChZivPDlnUoO" preload="auto" />
      
      {/* Header */}
      <div className="bg-black/30 backdrop-blur-sm border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="h-8 w-8 text-white">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-sm font-bold text-white">{game.name}</h1>
              <span className="text-xs text-red-400 animate-pulse">● LIVE</span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setSoundEnabled(!soundEnabled)} className="h-8 w-8 text-white">
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Main Content - 3 Column Layout */}
      <div className="max-w-7xl mx-auto px-2 py-3">
        <div className="flex gap-2">
          
          {/* LEFT: Players Podium */}
          <div className="w-24 flex-shrink-0">
            <div className="bg-black/30 backdrop-blur-sm rounded-lg p-2 border border-white/10">
              <h3 className="text-[10px] font-bold text-amber-400 mb-2 text-center">TOP PLAYERS</h3>
              <div className="space-y-1.5">
                {topPlayers.length > 0 ? (
                  topPlayers.map((player, index) => (
                    <div
                      key={index}
                      className={`p-1.5 rounded text-center ${
                        index === 0 ? 'bg-amber-500/30 border border-amber-500/50' :
                        index === 1 ? 'bg-gray-400/20 border border-gray-400/30' :
                        index === 2 ? 'bg-orange-600/20 border border-orange-600/30' :
                        'bg-white/5 border border-white/10'
                      }`}
                    >
                      <div className="text-[10px] font-bold text-white truncate">{player.name}</div>
                      <div className={`text-[9px] font-semibold ${
                        index === 0 ? 'text-amber-400' :
                        index === 1 ? 'text-gray-300' :
                        index === 2 ? 'text-orange-400' :
                        'text-gray-400'
                      }`}>
                        {player.totalMarked} pts
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-[9px] text-gray-400 text-center">Loading...</p>
                )}
              </div>
            </div>
          </div>

          {/* CENTER: Number Calling */}
          <div className="flex-1">
            {/* Current Number Ball */}
            <div className="flex justify-center mb-3">
              <div className="relative">
                {/* Main Ball */}
                <div className={`w-28 h-28 rounded-full bg-gradient-to-br ${getBallColor(session.current_number)} flex items-center justify-center shadow-2xl`}
                  style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.5), inset 0 -10px 30px rgba(0,0,0,0.3), inset 0 10px 30px rgba(255,255,255,0.3)' }}
                >
                  {/* White circle inside */}
                  <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-inner">
                    <span className="text-4xl font-black text-gray-900">{session.current_number || '?'}</span>
                  </div>
                </div>
                {/* Highlight */}
                <div className="absolute top-3 left-6 w-8 h-8 bg-white/40 rounded-full blur-xl" />
              </div>
            </div>

            {/* Call Name */}
            {session.current_number && (
              <p className="text-center text-amber-400 font-semibold text-sm mb-3">
                {getCallName(session.current_number)}
              </p>
            )}

            {/* Numbers Called Counter */}
            <div className="text-center mb-3">
              <span className="px-3 py-1 bg-black/40 rounded-full text-xs text-white">
                <span className="text-amber-400 font-bold">{session.called_numbers?.length || 0}</span>/90 Numbers
              </span>
            </div>

            {/* Called Numbers - Last 10 in One Line */}
            <div className="bg-black/30 backdrop-blur-sm rounded-lg p-2 border border-white/10 mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-gray-400">Last Called</span>
                <span className="text-[10px] text-amber-400">{session.called_numbers?.length || 0}/90</span>
              </div>
              <div className="flex gap-1.5 overflow-x-auto">
                {session.called_numbers && session.called_numbers.length > 0 ? (
                  [...session.called_numbers].reverse().slice(0, 10).map((num, index) => (
                    <div
                      key={num}
                      className={`w-8 h-8 flex-shrink-0 rounded-full bg-gradient-to-br ${getBallColor(num)} flex items-center justify-center text-[10px] font-bold text-white shadow-md ${
                        index === 0 ? 'ring-2 ring-white scale-110' : ''
                      }`}
                    >
                      {num}
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] text-gray-400">No numbers called yet</p>
                )}
              </div>
            </div>

            {/* My Tickets with Zoom Control */}
            {myTickets.length > 0 && (
              <div className="bg-black/30 backdrop-blur-sm rounded-lg p-2 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-white">My Tickets ({myTickets.length})</h3>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setTicketZoom(Math.max(1, ticketZoom - 1))}
                      disabled={ticketZoom <= 1}
                      className="h-6 w-6 text-white hover:bg-white/10"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </Button>
                    <span className="text-[10px] text-gray-400 w-8 text-center">
                      {ticketZoom === 1 ? 'S' : ticketZoom === 2 ? 'M' : 'L'}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setTicketZoom(Math.min(3, ticketZoom + 1))}
                      disabled={ticketZoom >= 3}
                      className="h-6 w-6 text-white hover:bg-white/10"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                {/* Tickets Grid - responsive based on zoom level */}
                <div className={`grid gap-2 ${
                  ticketZoom === 1 ? 'grid-cols-4' : 
                  ticketZoom === 2 ? 'grid-cols-2' : 
                  'grid-cols-1'
                }`}>
                  {myTickets.map((ticket) => (
                    <div 
                      key={ticket.ticket_id} 
                      className={`bg-amber-50 rounded-lg transition-all duration-300 ${
                        ticketZoom === 1 ? 'p-1' : ticketZoom === 2 ? 'p-1.5' : 'p-3'
                      }`}
                    >
                      <p className={`font-bold text-amber-700 mb-1 ${
                        ticketZoom === 1 ? 'text-[6px]' : ticketZoom === 2 ? 'text-[8px]' : 'text-xs'
                      }`}>
                        {ticket.ticket_number}
                      </p>
                      <div className="grid grid-cols-9 gap-px">
                        {ticket.numbers.map((row, rowIndex) => (
                          row.map((num, colIndex) => {
                            const isMarked = num && markedNumbers.has(num);
                            return (
                              <div
                                key={`${rowIndex}-${colIndex}`}
                                className={`flex items-center justify-center font-bold rounded-sm transition-all ${
                                  ticketZoom === 1 
                                    ? 'aspect-square text-[5px]' 
                                    : ticketZoom === 2 
                                    ? 'aspect-square text-[7px]' 
                                    : 'aspect-[1.2/1] text-sm py-1'
                                } ${
                                  num === null
                                    ? 'bg-amber-100'
                                    : isMarked
                                    ? 'bg-green-500 text-white'
                                    : 'bg-white text-gray-800 border border-gray-200'
                                }`}
                              >
                                {num || ''}
                              </div>
                            );
                          })
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Dividends */}
          <div className="w-28 flex-shrink-0">
            <div className="bg-black/30 backdrop-blur-sm rounded-lg p-2 border border-white/10">
              <div className="flex items-center gap-1 mb-2">
                <Trophy className="w-3 h-3 text-amber-500" />
                <h3 className="text-[10px] font-bold text-white">PRIZES</h3>
              </div>
              <div className="space-y-1">
                {game.prizes && Object.entries(game.prizes).map(([prize, amount]) => {
                  const winner = session.winners?.[prize];
                  return (
                    <div
                      key={prize}
                      className={`p-1.5 rounded border text-[9px] ${
                        winner
                          ? 'bg-green-500/20 border-green-500/40'
                          : 'bg-white/5 border-white/10'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-gray-300 truncate">{prize}</span>
                        <span className="text-amber-400 font-bold">₹{amount}</span>
                      </div>
                      {winner && (
                        <p className="text-green-400 text-[8px] mt-0.5 truncate">🏆 {winner.user_name}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
