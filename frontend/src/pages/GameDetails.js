import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Trophy, Ticket as TicketIcon } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

function TambolaTicket({ ticket, isSelected, onToggle }) {
  return (
    <div
      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
        isSelected
          ? 'border-amber-500 bg-amber-500/10'
          : 'border-white/10 bg-[#18181b] hover:border-amber-500/50'
      }`}
      data-testid={`ticket-${ticket.ticket_id}`}
      onClick={() => onToggle(ticket.ticket_id)}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-amber-500">{ticket.ticket_number}</span>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => {}}
          className="w-4 h-4"
          data-testid={`checkbox-${ticket.ticket_id}`}
        />
      </div>
      <div className="ticket-grid">
        {ticket.numbers.map((row, rowIndex) => (
          row.map((num, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className={`ticket-cell ${num === null ? 'empty' : ''}`}
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
  const [tickets, setTickets] = useState([]);
  const [selectedTickets, setSelectedTickets] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isBooking, setIsBooking] = useState(false);
  const [fullSheets, setFullSheets] = useState([]);
  const [viewMode, setViewMode] = useState('sheets'); // 'sheets' or 'individual'
  const ticketsPerPage = 20;

  useEffect(() => {
    fetchGame();
  }, [gameId]);

  useEffect(() => {
    if (showModal) {
      fetchTickets(currentPage);
    }
  }, [showModal, currentPage]);

  const fetchGame = async () => {
    try {
      const response = await axios.get(`${API}/games/${gameId}`);
      setGame(response.data);
    } catch (error) {
      console.error('Failed to fetch game:', error);
      toast.error('Failed to load game details');
    }
  };

  const fetchTickets = async (page) => {
    try {
      const response = await axios.get(
        `${API}/games/${gameId}/tickets?page=${page}&limit=${ticketsPerPage}&available_only=true`
      );
      setTickets(response.data.tickets);
      setTotalPages(response.data.pages);
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
      const ticketNumbers = selectedTickets.map(id => {
        const ticket = tickets.find(t => t.ticket_id === id);
        return ticket?.ticket_number;
      }).join(', ');

      const message = `Hi! I want to book the following tickets for ${game.name}:\n\nTickets: ${ticketNumbers}\nTotal Amount: ₹${booking.total_amount}\nBooking ID: ${booking.booking_id}`;
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
      
      toast.success('Booking created! Opening WhatsApp...');
      window.open(whatsappUrl, '_blank');
      
      setShowModal(false);
      setSelectedTickets([]);
      navigate('/my-tickets');
    } catch (error) {
      console.error('Booking failed:', error);
      toast.error('Failed to create booking');
    } finally {
      setIsBooking(false);
    }
  };

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

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Game Info */}
          <div className="lg:col-span-2">
            <div className="glass-card p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-white">{game.name}</h2>
                <span className="px-4 py-2 bg-amber-500 text-black text-sm font-bold rounded-full">
                  {game.date} | {game.time}
                </span>
              </div>
              <div className="flex items-center gap-6 text-gray-400">
                <div>
                  <span className="text-sm">Prize Pool</span>
                  <p className="text-2xl font-bold text-amber-500">₹{game.prize_pool.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-sm">Ticket Price</span>
                  <p className="text-2xl font-bold text-white">₹{game.price}</p>
                </div>
                <div>
                  <span className="text-sm">Available</span>
                  <p className="text-2xl font-bold text-white">{game.available_tickets}</p>
                </div>
              </div>
            </div>

            <Button
              data-testid="open-ticket-selection-btn"
              onClick={() => setShowModal(true)}
              className="w-full h-14 text-lg font-bold rounded-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
            >
              <TicketIcon className="w-5 h-5 mr-2" />
              Select Tickets
            </Button>
          </div>

          {/* Prize Breakdown */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-6 h-6 text-amber-500" />
              <h3 className="text-xl font-bold text-white">Prizes</h3>
            </div>
            <div className="space-y-3">
              {Object.entries(game.prizes).map(([prize, amount]) => (
                <div key={prize} className="flex items-center justify-between py-2 border-b border-white/10">
                  <span className="text-gray-300 text-sm">{prize}</span>
                  <span className="text-amber-500 font-bold">₹{amount.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Ticket Selection Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-[#121216] border-white/10" data-testid="ticket-selection-modal">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-white">Select Tickets</DialogTitle>
          </DialogHeader>

          {/* Selected Info */}
          <div className="sticky top-0 bg-[#121216] py-4 border-b border-white/10 z-10">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">
                {selectedTickets.length} tickets selected | Total: ₹{(selectedTickets.length * game.price).toLocaleString()}
              </span>
              {selectedTickets.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedTickets([])}
                  data-testid="clear-selection-btn"
                >
                  Clear Selection
                </Button>
              )}
            </div>
          </div>

          {/* Tickets Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 py-4">
            {tickets.map((ticket) => (
              <TambolaTicket
                key={ticket.ticket_id}
                ticket={ticket}
                isSelected={selectedTickets.includes(ticket.ticket_id)}
                onToggle={toggleTicket}
              />
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-4 py-4">
            <Button
              variant="outline"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              data-testid="prev-page-btn"
            >
              Previous
            </Button>
            <span className="text-gray-400">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              data-testid="next-page-btn"
            >
              Next
            </Button>
          </div>

          {/* Book Button */}
          <div className="sticky bottom-0 bg-[#121216] pt-4 border-t border-white/10">
            <Button
              data-testid="book-via-whatsapp-btn"
              onClick={handleBookViaWhatsApp}
              disabled={selectedTickets.length === 0 || isBooking}
              className="w-full h-14 text-lg font-bold rounded-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
            >
              {isBooking ? 'Processing...' : 'Book via WhatsApp'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
