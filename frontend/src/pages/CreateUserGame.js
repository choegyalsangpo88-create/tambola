import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Users, Calendar, Clock, Trophy, Ticket } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Default dividends for user games (family/party style)
const DEFAULT_DIVIDENDS = {
  'Quick Five': { enabled: false, amount: 100, description: 'First to mark 5 numbers' },
  'Top Line': { enabled: true, amount: 200, description: 'Complete first row' },
  'Middle Line': { enabled: true, amount: 200, description: 'Complete middle row' },
  'Bottom Line': { enabled: true, amount: 200, description: 'Complete last row' },
  'Four Corners': { enabled: false, amount: 150, description: 'All 4 corner numbers' },
  'Full House': { enabled: true, amount: 500, description: 'Complete all numbers' },
  '2nd Full House': { enabled: false, amount: 300, description: 'Second to complete all' },
  '3rd Full House': { enabled: false, amount: 200, description: 'Third to complete all' },
};

export default function CreateUserGame() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    date: '',
    time: '',
    max_tickets: 30,
  });
  const [dividends, setDividends] = useState({ ...DEFAULT_DIVIDENDS });

  const toggleDividend = (name) => {
    setDividends(prev => ({
      ...prev,
      [name]: { ...prev[name], enabled: !prev[name].enabled }
    }));
  };

  const updateDividendAmount = (name, amount) => {
    setDividends(prev => ({
      ...prev,
      [name]: { ...prev[name], amount: parseInt(amount) || 0 }
    }));
  };

  const getEnabledPrizesDescription = () => {
    const enabled = Object.entries(dividends)
      .filter(([_, data]) => data.enabled)
      .map(([name, data]) => `${name}: ₹${data.amount}`)
      .join('\n');
    return enabled || 'No prizes selected';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.date || !formData.time) {
      toast.error('Please fill all required fields');
      return;
    }

    // Check if at least one dividend is enabled
    const hasEnabledDividend = Object.values(dividends).some(d => d.enabled);
    if (!hasEnabledDividend) {
      toast.error('Please select at least one prize');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(
        `${API}/user-games`,
        {
          ...formData,
          prizes_description: getEnabledPrizesDescription()
        },
        { withCredentials: true }
      );
      
      toast.success('Game created successfully!');
      navigate(`/my-games/${response.data.user_game_id}`);
    } catch (error) {
      console.error('Failed to create game:', error);
      toast.error(error.response?.data?.detail || 'Failed to create game');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c]">
      {/* Header */}
      <div className="bg-[#121216] border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Create Your Own Game
          </h1>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="glass-card p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 flex items-center justify-center">
              <Users className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Family & Party Tambola</h2>
              <p className="text-sm text-gray-400">Create a private game for your loved ones</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Game Name */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Game Name *
              </label>
              <Input
                type="text"
                placeholder="e.g., Diwali Family Tambola"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                required
              />
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <Calendar className="inline w-4 h-4 mr-1" /> Date *
                </label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="bg-white/5 border-white/10 text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  <Clock className="inline w-4 h-4 mr-1" /> Time *
                </label>
                <Input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  className="bg-white/5 border-white/10 text-white"
                  required
                />
              </div>
            </div>

            {/* Max Tickets */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Ticket className="inline w-4 h-4 mr-1" /> Number of Tickets
              </label>
              <Input
                type="number"
                min="6"
                max="90"
                value={formData.max_tickets}
                onChange={(e) => setFormData({ ...formData, max_tickets: parseInt(e.target.value) || 30 })}
                className="bg-white/5 border-white/10 text-white"
              />
              <p className="text-xs text-gray-500 mt-1">Recommend: 30-60 tickets for family games</p>
            </div>

            {/* Prizes Description */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Trophy className="inline w-4 h-4 mr-1" /> Prizes Description
              </label>
              <Textarea
                placeholder="e.g., First Line: ₹100, Full House: ₹500, Early 5: Gift Hamper"
                value={formData.prizes_description}
                onChange={(e) => setFormData({ ...formData, prizes_description: e.target.value })}
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 min-h-[100px]"
              />
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-14 text-lg font-bold rounded-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </div>
              ) : (
                'Create Game'
              )}
            </Button>
          </form>
        </div>

        {/* Info Card */}
        <div className="mt-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <h3 className="font-semibold text-amber-400 mb-2">How it works:</h3>
          <ul className="text-sm text-gray-400 space-y-1">
            <li>1. Create your game with name, date & time</li>
            <li>2. Share the link or QR code with friends & family</li>
            <li>3. Players join by entering their name - no signup needed!</li>
            <li>4. Start the game and call numbers from your host panel</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
