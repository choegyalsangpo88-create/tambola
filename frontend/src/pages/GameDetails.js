import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, Calendar, Users, Award, Ticket, Filter } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Get auth headers for API calls (mobile fallback)
const getAuthHeaders = () => {
  const session = localStorage.getItem('tambola_session');
  return session ? { 'Authorization': `Bearer ${session}` } : {};
};

// Printed Tambola Ticket - Accurate replica of physical Indian Tambola tickets
function TambolaTicket({ ticket, isSelected, onToggle, bookedBy }) {
  const isBooked = ticket.is_booked || bookedBy;
  const holderName = bookedBy || ticket.holder_name || ticket.booked_by_name;
  const shortName = holderName ? (
    holderName.split(' ').length > 1 
      ? holderName.split(' ')[0][0] + '. ' + holderName.split(' ')[1].slice(0, 6)
      : holderName.slice(0, 8)
  ) : null;
  
  return (
    <div
      className={`cursor-pointer transition-transform ${
        isBooked && !isSelected
          ? 'opacity-40 cursor-not-allowed'
          : isSelected
          ? 'scale-[1.02]'
          : 'hover:scale-[1.01]'
      }`}
      onClick={() => !isBooked && onToggle(ticket.ticket_id)}
      style={{
        backgroundColor: '#f1c40f',
        padding: '8px',
        display: 'inline-block'
      }}
    >
      {/* Ticket container with white background */}
      <div style={{
        backgroundColor: '#ffffff',
        border: isSelected ? '3px solid #22c55e' : '2px solid #000000',
        boxShadow: isSelected ? '0 0 0 2px #22c55e' : 'none'
      }}>
        {/* Header - LOTTO TICKET number */}
        <div style={{
          backgroundColor: '#f5f5f5',
          borderBottom: '2px solid #000000',
          padding: '3px 6px',
          textAlign: 'center',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{
            fontFamily: 'Arial, Helvetica, sans-serif',
            fontWeight: 'bold',
            fontSize: '11px',
            color: '#000000',
            letterSpacing: '0.5px'
          }}>
            LOTTO TICKET {ticket.ticket_number}
          </span>
          {shortName && (
            <span style={{
              fontSize: '9px',
              color: '#666666'
            }}>
              ({shortName})
            </span>
          )}
          {isSelected && (
            <span style={{
              color: '#22c55e',
              fontWeight: 'bold',
              fontSize: '14px'
            }}>✓</span>
          )}
        </div>
        
        {/* Grid - 3 rows x 9 columns using table for accurate print layout */}
        <table 
          style={{
            borderCollapse: 'collapse',
            width: '100%'
          }}
          cellSpacing="0"
          cellPadding="0"
        >
          <tbody>
            {ticket.numbers.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((num, colIndex) => (
                  <td
                    key={`${rowIndex}-${colIndex}`}
                    style={{
                      width: '11.11%',
                      height: '28px',
                      border: '1px solid #000000',
                      textAlign: 'center',
                      verticalAlign: 'middle',
                      backgroundColor: '#e8f4fc',
                      fontFamily: 'Arial Black, Arial, sans-serif',
                      fontWeight: 'bold',
                      fontSize: '13px',
                      color: '#000000',
                      padding: '0',
                      margin: '0'
                    }}
                  >
                    {num || ''}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function GameDetails() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState(null);
  const [fullSheets, setFullSheets] = useState([]);
  const [selectedTickets, setSelectedTickets] = useState([]);
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'fullsheets'
  const [isBooking, setIsBooking] = useState(false);
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    fetchGame();
    fetchAllTickets();
    
    // Refresh tickets every 10 seconds to see real-time bookings
    const interval = setInterval(fetchAllTickets, 10000);
    return () => clearInterval(interval);
  }, [gameId]);

  const fetchGame = async () => {
    try {
      const response = await axios.get(`${API}/games/${gameId}`);
      setGame(response.data);
    } catch (error) {
      console.error('Failed to fetch game:', error);
      toast.error('Failed to load game details');
    }
  };

  const fetchAllTickets = async () => {
    try {
      const response = await axios.get(
        `${API}/games/${gameId}/tickets?page=1&limit=1000`
      );
      const allTickets = response.data.tickets;
      
      // Store flat ticket list for message building
      setTickets(allTickets);
      
      // Group tickets by Full Sheet ID
      // If full_sheet_id doesn't exist, calculate it based on ticket number (1-6 = FS001, 7-12 = FS002, etc.)
      const sheetsMap = {};
      allTickets.forEach(ticket => {
        let sheetId = ticket.full_sheet_id;
        
        // If no full_sheet_id, calculate based on ticket number
        if (!sheetId) {
          const ticketNum = parseInt(ticket.ticket_number.replace(/\D/g, '')) || 0;
          const sheetNum = Math.ceil(ticketNum / 6);
          sheetId = `FS${String(sheetNum).padStart(3, '0')}`;
          // Also calculate position in sheet
          ticket.ticket_position_in_sheet = ((ticketNum - 1) % 6) + 1;
          ticket.full_sheet_id = sheetId;
        }
        
        if (!sheetsMap[sheetId]) {
          sheetsMap[sheetId] = [];
        }
        sheetsMap[sheetId].push(ticket);
      });
      
      // Convert to array and sort
      const sheetsArray = Object.entries(sheetsMap).map(([sheetId, sheetTickets]) => {
        const sortedTickets = sheetTickets.sort((a, b) => 
          (a.ticket_position_in_sheet || 0) - (b.ticket_position_in_sheet || 0)
        );
        const availableTickets = sortedTickets.filter(t => !t.is_booked);
        
        return {
          sheetId,
          tickets: sortedTickets,
          isComplete: sheetTickets.length === 6,
          availableCount: availableTickets.length,
          isFullyAvailable: sheetTickets.length === 6 && availableTickets.length === 6
        };
      }).sort((a, b) => {
        const numA = parseInt(a.sheetId.replace('FS', ''));
        const numB = parseInt(b.sheetId.replace('FS', ''));
        return numA - numB;
      });
      
      setFullSheets(sheetsArray);
      
      // Clear selection if any selected tickets are now booked
      if (selectedTickets.length > 0) {
        const stillAvailable = selectedTickets.filter(ticketId => {
          const ticket = allTickets.find(t => t.ticket_id === ticketId);
          return ticket && !ticket.is_booked;
        });
        if (stillAvailable.length !== selectedTickets.length) {
          setSelectedTickets(stillAvailable);
          if (stillAvailable.length < selectedTickets.length) {
            toast.info('Some selected tickets were booked by others');
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
      toast.error('Failed to load tickets');
    }
  };

  const toggleTicket = (ticketId) => {
    setSelectedTickets(prev =>
      prev.includes(ticketId)
        ? prev.filter(id => id !== ticketId)
        : [...prev, ticketId]
    );
  };

  const selectFullSheet = (sheetTickets) => {
    const availableTickets = sheetTickets.filter(t => !t.is_booked);
    const sheetTicketIds = availableTickets.map(t => t.ticket_id);
    const allSelected = sheetTicketIds.every(id => selectedTickets.includes(id));
    
    if (allSelected) {
      setSelectedTickets(prev => prev.filter(id => !sheetTicketIds.includes(id)));
      toast.info('Full Sheet deselected');
    } else {
      const newSelection = [...new Set([...selectedTickets, ...sheetTicketIds])];
      setSelectedTickets(newSelection);
      toast.success('Full Sheet selected!');
    }
  };

  const isFullSheetSelected = (sheetTickets) => {
    const availableTickets = sheetTickets.filter(t => !t.is_booked);
    if (availableTickets.length !== 6) return false;
    return availableTickets.every(t => selectedTickets.includes(t.ticket_id));
  };

  const handleBookViaWhatsApp = async () => {
    if (selectedTickets.length === 0) {
      toast.error('Please select at least one ticket');
      return;
    }

    setIsBooking(true);
    try {
      // Get user info with auth headers for mobile fallback
      const userResponse = await axios.get(`${API}/auth/me`, { 
        withCredentials: true,
        headers: getAuthHeaders()
      });
      const user = userResponse.data;

      // Create booking REQUEST (not direct booking) - goes to admin for approval
      const response = await axios.post(
        `${API}/booking-requests`,
        {
          game_id: gameId,
          ticket_ids: selectedTickets
        },
        { 
          withCredentials: true,
          headers: getAuthHeaders()
        }
      );

      const bookingRequest = response.data;
      
      // Get selected ticket numbers for the message
      const selectedTicketNumbers = tickets
        .filter(t => selectedTickets.includes(t.ticket_id))
        .map(t => t.ticket_number)
        .join(', ');

      // Build detailed WhatsApp message
      const message = `🎫 *NEW TICKET BOOKING REQUEST*

👤 *Player:* ${user.name || 'Guest'}
📧 *Email:* ${user.email || 'N/A'}
📱 *Phone:* ${user.phone || 'N/A'}

🎮 *Game:* ${game.name}
📅 *Date:* ${game.date} at ${game.time}

🎟️ *Tickets:* ${selectedTicketNumbers}
📊 *Quantity:* ${selectedTickets.length} ticket(s)
💰 *Total Amount:* ₹${bookingRequest.total_amount}

🆔 *Request ID:* ${bookingRequest.request_id}

⏳ Status: PENDING APPROVAL

Please approve my booking request. 🙏`;

      // WhatsApp Business Number
      const whatsappNumber = '918837489781';
      const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
      
      toast.success('Booking request sent! Opening WhatsApp...');
      window.open(whatsappUrl, '_blank');
      
      setSelectedTickets([]);
      fetchAllTickets();
    } catch (error) {
      console.error('Booking request failed:', error);
      const errorMsg = error.response?.data?.detail || 'Failed to create booking request';
      toast.error(errorMsg);
      
      // If tickets are already booked, refresh the ticket list
      if (errorMsg.includes('already booked') || errorMsg.includes('not available')) {
        toast.info('Refreshing tickets...');
        setSelectedTickets([]);
        fetchAllTickets();
      }
    } finally {
      setIsBooking(false);
    }
  };

  // Filter sheets - show only fully available sheets when fullsheets filter is active
  const displayedSheets = filterMode === 'fullsheets'
    ? fullSheets.filter(sheet => sheet.isFullyAvailable)
    : fullSheets;

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c]">
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] pb-32 overflow-y-auto">
      {/* Header */}
      <div className="bg-[#121216] border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 py-3 flex items-center gap-3">
          <Button
            data-testid="back-button"
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
            className="h-8 w-8"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold text-white truncate" style={{ fontFamily: 'Outfit, sans-serif' }}>
            {game.name}
          </h1>
        </div>
      </div>

      {/* Top Section - Game Details (Left) | Dividends (Right) - Vertical Split */}
      <div className="max-w-7xl mx-auto px-3 py-3">
        <div className="glass-card p-4 flex">
          {/* Left: Game Details */}
          <div className="flex-1 pr-4">
            <h2 className="text-lg font-bold text-white mb-3">{game.name}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center gap-1 text-gray-400 text-xs mb-0.5">
                  <Calendar className="w-3 h-3" />
                  <span>Date & Time</span>
                </div>
                <p className="text-white font-semibold text-sm">{game.date}</p>
                <p className="text-amber-500 text-xs">{game.time}</p>
              </div>
              <div>
                <div className="flex items-center gap-1 text-gray-400 text-xs mb-0.5">
                  <Award className="w-3 h-3" />
                  <span>Prize Pool</span>
                </div>
                <p className="text-xl font-bold text-amber-500">₹{game.prize_pool.toLocaleString()}</p>
              </div>
              <div>
                <div className="flex items-center gap-1 text-gray-400 text-xs mb-0.5">
                  <Ticket className="w-3 h-3" />
                  <span>Ticket Price</span>
                </div>
                <p className="text-lg font-bold text-white">₹{game.price}</p>
              </div>
              <div>
                <div className="flex items-center gap-1 text-gray-400 text-xs mb-0.5">
                  <Users className="w-3 h-3" />
                  <span>Available</span>
                </div>
                <p className="text-lg font-bold text-white">{game.available_tickets}</p>
              </div>
            </div>
          </div>

          {/* Vertical Divider Line */}
          <div className="w-px bg-white/20 mx-2" />

          {/* Right: Dividends */}
          <div className="w-40 pl-3">
            <div className="flex items-center gap-1 mb-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-white">Dividends</h3>
            </div>
            <div className="space-y-1">
              {Object.entries(game.prizes).map(([prize, amount]) => (
                <div key={prize} className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 truncate mr-2">{prize}</span>
                  <span className="text-amber-500 font-semibold whitespace-nowrap">₹{amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-amber-500/30 mx-3" />

      {/* Tickets Section */}
      <div className="max-w-7xl mx-auto px-3 py-3">
        {/* Filter Bar */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-400">Select Your Tickets</h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilterMode('all')}
              className={`h-7 px-3 text-xs border-white/20 ${filterMode === 'all' ? 'bg-amber-500 text-black border-amber-500' : 'text-gray-300'}`}
              data-testid="filter-all-btn"
            >
              All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilterMode('fullsheets')}
              className={`h-7 px-3 text-xs border-white/20 ${filterMode === 'fullsheets' ? 'bg-amber-500 text-black border-amber-500' : 'text-gray-300'}`}
              data-testid="filter-fullsheets-btn"
            >
              <Filter className="w-3 h-3 mr-1" />
              Full Sheets
            </Button>
          </div>
        </div>

        {/* No results message for fullsheets filter */}
        {filterMode === 'fullsheets' && displayedSheets.length === 0 && (
          <div className="glass-card p-8 text-center">
            <p className="text-gray-400">No full sheets available (all 6 tickets must be unbooked)</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilterMode('all')}
              className="mt-4 border-amber-500/50 text-amber-400"
            >
              Show All Tickets
            </Button>
          </div>
        )}

        {/* Full Sheets Grid */}
        <div className="space-y-3">
          {displayedSheets.map((sheet, sheetIndex) => {
            const isSelected = isFullSheetSelected(sheet.tickets);
            const isFullyAvailable = sheet.availableCount === 6;
            
            // Alternating background colors for visual differentiation
            const bgColors = [
              'bg-blue-500/5',
              'bg-purple-500/5',
              'bg-pink-500/5',
              'bg-emerald-500/5',
              'bg-orange-500/5',
              'bg-cyan-500/5',
              'bg-indigo-500/5',
              'bg-rose-500/5',
              'bg-teal-500/5',
              'bg-amber-500/5'
            ];
            
            // Border colors for left accent
            const borderColors = [
              'border-l-blue-500',
              'border-l-purple-500',
              'border-l-pink-500',
              'border-l-emerald-500',
              'border-l-orange-500',
              'border-l-cyan-500',
              'border-l-indigo-500',
              'border-l-rose-500',
              'border-l-teal-500',
              'border-l-amber-400'
            ];
            
            const bgColor = isSelected 
              ? 'bg-amber-500/10' 
              : bgColors[sheetIndex % bgColors.length];
            const borderColor = isSelected 
              ? 'border-l-amber-500' 
              : borderColors[sheetIndex % borderColors.length];
            
            return (
              <div
                key={sheet.sheetId}
                className={`rounded-lg p-3 border-l-4 ${borderColor} ${bgColor} border border-white/5`}
                data-testid={`full-sheet-${sheet.sheetId}`}
              >
                {/* Sheet Header - Compact */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-white">{sheet.sheetId}</span>
                    <span className="text-xs text-gray-500">
                      {sheet.tickets[0]?.ticket_number} - {sheet.tickets[5]?.ticket_number}
                    </span>
                    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                      isFullyAvailable
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}>
                      {sheet.availableCount}/6
                    </span>
                  </div>
                  {isFullyAvailable && (
                    <Button
                      onClick={() => selectFullSheet(sheet.tickets)}
                      size="sm"
                      className={`h-7 px-3 text-xs rounded-full font-semibold ${
                        isSelected
                          ? 'bg-amber-500 text-black'
                          : 'bg-white/10 text-white hover:bg-white/20'
                      }`}
                      data-testid={`select-sheet-${sheet.sheetId}`}
                    >
                      {isSelected ? '✓ Selected' : 'Select All'}
                    </Button>
                  )}
                </div>

                {/* Tickets Grid - 6 in a row on desktop, 3 on mobile - reduced gap */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {sheet.tickets.map((ticket) => (
                    <TambolaTicket
                      key={ticket.ticket_id}
                      ticket={ticket}
                      isSelected={selectedTickets.includes(ticket.ticket_id)}
                      onToggle={toggleTicket}
                      bookedBy={ticket.is_booked ? ticket.booked_by_name : null}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Spacer for fixed bottom bar */}
        <div className="h-20" />
      </div>

      {/* Fixed Bottom Book Button - Always visible */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#121216] border-t border-white/10 py-3 px-3 z-50 safe-area-pb">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-white font-bold">
              {selectedTickets.length > 0 
                ? `${selectedTickets.length} Ticket${selectedTickets.length > 1 ? 's' : ''} Selected`
                : 'Select Tickets'
              }
            </p>
            <p className="text-amber-500 text-sm font-semibold">
              {selectedTickets.length > 0 
                ? `₹${(selectedTickets.length * game.price).toLocaleString()}`
                : `₹${game.price} per ticket`
              }
            </p>
          </div>
          <div className="flex gap-2">
            {selectedTickets.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedTickets([])}
                className="border-white/20 h-10 px-4 text-white"
              >
                Clear
              </Button>
            )}
            <Button
              onClick={handleBookViaWhatsApp}
              disabled={isBooking || selectedTickets.length === 0}
              className={`font-bold h-10 px-6 ${
                selectedTickets.length > 0 
                  ? 'bg-green-500 hover:bg-green-600' 
                  : 'bg-gray-600 cursor-not-allowed'
              }`}
              data-testid="book-via-whatsapp-btn"
            >
              {isBooking ? 'Booking...' : '💬 Book via WhatsApp'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
