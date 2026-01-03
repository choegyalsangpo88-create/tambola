import { useState, useEffect, useRef, useCallback } from 'react';
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
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [currentBall, setCurrentBall] = useState(null);
  const [showBallAnimation, setShowBallAnimation] = useState(false);
  const [dividends, setDividends] = useState({});
  const [allWinners, setAllWinners] = useState({});
  
  const audioRef = useRef(null);
  const audioElementRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const lastAnnouncedRef = useRef(null);
  const isAnnouncingRef = useRef(false);
  const previousWinnersRef = useRef({});
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);

  // Unlock audio on iOS/mobile - MUST be triggered by user gesture
  const unlockAudio = useCallback(() => {
    // Create and play silent audio to unlock
    const silentAudio = new Audio("data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7v////////////////////////////////");
    silentAudio.volume = 0.01;
    silentAudio.play().then(() => {
      setAudioUnlocked(true);
      toast.success('🔊 Sound enabled!');
    }).catch(() => {
      // Try with AudioContext
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
        setAudioUnlocked(true);
        toast.success('🔊 Sound enabled!');
      } catch (e) {
        console.log('Audio unlock failed:', e);
      }
    });
  }, []);

  useEffect(() => {
    fetchInitialData();
    
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [userGameId]);

  useEffect(() => {
    // Poll every 2 seconds for live game
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
      
      const gameData = gameRes.data;
      setGame(gameData);
      setPlayers(playersRes.data.players || []);
      setDividends(gameData.dividends || {});
      setAllWinners(gameData.winners || {});
      previousWinnersRef.current = gameData.winners || {};
      
      setSession({
        called_numbers: gameData.called_numbers || [],
        current_number: gameData.current_number,
        winners: gameData.winners || {},
        status: gameData.status
      });
      
      if (userRes?.data && gameData.host_user_id === userRes.data.user_id) {
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
      
      // Check for new winners and celebrate
      if (newSession.winners) {
        Object.keys(newSession.winners).forEach(prize => {
          if (!previousWinnersRef.current[prize]) {
            const winner = newSession.winners[prize];
            celebrateWinner(prize, winner.holder_name || winner.name || 'Player');
          }
        });
        previousWinnersRef.current = newSession.winners;
        setAllWinners(newSession.winners);
      }
      
      // Check for new number - show animation and play TTS
      if (newSession.current_number && newSession.current_number !== session?.current_number) {
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
          if ('speechSynthesis' in window) window.speechSynthesis.cancel();
          toast.success('🎉 Game Completed! All prizes have been claimed.');
          confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        }
      }
      
      setSession(newSession);
    } catch (error) {
      console.error('Poll error:', error);
    }
  };

  // Celebrate winner with confetti, toast, and TTS
  const celebrateWinner = async (prize, winnerName) => {
    // Big confetti burst
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.6 },
      colors: ['#FFD700', '#FFA500', '#FF6347', '#00FF00', '#FF69B4']
    });
    
    // Second burst from sides
    setTimeout(() => {
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.7, x: 0.3 },
        colors: ['#FFD700', '#FFA500', '#00FF00']
      });
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.7, x: 0.7 },
        colors: ['#FFD700', '#FFA500', '#00FF00']
      });
    }, 300);
    
    // Show toast with winner info
    toast.success(
      <div className="text-center">
        <p className="text-lg font-bold">🏆 {prize}</p>
        <p className="text-xl font-black text-amber-400">Congratulations {winnerName}!</p>
      </div>,
      { duration: 6000 }
    );
    
    // Announce winner via TTS if audio is unlocked
    if (audioUnlocked && soundEnabled) {
      try {
        const text = `Congratulations ${winnerName}! You have won ${prize}!`;
        await playServerTTS(text);
      } catch (e) {
        console.log('Winner announcement error:', e);
      }
    }
  };

  const showNewNumber = async (number) => {
    if (!number || game?.status === 'completed') return;
    
    // Prevent duplicate announcements
    if (lastAnnouncedRef.current === number) return;
    lastAnnouncedRef.current = number;
    
    setCurrentBall(number);
    setShowBallAnimation(true);
    
    // Play announcement if sound is on and audio is unlocked
    if (soundEnabled && audioUnlocked && game?.status === 'live') {
      await announceNumber(number);
    }
    
    setTimeout(() => setShowBallAnimation(false), 3000);
  };

  // Main announcement function - uses server TTS for mobile compatibility
  const announceNumber = async (number) => {
    if (isAnnouncingRef.current || game?.status === 'completed' || !audioUnlocked) return;
    isAnnouncingRef.current = true;
    
    const callName = getCallName(number);
    
    try {
      // Try server-side TTS first (most reliable for mobile)
      const played = await playServerTTS(callName);
      
      // Fallback to browser TTS if server TTS fails
      if (!played) {
        await speakWithBrowserTTS(callName);
      }
    } catch (error) {
      console.log('Announcement error:', error);
    } finally {
      isAnnouncingRef.current = false;
    }
  };

  // Server-side TTS - most reliable for iOS/Android
  const playServerTTS = async (text) => {
    try {
      const response = await axios.post(`${API}/tts/generate?text=${encodeURIComponent(text)}&include_prefix=false`);
      const data = response.data;
      
      if (data.audio) {
        return new Promise((resolve) => {
          // Create audio element
          const audio = new Audio();
          audio.src = `data:audio/mp3;base64,${data.audio}`;
          audio.volume = 1.0;
          audio.preload = 'auto';
          
          audio.onended = () => resolve(true);
          audio.onerror = (e) => {
            console.log('Audio error:', e);
            resolve(false);
          };
          
          // Play with promise handling
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                // Playing
              })
              .catch((e) => {
                console.log('Play failed:', e);
                resolve(false);
              });
          }
          
          // Timeout safety
          setTimeout(() => resolve(true), 6000);
        });
      }
      
      return false;
    } catch (e) {
      console.log('Server TTS error:', e);
      return false;
    }
  };

  // Browser speech synthesis - fallback
  const speakWithBrowserTTS = (text) => {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window)) {
        resolve();
        return;
      }
      
      try {
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        utterance.lang = 'en-US';
        
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        
        window.speechSynthesis.speak(utterance);
        
        // Timeout safety
        setTimeout(resolve, 8000);
      } catch (e) {
        resolve();
      }
    });
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
  const displayWinners = allWinners || game.winners || session?.winners || {};
  const displayDividends = dividends || game.dividends || {};

  // Game Ended Screen
  if (isGameCompleted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0a3d2c] to-[#0a0a0c] flex flex-col items-center justify-center p-4">
        <div className="glass-card p-8 max-w-lg w-full text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-3xl font-bold text-white mb-2">Game Ended!</h1>
          <p className="text-gray-400 mb-6">Congratulations to all winners!</p>
          
          <div className="space-y-3 mb-6">
            {Object.entries(displayWinners).map(([prize, winner]) => (
              <div key={prize} className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-amber-400 font-bold">{prize}</span>
                  <Trophy className="w-5 h-5 text-amber-500" />
                </div>
                <p className="text-white text-sm mt-1">
                  Winner: {winner.name || winner.holder_name || winner.ticket_number || 'Winner'}
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
          <div className="flex items-center gap-2">
            {/* Sound Enable Button for Mobile */}
            {!audioUnlocked && (
              <Button
                onClick={unlockAudio}
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1 h-8 animate-pulse"
              >
                🔊 Tap for Sound
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (!audioUnlocked) {
                  unlockAudio();
                }
                setSoundEnabled(!soundEnabled);
              }}
              className={`${soundEnabled && audioUnlocked ? 'text-green-400' : 'text-gray-400'} hover:text-white`}
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Sound Enable Banner for Mobile */}
      {!audioUnlocked && game?.status === 'live' && (
        <div 
          onClick={unlockAudio}
          className="bg-gradient-to-r from-green-600 to-emerald-600 py-2 px-4 text-center cursor-pointer"
        >
          <p className="text-white text-sm font-medium">
            📱 Tap here to enable caller voice on your phone
          </p>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-3 py-4">
        {/* Main Row: Caller Ball | Dividends - Equal Space */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Left: Compact Caller Ball */}
          <div className="bg-black/30 rounded-xl p-3 flex flex-col items-center justify-center">
            <div className={`relative transition-all duration-500 ${showBallAnimation ? 'scale-110' : 'scale-100'}`}>
              <div className={`w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br ${getBallColor(currentBall || session?.current_number || 0)} flex items-center justify-center shadow-xl`}
                style={{ boxShadow: '0 10px 30px rgba(0,0,0,0.5), inset 0 -5px 15px rgba(0,0,0,0.3), inset 0 5px 15px rgba(255,255,255,0.3)' }}
              >
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-white flex items-center justify-center shadow-inner">
                  <span className="text-2xl md:text-3xl font-black text-gray-900">
                    {currentBall || session?.current_number || '?'}
                  </span>
                </div>
              </div>
              {showBallAnimation && (
                <div className="absolute inset-0 rounded-full bg-white/30 animate-ping" />
              )}
            </div>
            <p className="text-amber-400 text-xs mt-2">{session?.called_numbers?.length || 0}/90 Numbers</p>
          </div>

          {/* Right: Dividends with Winner Names */}
          <div className="bg-black/30 rounded-xl p-3">
            <h3 className="text-amber-400 font-bold text-sm mb-2 flex items-center gap-1">
              <Trophy className="w-3 h-3" /> DIVIDENDS
            </h3>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {Object.entries(dividends).map(([prize, amount]) => {
                const winner = allWinners[prize];
                return (
                  <div key={prize} className={`flex justify-between items-center text-xs py-1 px-2 rounded ${winner ? 'bg-green-900/30' : 'bg-white/5'}`}>
                    <div className="flex-1 min-w-0">
                      <span className={`${winner ? 'text-green-400' : 'text-gray-300'}`}>{prize}</span>
                      {winner && (
                        <p className="text-green-300 text-[10px] truncate">🏆 {winner.holder_name || winner.name || 'Winner'}</p>
                      )}
                    </div>
                    <span className="text-amber-400 font-bold ml-2">₹{amount?.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Top Players - Show names from beginning */}
        <div className="bg-black/30 rounded-xl p-3 mb-4">
          <h3 className="text-amber-400 font-bold text-sm mb-2 flex items-center gap-1">
            <Users className="w-3 h-3" /> TOP PLAYERS
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {players.length > 0 ? (
              players
                .map(player => {
                  // Calculate marked count for each player
                  const calledSet = new Set(session?.called_numbers || []);
                  let markedCount = 0;
                  if (player.tickets) {
                    player.tickets.forEach(ticket => {
                      if (ticket.numbers) {
                        ticket.numbers.forEach(row => {
                          row.forEach(num => {
                            if (num && calledSet.has(num)) markedCount++;
                          });
                        });
                      }
                    });
                  }
                  return { ...player, markedCount };
                })
                .sort((a, b) => b.markedCount - a.markedCount)
                .slice(0, 6)
                .map((player, idx) => (
                  <div key={player.user_id || idx} className="bg-white/5 rounded-lg p-2 text-center">
                    <p className="text-white text-xs font-medium truncate">{player.name?.split(' ')[0] || 'Player'}</p>
                    <p className="text-amber-400 text-[10px]">{player.markedCount} marked</p>
                  </div>
                ))
            ) : (
              <div className="col-span-3 text-center text-gray-500 text-xs py-2">No players yet</div>
            )}
          </div>
        </div>

        {/* Auto-Calling Status */}
        {game.status === 'live' && (
          <p className="text-center text-emerald-400 text-xs mb-4">🔄 Auto-calling every 10 seconds</p>
        )}
        
        {/* Game Completed Message */}
        {game.status === 'completed' && (
          <div className="text-center mb-4 p-3 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-xl border border-amber-500/30">
            <p className="text-amber-400 font-bold">🎉 Game Completed!</p>
          </div>
        )}

        {/* Host Controls - Only End Game button */}
        {isHost && game.status === 'live' && (
          <div className="flex gap-3 justify-center mb-4">
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
