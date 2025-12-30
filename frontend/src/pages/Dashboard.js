import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Home, Ticket, User, Trophy, Calendar, Users, Award, Plus, QrCode, X } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [liveGames, setLiveGames] = useState([]);
  const [upcomingGames, setUpcomingGames] = useState([]);
  const [activeTab, setActiveTab] = useState('home');
  const navigate = useNavigate();

  useEffect(() => {
    fetchUser();
    fetchGames();
  }, []);

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, { withCredentials: true });
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
    }
  };

  const fetchGames = async () => {
    try {
      const response = await axios.get(`${API}/games`);
      const games = response.data;
      setLiveGames(games.filter(g => g.status === 'live'));
      setUpcomingGames(games.filter(g => g.status === 'upcoming'));
    } catch (error) {
      console.error('Failed to fetch games:', error);
      toast.error('Failed to load games');
    }
  };

  const handleNavigation = (path) => {
    navigate(path);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c]">
      {/* Header */}
      <div className="bg-[#121216] border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>
              Tambola
            </h1>
            {user && (
              <p className="text-sm text-gray-400">Hello, {user.name}!</p>
            )}
          </div>
          <Button
            data-testid="profile-button"
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={() => handleNavigation('/profile')}
          >
            <User className="w-6 h-6 text-amber-500" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Create Your Own Game CTA */}
        <div className="mb-8">
          <div 
            className="glass-card p-6 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 hover-lift cursor-pointer"
            onClick={() => navigate('/create-game')}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 flex items-center justify-center">
                  <Users className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-1">Create Your Own Tambola</h3>
                  <p className="text-sm text-gray-400">Host a game for family & friends - No signup needed for players!</p>
                </div>
              </div>
              <Button className="rounded-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 hidden md:flex">
                <Plus className="w-4 h-4 mr-2" /> Create Game
              </Button>
            </div>
          </div>
        </div>

        {/* Live Games */}
        {liveGames.length > 0 && (
          <div className="mb-10" data-testid="live-games-section">
            <h2 className="text-2xl md:text-3xl font-semibold text-white mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>
              <Trophy className="inline w-7 h-7 text-amber-500 mr-2" />
              Live Games
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {liveGames.map((game) => (
                <div
                  key={game.game_id}
                  className="glass-card p-6 min-w-[300px] hover-lift cursor-pointer"
                  data-testid={`live-game-${game.game_id}`}
                  onClick={() => navigate(`/live/${game.game_id}`)}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-white">{game.name}</h3>
                    <span className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
                      LIVE
                    </span>
                  </div>
                  <p className="text-gray-400 text-sm mb-4">
                    Prize Pool: ₹{game.prize_pool.toLocaleString()}
                  </p>
                  <Button
                    data-testid={`join-live-game-${game.game_id}`}
                    className="w-full rounded-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 font-bold"
                  >
                    Join Now
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Games */}
        <div data-testid="upcoming-games-section">
          <h2 className="text-2xl md:text-3xl font-semibold text-white mb-6" style={{ fontFamily: 'Outfit, sans-serif' }}>
            <Calendar className="inline w-7 h-7 text-amber-500 mr-2" />
            Upcoming Games
          </h2>
          {upcomingGames.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <p className="text-gray-400">No upcoming games at the moment</p>
              <p className="text-sm text-gray-500 mt-2">Check back soon!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {upcomingGames.map((game) => (
                <div
                  key={game.game_id}
                  className="glass-card p-6 hover-lift cursor-pointer"
                  data-testid={`upcoming-game-${game.game_id}`}
                  onClick={() => navigate(`/game/${game.game_id}`)}
                >
                  <h3 className="text-xl font-bold text-white mb-3">{game.name}</h3>
                  <div className="space-y-2 text-sm text-gray-400 mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-amber-500" />
                      <span>{game.date} at {game.time}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-500" />
                      <span>Prize Pool: ₹{game.prize_pool.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-amber-500" />
                      <span>{game.available_tickets}/{game.ticket_count} Available</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Ticket className="w-4 h-4 text-amber-500" />
                      <span>₹{game.price} per ticket</span>
                    </div>
                  </div>
                  <Button
                    data-testid={`select-tickets-${game.game_id}`}
                    className="w-full rounded-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 font-bold"
                  >
                    Select Tickets
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#121216] border-t border-white/10 safe-area-pb">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-around">
          <button
            data-testid="nav-home"
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
              activeTab === 'home' ? 'text-amber-500' : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => setActiveTab('home')}
          >
            <Home className="w-5 h-5" />
            <span className="text-xs font-medium">Home</span>
          </button>
          <button
            data-testid="nav-my-games"
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
              activeTab === 'games' ? 'text-amber-500' : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => {
              setActiveTab('games');
              handleNavigation('/my-games');
            }}
          >
            <Users className="w-5 h-5" />
            <span className="text-xs font-medium">My Games</span>
          </button>
          <button
            data-testid="nav-my-tickets"
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
              activeTab === 'tickets' ? 'text-amber-500' : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => {
              setActiveTab('tickets');
              handleNavigation('/my-tickets');
            }}
          >
            <Ticket className="w-5 h-5" />
            <span className="text-xs font-medium">Tickets</span>
          </button>
          <button
            data-testid="nav-past-results"
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors ${
              activeTab === 'results' ? 'text-amber-500' : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => {
              setActiveTab('results');
              handleNavigation('/past-results');
            }}
          >
            <Trophy className="w-5 h-5" />
            <span className="text-xs font-medium">Results</span>
          </button>
        </div>
      </div>
    </div>
  );
}
