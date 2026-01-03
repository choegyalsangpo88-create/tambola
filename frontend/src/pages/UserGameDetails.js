import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, Copy, Share2, Users, Calendar, Clock,
  Trophy, Play, Edit2, QrCode, Download, Check, Ticket
} from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function UserGameDetails() {
  const { userGameId } = useParams();
  const navigate = useNavigate();
  const qrRef = useRef(null);
  
  const [game, setGame] = useState(null);
  const [players, setPlayers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchGameDetails();
  }, [userGameId]);

  const fetchGameDetails = async () => {
    try {
      const [gameRes, playersRes] = await Promise.all([
        axios.get(`${API}/user-games/${userGameId}`, { withCredentials: true }),
        axios.get(`${API}/user-games/${userGameId}/players`, { withCredentials: true })
      ]);
      setGame(gameRes.data);
      setPlayers(playersRes.data.players || []);
    } catch (error) {
      console.error('Failed to fetch game:', error);
      toast.error('Failed to load game details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartGame = async () => {
    try {
      await axios.post(`${API}/user-games/${userGameId}/start`, {}, { withCredentials: true });
      toast.success('Game started!');
      navigate(`/user-game-play/${userGameId}`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start game');
    }
  };

  const getShareUrl = () => {
    return `${window.location.origin}/join/${game?.share_code}`;
  };

  const getWhatsAppMessage = () => {
    const msg = `🎉 Join my Six Seven Game!\n\n🎮 ${game?.name}\n📅 ${game?.date} at ${game?.time}\n\n${game?.prizes_description ? `🏆 Prizes: ${game?.prizes_description}\n\n` : ''}👉 Click to join: ${getShareUrl()}\n\nJust enter your name and get your ticket!`;
    return encodeURIComponent(msg);
  };

  const handleWhatsAppShare = () => {
    const url = `https://api.whatsapp.com/send?text=${getWhatsAppMessage()}`;
    window.open(url, '_blank');
  };

  const downloadQRCode = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;
    
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = 400;
      canvas.height = 400;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, 400, 400);
      ctx.drawImage(img, 0, 0, 400, 400);
      
      const link = document.createElement('a');
      link.download = `tambola-${game?.share_code}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const handleCopy = () => {
    setCopied(true);
    toast.success('Link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleHostBookTicket = async () => {
    try {
      await axios.post(`${API}/user-games/${userGameId}/host-join?ticket_count=1`, {}, { withCredentials: true });
      toast.success('Ticket booked for you!');
      fetchGameDetails();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to book ticket');
    }
  };

  const handleDeleteGame = async () => {
    if (!window.confirm('Are you sure you want to delete this game? This cannot be undone.')) return;
    try {
      await axios.delete(`${API}/user-games/${userGameId}`, { withCredentials: true });
      toast.success('Game deleted');
      navigate('/my-games');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete game');
    }
  };

  // Check if host has already booked
  const hostHasTicket = players.some(p => p.is_host);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c]">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c]">
        <p className="text-gray-400">Game not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] pb-24">
      {/* Header */}
      <div className="bg-[#121216] border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/my-games')}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>
              {game.name}
            </h1>
            <p className="text-sm text-gray-400">Code: {game.share_code}</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Share Section */}
        <div className="glass-card p-5">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Share2 className="w-5 h-5 text-amber-500" /> Share Game
          </h2>
          
          {/* Share Link */}
          <div className="flex gap-2 mb-4">
            <div className="flex-1 bg-white/5 rounded-lg px-4 py-3 text-gray-300 text-sm truncate">
              {getShareUrl()}
            </div>
            <CopyToClipboard text={getShareUrl()} onCopy={handleCopy}>
              <Button variant="outline" className="border-white/10 hover:bg-white/10">
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </Button>
            </CopyToClipboard>
          </div>

          {/* WhatsApp & QR Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={handleWhatsAppShare}
              className="h-12 bg-[#25D366] hover:bg-[#128C7E] text-white font-semibold"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Share on WhatsApp
            </Button>
            <Button
              onClick={() => setShowQR(!showQR)}
              variant="outline"
              className="h-12 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
            >
              <QrCode className="w-5 h-5 mr-2" /> {showQR ? 'Hide' : 'Show'} QR Code
            </Button>
          </div>

          {/* QR Code */}
          {showQR && (
            <div className="mt-4 flex flex-col items-center">
              <div ref={qrRef} className="bg-white p-4 rounded-xl">
                <QRCodeSVG
                  value={getShareUrl()}
                  size={200}
                  level="H"
                  includeMargin={false}
                />
              </div>
              <Button
                onClick={downloadQRCode}
                variant="ghost"
                className="mt-3 text-amber-400 hover:text-amber-300"
              >
                <Download className="w-4 h-4 mr-2" /> Download QR Code
              </Button>
            </div>
          )}
        </div>

        {/* Game Info */}
        <div className="glass-card p-5">
          <h2 className="text-lg font-bold text-white mb-4">Game Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-xs text-gray-500">Date</p>
                <p className="text-white">{game.date}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-xs text-gray-500">Time</p>
                <p className="text-white">{game.time}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Ticket className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-xs text-gray-500">Total Tickets</p>
                <p className="text-white">{game.max_tickets}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-xs text-gray-500">Players Joined</p>
                <p className="text-white">{players.length}</p>
              </div>
            </div>
          </div>
          {game.prizes_description && (
            <div className="mt-4 pt-4 border-t border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <p className="text-sm text-gray-400">Prizes</p>
              </div>
              <p className="text-white whitespace-pre-wrap">{game.prizes_description}</p>
            </div>
          )}
        </div>

        {/* Players List */}
        <div className="glass-card p-5">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-500" /> Players ({players.length})
          </h2>
          {players.length === 0 ? (
            <p className="text-gray-400 text-center py-4">No players yet. Share the link to invite!</p>
          ) : (
            <div className="space-y-3">
              {players.map((player, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold">
                      {player.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-white font-medium">{player.name}</span>
                  </div>
                  <span className="text-sm text-amber-400">{player.ticket_count} ticket{player.ticket_count > 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fixed Bottom Bar */}
      {game.status === 'upcoming' && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#121216] border-t border-white/10 p-4">
          <div className="max-w-4xl mx-auto space-y-3">
            {/* Host Book Ticket Button */}
            {!hostHasTicket && (
              <Button
                onClick={handleHostBookTicket}
                variant="outline"
                className="w-full h-10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
              >
                <Ticket className="w-4 h-4 mr-2" /> Book My Own Ticket
              </Button>
            )}
            <div className="flex gap-3">
              <Button
                onClick={() => navigate(`/edit-game/${userGameId}`)}
                variant="outline"
                className="flex-1 h-12 border-white/10 text-white hover:bg-white/10"
              >
                <Edit2 className="w-4 h-4 mr-2" /> Edit Game
              </Button>
              <Button
                onClick={handleStartGame}
                disabled={players.length === 0}
                className="flex-1 h-12 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 font-bold"
              >
                <Play className="w-4 h-4 mr-2" /> Start Game
              </Button>
            </div>
          </div>
        </div>
      )}

      {game.status === 'live' && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#121216] border-t border-white/10 p-4">
          <div className="max-w-4xl mx-auto">
            <Button
              onClick={() => navigate(`/user-game-play/${userGameId}`)}
              className="w-full h-14 bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 font-bold text-lg animate-pulse"
            >
              <Play className="w-5 h-5 mr-2" /> Join Live Game
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
