import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function LiveGame() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [session, setSession] = useState(null);
  const [myTickets, setMyTickets] = useState([]);
  const [markedNumbers, setMarkedNumbers] = useState(new Set());
  const pollInterval = useRef(null);

  useEffect(() => {
    fetchGameData();
    fetchMyTickets();

    // Poll for updates every 3 seconds
    pollInterval.current = setInterval(() => {
      fetchSession();
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
            {/* Current Number */}
            <div className="glass-card p-8 text-center" data-testid="current-number-display">
              <p className="text-amber-500 text-sm font-bold mb-2">CURRENT NUMBER</p>
              <div className="number-call-animation">
                <p
                  className="text-6xl md:text-8xl font-black text-white number-font"
                  style={{
                    textShadow: '0 0 15px rgba(234, 179, 8, 0.5)'
                  }}
                  data-testid="current-number"
                >
                  {session.current_number || '--'}
                </p>
              </div>
            </div>

            {/* My Tickets */}
            {myTickets.length > 0 ? (
              <div data-testid="my-tickets-section">
                <h3 className="text-xl font-bold text-white mb-4">My Tickets</h3>
                <div className="space-y-4">
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
            ) : (
              <div className="glass-card p-8 text-center">
                <p className="text-gray-400">You don't have any confirmed tickets for this game</p>
              </div>
            )}

            {/* Called Numbers */}
            <div className="glass-card p-6" data-testid="called-numbers-section">
              <h3 className="text-lg font-bold text-white mb-4">Called Numbers</h3>
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
          </div>

          {/* Winners Sidebar */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-6 h-6 text-amber-500" />
              <h3 className="text-xl font-bold text-white">Winners</h3>
            </div>
            <div className="space-y-3" data-testid="winners-list">
              {session.winners && Object.keys(session.winners).length > 0 ? (
                Object.entries(session.winners).map(([prize, winner]) => (
                  <div key={prize} className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/30">
                    <p className="text-sm font-bold text-amber-500">{prize}</p>
                    <p className="text-white font-medium" data-testid={`winner-${prize}`}>{winner.user_name}</p>
                    <p className="text-xs text-gray-400">{winner.ticket_id}</p>
                  </div>
                ))
              ) : (
                <p className="text-gray-400 text-sm">No winners yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
