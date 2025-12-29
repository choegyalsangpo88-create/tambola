import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, Calendar, Users, Award, Ticket, Filter } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Wide compact ticket component
function TambolaTicket({ ticket, isSelected, onToggle, bookedBy }) {
  const isBooked = ticket.is_booked || bookedBy;
  
  return (
    <div
      className={`relative rounded-lg cursor-pointer transition-all ${
        isBooked && !isSelected
          ? 'opacity-40 cursor-not-allowed'
          : isSelected
          ? 'ring-2 ring-amber-500 shadow-lg shadow-amber-500/20'
          : 'hover:ring-1 hover:ring-white/30'
      }`}
      onClick={() => !isBooked && onToggle(ticket.ticket_id)}
    >
      {/* Ticket number and booked by - positioned just above ticket */}
      <div className="flex items-center justify-between px-1 mb-0.5">
        <span className={`text-[10px] font-bold ${isSelected ? 'text-amber-400' : 'text-amber-500/80'}`}>
          {ticket.ticket_number}
        </span>
        {bookedBy && (
          <span className="text-[9px] text-gray-500 truncate max-w-[60px]">{bookedBy}</span>
        )}
        {isSelected && (
          <span className="text-[10px] text-amber-400">✓</span>
        )}
      </div>
      
      {/* Ticket grid - wide and clear */}
      <div className={`bg-white rounded-md overflow-hidden ${isSelected ? 'ring-1 ring-amber-400' : ''}`}>
        <div className="grid grid-cols-9">
          {ticket.numbers.map((row, rowIndex) => (
            row.map((num, colIndex) => (
              <div
                key={`${rowIndex}-${colIndex}`}
                className={`aspect-[1.2/1] flex items-center justify-center text-[9px] sm:text-[10px] font-bold border-r border-b border-gray-200 last:border-r-0 ${
                  num === null 
                    ? 'bg-gray-50' 
                    : 'bg-white text-gray-900'
                }`}
              >
                {num || ''}
              </div>
            ))
          ))}
        </div>
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

  useEffect(() => {
    fetchGame();
    fetchAllTickets();
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
      
      // Group tickets by Full Sheet ID
      const sheetsMap = {};
      allTickets.forEach(ticket => {
        const sheetId = ticket.full_sheet_id;
        if (!sheetsMap[sheetId]) {
          sheetsMap[sheetId] = [];
        }
        sheetsMap[sheetId].push(ticket);
      });
      
      // Convert to array and sort
      const sheetsArray = Object.entries(sheetsMap).map(([sheetId, tickets]) => {
        const sortedTickets = tickets.sort((a, b) => a.ticket_position_in_sheet - b.ticket_position_in_sheet);
        const availableTickets = sortedTickets.filter(t => !t.is_booked);
        
        return {
          sheetId,
          tickets: sortedTickets,
          isComplete: tickets.length === 6,
          availableCount: availableTickets.length,
          isFullyAvailable: availableTickets.length === 6
        };
      }).sort((a, b) => {
        const numA = parseInt(a.sheetId.replace('FS', ''));
        const numB = parseInt(b.sheetId.replace('FS', ''));
        return numA - numB;
      });
      
      setFullSheets(sheetsArray);
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
      const response = await axios.post(
        `${API}/bookings`,
        {
          game_id: gameId,
          ticket_ids: selectedTickets
        },
        { withCredentials: true }
      );

      const booking = response.data;
      const message = `Hi! I want to book ${selectedTickets.length} tickets for ${game.name}\n\nTotal Amount: ₹${booking.total_amount}\nBooking ID: ${booking.booking_id}`;
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
      
      toast.success('Booking created! Opening WhatsApp...');
      window.open(whatsappUrl, '_blank');
      
      setSelectedTickets([]);
      navigate('/my-tickets');
    } catch (error) {
      console.error('Booking failed:', error);
      toast.error('Failed to create booking');
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
    <div className="min-h-screen bg-[#0a0a0c] pb-24">
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

      {/* Top Section - Game Details & Dividends (Compact - fits in top 1/3) */}
      <div className="max-w-7xl mx-auto px-3 py-3">
        <div className="glass-card p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Left: Game Info */}
            <div className="flex-1">
              <h2 className="text-lg font-bold text-white mb-3">{game.name}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                    <span>Price</span>
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

            {/* Right: Dividends (Compact) */}
            <div className="lg:w-64 lg:border-l lg:border-white/10 lg:pl-4">
              <div className="flex items-center gap-1 mb-2">
                <Trophy className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-white">Dividends</h3>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-1 gap-x-4 gap-y-0.5">
                {Object.entries(game.prizes).map(([prize, amount]) => (
                  <div key={prize} className="flex items-center justify-between py-0.5 text-xs">
                    <span className="text-gray-400">{prize}</span>
                    <span className="text-amber-500 font-semibold">₹{amount.toLocaleString()}</span>
                  </div>
                ))}
              </div>
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
      </div>

      {/* Fixed Bottom Book Button */}
      {selectedTickets.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-[#121216] border-t border-amber-500 py-3 px-3 z-50">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div>
              <p className="text-white font-bold">
                {selectedTickets.length} Ticket{selectedTickets.length > 1 ? 's' : ''}
              </p>
              <p className="text-amber-500 text-sm font-semibold">
                ₹{(selectedTickets.length * game.price).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedTickets([])}
                className="border-white/20 h-10 px-4"
              >
                Clear
              </Button>
              <Button
                onClick={handleBookViaWhatsApp}
                disabled={isBooking}
                className="bg-green-500 hover:bg-green-600 font-bold h-10 px-6"
                data-testid="book-via-whatsapp-btn"
              >
                {isBooking ? '...' : '📱 Book Now'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
