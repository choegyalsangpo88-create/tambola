import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, Calendar, Award, Hash, Users, Ticket, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Component to display a winning ticket
function WinningTicket({ ticket, calledNumbers }) {
  if (!ticket?.ticket_numbers) return null;
  
  return (
    <div className="bg-white rounded-lg p-2 mt-2" style={{ border: '2px solid #D4A017' }}>
      <div className="text-[10px] font-bold text-black text-center mb-1 bg-gray-100 py-0.5 rounded">
        TICKET #{ticket.ticket_number}
      </div>
      <div className="grid grid-cols-9 gap-0">
        {ticket.ticket_numbers?.map((row, rowIdx) => (
          row.map((num, colIdx) => {
            const isCalled = num && calledNumbers?.includes(num);
            return (
              <div
                key={`${rowIdx}-${colIdx}`}
                className="flex items-center justify-center border border-gray-200"
                style={{
                  height: '20px',
                  fontSize: '10px',
                  fontWeight: 'bold',
                  backgroundColor: isCalled ? '#22c55e' : 'white',
                  color: isCalled ? 'white' : '#000'
                }}
              >
                {num || ''}
              </div>
            );
          })
        ))}
      </div>
    </div>
  );
}

// Component to display called numbers board
function CalledNumbersBoard({ calledNumbers }) {
  // Create 1-90 grid
  const numbers = Array.from({ length: 90 }, (_, i) => i + 1);
  
  return (
    <div className="grid grid-cols-10 gap-1">
      {numbers.map(num => {
        const isCalled = calledNumbers?.includes(num);
        const callIndex = calledNumbers?.indexOf(num);
        return (
          <div
            key={num}
            className={`
              w-7 h-7 flex items-center justify-center rounded text-xs font-bold
              ${isCalled ? 'bg-green-500 text-white' : 'bg-white/10 text-gray-500'}
            `}
            title={isCalled ? `Called #${callIndex + 1}` : 'Not called'}
          >
            {num}
          </div>
        );
      })}
    </div>
  );
}

