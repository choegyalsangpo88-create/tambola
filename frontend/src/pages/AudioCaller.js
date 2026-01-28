import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Play, Pause, RotateCcw, Square, Volume2, VolumeX, Share2, Copy, Check, Mic } from 'lucide-react';
import { toast } from 'sonner';
import { getCallName } from '../utils/tambolaCallNames';
import { unlockMobileAudio, speakText } from '../utils/audioHelper';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Get auth headers for API calls
const getAuthHeaders = () => {
  const session = localStorage.getItem('tambola_session');
  return session ? { 'Authorization': `Bearer ${session}` } : {};
};

// Number Board Component - Shows all 1-90 numbers with called ones highlighted
function NumberBoard({ calledNumbers, currentNumber }) {
  const numbers = Array.from({ length: 90 }, (_, i) => i + 1);
  
  return (
    <div className="grid grid-cols-10 gap-1 p-3 bg-black/40 rounded-2xl">
      {numbers.map(num => {
        const isCalled = calledNumbers.includes(num);
        const isCurrent = num === currentNumber;
        
        return (
          <div
            key={num}
            className={`
              aspect-square flex items-center justify-center rounded-lg 
              text-sm sm:text-base font-bold transition-all duration-300
              ${isCurrent ? 'bg-amber-500 text-black scale-110 ring-4 ring-amber-300/50 shadow-lg shadow-amber-500/30' : 
                isCalled ? 'bg-green-500 text-white shadow-md' : 
                'bg-white/10 text-gray-500'}
            `}
          >
            {num}
          </div>
        );
      })}
    </div>
  );
}

// Large Current Ball Display
function CurrentBall({ number, callName, isAnimating }) {
  if (!number) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center border-4 border-gray-600">
          <Mic className="w-16 h-16 text-gray-500" />
        </div>
        <p className="mt-4 text-gray-500 text-lg">Press Start to begin</p>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col items-center justify-center py-6">
      <div className="relative">
        <div className={`
          w-36 h-36 sm:w-44 sm:h-44 rounded-full 
          bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 
          flex items-center justify-center 
          shadow-2xl shadow-amber-500/40
          border-4 border-amber-300/50
          ${isAnimating ? 'animate-bounce' : ''}
        `}>
          <span className="text-6xl sm:text-7xl font-black text-white drop-shadow-lg">
            {number}
          </span>
        </div>
        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-28 h-4 bg-black/30 rounded-full blur-md" />
      </div>
      {callName && (
        <p className="mt-5 text-xl sm:text-2xl text-amber-400 font-bold text-center px-4">
          &quot;{callName}&quot;
        </p>
      )}
    </div>
  );
}

