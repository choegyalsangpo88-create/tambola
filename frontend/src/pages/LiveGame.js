import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, Volume2, VolumeX, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { getCallName } from '@/utils/tambolaCallNames';
import { unlockMobileAudio, playBase64Audio, speakText } from '@/utils/audioHelper';

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
  const [isSpinning, setIsSpinning] = useState(false);
  const pollInterval = useRef(null);
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
      setAudioUnlocked(true); // Still try to play
    }
  }, []);

  // Celebrate winner with name and prize - NO TTS announcement
  const celebrateWinner = async (prize, winnerName) => {
    // Big confetti burst
    confetti({
      particleCount: 150,
      spread: 100,
      origin: { y: 0.6 },
      colors: ['#FFD700', '#FFA500', '#FF6347', '#00FF00', '#FF69B4']
    });
    
    // Second burst
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

  // Play TTS announcement using Howler.js for mobile compatibility
  const playTTSAnnouncement = async (number) => {
    if (!soundEnabled || !audioUnlocked || isAnnouncingRef.current || game?.status === 'completed') return;
    if (lastAnnouncedRef.current === number) return;
    
    lastAnnouncedRef.current = number;
    isAnnouncingRef.current = true;
    setLastPlayedNumber(number);
    
    const callName = getCallName(number);
    
    try {
      // Try server-side TTS with Howler.js (most reliable for mobile)
      const played = await playTTSWithHowler(callName);
      
      // Fallback to browser TTS if server TTS fails
      if (!played) {
        await speakText(callName);
      }
    } catch (error) {
      console.log('TTS error:', error);
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
        return await playBase64Audio(data.audio);
      }
      
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
      
      // Play TTS for new number with spin animation
      if (session.current_number && session.current_number !== lastPlayedNumber) {
        // Trigger spin animation
        setIsSpinning(true);
        setTimeout(() => setIsSpinning(false), 600);
        
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
        
        {/* Row 1: Top Players | 3D Caller Ball | Dividends */}
        <div className="grid grid-cols-12 gap-2">
          {/* LEFT: Top 5 Players Close to Winning */}
          <div className="col-span-3 bg-black/30 backdrop-blur-sm rounded-lg p-2 border border-white/10">
            <p className="text-[8px] text-amber-400 font-bold mb-1">Top Players</p>
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {allBookedTickets.length > 0 && game?.prizes ? (
                (() => {
                  const calledSet = new Set(session.called_numbers || []);
                  const playerProgress = [];
                  const gamePrizes = Object.keys(game.prizes || {});
                  
                  // Calculate who is closest to winning each prize (only check prizes in dividends)
                  allBookedTickets.forEach(ticket => {
                    const name = ticket.holder_name || ticket.booked_by_name || 'Player';
                    if (!ticket.numbers || ticket.numbers.length < 3) return;
                    
                    // Check Top Line only if it's in dividends
                    if (gamePrizes.includes('Top Line') && !session.winners?.['Top Line']) {
                      const topRow = ticket.numbers[0].filter(n => n !== null);
                      const topMarked = topRow.filter(n => calledSet.has(n)).length;
                      const topRemaining = Math.min(5 - topMarked, 5);
                      if (topRemaining > 0 && topRemaining <= 3) {
                        playerProgress.push({ name, remaining: topRemaining });
                      }
                    }
                    
                    // Check Middle Line only if it's in dividends
                    if (gamePrizes.includes('Middle Line') && !session.winners?.['Middle Line']) {
                      const midRow = ticket.numbers[1].filter(n => n !== null);
                      const midMarked = midRow.filter(n => calledSet.has(n)).length;
                      const midRemaining = Math.min(5 - midMarked, 5);
                      if (midRemaining > 0 && midRemaining <= 3) {
                        playerProgress.push({ name, remaining: midRemaining });
                      }
                    }
                    
                    // Check Bottom Line only if it's in dividends
                    if (gamePrizes.includes('Bottom Line') && !session.winners?.['Bottom Line']) {
                      const botRow = ticket.numbers[2].filter(n => n !== null);
                      const botMarked = botRow.filter(n => calledSet.has(n)).length;
                      const botRemaining = Math.min(5 - botMarked, 5);
                      if (botRemaining > 0 && botRemaining <= 3) {
                        playerProgress.push({ name, remaining: botRemaining });
                      }
                    }
                    
                    // Check Four Corners only if it's in dividends
                    if (gamePrizes.includes('Four Corners') && !session.winners?.['Four Corners']) {
                      // Get first and last numbers in top and bottom rows
                      const topNums = ticket.numbers[0].map((n, i) => ({n, i})).filter(x => x.n !== null);
                      const botNums = ticket.numbers[2].map((n, i) => ({n, i})).filter(x => x.n !== null);
                      if (topNums.length >= 2 && botNums.length >= 2) {
                        const corners = [topNums[0].n, topNums[topNums.length-1].n, botNums[0].n, botNums[botNums.length-1].n];
                        const cornersMarked = corners.filter(n => calledSet.has(n)).length;
                        const cornersRemaining = Math.min(4 - cornersMarked, 5);
                        if (cornersRemaining > 0 && cornersRemaining <= 2) {
                          playerProgress.push({ name, remaining: cornersRemaining });
                        }
                      }
                    }
                    
                    // Check Full House variants
                    const fullHousePrizes = gamePrizes.filter(p => p.includes('Full House'));
                    if (fullHousePrizes.length > 0 && !session.winners?.['1st Full House']) {
                      const allNums = ticket.numbers.flat().filter(n => n !== null);
                      const fullMarked = allNums.filter(n => calledSet.has(n)).length;
                      const fullRemaining = Math.min(15 - fullMarked, 5);
                      if (fullRemaining > 0 && fullRemaining <= 5) {
                        playerProgress.push({ name, remaining: fullRemaining });
                      }
                    }
                  });
                  
                  // Sort by remaining (fewer = closer to winning)
                  // Group by player name, keep best remaining
                  const playerStats = {};
                  playerProgress.forEach(p => {
                    if (!playerStats[p.name]) {
                      playerStats[p.name] = { 
                        name: p.name, 
                        bestRemaining: p.remaining
                      };
                    } else {
                      if (p.remaining < playerStats[p.name].bestRemaining) {
                        playerStats[p.name].bestRemaining = p.remaining;
                      }
                    }
                  });
                  
                  // Sort by remaining (ascending), show up to 6 players
                  const topPlayers = Object.values(playerStats)
                    .sort((a, b) => a.bestRemaining - b.bestRemaining)
                    .slice(0, 6);
                  
                  if (topPlayers.length === 0) {
                    return <p className="text-[7px] text-gray-500 text-center">Waiting...</p>;
                  }
                  
                  return topPlayers.map((p, idx) => (
                    <div key={idx} className="bg-white/5 rounded px-1.5 py-1">
                      <span className="text-[9px] text-white font-medium truncate block">
                        {p.name.split(' ')[0]}
                      </span>
                      <div className="flex gap-0.5 mt-0.5">
                        {Array.from({ length: Math.min(p.bestRemaining, 5) }).map((_, i) => (
                          <span key={i} className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        ))}
                      </div>
                    </div>
                  ));
                })()
              ) : (
                <p className="text-[7px] text-gray-500 text-center">Waiting...</p>
              )}
            </div>
          </div>

          {/* CENTER: Real 3D Tambola Ball */}
          <div className="col-span-5 bg-gradient-to-b from-black/40 to-black/20 backdrop-blur-sm rounded-lg p-4 border border-white/10 flex flex-col items-center justify-center">
            <div className="sphere-3d relative" style={{ perspective: '800px' }}>
              {/* The 3D Ball */}
              <div 
                className={`relative ${isSpinning && game?.status !== 'completed' ? 'ball-entry' : 'ball-idle'}`}
                style={{ transformStyle: 'preserve-3d' }}
              >
                {/* Main Ball Body */}
                <div 
                  className="w-28 h-28 rounded-full relative"
                  style={{
                    background: `
                      radial-gradient(circle at 25% 25%, 
                        rgba(255,255,255,0.4) 0%, 
                        transparent 40%
                      ),
                      radial-gradient(circle at 75% 75%, 
                        rgba(0,0,0,0.3) 0%, 
                        transparent 40%
                      ),
                      radial-gradient(circle at 50% 50%, 
                        #ff3333 0%, 
                        #cc0000 30%, 
                        #990000 60%, 
                        #660000 100%
                      )
                    `,
                    boxShadow: `
                      0 20px 40px rgba(0,0,0,0.5),
                      0 8px 16px rgba(0,0,0,0.3),
                      inset 0 -15px 30px rgba(0,0,0,0.4),
                      inset 0 15px 30px rgba(255,255,255,0.15),
                      inset 8px 0 20px rgba(255,255,255,0.1),
                      inset -8px 0 20px rgba(0,0,0,0.2)
                    `,
                    transform: 'translateZ(0)'
                  }}
                >
                  {/* Glossy highlight - top left */}
                  <div 
                    className="absolute top-3 left-4 w-10 h-6 rounded-full"
                    style={{ 
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
                      filter: 'blur(2px)'
                    }}
                  />
                  
                  {/* Small secondary highlight */}
                  <div 
                    className="absolute top-5 left-7 w-3 h-2 rounded-full"
                    style={{ background: 'rgba(255,255,255,0.9)' }}
                  />
                  
                  {/* White number circle - slightly recessed look */}
                  <div 
                    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center"
                    style={{
                      width: '68px',
                      height: '68px',
                      background: `
                        radial-gradient(circle at 35% 35%, 
                          #ffffff 0%, 
                          #f8f8f8 40%, 
                          #eeeeee 70%, 
                          #e0e0e0 100%
                        )
                      `,
                      boxShadow: `
                        inset 0 4px 12px rgba(0,0,0,0.15),
                        inset 0 -2px 8px rgba(255,255,255,0.8),
                        0 2px 4px rgba(0,0,0,0.2)
                      `
                    }}
                  >
                    <span 
                      className="text-5xl font-black" 
                      style={{ 
                        color: '#1a1a1a',
                        textShadow: '1px 1px 2px rgba(0,0,0,0.1)',
                        fontFamily: 'Arial Black, Impact, sans-serif'
                      }}
                    >
                      {session.current_number || '?'}
                    </span>
                  </div>
                  
                  {/* Bottom edge highlight (rim light) */}
                  <div 
                    className="absolute bottom-3 left-1/2 transform -translate-x-1/2 w-14 h-2 rounded-full opacity-30"
                    style={{ background: 'linear-gradient(to top, rgba(255,200,200,0.5), transparent)' }}
                  />
                </div>
                
                {/* Ball shadow on surface */}
                <div 
                  className="ball-shadow absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-20 h-4 rounded-full"
                  style={{ 
                    background: 'radial-gradient(ellipse, rgba(0,0,0,0.6) 0%, transparent 70%)',
                    filter: 'blur(3px)'
                  }}
                />
              </div>
            </div>
            <p className="text-sm text-amber-400 font-bold mt-4">{session.called_numbers?.length || 0} / 90</p>
          </div>

          {/* RIGHT: Dividends List with Winner Names */}
          <div className="col-span-4 bg-black/30 backdrop-blur-sm rounded-lg p-2 border border-white/10">
            <div className="flex items-center gap-1 mb-1">
              <Trophy className="w-3 h-3 text-amber-500" />
              <span className="text-[9px] font-bold text-white">DIVIDENDS</span>
            </div>
            <div className="space-y-0.5 max-h-36 overflow-y-auto">
              {game.prizes && Object.entries(game.prizes).map(([prize, amount]) => {
                const winner = session.winners?.[prize];
                return (
                  <div key={prize} className={`px-1.5 py-1 rounded ${winner ? 'bg-green-500/20 border border-green-500/30' : 'bg-white/5'}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-[8px] ${winner ? 'text-green-400 line-through' : 'text-gray-300'}`}>{prize}</span>
                      <span className="text-[8px] font-bold text-amber-400">₹{amount}</span>
                    </div>
                    {winner && (
                      <p className="text-[7px] text-green-300 mt-0.5">🎉 {winner.holder_name || winner.name || 'Winner'}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Row 2: Called Numbers - Fill lines, max 4 rows */}
        <div className="bg-black/30 backdrop-blur-sm rounded-lg p-2 border border-white/10">
          <p className="text-[8px] text-gray-400 mb-1">Called: {session.called_numbers?.length || 0}/90</p>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(18px,1fr))] gap-[3px]" style={{ maxHeight: '88px', overflow: 'hidden' }}>
            {(() => {
              const called = session.called_numbers || [];
              if (called.length === 0) {
                return <p className="text-[10px] text-gray-400 col-span-full">No numbers called yet</p>;
              }
              // Show all called numbers in reverse order (latest first)
              return [...called].reverse().map((num, idx) => (
                <div
                  key={idx}
                  className={`w-[18px] h-[18px] rounded-full bg-gradient-to-br ${getBallColor(num)} flex items-center justify-center text-[7px] font-bold text-white shadow-sm ${idx === 0 ? 'ring-1 ring-amber-400 scale-110' : ''}`}
                >
                  {num}
                </div>
              ));
            })()}
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
