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
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [ticketZoom, setTicketZoom] = useState(2);
  const [lastPlayedNumber, setLastPlayedNumber] = useState(null);
  const pollInterval = useRef(null);
  const audioRef = useRef(null);
  const lastAnnouncedRef = useRef(null);
  const isAnnouncingRef = useRef(false);
  const previousWinnersRef = useRef({});

  // Unlock audio on iOS/mobile - MUST be triggered by user gesture
  const unlockAudio = useCallback(() => {
    const silentAudio = new Audio("data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7v////////////////////////////////");
    silentAudio.volume = 0.01;
    silentAudio.play().then(() => {
      setAudioUnlocked(true);
      toast.success('🔊 Sound enabled!');
    }).catch(() => {
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

  // Celebrate winner
  const celebrateWinner = (prize, winnerName) => {
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#FFD700', '#FFA500', '#FF6347', '#00FF00']
    });
    toast.success(`🏆 ${prize} Winner: ${winnerName}!`, { duration: 5000 });
  };

  // Play TTS announcement - uses server TTS for mobile compatibility
  const playTTSAnnouncement = async (number) => {
    if (!soundEnabled || !audioUnlocked || isAnnouncingRef.current || game?.status === 'completed') return;
    if (lastAnnouncedRef.current === number) return;
    
    lastAnnouncedRef.current = number;
    isAnnouncingRef.current = true;
    setLastPlayedNumber(number);
    
    const callName = getCallName(number);
    
    try {
      // Try server-side TTS first (most reliable for mobile)
      const played = await playServerTTS(callName);
      
      // Fallback to browser TTS if server TTS fails
      if (!played) {
        await speakWithBrowserTTS(callName);
      }
    } catch (error) {
      console.log('TTS error:', error);
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
          const audio = new Audio();
          audio.src = `data:audio/mp3;base64,${data.audio}`;
          audio.volume = 1.0;
          audio.preload = 'auto';
          
          audio.onended = () => resolve(true);
          audio.onerror = (e) => {
            console.log('Audio error:', e);
            resolve(false);
          };
          
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch((e) => {
              console.log('Play failed:', e);
              resolve(false);
            });
          }
          
          setTimeout(() => resolve(true), 6000);
        });
      }
      
      return false;
    } catch (e) {
      console.log('Server TTS error:', e);
      return false;
    }
  };

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
        setTimeout(resolve, 8000);
      } catch (e) {
        resolve();
      }
    });
  };

  useEffect(() => {
    fetchGameData();
    fetchMyTickets();
    fetchAllBookedTickets();
    pollInterval.current = setInterval(fetchSession, 3000);
    return () => { if (pollInterval.current) clearInterval(pollInterval.current); };
  }, [gameId]);

  useEffect(() => {
    if (session && session.called_numbers) {
      setMarkedNumbers(new Set(session.called_numbers));
      
      // Check for new winners and celebrate
      if (session.winners) {
        Object.keys(session.winners).forEach(prize => {
          if (!previousWinnersRef.current[prize]) {
            const winner = session.winners[prize];
            celebrateWinner(prize, winner.holder_name || winner.name || 'Player');
          }
        });
        previousWinnersRef.current = session.winners;
      }
      
      // Play TTS for new number
      if (session.current_number && session.current_number !== lastPlayedNumber) {
        playTTSAnnouncement(session.current_number);
      }
    }
  }, [session]);

  const fetchGameData = async () => {
    try {
      const response = await axios.get(`${API}/games/${gameId}`);
      setGame(response.data);
      previousWinnersRef.current = response.data.winners || {};
      fetchSession();
    } catch (error) { console.error('Failed to fetch game:', error); }
  };

  const fetchSession = async () => {
    try {
      const response = await axios.get(`${API}/games/${gameId}/session`);
      const newSession = response.data;
      
      // Check if game ended
      if (newSession.status === 'completed' && game?.status !== 'completed') {
        if (pollInterval.current) {
          clearInterval(pollInterval.current);
          pollInterval.current = null;
        }
        if ('speechSynthesis' in window) window.speechSynthesis.cancel();
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
          <div className="flex items-center gap-2">
            {!audioUnlocked && (
              <Button
                onClick={unlockAudio}
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-1 h-7 animate-pulse"
              >
                🔊 Sound
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => {
                if (!audioUnlocked) unlockAudio();
                setSoundEnabled(!soundEnabled);
              }} 
              className={`h-8 w-8 ${soundEnabled && audioUnlocked ? 'text-green-400' : 'text-white'}`}
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

        {/* Top Players - Show progress toward winning prizes */}
        <div className="bg-black/30 backdrop-blur-sm rounded-lg p-2 border border-white/10">
          <h3 className="text-[10px] font-bold text-amber-400 mb-1 text-center">🔥 CLOSE TO WINNING</h3>
          <div className="space-y-1">
            {allBookedTickets.length > 0 ? (
              (() => {
                const calledSet = new Set(session.called_numbers || []);
                const playerProgress = [];
                
                // Calculate progress for each player's best prize
                allBookedTickets.forEach(ticket => {
                  const playerName = ticket.holder_name || ticket.booked_by_name || 'Player';
                  const ticketNum = ticket.ticket_number;
                  
                  if (!ticket.numbers || ticket.numbers.length < 3) return;
                  
                  // Check Top Line progress (5 numbers needed)
                  const topRow = ticket.numbers[0].filter(n => n !== null);
                  const topMarked = topRow.filter(n => calledSet.has(n)).length;
                  if (topMarked >= 3 && topMarked < 5 && !session.winners?.['Top Line']) {
                    playerProgress.push({ name: playerName, prize: 'Top Line', marked: topMarked, total: 5, ticket: ticketNum });
                  }
                  
                  // Check Middle Line progress
                  const midRow = ticket.numbers[1].filter(n => n !== null);
                  const midMarked = midRow.filter(n => calledSet.has(n)).length;
                  if (midMarked >= 3 && midMarked < 5 && !session.winners?.['Middle Line']) {
                    playerProgress.push({ name: playerName, prize: 'Middle Line', marked: midMarked, total: 5, ticket: ticketNum });
                  }
                  
                  // Check Bottom Line progress
                  const botRow = ticket.numbers[2].filter(n => n !== null);
                  const botMarked = botRow.filter(n => calledSet.has(n)).length;
                  if (botMarked >= 3 && botMarked < 5 && !session.winners?.['Bottom Line']) {
                    playerProgress.push({ name: playerName, prize: 'Bottom Line', marked: botMarked, total: 5, ticket: ticketNum });
                  }
                  
                  // Check Four Corners progress
                  const corners = [ticket.numbers[0][0], ticket.numbers[0][8], ticket.numbers[2][0], ticket.numbers[2][8]].filter(n => n !== null);
                  const cornersMarked = corners.filter(n => calledSet.has(n)).length;
                  if (cornersMarked >= 2 && cornersMarked < corners.length && !session.winners?.['Four Corners']) {
                    playerProgress.push({ name: playerName, prize: 'Corners', marked: cornersMarked, total: corners.length, ticket: ticketNum });
                  }
                  
                  // Check Full House progress (15 numbers)
                  const allNums = ticket.numbers.flat().filter(n => n !== null);
                  const fullMarked = allNums.filter(n => calledSet.has(n)).length;
                  if (fullMarked >= 10 && fullMarked < 15) {
                    playerProgress.push({ name: playerName, prize: 'Full House', marked: fullMarked, total: 15, ticket: ticketNum });
                  }
                });
                
                // Sort by closest to winning (highest percentage)
                const sorted = playerProgress
                  .sort((a, b) => (b.marked / b.total) - (a.marked / a.total))
                  .slice(0, 4);
                
                if (sorted.length === 0) {
                  return <p className="text-[9px] text-gray-500 text-center py-1">Game starting...</p>;
                }
                
                return sorted.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-white/5 rounded px-2 py-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-white font-medium truncate max-w-[60px]">{p.name.split(' ')[0]}</span>
                      <span className="text-[8px] text-amber-400">{p.prize}</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: p.total }).map((_, i) => (
                        <span key={i} className={`w-2 h-2 rounded-full ${i < p.marked ? 'bg-green-500' : 'bg-gray-600'}`} />
                      ))}
                    </div>
                  </div>
                ));
              })()
            ) : (
              <p className="text-[9px] text-gray-500 text-center py-1">Waiting for players...</p>
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
                const holderName = ticket.holder_name || ticket.booked_by_name;
                const shortName = holderName ? (holderName.split(' ')[0][0] + '. ' + (holderName.split(' ')[1] || '').slice(0, 7)) : '';
                return (
                  <div key={ticket.ticket_id} className={`bg-amber-50 rounded-lg transition-all duration-300 ${ticketZoom === 1 ? 'p-1' : ticketZoom === 2 ? 'p-2' : 'p-3'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <p className={`font-bold text-amber-700 ${ticketZoom === 1 ? 'text-[7px]' : ticketZoom === 2 ? 'text-[9px]' : 'text-sm'}`}>{ticket.ticket_number}</p>
                      {shortName && (
                        <p className={`text-purple-600 font-medium bg-purple-100 px-1 rounded ${ticketZoom === 1 ? 'text-[6px]' : ticketZoom === 2 ? 'text-[8px]' : 'text-xs'}`}>
                          {shortName}
                        </p>
                      )}
                    </div>
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
