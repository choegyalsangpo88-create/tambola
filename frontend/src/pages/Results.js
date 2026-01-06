import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Trophy, Calendar, Users, ArrowLeft, Award, Clock, Eye, X } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Results() {
  const [completedGames, setCompletedGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [gameSession, setGameSession] = useState(null);
  const [gameTickets, setGameTickets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedWinnerTicket, setSelectedWinnerTicket] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCompletedGames();
  }, []);

  const fetchCompletedGames = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get(`${API}/games/completed`);
      setCompletedGames(response.data || []);
    } catch (error) {
      // Try fallback to all games and filter
      try {
        const response = await axios.get(`${API}/games`);
        const games = response.data || [];
        setCompletedGames(games.filter(g => g.status === 'completed'));
      } catch (e) {
        console.error('Failed to fetch games:', e);
        toast.error('Failed to load results');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchGameDetails = async (game) => {
    try {
      const [sessionResponse, ticketsResponse] = await Promise.all([
        axios.get(`${API}/games/${game.game_id}/session`),
        axios.get(`${API}/games/${game.game_id}/tickets?page=1&limit=600`).catch(() => ({ data: { tickets: [] } }))
      ]);
      setGameSession(sessionResponse.data);
      setGameTickets(ticketsResponse.data.tickets || []);
      setSelectedGame(game);
    } catch (error) {
      console.error('Failed to fetch game details:', error);
      toast.error('Failed to load game results');
    }
  };

  // Find winning ticket by ticket_id or ticket_number
  const findWinningTicket = (winner) => {
    if (!winner) return null;
    return gameTickets.find(t => 
      t.ticket_id === winner.ticket_id || 
      t.ticket_number === winner.ticket_number
    );
  };

  // Get ball color based on number range
  const getBallColor = (num) => {
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

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
      });
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Game Details View
  if (selectedGame && gameSession) {
    const winners = gameSession.winners || {};
    const totalNumbers = gameSession.called_numbers?.length || 0;

    return (
      <div className="min-h-screen bg-[#0a0a0c]">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-900/50 to-teal-900/50 border-b border-emerald-500/30 sticky top-0 z-50">
          <div className="max-w-4xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { setSelectedGame(null); setGameSession(null); }}
                  className="h-8 w-8 text-white"
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                  <h1 className="text-lg font-bold text-white">{selectedGame.name}</h1>
                  <p className="text-xs text-emerald-400">Game Results</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-emerald-500 text-white text-xs font-bold rounded-full">
                COMPLETED
              </span>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          {/* Game Summary */}
          <div className="bg-[#1a1a1e] rounded-xl p-6 border border-white/10">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              Game Summary
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-amber-400">₹{selectedGame.prize_pool?.toLocaleString()}</p>
                <p className="text-xs text-gray-400">Prize Pool</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-emerald-400">{totalNumbers}</p>
                <p className="text-xs text-gray-400">Numbers Called</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-purple-400">{Object.keys(winners).length}</p>
                <p className="text-xs text-gray-400">Winners</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3 text-center">
                <p className="text-sm font-bold text-gray-300">{selectedGame.date}</p>
                <p className="text-xs text-gray-400">{selectedGame.time}</p>
              </div>
            </div>
          </div>

          {/* Winners List */}
          <div className="bg-[#1a1a1e] rounded-xl p-6 border border-white/10">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              Winners
            </h2>
            
            {Object.keys(winners).length === 0 ? (
              <p className="text-gray-400 text-center py-4">No winners recorded</p>
            ) : (
              <div className="space-y-3">
                {selectedGame.prizes && Object.entries(selectedGame.prizes).map(([prize, amount]) => {
                  const winner = winners[prize];
                  return (
                    <div 
                      key={prize} 
                      className={`rounded-lg p-4 ${winner ? 'bg-gradient-to-r from-emerald-900/30 to-teal-900/30 border border-emerald-500/30' : 'bg-white/5'}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className={`font-semibold ${winner ? 'text-emerald-400' : 'text-gray-400'}`}>
                            {prize}
                          </p>
                          {winner ? (
                            <p className="text-white text-lg font-bold mt-1">
                              🏆 {winner.holder_name || winner.name || 'Winner'}
                            </p>
                          ) : (
                            <p className="text-gray-500 text-sm mt-1">Not claimed</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-amber-400 font-bold text-xl">₹{amount}</p>
                          {winner?.ticket_number && (
                            <p className="text-xs text-gray-400">Ticket: {winner.ticket_number}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Called Numbers */}
          <div className="bg-[#1a1a1e] rounded-xl p-6 border border-white/10">
            <h2 className="text-lg font-bold text-white mb-4">All Called Numbers</h2>
            <div className="flex flex-wrap gap-2">
              {gameSession.called_numbers?.map((num, idx) => (
                <div 
                  key={num}
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-xs font-bold text-white shadow-md"
                >
                  {num}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Results List View
  return (
    <div className="min-h-screen bg-[#0a0a0c]">
      {/* Header */}
      <div className="bg-[#121216] border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="h-8 w-8 text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold text-white">Game Results</h1>
              <p className="text-xs text-gray-400">View past game winners</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {completedGames.length === 0 ? (
          <div className="bg-[#1a1a1e] rounded-xl p-8 text-center border border-white/10">
            <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No completed games yet</p>
            <p className="text-sm text-gray-500 mt-2">Results will appear here after games end</p>
          </div>
        ) : (
          <div className="space-y-4">
            {completedGames.map((game) => (
              <div
                key={game.game_id}
                onClick={() => fetchGameDetails(game)}
                className="bg-[#1a1a1e] rounded-xl p-5 border border-white/10 hover:border-emerald-500/50 cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-white">{game.name}</h3>
                  <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded">
                    COMPLETED
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {game.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {game.time}
                  </span>
                  <span className="flex items-center gap-1 text-amber-400">
                    <Award className="w-4 h-4" />
                    ₹{game.prize_pool?.toLocaleString()}
                  </span>
                </div>
                <p className="text-emerald-400 text-xs mt-3">Tap to view winners →</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
