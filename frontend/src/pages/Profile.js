import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, User as UserIcon, Share2, HelpCircle, LogOut } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Avatar options
const AVATARS = [
  'https://images.unsplash.com/photo-1647663386171-7b4deaba904c',
  'https://images.unsplash.com/photo-1520875557929-b3dde468605a',
  'https://images.unsplash.com/photo-1583852469342-18a99d0133f9',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Lucky',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Winner',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Champion',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Star',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Hero'
];

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATARS[0]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, { withCredentials: true });
      setUser(response.data);
      setName(response.data.name);
      setSelectedAvatar(response.data.picture || AVATARS[0]);
    } catch (error) {
      console.error('Failed to fetch user:', error);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await axios.put(
        `${API}/profile`,
        {
          name,
          avatar: selectedAvatar
        },
        { withCredentials: true }
      );
      toast.success('Profile updated successfully');
      fetchUser();
    } catch (error) {
      console.error('Failed to update profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
      toast.success('Logged out successfully');
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      toast.error('Failed to logout');
    }
  };

  const handleShareApp = () => {
    const shareData = {
      title: 'Six Seven Tambola',
      text: 'Join me in playing Six Seven Tambola and win amazing prizes!',
      url: window.location.origin
    };

    if (navigator.share) {
      navigator.share(shareData).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.origin);
      toast.success('Link copied to clipboard');
    }
  };

  if (!user) {
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
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            data-testid="back-button"
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Profile
          </h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Avatar Selection */}
          <div className="glass-card p-6">
            <h2 className="text-lg font-bold text-white mb-4">Choose Avatar</h2>
            <div className="grid grid-cols-5 md:grid-cols-10 gap-3" data-testid="avatar-grid">
              {AVATARS.map((avatar, index) => (
                <button
                  key={index}
                  data-testid={`avatar-${index}`}
                  onClick={() => setSelectedAvatar(avatar)}
                  className={`w-full aspect-square rounded-full overflow-hidden border-4 transition-all ${
                    selectedAvatar === avatar
                      ? 'border-amber-500 scale-110'
                      : 'border-white/10 hover:border-amber-500/50'
                  }`}
                >
                  <img src={avatar} alt={`Avatar ${index + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {/* Name Edit */}
          <div className="glass-card p-6">
            <h2 className="text-lg font-bold text-white mb-4">Edit Name</h2>
            <Input
              data-testid="name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="bg-black/20 border-white/10 focus:border-amber-500 text-white h-12"
            />
            <Button
              data-testid="save-profile-btn"
              onClick={handleSave}
              disabled={isSaving}
              className="w-full mt-4 h-12 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 font-bold"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>

          {/* User Info */}
          <div className="glass-card p-6">
            <h2 className="text-lg font-bold text-white mb-4">Account Info</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-400">Email</p>
                <p className="text-white" data-testid="user-email">{user.email}</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              data-testid="share-app-btn"
              onClick={handleShareApp}
              variant="outline"
              className="w-full h-12 rounded-full border-white/10 hover:bg-white/5 font-bold"
            >
              <Share2 className="w-5 h-5 mr-2" />
              Share App
            </Button>

            <Button
              data-testid="support-btn"
              variant="outline"
              className="w-full h-12 rounded-full border-white/10 hover:bg-white/5 font-bold"
              onClick={() => toast.info('Contact support at support@tambola.com')}
            >
              <HelpCircle className="w-5 h-5 mr-2" />
              Support
            </Button>

            <Button
              data-testid="logout-btn"
              onClick={handleLogout}
              variant="outline"
              className="w-full h-12 rounded-full border-red-500/50 text-red-500 hover:bg-red-500/10 font-bold"
            >
              <LogOut className="w-5 h-5 mr-2" />
              Logout
            </Button>
          </div>

          {/* Admin Link (Optional) */}
          <div className="text-center">
            <Button
              data-testid="admin-panel-link"
              variant="ghost"
              onClick={() => navigate('/admin')}
              className="text-gray-500 hover:text-amber-500"
            >
              Admin Panel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
