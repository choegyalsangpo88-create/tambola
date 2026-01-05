import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Play, Square, Volume2, VolumeX, Users, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { getCallName } from '../utils/tambolaCallNames';
import { unlockMobileAudio, playBase64Audio, speakText, isAudioUnlocked } from '../utils/audioHelper';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function UserGamePlay() {
  const { userGameId } = useParams();
  const navigate = useNavigate();
  
  const [game, setGame] = useState(null);
  const [session, setSession] = useState(null);
  const [players, setPlayers] = useState([]);
  const [myTickets, setMyTickets] = useState([]); // Current user's tickets
  const [playerName, setPlayerName] = useState(''); // Current player name
  const [isHost, setIsHost] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCalling, setIsCalling] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [currentBall, setCurrentBall] = useState(null);
  const [showBallAnimation, setShowBallAnimation] = useState(false);
  const [dividends, setDividends] = useState({});
  const [allWinners, setAllWinners] = useState({});
  const [selectedWinnerTicket, setSelectedWinnerTicket] = useState(null); // For viewing winning ticket
  
  const pollIntervalRef = useRef(null);
  const lastAnnouncedRef = useRef(null);
  const isAnnouncingRef = useRef(false);
  const previousWinnersRef = useRef({});

  // Unlock audio on iOS/mobile using Howler.js - MUST be triggered by user gesture
  const unlockAudio = useCallback(async () => {
    try {
      await unlockMobileAudio();
      setAudioUnlocked(true);
      toast.success('🔊 Sound enabled!');
    } catch (e) {
      console.log('Audio unlock failed:', e);
      // Still mark as unlocked to try playing
      setAudioUnlocked(true);
    }
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
      const allPlayers = playersRes.data.players || [];
      setPlayers(allPlayers);
      setDividends(gameData.dividends || {});
      setAllWinners(gameData.winners || {});
      previousWinnersRef.current = gameData.winners || {};
      
      setSession({
        called_numbers: gameData.called_numbers || [],
        current_number: gameData.current_number,
        winners: gameData.winners || {},
        status: gameData.status
      });
      
      // Check if current user is host
      const currentUserId = userRes?.data?.user_id;
      const currentUserName = userRes?.data?.name;
      
      if (currentUserId && gameData.host_user_id === currentUserId) {
        setIsHost(true);
        setPlayerName(currentUserName || 'Host');
        // Find host's tickets
        const hostPlayer = allPlayers.find(p => p.name === currentUserName || p.name === gameData.host_name);
        if (hostPlayer) {
          setMyTickets(hostPlayer.tickets || []);
        }
      }
      
      // Check localStorage for player info (for non-logged in players who joined via share code)
      const storedPlayer = localStorage.getItem(`tambola_player_${userGameId}`);
      if (storedPlayer) {
        try {
          const playerData = JSON.parse(storedPlayer);
          setPlayerName(playerData.name);
          // Find this player's current tickets from the players list
          const myPlayer = allPlayers.find(p => p.name === playerData.name);
          if (myPlayer) {
            setMyTickets(myPlayer.tickets || []);
          }
        } catch (e) {
          console.log('Error parsing stored player:', e);
        }
      }
      
      // Also check URL query param for player name
      const urlParams = new URLSearchParams(window.location.search);
      const playerParam = urlParams.get('player');
      if (playerParam) {
        setPlayerName(playerParam);
        const myPlayer = allPlayers.find(p => p.name === playerParam);
        if (myPlayer) {
          setMyTickets(myPlayer.tickets || []);
        }
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

  // Celebrate winner with confetti and toast - NO TTS announcement
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
    
    // Show toast with "Prize Gone" message and winner name(s)
    toast.success(
      <div className="text-center">
        <p className="text-xl font-black text-amber-400">🎉 Congratulations!</p>
        <p className="text-lg font-bold text-white">{prize} Gone!</p>
        <p className="text-sm text-green-300">Winner: {winnerName}</p>
      </div>,
      { duration: 6000 }
    );
    
    // NO TTS announcement for winner name
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

  // Main announcement function - uses Howler.js for mobile compatibility
  const announceNumber = async (number) => {
    if (isAnnouncingRef.current || game?.status === 'completed' || !audioUnlocked) return;
    isAnnouncingRef.current = true;
    
    const callName = getCallName(number);
    
    try {
      // Try server-side TTS with Howler.js (most reliable for mobile)
      const played = await playTTSWithHowler(callName);
      
      // Fallback to browser TTS if server TTS fails
      if (!played) {
        await speakText(callName);
      }
    } catch (error) {
      console.log('Announcement error:', error);
    } finally {
      isAnnouncingRef.current = false;
    }
  };

  // Server-side TTS with Howler.js - works on iOS/Android
  const playTTSWithHowler = async (text) => {
    try {
      const response = await axios.post(`${API}/tts/generate?text=${encodeURIComponent(text)}&include_prefix=false`);
      const data = response.data;
      
      if (data.audio) {
        // Use Howler.js via our utility
        return await playBase64Audio(data.audio);
      }
      
      // If server returns use_browser_tts, use browser TTS
      if (data.use_browser_tts) {
        await speakText(data.text || text);
        return true;
      }
      
      return false;
    } catch (e) {
      console.log('Server TTS error:', e);
      return false;
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

  // Get gradient colors for 3D ball based on number range
  const getBallGradient = (num) => {
    if (num <= 9) return '#60a5fa, #2563eb 50%, #1d4ed8 80%, #1e3a8a';
    if (num <= 19) return '#f87171, #dc2626 50%, #b91c1c 80%, #7f1d1d';
    if (num <= 29) return '#4ade80, #16a34a 50%, #15803d 80%, #14532d';
    if (num <= 39) return '#facc15, #ca8a04 50%, #a16207 80%, #713f12';
    if (num <= 49) return '#c084fc, #9333ea 50%, #7e22ce 80%, #581c87';
    if (num <= 59) return '#f472b6, #db2777 50%, #be185d 80%, #831843';
    if (num <= 69) return '#22d3ee, #0891b2 50%, #0e7490 80%, #164e63';
    if (num <= 79) return '#fb923c, #ea580c 50%, #c2410c 80%, #7c2d12';
    return '#9ca3af, #6b7280 50%, #4b5563 80%, #374151';
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
            {Object.entries(displayWinners).map(([prize, winner]) => {
              // Find the winning ticket
              const winningTicket = game.tickets?.find(t => 
                t.ticket_id === winner.ticket_id || t.ticket_number === winner.ticket_number
              );
              
              return (
                <div 
                  key={prize} 
                  className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-lg p-3 cursor-pointer hover:border-amber-400 transition-all"
                  onClick={() => {
                    if (winningTicket) {
                      setSelectedWinnerTicket({ ...winningTicket, prize, winner });
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-amber-400 font-bold">{prize}</span>
                    <Trophy className="w-5 h-5 text-amber-500" />
                  </div>
                  <p className="text-white text-sm mt-1">
                    🏆 {winner.holder_name || winner.name || 'Winner'}
                    {winner.ticket_number && <span className="text-amber-300 ml-2">({winner.ticket_number})</span>}
                  </p>
                  <p className="text-gray-400 text-xs mt-1">Click to view winning ticket</p>
                </div>
              );
            })}
          </div>
          
          {/* Modal for viewing winning ticket */}
          {selectedWinnerTicket && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={() => setSelectedWinnerTicket(null)}>
              <div className="bg-white rounded-xl p-4 max-w-sm w-full" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-gray-800">
                    🏆 {selectedWinnerTicket.prize}
                  </h3>
                  <button onClick={() => setSelectedWinnerTicket(null)} className="text-gray-500 hover:text-gray-700 text-xl">&times;</button>
                </div>
                <p className="text-sm text-gray-600 mb-2">
                  Winner: <span className="font-bold">{selectedWinnerTicket.winner?.holder_name || selectedWinnerTicket.winner?.name}</span>
                </p>
                <p className="text-sm text-gray-600 mb-3">
                  Ticket: <span className="font-bold">{selectedWinnerTicket.ticket_number}</span>
                </p>
                <div className="bg-amber-50 rounded-lg p-3">
                  <div className="grid grid-cols-9 gap-1">
                    {selectedWinnerTicket.numbers?.map((row, rowIdx) => (
                      row.map((num, colIdx) => {
                        const isCalled = (game.called_numbers || session?.called_numbers || []).includes(num);
                        return (
                          <div
                            key={`${rowIdx}-${colIdx}`}
                            className={`aspect-square flex items-center justify-center text-xs font-bold rounded ${
                              num 
                                ? isCalled 
                                  ? 'bg-green-500 text-white ring-2 ring-green-600' 
                                  : 'bg-amber-100 text-amber-900'
                                : 'bg-gray-100'
                            }`}
                          >
                            {num || ''}
                          </div>
                        );
                      })
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">Green = Called numbers</p>
              </div>
            </div>
          )}
          
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
          {/* Left: Real 3D Tambola Ball with number on both sides */}
          <div className="bg-black/30 rounded-xl p-3 flex flex-col items-center justify-center">
            <div className="relative" style={{ perspective: '800px' }}>
              <div 
                className={`relative ${showBallAnimation ? 'ball-entry' : 'ball-idle'}`}
                style={{ transformStyle: 'preserve-3d' }}
              >
                {/* Main Ball Body */}
                <div 
                  className="w-28 h-28 md:w-32 md:h-32 rounded-full relative"
                  style={{
                    background: `
                      radial-gradient(ellipse 120% 80% at 25% 20%, rgba(255,255,255,0.5) 0%, transparent 35%),
                      radial-gradient(ellipse 100% 100% at 50% 50%, ${getBallGradient(currentBall || session?.current_number || 0)})
                    `,
                    boxShadow: `
                      0 25px 50px rgba(0,0,0,0.5),
                      0 10px 20px rgba(0,0,0,0.3),
                      inset -20px -20px 40px rgba(0,0,0,0.4),
                      inset 15px 15px 30px rgba(255,255,255,0.1)
                    `,
                    transform: 'rotateY(-15deg) rotateX(5deg)'
                  }}
                >
                  {/* Main glossy highlight */}
                  <div 
                    className="absolute top-3 left-4 w-10 h-6 md:w-12 md:h-7 rounded-full"
                    style={{ 
                      background: 'linear-gradient(145deg, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.4) 40%, transparent 70%)',
                      filter: 'blur(3px)',
                      transform: 'rotate(-20deg)'
                    }}
                  />
                  
                  {/* Sharp highlight spot */}
                  <div 
                    className="absolute top-5 left-7 w-3 h-2 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.95)' }}
                  />
                  
                  {/* FRONT White number circle (center) */}
                  <div 
                    className="absolute rounded-full flex items-center justify-center"
                    style={{
                      width: '60px',
                      height: '60px',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      background: `
                        radial-gradient(ellipse 90% 90% at 40% 35%, 
                          #ffffff 0%, 
                          #fafafa 30%,
                          #f0f0f0 60%, 
                          #e5e5e5 100%
                        )
                      `,
                      boxShadow: `
                        inset 0 4px 15px rgba(0,0,0,0.12),
                        inset 0 -3px 10px rgba(255,255,255,0.9),
                        0 2px 6px rgba(0,0,0,0.25)
                      `,
                      border: '2px solid rgba(200,200,200,0.3)'
                    }}
                  >
                    <span 
                      className="text-4xl font-black" 
                      style={{ 
                        color: '#111111',
                        textShadow: '1px 1px 2px rgba(0,0,0,0.15)',
                        fontFamily: 'Arial Black, Impact, sans-serif',
                        letterSpacing: '-2px'
                      }}
                    >
                      {currentBall || session?.current_number || '?'}
                    </span>
                  </div>
                  
                  {/* SIDE White number circle (right side - gives 3D depth) */}
                  <div 
                    className="absolute rounded-full flex items-center justify-center overflow-hidden"
                    style={{
                      width: '40px',
                      height: '50px',
                      top: '38%',
                      right: '-6px',
                      background: `
                        linear-gradient(90deg, 
                          #e8e8e8 0%,
                          #f5f5f5 30%,
                          #fafafa 50%,
                          #f0f0f0 100%
                        )
                      `,
                      boxShadow: `
                        inset -3px 0 10px rgba(0,0,0,0.15),
                        inset 2px 0 8px rgba(255,255,255,0.5)
                      `,
                      borderRadius: '50%',
                      transform: 'rotateY(60deg) scaleX(0.5)',
                      border: '2px solid rgba(180,180,180,0.3)'
                    }}
                  >
                    <span 
                      className="text-xl font-black" 
                      style={{ 
                        color: '#222222',
                        fontFamily: 'Arial Black, Impact, sans-serif',
                        transform: 'scaleX(2)',
                        letterSpacing: '-1px'
                      }}
                    >
                      {currentBall || session?.current_number || '?'}
                    </span>
                  </div>
                </div>
                
                {/* Ball shadow */}
                <div 
                  className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-20 h-4 rounded-full"
                  style={{ 
                    background: 'radial-gradient(ellipse, rgba(0,0,0,0.5) 0%, transparent 70%)',
                    filter: 'blur(4px)'
                  }}
                />
              </div>
            </div>
            <p className="text-amber-400 text-xs mt-3">{session?.called_numbers?.length || 0}/90 Numbers</p>
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
                  <div key={prize} className={`py-1.5 px-2 rounded ${winner ? 'bg-green-900/40 border border-green-500/30' : 'bg-white/5'}`}>
                    <div className="flex justify-between items-center text-xs">
                      <span className={`${winner ? 'text-green-400 line-through' : 'text-gray-300'}`}>{prize}</span>
                      <span className="text-amber-400 font-bold">₹{amount?.toLocaleString()}</span>
                    </div>
                    {winner && (
                      <p className="text-green-300 text-[10px] mt-0.5">
                        🎉 {winner.holder_name || winner.name || 'Winner'}
                        {winner.ticket_number && <span className="text-green-400 ml-1">({winner.ticket_number})</span>}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
                  if (bestRemaining < 999) {
                    playerStats.push({
                      ...player,
                      bestRemaining
                    });
                  }
                });
                
                // Sort by remaining (ascending), show up to 6 players
                const topPlayers = playerStats
                  .sort((a, b) => a.bestRemaining - b.bestRemaining)
                  .slice(0, 6);
                
                if (topPlayers.length === 0) {
                  return <div className="col-span-3 text-center text-gray-500 text-xs py-2">No players yet</div>;
                }
                
                return topPlayers.map((player, idx) => (
                  <div key={player.user_id || idx} className="bg-white/5 rounded-lg p-2 text-center">
                    <p className="text-white text-xs font-medium truncate">
                      {player.name?.split(' ')[0] || 'Player'}
                    </p>
                    <div className="flex justify-center gap-0.5 mt-1">
                      {Array.from({ length: Math.min(player.bestRemaining, 5) }).map((_, i) => (
                        <span key={i} className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      ))}
                    </div>
                  </div>
                ));
              })()
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

        {/* Called Numbers - Fill lines, max 4 rows */}
        <div className="glass-card p-3 mb-4">
          <h3 className="text-xs font-semibold text-gray-400 mb-2">Called Numbers ({session?.called_numbers?.length || 0})</h3>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(22px,1fr))] gap-1" style={{ maxHeight: '104px', overflow: 'hidden' }}>
            {(() => {
              const called = session?.called_numbers || [];
              if (called.length === 0) {
                return <p className="text-[10px] text-gray-400 col-span-full">No numbers called yet</p>;
              }
              // Show all called numbers in reverse order (latest first)
              return [...called].reverse().map((num, idx) => (
                <div
                  key={idx}
                  className={`w-[22px] h-[22px] rounded-full bg-gradient-to-br ${getBallColor(num)} flex items-center justify-center text-[9px] font-bold text-white shadow-sm ${idx === 0 ? 'ring-1 ring-amber-400 scale-110' : ''}`}
                >
                  {num}
                </div>
              ));
            })()}
          </div>
        </div>

        {/* My Tickets Section - Show player's booked tickets */}
        {myTickets.length > 0 && (
          <div className="glass-card p-4 mb-6">
            <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
              🎫 My Tickets ({myTickets.length}) {playerName && <span className="text-amber-400">- {playerName}</span>}
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {myTickets.map((ticket, idx) => {
                const calledSet = new Set(session?.called_numbers || []);
                const allNums = ticket.numbers?.flat().filter(n => n !== null) || [];
                const markedCount = allNums.filter(n => calledSet.has(n)).length;
                const remaining = 15 - markedCount;
                
                return (
                  <div key={ticket.ticket_id || idx} className="bg-white rounded-lg p-2 shadow-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-gray-700">{ticket.ticket_number}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        remaining <= 3 ? 'bg-red-100 text-red-600 font-bold' : 
                        remaining <= 6 ? 'bg-amber-100 text-amber-600' : 
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {remaining} left
                      </span>
                    </div>
                    <div className="grid grid-cols-9 gap-0.5">
                      {ticket.numbers?.map((row, rowIdx) => (
                        row.map((num, colIdx) => {
                          const isMarked = num && calledSet.has(num);
                          return (
                            <div
                              key={`${rowIdx}-${colIdx}`}
                              className={`aspect-square flex items-center justify-center text-[9px] md:text-[10px] font-bold rounded ${
                                num 
                                  ? isMarked 
                                    ? 'bg-green-500 text-white ring-1 ring-green-600' 
                                    : 'bg-amber-100 text-amber-900'
                                  : 'bg-gray-100'
                              }`}
                            >
                              {num || ''}
                            </div>
                          );
                        })
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* If no tickets found, show option to enter name */}
        {myTickets.length === 0 && !isHost && game?.status === 'live' && (
          <div className="glass-card p-4 mb-6 text-center">
            <p className="text-gray-400 mb-3">Enter your name to see your tickets:</p>
            <div className="flex gap-2 max-w-xs mx-auto">
              <input
                type="text"
                placeholder="Your name"
                className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
              />
              <button
                onClick={() => {
                  const myPlayer = players.find(p => p.name.toLowerCase() === playerName.toLowerCase());
                  if (myPlayer) {
                    setMyTickets(myPlayer.tickets || []);
                    localStorage.setItem(`tambola_player_${userGameId}`, JSON.stringify({ name: playerName }));
                    toast.success(`Found ${myPlayer.tickets?.length || 0} tickets!`);
                  } else {
                    toast.error('Player not found. Check your name.');
                  }
                }}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600"
              >
                Find
              </button>
            </div>
          </div>
        )}

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
