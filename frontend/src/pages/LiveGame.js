import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, TrendingUp } from 'lucide-react';
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
  const [top5Players, setTop5Players] = useState([]);
  const [previousWinners, setPreviousWinners] = useState({});
  const pollInterval = useRef(null);
  const audioRef = useRef(null);

  // Confetti celebration function
  const celebrateWinner = (prizeType) => {
    // Confetti burst
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#FCD34D', '#F59E0B', '#D97706', '#10B981']
    });
    
    // Fireworks effect
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

    function randomInRange(min, max) {
      return Math.random() * (max - min) + min;
    }

    const interval = setInterval(function() {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      
      // Fireworks from different positions
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: ['#FCD34D', '#F59E0B']
      });
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: ['#10B981', '#34D399']
      });
    }, 250);
    
    // Show toast notification
    toast.success(`🎉 ${prizeType} Winner Declared!`, {
      duration: 5000,
      style: {
        background: 'linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%)',
        color: '#000',
        fontWeight: 'bold'
      }
    });
  };

  // Play number call sound
  const playNumberSound = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(e => console.log('Audio play failed:', e));
    }
  };

  useEffect(() => {
    fetchGameData();
    fetchMyTickets();
    fetchAllBookedTickets();

    // Poll for updates every 3 seconds
    pollInterval.current = setInterval(() => {
      fetchSession();
      calculateTop5Players();
    }, 3000);

    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    };
  }, [gameId]);

  useEffect(() => {
    if (session && session.called_numbers) {
      setMarkedNumbers(new Set(session.called_numbers));
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

  const calculateTop5Players = () => {
    if (!session || !allBookedTickets.length) return;

    const calledSet = new Set(session.called_numbers);
    const playerProgress = {};

    allBookedTickets.forEach(ticket => {
      const userId = ticket.user_id;
      if (!userId) return;

      let markedCount = 0;
      ticket.numbers.forEach(row => {
        row.forEach(num => {
          if (num && calledSet.has(num)) {
            markedCount++;
          }
        });
      });

      if (!playerProgress[userId]) {
        playerProgress[userId] = {
          userId,
          totalMarked: 0,
          ticketsCount: 0
        };
      }
      playerProgress[userId].totalMarked += markedCount;
      playerProgress[userId].ticketsCount += 1;
    });

    // Sort by total marked numbers
    const sortedPlayers = Object.values(playerProgress)
      .sort((a, b) => b.totalMarked - a.totalMarked)
      .slice(0, 5);

    setTop5Players(sortedPlayers);
  };

  if (!game || !session) {
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
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>
              {game.name}
            </h1>
            <p className="text-sm text-gray-400">Live Game</p>
          </div>
          <span className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
            LIVE
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Game Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Current Number - 3D Ball */}
            <div className="glass-card p-8 text-center" data-testid="current-number-display">
              <p className="text-amber-500 text-sm font-bold mb-4">CURRENT CALL</p>
              
              {/* 3D Tambola Ball */}
              <div className="relative w-48 h-48 mx-auto mb-6">
                {/* 3D Ball */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-orange-400 via-amber-500 to-orange-600 shadow-2xl" style={{
                  boxShadow: '0 30px 80px rgba(251, 146, 60, 0.8), inset 0 -15px 40px rgba(0,0,0,0.3), inset 0 15px 40px rgba(255,255,255,0.2)'
                }}>
                  {/* Shine effect */}
                  <div className="absolute top-8 left-12 w-20 h-20 bg-white rounded-full opacity-40 blur-2xl"></div>
                  {/* Current Number */}
                  <div className="absolute inset-0 flex items-center justify-center number-call-animation">
                    <span className="text-7xl font-black text-white number-font" style={{
                      textShadow: '3px 3px 6px rgba(0,0,0,0.6)'
                    }} data-testid="current-number">
                      {session.current_number || '--'}
                    </span>
                  </div>
                </div>
                {/* Shadow */}
                <div className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 w-40 h-8 bg-black opacity-40 rounded-full blur-2xl"></div>
              </div>
              
              {/* Call Name */}
              {session.current_number && (
                <p className="text-2xl text-gray-300 font-medium">
                  {getCallName(session.current_number).split(' - ')[1] || ''}
                </p>
              )}
            </div>

            {/* Called Numbers - Just below current call */}
            <div className="glass-card p-6" data-testid="called-numbers-section">
              <h3 className="text-lg font-bold text-white mb-4">Called Numbers ({session.called_numbers.length}/90)</h3>
              <div className="flex flex-wrap gap-2">
                {session.called_numbers && session.called_numbers.length > 0 ? (
                  session.called_numbers.map((num) => (
                    <div
                      key={num}
                      className="w-12 h-12 flex items-center justify-center bg-amber-500 text-black font-bold rounded-lg number-font"
                      data-testid={`called-number-${num}`}
                    >
                      {num}
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400">No numbers called yet</p>
                )}
              </div>
            </div>

            {/* My Tickets - Scrollable */}
            {myTickets.length > 0 && (
              <div data-testid="my-tickets-section">
                <h3 className="text-xl font-bold text-white mb-4">My Tickets</h3>
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                  {myTickets.map((ticket) => (
                    <div key={ticket.ticket_id} className="glass-card p-6" data-testid={`live-ticket-${ticket.ticket_id}`}>
                      <p className="text-xs font-bold text-amber-500 mb-3">{ticket.ticket_number}</p>
                      <div className="ticket-grid">
                        {ticket.numbers.map((row, rowIndex) => (
                          row.map((num, colIndex) => {
                            const isMarked = num && markedNumbers.has(num);
                            return (
                              <div
                                key={`${rowIndex}-${colIndex}`}
                                className={`ticket-cell ${
                                  num === null ? 'empty' : isMarked ? 'marked' : ''
                                }`}
                                data-testid={isMarked ? `marked-cell-${num}` : undefined}
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

          {/* Right Sidebar */}
          <div className="space-y-6">
            {/* Dividends (Prizes) */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Trophy className="w-6 h-6 text-amber-500" />
                <h3 className="text-xl font-bold text-white">Dividends</h3>
              </div>
              <div className="space-y-3" data-testid="dividends-list">
                {game.prizes && Object.entries(game.prizes).map(([prize, amount]) => {
                  const winner = session.winners?.[prize];
                  return (
                    <div key={prize} className={`p-3 rounded-lg border ${
                      winner 
                        ? 'bg-green-500/10 border-green-500/30' 
                        : 'bg-amber-500/5 border-amber-500/20'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-white">{prize}</span>
                        <span className="text-sm font-bold text-amber-500">₹{amount.toLocaleString()}</span>
                      </div>
                      {winner && (
                        <div className="mt-2 pt-2 border-t border-green-500/30">
                          <p className="text-xs text-green-400 font-medium" data-testid={`winner-${prize}`}>
                            🏆 {winner.user_name}
                          </p>
                          <p className="text-xs text-gray-500">{winner.ticket_id}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top 5 Players About to Win */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-6 h-6 text-emerald-500" />
                <h3 className="text-xl font-bold text-white">Top 5 Players</h3>
              </div>
              <div className="space-y-2" data-testid="top-players-list">
                {top5Players.length > 0 ? (
                  top5Players.map((player, index) => (
                    <div key={player.userId} className="flex items-center justify-between p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 flex items-center justify-center bg-emerald-500 text-white text-xs font-bold rounded-full">
                          #{index + 1}
                        </span>
                        <span className="text-sm text-white font-medium">
                          Player {player.userId.slice(-4)}
                        </span>
                      </div>
                      <span className="text-xs text-emerald-400 font-bold">
                        {player.totalMarked} marked
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-400 text-sm">Calculating rankings...</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
