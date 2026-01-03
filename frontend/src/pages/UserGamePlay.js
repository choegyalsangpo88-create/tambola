import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Play, Square, Volume2, VolumeX, Users, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { getCallName } from '../utils/tambolaCallNames';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function UserGamePlay() {
  const { userGameId } = useParams();
  const navigate = useNavigate();
  
  const [game, setGame] = useState(null);
  const [session, setSession] = useState(null);
  const [players, setPlayers] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCalling, setIsCalling] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [currentBall, setCurrentBall] = useState(null);
  const [showBallAnimation, setShowBallAnimation] = useState(false);
  
  const audioRef = useRef(null);
  const pollIntervalRef = useRef(null);

  useEffect(() => {
    fetchInitialData();
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [userGameId]);

  useEffect(() => {
    // Poll for ALL users (host and non-host) since auto-call is enabled
    if (game && game.status === 'live') {
      pollIntervalRef.current = setInterval(fetchSession, 2000);
      return () => clearInterval(pollIntervalRef.current);
    }
  }, [game]);

  const fetchInitialData = async () => {
    try {
      const [gameRes, playersRes, userRes] = await Promise.all([
        axios.get(`${API}/user-games/${userGameId}`),
        axios.get(`${API}/user-games/${userGameId}/players`),
        axios.get(`${API}/auth/me`, { withCredentials: true }).catch(() => null)
      ]);
      
      setGame(gameRes.data);
      setPlayers(playersRes.data.players || []);
      setSession({
        called_numbers: gameRes.data.called_numbers || [],
        current_number: gameRes.data.current_number,
        winners: gameRes.data.winners || {}
      });
      
      if (userRes?.data && gameRes.data.host_user_id === userRes.data.user_id) {
        setIsHost(true);
      }
    } catch (error) {
      console.error('Failed to fetch game:', error);
      toast.error('Failed to load game');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSession = async () => {
    try {
      const response = await axios.get(`${API}/user-games/${userGameId}/session`);
      const newSession = response.data;
      
      // Check for new number - show animation and play TTS
      if (newSession.current_number && newSession.current_number !== session?.current_number) {
        // Only show new number if game is still live
        if (newSession.status === 'live') {
          showNewNumber(newSession.current_number);
        }
      }
      
      // Update game status if changed
      if (newSession.status && game?.status !== newSession.status) {
        setGame(prev => ({ ...prev, status: newSession.status }));
        
        // Stop polling and sounds when game ends
        if (newSession.status === 'completed') {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          // Cancel any ongoing speech
          if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
          }
          // Show game completed message
          toast.success('🎉 Game Completed! All prizes have been claimed.');
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        }
      }
      
      setSession(newSession);
    } catch (error) {
      console.error('Poll error:', error);
    }
  };

  const showNewNumber = async (number) => {
    if (!number || game?.status === 'completed') return;
    setCurrentBall(number);
    setShowBallAnimation(true);
    
    if (soundEnabled && game?.status === 'live') {
      // Play TTS announcement
      await playTTSAnnouncement(number);
    }
    
    setTimeout(() => setShowBallAnimation(false), 3000);
  };

  const playTTSAnnouncement = async (number) => {
    // Don't play if game ended
    if (game?.status === 'completed') return;
    
    try {
      const callName = getCallName(number);
      const response = await axios.post(`${API}/tts/generate?text=${encodeURIComponent(callName)}&include_prefix=true`);
      
      if (response.data.enabled && game?.status === 'live') {
        if (response.data.audio && !response.data.use_browser_tts) {
          // Use API-generated audio
          const audio = new Audio(`data:audio/mp3;base64,${response.data.audio}`);
          audioRef.current = audio;
          await audio.play().catch(() => {});
        } else if (response.data.use_browser_tts && response.data.text) {
          // Use browser's built-in speech synthesis
          if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(response.data.text);
            utterance.rate = response.data.voice_settings?.speed || 1.0;
            window.speechSynthesis.speak(utterance);
          }
        }
      }
    } catch (error) {
      console.error('TTS failed:', error);
      // Only play beep if game is still live
      if (game?.status === 'live') {
        playSound();
      }
    }
  };

  const playSound = () => {
    try {
      const audio = new Audio('/sounds/ball-drop.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch (e) {
      // Ignore audio errors
    }
  };

  const handleCallNumber = async () => {
    if (isCalling) return;
    setIsCalling(true);
    
    try {
      const response = await axios.post(
        `${API}/user-games/${userGameId}/call-number`,
        {},
        { withCredentials: true }
      );
      
      const newNumber = response.data.number;
      showNewNumber(newNumber);
      
      setSession(prev => ({
        ...prev,
        called_numbers: response.data.called_numbers,
        current_number: newNumber
      }));
      
      // Celebrate every 10th number
      if (response.data.called_numbers.length % 10 === 0) {
        confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to call number');
    } finally {
      setIsCalling(false);
    }
  };

  const handleEndGame = async () => {
    if (!window.confirm('Are you sure you want to end this game?')) return;
    
    try {
      await axios.post(
        `${API}/user-games/${userGameId}/end`,
        {},
        { withCredentials: true }
      );
      toast.success('Game ended!');
      navigate('/my-games');
    } catch (error) {
      toast.error('Failed to end game');
    }
  };

  const getBallColor = (num) => {
    if (num <= 9) return 'from-blue-400 to-blue-600';
    if (num <= 19) return 'from-red-400 to-red-600';
    if (num <= 29) return 'from-green-400 to-green-600';
    if (num <= 39) return 'from-yellow-400 to-yellow-600';
    if (num <= 49) return 'from-purple-400 to-purple-600';
    if (num <= 59) return 'from-pink-400 to-pink-600';
    if (num <= 69) return 'from-cyan-400 to-cyan-600';
    if (num <= 79) return 'from-orange-400 to-orange-600';
    return 'from-gray-400 to-gray-600';
  };

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

  // Check if game is completed
  const isGameCompleted = game.status === 'completed';
  const allWinners = game.winners || session?.winners || {};
  const dividends = game.dividends || {};

  // Game Ended Screen
  if (isGameCompleted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a3d2c] to-[#0a0a0c] flex flex-col items-center justify-center p-4">
        <div className="glass-card p-8 max-w-lg w-full text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-3xl font-bold text-white mb-2">Game Ended!</h1>
          <p className="text-gray-400 mb-6">Congratulations to all winners!</p>
          
          <div className="space-y-3 mb-6">
            {Object.entries(allWinners).map(([prize, winner]) => (
              <div key={prize} className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-amber-400 font-bold">{prize}</span>
                  <Trophy className="w-5 h-5 text-amber-500" />
                </div>
                <p className="text-white text-sm mt-1">
                  Winner: {winner.name || winner.ticket_number || 'Winner'}
                </p>
              </div>
            ))}
          </div>
          
          <p className="text-gray-500 text-sm mb-4">
            Total numbers called: {game.called_numbers?.length || session?.called_numbers?.length || 0}/90
          </p>
          
          <Button 
            onClick={() => navigate(isHost ? '/my-games' : '/')} 
            className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
          >
            Back to {isHost ? 'My Games' : 'Home'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c]">
      {/* Header */}
      <div className="bg-[#121216] border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(isHost ? '/my-games' : '/')}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-white">{game.name}</h1>
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-400 animate-pulse">● LIVE</span>
                <span className="text-xs text-emerald-400">Auto-calling</span>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="text-gray-400 hover:text-white"
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Current Ball Display */}
        <div className="flex justify-center mb-8">
          <div className={`relative transition-all duration-500 ${showBallAnimation ? 'scale-110' : 'scale-100'}`}>
            <div className={`w-32 h-32 md:w-40 md:h-40 rounded-full bg-gradient-to-br ${getBallColor(currentBall || session?.current_number || 0)} flex items-center justify-center shadow-2xl`}
              style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.5), inset 0 -10px 30px rgba(0,0,0,0.3), inset 0 10px 30px rgba(255,255,255,0.3)' }}
            >
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-white flex items-center justify-center shadow-inner">
                <span className="text-4xl md:text-5xl font-black text-gray-900">
                  {currentBall || session?.current_number || '?'}
                </span>
              </div>
            </div>
            {showBallAnimation && (
              <div className="absolute inset-0 rounded-full bg-white/30 animate-ping" />
            )}
          </div>
        </div>

        {/* Call Name */}
        {(currentBall || session?.current_number) && (
          <p className="text-center text-amber-400 font-semibold mb-6 text-lg">
            {getCallName(currentBall || session?.current_number)}
          </p>
        )}

        {/* Auto-Calling Status - No manual controls needed */}
        {game.status === 'live' && (
          <div className="text-center mb-6">
            <p className="text-emerald-400 text-sm">🔄 Numbers are being called automatically every 10 seconds</p>
          </div>
        )}
        
        {/* Game Completed Message */}
        {game.status === 'completed' && (
          <div className="text-center mb-6 p-4 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-xl border border-amber-500/30">
            <p className="text-amber-400 text-lg font-bold">🎉 Game Completed!</p>
            <p className="text-gray-400 text-sm mt-1">All numbers have been called or all prizes won</p>
          </div>
        )}

        {/* Host Controls - Only End Game button */}
        {isHost && game.status === 'live' && (
          <div className="flex gap-3 justify-center mb-8">
            <Button
              onClick={handleEndGame}
              variant="outline"
              className="h-12 px-6 border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-full"
            >
              <Square className="w-5 h-5 mr-2" /> End Game Early
            </Button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="glass-card p-4 text-center">
            <p className="text-3xl font-bold text-amber-400">{session?.called_numbers?.length || 0}</p>
            <p className="text-xs text-gray-400">Called</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-3xl font-bold text-green-400">{90 - (session?.called_numbers?.length || 0)}</p>
            <p className="text-xs text-gray-400">Remaining</p>
          </div>
          <div className="glass-card p-4 text-center">
            <p className="text-3xl font-bold text-blue-400">{players.length}</p>
            <p className="text-xs text-gray-400">Players</p>
          </div>
        </div>

        {/* Called Numbers Board */}
        <div className="glass-card p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">Called Numbers</h3>
          <div className="grid grid-cols-10 gap-1">
            {Array.from({ length: 90 }, (_, i) => i + 1).map((num) => {
              const isCalled = session?.called_numbers?.includes(num);
              return (
                <div
                  key={num}
                  className={`aspect-square flex items-center justify-center text-xs font-bold rounded transition-all ${
                    isCalled
                      ? `bg-gradient-to-br ${getBallColor(num)} text-white shadow-md`
                      : 'bg-white/5 text-gray-500'
                  } ${num === session?.current_number ? 'ring-2 ring-amber-400 scale-110' : ''}`}
                >
                  {num}
                </div>
              );
            })}
          </div>
        </div>

        {/* Players with Tickets (Host View) */}
        {isHost && (
          <div className="glass-card p-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" /> Players ({players.length})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {players.map((player, idx) => (
                <div key={idx} className="bg-white/5 rounded-lg p-3">
                  <p className="text-white font-medium truncate">{player.name}</p>
                  <p className="text-xs text-gray-400">{player.ticket_count} ticket{player.ticket_count > 1 ? 's' : ''}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
