import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, Volume2, VolumeX, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { getCallName } from '@/utils/tambolaCallNames';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function LiveGame() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [session, setSession] = useState(null);
  const [myTickets, setMyTickets] = useState([]);
  const [allBookedTickets, setAllBookedTickets] = useState([]);
  const [markedNumbers, setMarkedNumbers] = useState(new Set());
  const [topPlayers, setTopPlayers] = useState([]);
  const [previousWinners, setPreviousWinners] = useState({});
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [ticketZoom, setTicketZoom] = useState(2);
  const [lastPlayedNumber, setLastPlayedNumber] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [showAudioPrompt, setShowAudioPrompt] = useState(true);
  const [isAnnouncing, setIsAnnouncing] = useState(false);
  const pollInterval = useRef(null);
  const audioRef = useRef(null);
  const ttsAudioRef = useRef(null);
  const audioContextRef = useRef(null);
  const speechSynthRef = useRef(null);
  const lastAnnouncedRef = useRef(null);

  // Pre-load voices for better mobile performance
  const loadVoices = useCallback(() => {
    if ('speechSynthesis' in window) {
      const voices = window.speechSynthesis.getVoices();
      const indianVoice = voices.find(v => v.lang.includes('en-IN'));
      const englishVoice = voices.find(v => v.lang.includes('en-GB') || v.lang.includes('en-US'));
      speechSynthRef.current = indianVoice || englishVoice || voices[0];
    }
  }, []);

  // Enable audio on user interaction (required for mobile)
  const enableAudio = async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      await audioContextRef.current.resume();
      
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;
        const utterance = new SpeechSynthesisUtterance('');
        utterance.volume = 0;
        window.speechSynthesis.speak(utterance);
      }
      
      const silentAudio = new Audio('data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRBqpAAAAAAD/+0DEAAAHAAGgAAAANIAAANIAAAATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+0LEJgAAA0gAAAAADSAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=');
      await silentAudio.play().catch(() => {});
      
      setAudioEnabled(true);
      setShowAudioPrompt(false);
    } catch (error) {
      console.error('Failed to enable audio:', error);
    }
  };

  const celebrateWinner = (prizeType) => {
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.6 },
      colors: ['#FCD34D', '#F59E0B', '#D97706', '#10B981']
    });
    toast.success(`🎉 ${prizeType} Winner!`, { duration: 5000 });
  };

  const playNumberSound = () => {
    if (soundEnabled && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  };

  // Play TTS for number announcement
  const playTTSAnnouncement = async (number) => {
    // Prevent duplicate announcements and check conditions
    if (!soundEnabled || !audioEnabled || isAnnouncing || game?.status === 'completed') return;
    if (lastAnnouncedRef.current === number) return;
    
    lastAnnouncedRef.current = number;
    setIsAnnouncing(true);
    setLastPlayedNumber(number);
    
    const callName = getCallName(number);
    
    try {
      // Try API-generated audio first
      const response = await axios.post(
        `${API}/tts/generate?text=${encodeURIComponent(callName)}&include_prefix=false`,
        {},
        { timeout: 5000 }
      );
      
      if (response.data.enabled && response.data.audio && !response.data.use_browser_tts) {
        await playAudioData(response.data.audio);
      } else {
        await speakWithBrowserTTS(callName);
      }
    } catch (error) {
      console.log('API TTS unavailable, using browser TTS');
      await speakWithBrowserTTS(callName);
    } finally {
      setIsAnnouncing(false);
    }
  };

  // Play base64 audio data
  const playAudioData = (base64Audio) => {
    return new Promise((resolve) => {
      try {
        if (audioContextRef.current?.state === 'suspended') {
          audioContextRef.current.resume();
        }
        
        if (ttsAudioRef.current) {
          ttsAudioRef.current.pause();
        }
        
        const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
        ttsAudioRef.current = audio;
        
        audio.onended = resolve;
        audio.onerror = () => resolve();
        
        audio.play().catch(() => resolve());
        setTimeout(resolve, 8000);
      } catch (e) {
        resolve();
      }
    });
  };

  const speakWithBrowserTTS = (text) => {
    return new Promise((resolve) => {
      if (!('speechSynthesis' in window) || !audioEnabled) {
        resolve();
        return;
      }
      
      try {
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        if (speechSynthRef.current) {
          utterance.voice = speechSynthRef.current;
        }
        
        utterance.onend = resolve;
        utterance.onerror = resolve;
        
        window.speechSynthesis.speak(utterance);
        setTimeout(resolve, 10000);
      } catch (e) {
        resolve();
      }
    });
  };

  useEffect(() => {
    fetchGameData();
    loadVoices();
    fetchMyTickets();
    fetchAllBookedTickets();
    pollInterval.current = setInterval(() => {
      fetchSession();
      calculateTopPlayers();
    }, 3000);
    return () => { if (pollInterval.current) clearInterval(pollInterval.current); };
  }, [gameId]);

  useEffect(() => {
    if (session && session.called_numbers) {
      setMarkedNumbers(new Set(session.called_numbers));
      if (session.winners) {
        const currentWinners = Object.keys(session.winners);
        const previousWinnerKeys = Object.keys(previousWinners);
        const newWinnerPrizes = currentWinners.filter(prize => !previousWinnerKeys.includes(prize));
        if (newWinnerPrizes.length > 0) newWinnerPrizes.forEach(prize => celebrateWinner(prize));
        setPreviousWinners(session.winners);
      }
      if (session.current_number && session.current_number !== previousWinners.lastNumber) {
        // Play TTS announcement for new number
        playTTSAnnouncement(session.current_number);
        setPreviousWinners(prev => ({ ...prev, lastNumber: session.current_number }));
      }
    }
  }, [session]);

  const fetchGameData = async () => {
    try {
      const response = await axios.get(`${API}/games/${gameId}`);
      setGame(response.data);
      fetchSession();
    } catch (error) { console.error('Failed to fetch game:', error); }
  };

  const fetchSession = async () => {
    try {
      const response = await axios.get(`${API}/games/${gameId}/session`);
      const newSession = response.data;
      
      // Check if game ended
      if (newSession.status === 'completed' && game?.status !== 'completed') {
        // Stop polling
        if (pollInterval.current) {
          clearInterval(pollInterval.current);
          pollInterval.current = null;
        }
        // Stop all sounds
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
        if (ttsAudioRef.current) {
          ttsAudioRef.current.pause();
        }
        // Update game status
        setGame(prev => ({ ...prev, status: 'completed' }));
        toast.success('🎉 Game Completed! All prizes have been claimed.');
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }
      
      setSession(newSession);
    } catch (error) { console.error('Failed to fetch session:', error); }
  };

  const fetchMyTickets = async () => {
    try {
      const bookingsResponse = await axios.get(`${API}/bookings/my`, { withCredentials: true });
      const myGameBookings = bookingsResponse.data.filter(b => b.game_id === gameId && b.status === 'confirmed');
      if (myGameBookings.length > 0) {
        const ticketIds = myGameBookings.flatMap(b => b.ticket_ids);
        const ticketsResponse = await axios.get(`${API}/games/${gameId}/tickets?page=1&limit=600`);
        const allTickets = ticketsResponse.data.tickets;
        setMyTickets(allTickets.filter(t => ticketIds.includes(t.ticket_id)));
      }
    } catch (error) { console.error('Failed to fetch my tickets:', error); }
  };

  const fetchAllBookedTickets = async () => {
    try {
      const ticketsResponse = await axios.get(`${API}/games/${gameId}/tickets?page=1&limit=600`);
      setAllBookedTickets(ticketsResponse.data.tickets.filter(t => t.is_booked && t.booking_status === 'confirmed'));
    } catch (error) { console.error('Failed to fetch booked tickets:', error); }
  };

  const calculateTopPlayers = () => {
    if (!session || !allBookedTickets.length) return;
    const calledSet = new Set(session.called_numbers);
    const playerProgress = {};
    allBookedTickets.forEach(ticket => {
      const oderId = ticket.user_id || ticket.booked_by_name;
      if (!oderId) return;
      let markedCount = 0;
      ticket.numbers.forEach(row => {
        row.forEach(num => { if (num && calledSet.has(num)) markedCount++; });
      });
      if (!playerProgress[oderId]) {
        playerProgress[oderId] = { name: ticket.booked_by_name || `Player ${String(oderId).slice(-4)}`, totalMarked: 0 };
      }
      playerProgress[oderId].totalMarked += markedCount;
    });
    setTopPlayers(Object.values(playerProgress).sort((a, b) => b.totalMarked - a.totalMarked).slice(0, 5));
  };

  const getBallColor = (num) => {
    if (!num) return 'from-gray-400 to-gray-600';
    if (num <= 10) return 'from-red-400 to-red-600';
    if (num <= 20) return 'from-orange-400 to-orange-600';
    if (num <= 30) return 'from-yellow-400 to-yellow-600';
    if (num <= 40) return 'from-green-400 to-green-600';
    if (num <= 50) return 'from-teal-400 to-teal-600';
    if (num <= 60) return 'from-cyan-400 to-cyan-600';
    if (num <= 70) return 'from-blue-400 to-blue-600';
    if (num <= 80) return 'from-indigo-400 to-indigo-600';
    return 'from-purple-400 to-purple-600';
  };

  if (!game || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c]">
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // Check if game is completed
  const isGameCompleted = game.status === 'completed' || session.status === 'completed';
  const allWinners = session.winners || {};
  const totalPrizes = Object.keys(game.prizes || {}).length;
  const wonPrizes = Object.keys(allWinners).length;

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
                  Ticket: {winner.ticket_number || winner.name || 'Winner'}
                </p>
              </div>
            ))}
          </div>
          
          <p className="text-gray-500 text-sm mb-4">
            Total numbers called: {session.called_numbers?.length || 0}/90
          </p>
          
          <Button 
            onClick={() => navigate('/')} 
            className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
          >
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a3d2c] to-[#0a0a0c] overflow-y-auto">
      <audio ref={audioRef} src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGD0fPTgjMGHm7A7+OZTA0OVqzl7K1aFwlInN/zxmwlBSp9zPLdjTkIGGS38+OXRQwRX7fn77hjGQc9k9TxwXEcBip6yO7glT0KFF24+fGmXRoJQ5vd88dxKAYrdMnx3I0+ChljuO3nnEcNElWv5OysWxYLSJvf88lwKAUrdsrw3Y0/ChVhuvDmnUgOElu05+ytXBcLS5zf88hwJwYreMnw3I5AChZivPDmnUkOElm05u6sXBgLTZve8slxJQYrecrw3Y5AChZivPDlnUoOE1u15u6rXBcLS5vc9MlxJgYse8nw3Y5AChZivPDlnUoOE1u15u6rXBcLS5vc9MlxJgYse8nw3Y5AChZivPDlnUoO" preload="auto" />
      
      {/* Audio Enable Prompt for Mobile */}
      {showAudioPrompt && !audioEnabled && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-[#1a1a1f] rounded-2xl p-6 max-w-sm w-full text-center border border-amber-500/30">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Volume2 className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Enable Sound</h2>
            <p className="text-gray-400 text-sm mb-6">
              Tap to enable number announcements. Required for audio on mobile.
            </p>
            <Button
              onClick={enableAudio}
              className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold rounded-full"
            >
              <Volume2 className="w-5 h-5 mr-2" /> Enable Sound
            </Button>
            <button
              onClick={() => setShowAudioPrompt(false)}
              className="mt-3 text-gray-500 text-sm hover:text-gray-400"
            >
              Continue without sound
            </button>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div className="bg-black/30 backdrop-blur-sm border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="h-8 w-8 text-white">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-sm font-bold text-white">{game.name}</h1>
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-400 animate-pulse">● LIVE</span>
                <span className="text-xs text-emerald-400">Auto-calling</span>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setSoundEnabled(!soundEnabled)} className="h-8 w-8 text-white">
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-2 py-2 space-y-2">
        
        {/* Row 1: Caller Ball | Dividends - Equal Space */}
        <div className="grid grid-cols-2 gap-2">
          {/* LEFT: Compact Ball + Number Count */}
          <div className="bg-black/30 backdrop-blur-sm rounded-lg p-2 border border-white/10 flex flex-col items-center justify-center">
            <div className="relative">
              <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${getBallColor(session.current_number)} flex items-center justify-center shadow-xl`}
                style={{ boxShadow: '0 8px 20px rgba(0,0,0,0.4), inset 0 -4px 10px rgba(0,0,0,0.3), inset 0 4px 10px rgba(255,255,255,0.3)' }}>
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-inner">
                  <span className="text-xl font-black text-gray-900">{session.current_number || '?'}</span>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-amber-400 font-semibold mt-1">{session.called_numbers?.length || 0}/90</p>
          </div>

          {/* RIGHT: Dividends List with Winner Names */}
          <div className="bg-black/30 backdrop-blur-sm rounded-lg p-2 border border-white/10">
            <div className="flex items-center gap-1 mb-1">
              <Trophy className="w-3 h-3 text-amber-500" />
              <span className="text-[10px] font-bold text-white">DIVIDENDS</span>
            </div>
            <div className="space-y-0.5 max-h-36 overflow-y-auto">
              {game.prizes && Object.entries(game.prizes).map(([prize, amount]) => {
                const winner = session.winners?.[prize];
                return (
                  <div key={prize} className={`px-1.5 py-0.5 rounded ${winner ? 'bg-green-500/20' : 'bg-white/5'}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-[9px] ${winner ? 'text-green-400' : 'text-gray-300'}`}>{prize}</span>
                      <span className="text-[9px] font-bold text-amber-400">₹{amount}</span>
                    </div>
                    {winner && (
                      <p className="text-[8px] text-green-300 truncate">🏆 {winner.holder_name || winner.name || 'Winner'}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Top Players - Show names from beginning */}
        <div className="bg-black/30 backdrop-blur-sm rounded-lg p-2 border border-white/10">
          <h3 className="text-[10px] font-bold text-amber-400 mb-1 text-center">TOP PLAYERS</h3>
          <div className="grid grid-cols-4 gap-1">
            {allBookedTickets.length > 0 ? (
              (() => {
                // Calculate marks for all players
                const calledSet = new Set(session.called_numbers || []);
                const playerMarks = {};
                
                allBookedTickets.forEach(ticket => {
                  const playerId = ticket.user_id || ticket.holder_name || ticket.booked_by_name;
                  const playerName = ticket.holder_name || ticket.booked_by_name || 'Player';
                  
                  if (!playerMarks[playerId]) {
                    playerMarks[playerId] = { name: playerName, marks: 0 };
                  }
                  
                  if (ticket.numbers) {
                    ticket.numbers.forEach(row => {
                      row.forEach(num => {
                        if (num && calledSet.has(num)) {
                          playerMarks[playerId].marks++;
                        }
                      });
                    });
                  }
                });
                
                // Sort by marks
                const sortedPlayers = Object.values(playerMarks)
                  .sort((a, b) => b.marks - a.marks)
                  .slice(0, 4);
                
                return sortedPlayers.map((player, idx) => (
                  <div key={idx} className={`rounded p-1 text-center ${
                    idx === 0 ? 'bg-amber-500/30' : idx === 1 ? 'bg-gray-500/20' : idx === 2 ? 'bg-orange-600/20' : 'bg-white/5'
                  }`}>
                    <p className="text-[9px] text-white truncate">{player.name?.split(' ')[0]}</p>
                    <p className="text-[8px] text-amber-400">{player.marks}</p>
                  </div>
                ));
              })()
            ) : (
              <p className="col-span-4 text-[9px] text-gray-500 text-center py-1">Waiting for players...</p>
            )}
          </div>
        </div>

        {/* Row 2: Last Called Numbers */}
        <div className="bg-black/30 backdrop-blur-sm rounded-lg p-2 border border-white/10">
          <div className="flex gap-1.5 overflow-x-auto">
            {session.called_numbers && session.called_numbers.length > 0 ? (
              [...session.called_numbers].reverse().slice(0, 12).map((num, index) => (
                <div key={num} className={`w-7 h-7 flex-shrink-0 rounded-full bg-gradient-to-br ${getBallColor(num)} flex items-center justify-center text-[9px] font-bold text-white shadow-md ${index === 0 ? 'ring-2 ring-white scale-110' : ''}`}>
                  {num}
                </div>
              ))
            ) : <p className="text-[10px] text-gray-400">No numbers called yet</p>}
          </div>
        </div>

        {/* Row 3: My Tickets - Full Width */}
        {myTickets.length > 0 && (
          <div className="bg-black/30 backdrop-blur-sm rounded-lg p-2 border border-white/10">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-white">My Tickets ({myTickets.length})</h3>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => setTicketZoom(Math.max(1, ticketZoom - 1))} disabled={ticketZoom <= 1} className="h-5 w-5 text-white hover:bg-white/10">
                  <ZoomOut className="w-3 h-3" />
                </Button>
                <span className="text-[9px] text-gray-400 w-5 text-center">{ticketZoom === 1 ? 'S' : ticketZoom === 2 ? 'M' : 'L'}</span>
                <Button variant="ghost" size="icon" onClick={() => setTicketZoom(Math.min(3, ticketZoom + 1))} disabled={ticketZoom >= 3} className="h-5 w-5 text-white hover:bg-white/10">
                  <ZoomIn className="w-3 h-3" />
                </Button>
              </div>
            </div>
            
            <div className={`grid gap-2 ${ticketZoom === 1 ? 'grid-cols-3' : ticketZoom === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {myTickets.map((ticket) => {
                return (
                  <div key={ticket.ticket_id} className={`bg-amber-50 rounded-lg transition-all duration-300 ${ticketZoom === 1 ? 'p-1' : ticketZoom === 2 ? 'p-2' : 'p-3'}`}>
                    <p className={`font-bold text-amber-700 mb-1 ${ticketZoom === 1 ? 'text-[7px]' : ticketZoom === 2 ? 'text-[9px]' : 'text-sm'}`}>{ticket.ticket_number}</p>
                    <div className="grid grid-cols-9 gap-px">
                      {ticket.numbers.map((row, rowIndex) => (
                        row.map((num, colIndex) => {
                          const isMarked = num && markedNumbers.has(num);
                          return (
                            <div key={`${rowIndex}-${colIndex}`} className={`flex items-center justify-center font-bold rounded-sm transition-all ${
                              ticketZoom === 1 ? 'aspect-square text-[6px]' : ticketZoom === 2 ? 'aspect-square text-[10px]' : 'aspect-[1.3/1] text-base py-1'
                            } ${num === null ? 'bg-amber-100' : isMarked ? 'bg-green-500 text-white' : 'bg-white text-gray-800 border border-gray-200'}`}>
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

        <div className="h-4" />
      </div>
    </div>
  );
}
