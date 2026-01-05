import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Calendar, Users, Play, Settings, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function MyUserGames() {
  const navigate = useNavigate();
  const [games, setGames] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMyGames();
  }, []);

  const fetchMyGames = async () => {
    try {
      const response = await axios.get(`${API}/user-games/my`, { withCredentials: true });
      setGames(response.data);
    } catch (error) {
      console.error('Failed to fetch games:', error);
      toast.error('Failed to load your games');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (gameId, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this game?')) return;
    
    try {
      await axios.delete(`${API}/user-games/${gameId}`, { withCredentials: true });
      toast.success('Game deleted');
      setGames(games.filter(g => g.user_game_id !== gameId));
    } catch (error) {
      toast.error('Failed to delete game');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      upcoming: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      live: 'bg-red-500/20 text-red-400 border-red-500/30 animate-pulse',
      completed: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    };
    return styles[status] || styles.upcoming;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c]">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c]">
      {/* Header */}
      <div className="bg-[#121216] border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-6 h-6" />
            </Button>
            <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>
              My Games
            </h1>
          </div>
          <Button
            onClick={() => navigate('/create-game')}
            className="rounded-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
          >
            <Plus className="w-4 h-4 mr-2" /> New Game
          </Button>
        </div>
      </div>

      {/* Games List */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {games.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">No games yet</h2>
            <p className="text-gray-400 mb-6">Create your first Six Seven Tambola game for family & friends!</p>
            <Button
              onClick={() => navigate('/create-game')}
              className="rounded-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
            >
              <Plus className="w-4 h-4 mr-2" /> Create Game
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {games.map((game) => (
              <div
                key={game.user_game_id}
                className="glass-card p-5 hover-lift cursor-pointer"
                onClick={() => navigate(`/my-games/${game.user_game_id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-white">{game.name}</h3>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getStatusBadge(game.status)}`}>
                        {game.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4 text-amber-500" />
                        {game.date} at {game.time}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4 text-amber-500" />
                        {game.players?.length || 0} players
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleDelete(game.user_game_id, e)}
                      className="text-gray-400 hover:text-red-400"
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                    {game.status === 'live' && (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/user-game-play/${game.user_game_id}`);
                        }}
                        className="bg-red-500 hover:bg-red-600 text-white text-sm px-3 py-1 animate-pulse"
                      >
                        <Play className="w-4 h-4 mr-1" /> Join Live
                      </Button>
                    )}
                    {game.status === 'upcoming' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-400 hover:text-white"
                      >
                        <Settings className="w-5 h-5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