export default function PastResults() {
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedGame, setExpandedGame] = useState(null);
  const [gameDetails, setGameDetails] = useState({});
  const [loadingDetails, setLoadingDetails] = useState({});

  useEffect(() => {
    fetchPastResults();
  }, []);

  const fetchPastResults = async () => {
    try {
      const response = await axios.get(`${API}/games/completed`);
      setResults(response.data);
    } catch (error) {
      console.error('Failed to fetch past results:', error);
      toast.error('Failed to load past results');
    } finally {
      setLoading(false);
    }
  };

  const fetchGameDetails = async (gameId) => {
    if (gameDetails[gameId]) {
      setExpandedGame(expandedGame === gameId ? null : gameId);
      return;
    }
    
    setLoadingDetails(prev => ({ ...prev, [gameId]: true }));
    try {
      const response = await axios.get(`${API}/games/${gameId}/results`);
      setGameDetails(prev => ({ ...prev, [gameId]: response.data }));
      setExpandedGame(gameId);
    } catch (error) {
      console.error('Failed to fetch game details:', error);
      toast.error('Failed to load game details');
    } finally {
      setLoadingDetails(prev => ({ ...prev, [gameId]: false }));
    }
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
          <div>
            <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Past Results
            </h1>
            <p className="text-xs text-gray-400">View completed games and winners</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        {results.length === 0 ? (
          <div className="glass-card p-8 text-center" data-testid="no-results-message">
            <Trophy className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg mb-2">No past results yet</p>
            <p className="text-gray-500 text-sm mb-6">Completed games will appear here</p>
          </div>
        ) : (
          <div className="space-y-4" data-testid="results-list">
            {results.map((result) => {
              const isExpanded = expandedGame === result.game_id;
              const details = gameDetails[result.game_id];
              const isLoadingThis = loadingDetails[result.game_id];
              
              return (
                <div 
                  key={result.game_id} 
                  className="glass-card overflow-hidden"
                  data-testid={`result-${result.game_id}`}
                >
                  {/* Game Header - Always visible */}
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-xl font-bold text-white mb-1">{result.name}</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <Calendar className="w-4 h-4" />
                          <span>{result.date} at {result.time}</span>
                        </div>
                      </div>
                      <span className="px-3 py-1 text-xs font-bold rounded-full bg-emerald-500/20 text-emerald-400">
                        COMPLETED
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-sm text-amber-500 font-bold">
                        Prize Pool: ₹{result.prize_pool?.toLocaleString()}
                      </p>
                      <Button
                        onClick={() => fetchGameDetails(result.game_id)}
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                        disabled={isLoadingThis}
                      >
                        {isLoadingThis ? (
                          <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Eye className="w-3 h-3 mr-1" />
                            {isExpanded ? 'Hide Details' : 'View Details'}
                            {isExpanded ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Quick Winners Preview */}
                    {Object.keys(result.winners || {}).length > 0 && !isExpanded && (
                      <div className="mt-3 pt-3 border-t border-white/10">
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(result.winners).slice(0, 4).map(([prize, winner]) => (
                            <span 
                              key={prize} 
                              className="px-2 py-1 text-[10px] bg-amber-500/10 text-amber-400 rounded-full"
                            >
                              {prize}: {winner.user_name}
                            </span>
                          ))}
                          {Object.keys(result.winners).length > 4 && (
                            <span className="px-2 py-1 text-[10px] bg-white/5 text-gray-400 rounded-full">
                              +{Object.keys(result.winners).length - 4} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && details && (
                    <div className="border-t border-white/10 bg-black/20">
                      {/* Game Stats */}
                      <div className="p-4 grid grid-cols-4 gap-3">
                        <div className="text-center p-3 bg-white/5 rounded-lg">
                          <Hash className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                          <p className="text-lg font-bold text-white">{details.total_called}</p>
                          <p className="text-[10px] text-gray-400">Numbers Called</p>
                        </div>
                        <div className="text-center p-3 bg-white/5 rounded-lg">
                          <Trophy className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                          <p className="text-lg font-bold text-white">{Object.keys(details.winners || {}).length}</p>
                          <p className="text-[10px] text-gray-400">Winners</p>
                        </div>
                        <div className="text-center p-3 bg-white/5 rounded-lg">
                          <Ticket className="w-5 h-5 text-green-400 mx-auto mb-1" />
                          <p className="text-lg font-bold text-white">{details.booked_tickets}</p>
                          <p className="text-[10px] text-gray-400">Tickets Sold</p>
                        </div>
                        <div className="text-center p-3 bg-white/5 rounded-lg">
                          <Users className="w-5 h-5 text-purple-400 mx-auto mb-1" />
                          <p className="text-lg font-bold text-white">{details.total_bookings}</p>
                          <p className="text-[10px] text-gray-400">Players</p>
                        </div>
                      </div>

                      {/* Winners with Tickets */}
                      {Object.keys(details.winners || {}).length > 0 && (
                        <div className="px-4 pb-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Award className="w-5 h-5 text-amber-500" />
                            <h4 className="text-sm font-bold text-white">Winners & Winning Tickets</h4>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {Object.entries(details.winners).map(([prize, winner]) => (
                              <div 
                                key={prize} 
                                className="p-3 bg-gradient-to-br from-amber-500/10 to-amber-600/5 rounded-xl border border-amber-500/30"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-bold text-amber-400">{prize}</span>
                                  <span className="text-xs text-white bg-amber-500/20 px-2 py-0.5 rounded">
                                    ₹{result.prizes?.[prize]?.toLocaleString() || 0}
                                  </span>
                                </div>
                                <p className="text-white font-semibold text-sm">{winner.user_name}</p>
                                <WinningTicket ticket={winner} calledNumbers={details.called_numbers} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Called Numbers Board */}
                      <div className="px-4 pb-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Hash className="w-5 h-5 text-blue-400" />
                          <h4 className="text-sm font-bold text-white">Called Numbers ({details.total_called}/90)</h4>
                        </div>
                        <div className="bg-white/5 rounded-xl p-3">
                          <CalledNumbersBoard calledNumbers={details.called_numbers} />
                        </div>
                        
                        {/* Call Order */}
                        {details.called_numbers?.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs text-gray-400 mb-2">Call Order:</p>
                            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                              {details.called_numbers.map((num, idx) => (
                                <span 
                                  key={idx} 
                                  className="w-6 h-6 flex items-center justify-center bg-green-500/20 text-green-400 text-[10px] font-bold rounded"
                                  title={`Call #${idx + 1}`}
                                >
                                  {num}
                                </span>
                              ))}
                            </div>
                          </div>
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
    </div>
  );
}
