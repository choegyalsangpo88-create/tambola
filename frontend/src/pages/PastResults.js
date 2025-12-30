import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, Calendar, Award } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function PastResults() {
  const navigate = useNavigate();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPastResults();
  }, []);

  const fetchPastResults = async () => {
    try {
      // Fetch archived completed games (older than 5 mins) with winners
      const response = await axios.get(`${API}/games/completed`);
      setResults(response.data);
    } catch (error) {
      console.error('Failed to fetch past results:', error);
      toast.error('Failed to load past results');
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
            <p className="text-xs text-gray-400">Last 20 completed games</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {results.length === 0 ? (
          <div className="glass-card p-8 text-center" data-testid="no-results-message">
            <Trophy className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg mb-2">No past results yet</p>
            <p className="text-gray-500 text-sm mb-6">Completed games will appear here</p>
          </div>
        ) : (
          <div className="space-y-4" data-testid="results-list">
            {results.map((result) => (
              <div key={result.game_id} className="glass-card p-6 hover-lift" data-testid={`result-${result.game_id}`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">{result.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Calendar className="w-4 h-4" />
                      <span>{result.date} at {result.time}</span>
                    </div>
                    <p className="text-sm text-amber-500 font-bold mt-2">
                      Prize Pool: ₹{result.prize_pool.toLocaleString()}
                    </p>
                  </div>
                  <span className="px-3 py-1 text-xs font-bold rounded-full bg-gray-500 text-white">
                    COMPLETED
                  </span>
                </div>

                {/* Winners */}
                {Object.keys(result.winners).length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <div className="flex items-center gap-2 mb-3">
                      <Award className="w-5 h-5 text-amber-500" />
                      <h4 className="text-sm font-bold text-white">Winners</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {Object.entries(result.winners).map(([prize, winner]) => (
                        <div key={prize} className="flex items-center justify-between p-2 bg-amber-500/10 rounded-lg border border-amber-500/30">
                          <span className="text-xs text-gray-400">{prize}</span>
                          <span className="text-sm text-white font-medium" data-testid={`winner-${prize}`}>
                            {winner.user_name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
