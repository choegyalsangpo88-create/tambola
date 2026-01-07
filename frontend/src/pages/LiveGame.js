import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, Volume2, VolumeX, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';
import confetti from 'canvas-confetti';
import { getCallName } from '@/utils/tambolaCallNames';
import { unlockMobileAudio, playBase64Audio, speakText } from '@/utils/audioHelper';

// Lazy load Three.js ball component for performance
const TambolaBall3D = lazy(() => import('@/components/TambolaBall3D'));

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Fallback ball component when Three.js is loading
function FallbackBall({ number }) {
  return (
    <div className="w-32 h-32 rounded-full relative mx-auto flex items-center justify-center"
      style={{
        background: 'radial-gradient(circle at 28% 28%, #ff5555 0%, #cc0000 50%, #8b0000 100%)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.5), inset -15px -15px 30px rgba(0,0,0,0.4)'
      }}
    >
      <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-inner">
        <span className="text-4xl font-black text-gray-900">{number || '?'}</span>
      </div>
    </div>
  );
}

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
  const [isNewNumber, setIsNewNumber] = useState(false);
  const [selectedWinnerTicket, setSelectedWinnerTicket] = useState(null);
  const [use3DBall, setUse3DBall] = useState(true); // Toggle for 3D ball
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

  // Celebrate winner with name and prize - Enhanced announcement with Voice
  const celebrateWinner = async (prize, winnerName, ticketNumber) => {
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
    
    // Voice announcement: "Congratulations! Top line gone!"
    if (soundEnabled && audioUnlocked) {
      try {
        const announcementText = `Congratulations! ${prize} gone!`;
        const played = await playTTSWithHowler(announcementText);
        if (!played) {
          await speakText(announcementText);
        }
      } catch (e) {
        console.log('Winner announcement TTS error:', e);
      }
    }
    
    // Show toast with "Congratulations! Prize Gone!" and winner info
    toast.success(
      <div className="text-center">
        <p className="text-2xl font-black text-amber-400 mb-1">🎉 Congratulations!</p>
        <p className="text-xl font-bold text-white">{prize} Gone!</p>
        <p className="text-base text-green-300 mt-1">
          Winner: <span className="font-bold">{winnerName}</span>
          {ticketNumber && <span className="text-amber-300 ml-1">({ticketNumber})</span>}
        </p>
      </div>,
      { duration: 8000 }
    );
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
            const winnerName = winner.holder_name || winner.name || 'Player';
            const ticketNum = winner.ticket_number || '';
            celebrateWinner(prize, winnerName, ticketNum);
          }
        });
        previousWinnersRef.current = session.winners;
      }
      
      // Play TTS for new number with 3D ball animation
      if (session.current_number && session.current_number !== lastPlayedNumber) {
        // Trigger new number animation
        setIsNewNumber(true);
        setTimeout(() => setIsNewNumber(false), 100);
        
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
              <div 
                key={prize} 
                className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-lg p-3 cursor-pointer hover:border-amber-400 transition-all"
                onClick={() => {
                  // Find the winning ticket from allBookedTickets
                  const winningTicket = allBookedTickets.find(t => 
                    t.ticket_id === winner.ticket_id || t.ticket_number === winner.ticket_number
                  );
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
            ))}
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
                        const isCalled = session.called_numbers?.includes(num);
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
                  
                  // Prize abbreviations
                  const prizeAbbr = {
                    'Top Line': 'TL',
                    'Middle Line': 'ML', 
                    'Bottom Line': 'BL',
                    'Four Corners': '4C',
                    'Quick Five': 'Q5',
                    '1st Full House': '1FH',
                    '2nd Full House': '2FH',
                    '3rd Full House': '3FH',
                    'Full House': 'FH',
                    'Full Sheet Bonus': 'FSB'
                  };
                  
                  // Calculate who is closest to winning each prize
                  allBookedTickets.forEach(ticket => {
                    const name = ticket.holder_name || ticket.booked_by_name || 'Player';
                    const firstName = name.split(' ')[0]; // Use first name only
                    if (!ticket.numbers || ticket.numbers.length < 3) return;
                    
                    // Check Top Line
                    if (gamePrizes.includes('Top Line') && !session.winners?.['Top Line']) {
                      const topRow = ticket.numbers[0].filter(n => n !== null);
                      const topMarked = topRow.filter(n => calledSet.has(n)).length;
                      const topRemaining = 5 - topMarked;
                      if (topRemaining > 0 && topRemaining <= 3) {
                        playerProgress.push({ name: firstName, remaining: topRemaining, prize: 'TL' });
                      }
                    }
                    
                    // Check Middle Line
                    if (gamePrizes.includes('Middle Line') && !session.winners?.['Middle Line']) {
                      const midRow = ticket.numbers[1].filter(n => n !== null);
                      const midMarked = midRow.filter(n => calledSet.has(n)).length;
                      const midRemaining = 5 - midMarked;
                      if (midRemaining > 0 && midRemaining <= 3) {
                        playerProgress.push({ name: firstName, remaining: midRemaining, prize: 'ML' });
                      }
                    }
                    
                    // Check Bottom Line
                    if (gamePrizes.includes('Bottom Line') && !session.winners?.['Bottom Line']) {
                      const botRow = ticket.numbers[2].filter(n => n !== null);
                      const botMarked = botRow.filter(n => calledSet.has(n)).length;
                      const botRemaining = 5 - botMarked;
                      if (botRemaining > 0 && botRemaining <= 3) {
                        playerProgress.push({ name: firstName, remaining: botRemaining, prize: 'BL' });
                      }
                    }
                    
                    // Check Four Corners
                    if (gamePrizes.includes('Four Corners') && !session.winners?.['Four Corners']) {
                      const topNums = ticket.numbers[0].map((n, i) => ({n, i})).filter(x => x.n !== null);
                      const botNums = ticket.numbers[2].map((n, i) => ({n, i})).filter(x => x.n !== null);
                      if (topNums.length >= 2 && botNums.length >= 2) {
                        const corners = [topNums[0].n, topNums[topNums.length-1].n, botNums[0].n, botNums[botNums.length-1].n];
                        const cornersMarked = corners.filter(n => calledSet.has(n)).length;
                        const cornersRemaining = 4 - cornersMarked;
                        if (cornersRemaining > 0 && cornersRemaining <= 2) {
                          playerProgress.push({ name: firstName, remaining: cornersRemaining, prize: '4C' });
                        }
                      }
                    }
                    
                    // Check Full House - sequential order
                    const fullHouseOrder = ['1st Full House', '2nd Full House', '3rd Full House'];
                    for (const fhPrize of fullHouseOrder) {
                      if (gamePrizes.includes(fhPrize) && !session.winners?.[fhPrize]) {
                        const allNums = ticket.numbers.flat().filter(n => n !== null);
                        const fullMarked = allNums.filter(n => calledSet.has(n)).length;
                        const fullRemaining = 15 - fullMarked;
                        if (fullRemaining > 0 && fullRemaining <= 5) {
                          playerProgress.push({ name: firstName, remaining: fullRemaining, prize: prizeAbbr[fhPrize] || 'FH' });
                        }
                        break; // Only show for first unclaimed Full House
                      }
                    }
                  });
                  
                  // Group by player name with their closest prize
                  const playerStats = {};
                  playerProgress.forEach(p => {
                    const key = `${p.name}_${p.prize}`;
                    if (!playerStats[key] || p.remaining < playerStats[key].remaining) {
                      playerStats[key] = { 
                        name: p.name, 
                        remaining: p.remaining,
                        prize: p.prize
                      };
                    }
                  });
                  
                  // Sort by remaining (ascending), show up to 6
                  const topPlayers = Object.values(playerStats)
                    .sort((a, b) => a.remaining - b.remaining)
                    .slice(0, 6);
                  
                  if (topPlayers.length === 0) {
                    return <p className="text-[8px] text-gray-500 text-center py-2">Waiting for players...</p>;
                  }
                  
                  return topPlayers.map((p, idx) => (
                    <div key={idx} className="bg-white/5 rounded px-1.5 py-1">
                      <span className="text-[9px] text-white font-medium truncate block">
                        {p.name}
                        <span className="text-amber-400 ml-1">({p.prize})</span>
                      </span>
                      <div className="flex gap-0.5 mt-0.5">
                        {Array.from({ length: Math.min(p.remaining, 5) }).map((_, i) => (
                          <span key={i} className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        ))}
                      </div>
                    </div>
                  ));
                })()
              ) : (
                <p className="text-[8px] text-gray-500 text-center py-2">Waiting for players...</p>
              )}
            </div>
          </div>

          {/* CENTER: Premium 3D Tambola Ball using Three.js */}
          <div className="col-span-5 bg-gradient-to-b from-black/40 to-black/20 backdrop-blur-sm rounded-lg p-2 border border-white/10 flex flex-col items-center justify-center overflow-hidden">
            {use3DBall ? (
              <Suspense fallback={<FallbackBall number={session.current_number} />}>
                <TambolaBall3D 
                  number={session.current_number}
                  previousNumber={lastPlayedNumber}
                  isNewNumber={isNewNumber}
                />
              </Suspense>
            ) : (
              <FallbackBall number={session.current_number} />
            )}
            <p className="text-sm text-amber-400 font-bold">{session.called_numbers?.length || 0} / 90</p>
          </div>

          {/* RIGHT: Dividends List with Winner Names - Full Height Scrollable */}
          <div className="col-span-4 bg-black/30 backdrop-blur-sm rounded-lg p-2 border border-white/10 flex flex-col" style={{ minHeight: '180px' }}>
            <div className="flex items-center gap-1 mb-1">
              <Trophy className="w-3 h-3 text-amber-500" />
              <span className="text-[9px] font-bold text-white">DIVIDENDS</span>
            </div>
            <div className="flex-1 space-y-0.5 overflow-y-auto pr-1" style={{ maxHeight: '150px' }}>
              {game.prizes && Object.entries(game.prizes).map(([prize, amount]) => {
                const winner = session.winners?.[prize];
                // Get first name only for cleaner display
                const winnerFirstName = winner?.holder_name?.split(' ')[0] || winner?.name?.split(' ')[0] || '';
                return (
                  <div 
                    key={prize} 
                    className={`px-1.5 py-1.5 rounded cursor-pointer transition-all ${winner ? 'bg-green-500/20 border border-green-500/30 hover:bg-green-500/30' : 'bg-white/5 hover:bg-white/10'}`}
                    onClick={() => {
                      if (winner && winner.ticket_id) {
                        const winningTicket = allBookedTickets.find(t => t.ticket_id === winner.ticket_id);
                        if (winningTicket) setSelectedWinnerTicket({ ...winningTicket, prize, winner });
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[9px] ${winner ? 'text-green-400 line-through' : 'text-gray-300'}`}>{prize}</span>
                      <span className="text-[9px] font-bold text-amber-400">₹{amount}</span>
                    </div>
                    {winner && (
                      <p className="text-[8px] text-green-300 mt-0.5 truncate">
                        🎉 {winnerFirstName || 'Winner'}
                        {winner.ticket_number && <span className="text-amber-300">({winner.ticket_number})</span>}
                      </p>
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
