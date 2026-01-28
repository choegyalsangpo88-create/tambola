import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Play, Pause, Square, Volume2, VolumeX, Share2, Copy, Check } from 'lucide-react';
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
    <div className="grid grid-cols-10 gap-1 p-2 bg-black/30 rounded-xl">
      {numbers.map(num => {
        const isCalled = calledNumbers.includes(num);
        const isCurrent = num === currentNumber;
        
        return (
          <div
            key={num}
            className={`
              w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg 
              text-sm sm:text-base font-bold transition-all duration-300
              ${isCurrent ? 'bg-amber-500 text-black scale-110 animate-pulse ring-2 ring-amber-300' : 
                isCalled ? 'bg-green-500 text-white' : 
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

// Current Ball Display
function CurrentBall({ number, callName }) {
  if (!number) return null;
  
  return (
    <div className="flex flex-col items-center justify-center py-6">
      <div className="relative">
        <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-2xl animate-bounce">
          <span className="text-5xl sm:text-6xl font-black text-white drop-shadow-lg">
            {number}
          </span>
        </div>
        <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-24 h-3 bg-black/20 rounded-full blur-sm" />
      </div>
      {callName && (
        <p className="mt-4 text-lg sm:text-xl text-amber-400 font-bold text-center">
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
  
  const pollIntervalRef = useRef(null);
  const autoCallIntervalRef = useRef(null);
  const calledCountRef = useRef(0);
  const isMountedRef = useRef(true);
  const lastAnnouncedRef = useRef(null);
  const isAnnouncingRef = useRef(false);

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
  useEffect(() => {
    if (game && game.status === 'live') {
      pollIntervalRef.current = setInterval(pollGameState, 2000);
      return () => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      };
    }
  }, [game?.status]);

  const fetchGameData = async () => {
    try {
      let response;
      if (shareCode) {
        // Viewer mode - fetch by share code
        response = await axios.get(`${API}/user-games/code/${shareCode}`);
      } else {
        // Host mode - fetch by ID
        response = await axios.get(`${API}/user-games/${userGameId}`);
        
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
      setCalledNumbers(gameData.called_numbers || []);
      setCurrentNumber(gameData.current_number);
      calledCountRef.current = gameData.called_numbers?.length || 0;
      
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
      const endpoint = shareCode 
        ? `${API}/user-games/share/${shareCode}/poll?last_count=${calledCountRef.current}`
        : `${API}/user-games/${userGameId}/poll?last_count=${calledCountRef.current}`;
      
      const response = await axios.get(endpoint);
      const data = response.data;
      
      if (!isMountedRef.current) return;
      
      // Update game status
      if (data.status !== game?.status) {
        setGame(prev => prev ? { ...prev, status: data.status } : prev);
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
          announceNumber(latestNumber);
        }
      }
      
      // Stop polling if game completed
      if (data.status === 'completed') {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        if (autoCallIntervalRef.current) clearInterval(autoCallIntervalRef.current);
        setIsPlaying(false);
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
    try {
      await axios.post(
        `${API}/user-games/${userGameId}/start`,
        {},
        { headers: getAuthHeaders(), withCredentials: true }
      );
      setGame(prev => prev ? { ...prev, status: 'live' } : prev);
      toast.success('Game started!');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start game');
    }
  };

  const handleCallNextNumber = async () => {
    if (calledNumbers.length >= 90) {
      toast.info('All numbers have been called!');
      return;
    }
    
    try {
      const response = await axios.post(
        `${API}/user-games/${userGameId}/call-number`,
        {},
        { headers: getAuthHeaders(), withCredentials: true }
      );
      
      const newNumber = response.data.current_number;
      if (newNumber) {
        setCurrentNumber(newNumber);
        setCurrentCallName(getCallName(newNumber));
        setCalledNumbers(prev => [...prev, newNumber]);
        calledCountRef.current += 1;
        announceNumber(newNumber);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to call number');
    }
  };

  const handleToggleAutoCall = () => {
    if (isPlaying) {
      // Stop auto-calling
      if (autoCallIntervalRef.current) {
        clearInterval(autoCallIntervalRef.current);
        autoCallIntervalRef.current = null;
      }
      setIsPlaying(false);
      toast.info('Auto-call paused');
    } else {
      // Start auto-calling
      const interval = (game?.call_interval || 8) * 1000;
      
      // Call first number immediately
      handleCallNextNumber();
      
      autoCallIntervalRef.current = setInterval(() => {
        if (calledNumbers.length < 90) {
          handleCallNextNumber();
        } else {
          if (autoCallIntervalRef.current) {
            clearInterval(autoCallIntervalRef.current);
            autoCallIntervalRef.current = null;
          }
          setIsPlaying(false);
        }
      }, interval);
      
      setIsPlaying(true);
      toast.success(`Auto-calling every ${game?.call_interval || 8} seconds`);
    }
  };

  const handleEndGame = async () => {
    if (!window.confirm('Are you sure you want to end this game?')) return;
    
    if (autoCallIntervalRef.current) {
      clearInterval(autoCallIntervalRef.current);
      autoCallIntervalRef.current = null;
    }
    setIsPlaying(false);
    
    try {
      await axios.post(
        `${API}/user-games/${userGameId}/end`,
        {},
        { headers: getAuthHeaders(), withCredentials: true }
      );
      setGame(prev => prev ? { ...prev, status: 'completed' } : prev);
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
    <div className="min-h-screen bg-[#0a0a0c]">
      {/* Header */}
      <div className="bg-[#121216] border-b border-white/10 sticky top-0 z-50">
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
              <h1 className="text-lg font-bold text-white">{game.name}</h1>
              <p className="text-xs text-gray-400">
                {isHost ? 'Host' : `Hosted by ${game.host_name}`}
                {game.status === 'live' && <span className="ml-2 text-green-400">● LIVE</span>}
                {game.status === 'completed' && <span className="ml-2 text-gray-400">● ENDED</span>}
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
                Enable Sound
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
                {copied ? <Check className="w-4 h-4 mr-1" /> : <Share2 className="w-4 h-4 mr-1" />}
                {copied ? 'Copied!' : 'Share'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Current Ball Display */}
        <CurrentBall number={currentNumber} callName={currentCallName} />
        
        {/* Stats Bar */}
        <div className="flex items-center justify-center gap-6 text-center">
          <div>
            <p className="text-3xl font-bold text-white">{calledNumbers.length}</p>
            <p className="text-xs text-gray-400">Called</p>
          </div>
          <div className="w-px h-10 bg-white/20" />
          <div>
            <p className="text-3xl font-bold text-gray-400">{90 - calledNumbers.length}</p>
            <p className="text-xs text-gray-400">Remaining</p>
          </div>
        </div>

        {/* Host Controls */}
        {isHost && game.status !== 'completed' && (
          <div className="flex items-center justify-center gap-3">
            {game.status === 'upcoming' ? (
              <Button
                onClick={handleStartGame}
                className="h-14 px-8 text-lg font-bold bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
              >
                <Play className="w-5 h-5 mr-2" />
                Start Game
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleToggleAutoCall}
                  className={`h-14 px-6 text-lg font-bold ${
                    isPlaying 
                      ? 'bg-amber-500 hover:bg-amber-600' 
                      : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                  }`}
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-5 h-5 mr-2" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 mr-2" />
                      Auto Call
                    </>
                  )}
                </Button>
                
                <Button
                  onClick={handleCallNextNumber}
                  variant="outline"
                  className="h-14 px-6 text-lg font-bold border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
                  disabled={isPlaying || calledNumbers.length >= 90}
                >
                  Call Next
                </Button>
                
                <Button
                  onClick={handleEndGame}
                  variant="outline"
                  className="h-14 px-6 text-lg font-bold border-red-500/50 text-red-400 hover:bg-red-500/10"
                >
                  <Square className="w-5 h-5 mr-2" />
                  End
                </Button>
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
        {game.status === 'completed' && (
          <div className="text-center p-6 bg-white/5 rounded-xl border border-white/10">
            <p className="text-2xl font-bold text-white mb-2">Game Ended!</p>
            <p className="text-gray-400">{calledNumbers.length} numbers were called</p>
          </div>
        )}

        {/* Share Code for Viewers */}
        {game.share_code && (
          <div className="text-center p-4 bg-purple-500/10 rounded-xl border border-purple-500/30">
            <p className="text-sm text-purple-300 mb-2">Share Code</p>
            <p className="text-3xl font-bold text-purple-400 tracking-widest">{game.share_code}</p>
            <p className="text-xs text-gray-500 mt-2">Others can view at: /audio-view/{game.share_code}</p>
          </div>
        )}
      </div>
    </div>
  );
}
