import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, Calendar, Users, Award, Ticket, Filter } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function TambolaTicket({ ticket, isSelected, onToggle, isCompact }) {
  return (
    <div
      className={`p-3 rounded-xl border-3 cursor-pointer transition-all shadow-lg ${
        isSelected
          ? 'border-amber-500 bg-amber-500/20 scale-105 shadow-amber-500/50'
          : 'border-white/20 bg-[#18181b] hover:border-amber-500/50 hover:scale-105'
      }`}
      data-testid={`ticket-${ticket.ticket_id}`}
      onClick={() => onToggle(ticket.ticket_id)}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`text-sm font-bold ${isSelected ? 'text-amber-400' : 'text-amber-500'}`}>
          {ticket.ticket_number}
        </span>
        <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
          isSelected ? 'bg-amber-500 border-amber-500' : 'border-white/30'
        }`}>
          {isSelected && <span className="text-black font-bold text-xs">✓</span>}
        </div>
      </div>
      <div className="ticket-grid" style={{ fontSize: '0.75rem' }}>
        {ticket.numbers.map((row, rowIndex) => (
          row.map((num, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={`ticket-cell ${num === null ? 'empty' : ''}`}
              style={{ fontSize: '0.7rem', padding: '4px' }}
            >
              {num || ''}
            </div>
          ))
        ))}
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
  const [filterMode, setFilterMode] = useState('all'); // 'all', 'selected', 'fullsheets'
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
        `${API}/games/${gameId}/tickets?page=1&limit=600&available_only=true`
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
      const sheetsArray = Object.entries(sheetsMap).map(([sheetId, tickets]) => ({
        sheetId,
        tickets: tickets.sort((a, b) => a.ticket_position_in_sheet - b.ticket_position_in_sheet),
        isComplete: tickets.length === 6,
        availableCount: tickets.filter(t => !t.is_booked).length
      })).sort((a, b) => {
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
    const sheetTicketIds = sheetTickets.map(t => t.ticket_id);
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
    const sheetTicketIds = sheetTickets.map(t => t.ticket_id);
    return sheetTicketIds.length === 6 && sheetTicketIds.every(id => selectedTickets.includes(id));
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

  const displayedSheets = filterMode === 'selected'
    ? fullSheets.filter(sheet => isFullSheetSelected(sheet.tickets))
    : filterMode === 'fullsheets'
    ? fullSheets.filter(sheet => sheet.availableCount === 6)
    : fullSheets;

  if (!game) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c]">
        <div className="w-16 h-16 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] pb-20">
      {/* Header */}
      <div className="bg-[#121216] border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            data-testid="back-button"
            variant="ghost"
            size="icon"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="w-6 h-6" />
          </Button>
          <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'Outfit, sans-serif' }}>
            {game.name}
          </h1>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left: Game Details */}
          <div className="lg:col-span-2 glass-card p-6">
            <h2 className="text-2xl font-bold text-white mb-4">{game.name}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                  <Calendar className="w-4 h-4" />
                  <span>Date & Time</span>
                </div>
                <p className="text-white font-bold">{game.date}</p>
                <p className="text-amber-500 text-sm">{game.time}</p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                  <Award className="w-4 h-4" />
                  <span>Prize Pool</span>
                </div>
                <p className="text-2xl font-bold text-amber-500">₹{game.prize_pool.toLocaleString()}</p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                  <Ticket className="w-4 h-4" />
                  <span>Price</span>
                </div>
                <p className="text-xl font-bold text-white">₹{game.price}</p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                  <Users className="w-4 h-4" />
                  <span>Available</span>
                </div>
                <p className="text-xl font-bold text-white">{game.available_tickets}</p>
              </div>
            </div>
          </div>

          {/* Right: Dividends (Prizes) */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-6 h-6 text-amber-500" />
              <h3 className="text-xl font-bold text-white">Dividends</h3>
            </div>
            <div className="space-y-2">
              {Object.entries(game.prizes).map(([prize, amount]) => (
                <div key={prize} className="flex items-center justify-between py-2 border-b border-white/10">
                  <span className="text-gray-300 text-sm">{prize}</span>
                  <span className="text-amber-500 font-bold">₹{amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Filter Toggle */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">All Full Sheets (100 Sheets × 6 Tickets)</h2>
          <Button
            variant="outline"
            onClick={() => setFilterSelected(!filterSelected)}
            className={`border-white/20 ${filterSelected ? 'bg-amber-500 text-black' : ''}`}
            data-testid="filter-selected-btn"
          >
            <Filter className="w-4 h-4 mr-2" />
            {filterSelected ? 'Show All Sheets' : 'Show Selected Only'}
          </Button>
        </div>

        {/* All Full Sheets */}
        <div className="space-y-8 mb-24">
          {displayedSheets.map((sheet, sheetIndex) => {
            const isSelected = isFullSheetSelected(sheet.tickets);
            const isFullyAvailable = sheet.availableCount === 6;
            
            // Assign unique border color to each sheet
            const borderColors = [
              'border-blue-500',
              'border-purple-500',
              'border-pink-500',
              'border-red-500',
              'border-orange-500',
              'border-yellow-500',
              'border-green-500',
              'border-teal-500',
              'border-cyan-500',
              'border-indigo-500'
            ];
            const borderColor = isSelected 
              ? 'border-amber-500' 
              : borderColors[sheetIndex % borderColors.length];
            
            return (
              <div
                key={sheet.sheetId}
                className={`glass-card p-6 border-4 transition-all ${borderColor} ${
                  isSelected ? 'bg-amber-500/10' : ''
                } ${!isFullyAvailable ? 'opacity-50' : ''}`}
                data-testid={`full-sheet-${sheet.sheetId}`}
              >
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-1">
                      {sheet.sheetId}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {sheet.tickets[0]?.ticket_number} - {sheet.tickets[5]?.ticket_number}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-4 py-2 text-sm font-bold rounded-full ${
                      isFullyAvailable
                        ? 'bg-green-500/20 text-green-400 border-2 border-green-500'
                        : 'bg-red-500/20 text-red-400 border-2 border-red-500'
                    }`}>
                      {sheet.availableCount}/6 Available
                    </span>
                    {isFullyAvailable && (
                      <Button
                        onClick={() => selectFullSheet(sheet.tickets)}
                        className={`rounded-full font-bold px-6 h-10 ${
                          isSelected
                            ? 'bg-red-600 hover:bg-red-700'
                            : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700'
                        }`}
                        data-testid={`select-sheet-${sheet.sheetId}`}
                      >
                        {isSelected ? '✓ Selected' : 'Select Full Sheet'}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Tickets Grid - 6 tickets in one row on desktop */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  {sheet.tickets.map((ticket) => (
                    <TambolaTicket
                      key={ticket.ticket_id}
                      ticket={ticket}
                      isSelected={selectedTickets.includes(ticket.ticket_id)}
                      onToggle={toggleTicket}
                      isCompact={false}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Fixed Bottom Book Button */}
        {selectedTickets.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-[#121216] border-t-4 border-amber-500 py-4 px-4 z-50">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div>
                <p className="text-white font-bold text-lg">
                  {selectedTickets.length} Tickets Selected
                </p>
                <p className="text-amber-500 text-sm">
                  Total: ₹{(selectedTickets.length * game.price).toLocaleString()}
                </p>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setSelectedTickets([])}
                  className="border-white/20 px-6 h-12"
                >
                  Clear All
                </Button>
                <Button
                  onClick={handleBookViaWhatsApp}
                  disabled={isBooking}
                  className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 font-bold px-8 h-12 text-lg"
                  data-testid="book-via-whatsapp-btn"
                >
                  {isBooking ? 'Processing...' : '📱 Book via WhatsApp'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