export default function AudioCaller() {
  const { userGameId, shareCode } = useParams();
  const navigate = useNavigate();
  
  const [game, setGame] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [calledNumbers, setCalledNumbers] = useState([]);
  const [currentNumber, setCurrentNumber] = useState(null);
  const [currentCallName, setCurrentCallName] = useState('');
  const [copied, setCopied] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [gameStatus, setGameStatus] = useState('upcoming'); // upcoming, live, completed
  
  const pollIntervalRef = useRef(null);
  const autoCallIntervalRef = useRef(null);
  const calledCountRef = useRef(0);
  const isMountedRef = useRef(true);
  const lastAnnouncedRef = useRef(null);
  const isAnnouncingRef = useRef(false);
  const gameIdRef = useRef(null);

  // Unlock audio on iOS/mobile
  const unlockAudio = useCallback(async () => {
    try {
      await unlockMobileAudio();
      setAudioUnlocked(true);
      toast.success('🔊 Sound enabled!');
    } catch (e) {
      console.log('Audio unlock failed:', e);
      setAudioUnlocked(true);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    isMountedRef.current = true;
    fetchGameData();
    
    return () => {
      isMountedRef.current = false;
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (autoCallIntervalRef.current) clearInterval(autoCallIntervalRef.current);
    };
  }, [userGameId, shareCode]);

  // Start polling when game is live
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (gameStatus === 'live') {
      pollIntervalRef.current = setInterval(pollGameState, 2000);
      return () => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      };
    }
  }, [gameStatus]);

  const fetchGameData = async () => {
    try {
      let response;
      if (shareCode) {
        // Viewer mode - fetch by share code
        response = await axios.get(`${API}/user-games/code/${shareCode}`);
      } else {
        // Host mode - fetch by ID
        response = await axios.get(`${API}/user-games/${userGameId}`);
        gameIdRef.current = userGameId;
        
        // Check if current user is host
        const userRes = await axios.get(`${API}/auth/me`, { 
          withCredentials: true,
          headers: getAuthHeaders()
        }).catch(() => null);
        
        if (userRes && userRes.data.user_id === response.data.host_user_id) {
          setIsHost(true);
        }
      }
      
      const gameData = response.data;
      setGame(gameData);
      setGameStatus(gameData.status || 'upcoming');
      setCalledNumbers(gameData.called_numbers || []);
      setCurrentNumber(gameData.current_number);
      calledCountRef.current = gameData.called_numbers?.length || 0;
      gameIdRef.current = gameData.user_game_id;
      
      if (gameData.current_number) {
        setCurrentCallName(getCallName(gameData.current_number));
      }
    } catch (error) {
      console.error('Failed to fetch game:', error);
      toast.error('Game not found');
    } finally {
      setIsLoading(false);
    }
  };

  const pollGameState = async () => {
    if (!isMountedRef.current) return;
    
    try {
      const gameId = gameIdRef.current;
      const endpoint = shareCode 
        ? `${API}/user-games/share/${shareCode}/poll?last_count=${calledCountRef.current}`
        : `${API}/user-games/${gameId}/poll?last_count=${calledCountRef.current}`;
      
      const response = await axios.get(endpoint);
      const data = response.data;
      
      if (!isMountedRef.current) return;
      
      // Update game status
      if (data.status !== gameStatus) {
        setGameStatus(data.status);
        if (data.status === 'completed') {
          stopAutoCall();
        }
      }
      
      // Update called numbers
      if (data.has_changes && data.new_numbers?.length > 0) {
        setCalledNumbers(data.all_called_numbers);
        calledCountRef.current = data.total_called;
        
        // Announce new numbers
        const latestNumber = data.new_numbers[data.new_numbers.length - 1];
        if (latestNumber && latestNumber !== lastAnnouncedRef.current) {
          setCurrentNumber(latestNumber);
          setCurrentCallName(getCallName(latestNumber));
          setIsAnimating(true);
          setTimeout(() => setIsAnimating(false), 1000);
          announceNumber(latestNumber);
        }
      }
    } catch (error) {
      console.error('Poll failed:', error);
    }
  };

  const announceNumber = async (number) => {
    if (!soundEnabled || isAnnouncingRef.current) return;
    if (number === lastAnnouncedRef.current) return;
    
    isAnnouncingRef.current = true;
    lastAnnouncedRef.current = number;
    
    try {
      const callName = getCallName(number);
      const text = `${number}. ${callName}`;
      await speakText(text);
    } catch (error) {
      console.error('TTS failed:', error);
    } finally {
      isAnnouncingRef.current = false;
    }
  };

  const handleStartGame = async () => {
    const gameId = gameIdRef.current || userGameId;
    try {
      await axios.post(
        `${API}/user-games/${gameId}/start`,
        {},
        { headers: getAuthHeaders(), withCredentials: true }
      );
      setGameStatus('live');
      toast.success('Game started!');
      
      // Start auto-calling immediately (default behavior)
      startAutoCall();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start game');
    }
  };

  const callNextNumber = async () => {
    if (calledNumbers.length >= 90) {
      toast.info('All 90 numbers have been called!');
      stopAutoCall();
      return false;
    }
    
    const gameId = gameIdRef.current || userGameId;
    try {
      const response = await axios.post(
        `${API}/user-games/${gameId}/call-number`,
        {},
        { headers: getAuthHeaders(), withCredentials: true }
      );
      
      const newNumber = response.data.current_number;
      if (newNumber) {
        setCurrentNumber(newNumber);
        setCurrentCallName(getCallName(newNumber));
        setCalledNumbers(prev => [...prev, newNumber]);
        calledCountRef.current += 1;
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 1000);
        announceNumber(newNumber);
        return true;
      }
      return false;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to call number');
      return false;
    }
  };

  const startAutoCall = () => {
    if (autoCallIntervalRef.current) return; // Already running
    
    const interval = (game?.call_interval || 8) * 1000;
    
    // Call first number immediately
    callNextNumber();
    
    autoCallIntervalRef.current = setInterval(async () => {
      const success = await callNextNumber();
      if (!success || calledNumbers.length >= 89) {
        stopAutoCall();
      }
    }, interval);
    
    setIsPlaying(true);
  };

  const stopAutoCall = () => {
    if (autoCallIntervalRef.current) {
      clearInterval(autoCallIntervalRef.current);
      autoCallIntervalRef.current = null;
    }
    setIsPlaying(false);
  };

  const handleToggleAutoCall = () => {
    if (isPlaying) {
      stopAutoCall();
      toast.info('Paused');
    } else {
      startAutoCall();
      toast.success(`Auto-calling every ${game?.call_interval || 8}s`);
    }
  };

  const handleResetGame = async () => {
    if (!window.confirm('Reset game? This will clear all called numbers.')) return;
    
    stopAutoCall();
    const gameId = gameIdRef.current || userGameId;
    
    try {
      // Reset the game in backend
      await axios.post(
        `${API}/user-games/${gameId}/reset`,
        {},
        { headers: getAuthHeaders(), withCredentials: true }
      );
      
      setCalledNumbers([]);
      setCurrentNumber(null);
      setCurrentCallName('');
      calledCountRef.current = 0;
      lastAnnouncedRef.current = null;
      setGameStatus('live');
      toast.success('Game reset!');
    } catch (error) {
      // If reset endpoint doesn't exist, just reset locally
      setCalledNumbers([]);
      setCurrentNumber(null);
      setCurrentCallName('');
      calledCountRef.current = 0;
      lastAnnouncedRef.current = null;
      toast.success('Game reset locally');
    }
  };

  const handleEndGame = async () => {
    if (!window.confirm('End this game?')) return;
    
    stopAutoCall();
    const gameId = gameIdRef.current || userGameId;
    
    try {
      await axios.post(
        `${API}/user-games/${gameId}/end`,
        {},
        { headers: getAuthHeaders(), withCredentials: true }
      );
      setGameStatus('completed');
      toast.success('Game ended!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to end game');
    }
  };

  const copyShareLink = () => {
    const link = `${window.location.origin}/audio-view/${game?.share_code}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c]">
        <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
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
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0c] to-[#1a1a2e]">
      {/* Header */}
      <div className="bg-black/50 backdrop-blur-md border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/')}
              className="text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold text-white">{game.name || 'Audio Caller'}</h1>
              <p className="text-xs text-gray-400">
                {isHost ? 'You are hosting' : `Hosted by ${game.host_name}`}
                {gameStatus === 'live' && <span className="ml-2 text-green-400 animate-pulse">● LIVE</span>}
                {gameStatus === 'completed' && <span className="ml-2 text-gray-400">● ENDED</span>}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Sound Toggle */}
            {!audioUnlocked ? (
              <Button
                onClick={unlockAudio}
                size="sm"
                className="bg-purple-500 hover:bg-purple-600 text-white"
              >
                <Volume2 className="w-4 h-4 mr-1" />
                Sound
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={soundEnabled ? 'text-green-400' : 'text-gray-500'}
              >
                {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              </Button>
            )}
            
            {/* Share Button (Host only) */}
            {isHost && game.share_code && (
              <Button
                variant="outline"
                size="sm"
                onClick={copyShareLink}
                className="border-purple-500/50 text-purple-400"
              >
                {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        
        {/* Current Ball Display */}
        <CurrentBall number={currentNumber} callName={currentCallName} isAnimating={isAnimating} />
        
        {/* Stats Bar */}
        <div className="flex items-center justify-center gap-8 text-center">
          <div className="bg-green-500/20 rounded-xl px-6 py-3">
            <p className="text-4xl font-black text-green-400">{calledNumbers.length}</p>
            <p className="text-xs text-green-300/70">Called</p>
          </div>
          <div className="bg-white/5 rounded-xl px-6 py-3">
            <p className="text-4xl font-black text-gray-400">{90 - calledNumbers.length}</p>
            <p className="text-xs text-gray-500">Remaining</p>
          </div>
        </div>

        {/* Host Controls */}
        {isHost && gameStatus !== 'completed' && (
          <div className="space-y-4">
            {gameStatus === 'upcoming' ? (
              /* Start Game Button */
              <Button
                onClick={handleStartGame}
                className="w-full h-20 text-2xl font-bold bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-2xl shadow-lg shadow-green-500/30"
              >
                <Play className="w-8 h-8 mr-3" />
                Start Game
              </Button>
            ) : (
              <>
                {/* Large Pause/Play Button */}
                <Button
                  onClick={handleToggleAutoCall}
                  className={`w-full h-24 text-3xl font-bold rounded-2xl shadow-xl transition-all ${
                    isPlaying 
                      ? 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-amber-500/30' 
                      : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-green-500/30'
                  }`}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-10 h-10 mr-3" />
                      PAUSE
                    </>
                  ) : (
                    <>
                      <Play className="w-10 h-10 mr-3" />
                      RESUME
                    </>
                  )}
                </Button>
                
                {/* Secondary Controls Row */}
                <div className="grid grid-cols-3 gap-3">
                  <Button
                    onClick={callNextNumber}
                    variant="outline"
                    className="h-14 text-sm font-bold border-purple-500/50 text-purple-400 hover:bg-purple-500/10 rounded-xl"
                    disabled={isPlaying || calledNumbers.length >= 90}
                  >
                    <Mic className="w-5 h-5 mr-2" />
                    Manual Call
                  </Button>
                  
                  <Button
                    onClick={handleResetGame}
                    variant="outline"
                    className="h-14 text-sm font-bold border-blue-500/50 text-blue-400 hover:bg-blue-500/10 rounded-xl"
                  >
                    <RotateCcw className="w-5 h-5 mr-2" />
                    Reset
                  </Button>
                  
                  <Button
                    onClick={handleEndGame}
                    variant="outline"
                    className="h-14 text-sm font-bold border-red-500/50 text-red-400 hover:bg-red-500/10 rounded-xl"
                  >
                    <Square className="w-5 h-5 mr-2" />
                    End
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Number Board */}
        <div>
          <h3 className="text-sm font-semibold text-gray-400 mb-3 text-center">Number Board</h3>
          <NumberBoard calledNumbers={calledNumbers} currentNumber={currentNumber} />
        </div>

        {/* Game Ended Message */}
        {gameStatus === 'completed' && (
          <div className="text-center p-6 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-2xl border border-purple-500/30">
            <p className="text-3xl font-bold text-white mb-2">🎉 Game Over!</p>
            <p className="text-gray-400">{calledNumbers.length} numbers were called</p>
          </div>
        )}

        {/* Share Code Display */}
        {game.share_code && (
          <div 
            className="text-center p-4 bg-purple-500/10 rounded-2xl border border-purple-500/30 cursor-pointer hover:bg-purple-500/20 transition-colors"
            onClick={copyShareLink}
          >
            <p className="text-xs text-purple-300 mb-1">Share Code (tap to copy link)</p>
            <p className="text-4xl font-black text-purple-400 tracking-[0.3em]">{game.share_code}</p>
          </div>
        )}
      </div>
    </div>
  );
}
