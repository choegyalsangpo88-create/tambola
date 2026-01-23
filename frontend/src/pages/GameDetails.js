import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, Calendar, Users, Award, Ticket, Filter, CreditCard, MessageCircle, Copy, CheckCircle, Info, X } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// ===== PAYMENT CONFIGURATION (Single source of truth) =====
// India - UPI
const UPI_ID = 'choegyalsangpo@ibl';
const UPI_PAYEE_NAME = 'Choegyal Sangpo';
// Canada - Interac e-Transfer
const INTERAC_EMAIL = 'payments@sixseventambola.ca';
const INTERAC_AUTO_DEPOSIT = true;
// Europe - Wero / SEPA
const WERO_PHONE = '+33612345678';
const WERO_RECIPIENT = 'SixSeven Tambola';
const SEPA_IBAN = 'FR76 3000 1007 1600 0000 0000 123';
const SEPA_BIC = 'BNPAFRPP';
// WhatsApp for all regions
const WHATSAPP_NUMBER = '918837489781';
const WHATSAPP_DISPLAY = '+91 8837489781';

// Exchange rates (INR as base currency)
// These are approximate rates - update periodically
const EXCHANGE_RATES = {
  INR: 1,
  CAD: 0.016,  // 1 INR = 0.016 CAD (approx)
  EUR: 0.011   // 1 INR = 0.011 EUR (approx)
};

// Payment methods configuration
const PAYMENT_METHODS = {
  upi: {
    id: 'upi',
    name: 'UPI',
    icon: '🇮🇳',
    currency: '₹',
    currencyCode: 'INR',
    region: 'india',
    exchangeRate: EXCHANGE_RATES.INR
  },
  interac: {
    id: 'interac',
    name: 'Interac e-Transfer',
    icon: '🇨🇦',
    currency: '$',
    currencyCode: 'CAD',
    region: 'canada',
    exchangeRate: EXCHANGE_RATES.CAD
  },
  wero: {
    id: 'wero',
    name: 'Wero',
    icon: '🇪🇺',
    currency: '€',
    currencyCode: 'EUR',
    region: 'europe',
    exchangeRate: EXCHANGE_RATES.EUR
  }
};

// Region to default payment method mapping
const REGION_DEFAULTS = {
  india: 'upi',
  canada: 'interac',
  europe: 'wero',
  default: 'upi'
};

// Single Lotto Ticket Component (clickable for individual selection)
// Consistent styling whether in a full sheet or standalone
function LottoTicketCard({ ticket, isFirst, pageNumber, isSelected, onToggle, isBooked, isInFullSheet = false }) {
  const bookedByName = ticket.booked_by_name || ticket.holder_name;

  return (
    <div 
      className={`bg-white cursor-pointer transition-all duration-200 ${
        isBooked 
          ? 'opacity-50 cursor-not-allowed' 
          : ''
      }`}
      style={{ 
        border: isSelected ? '2px solid #f59e0b' : '1px solid #d4a800',
        margin: '1px',
        borderRadius: '0px',
        boxShadow: isSelected ? '0 0 6px rgba(245, 158, 11, 0.5)' : 'none'
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isBooked && onToggle) {
          onToggle(ticket.ticket_id);
        }
      }}
      data-testid={`ticket-${ticket.ticket_number}`}
    >
      {/* Header with ticket number and user name */}
      <div className="py-0.5 border-b border-gray-300 bg-gray-100">
        {/* Ticket header with user name on right */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1">
            {isFirst && pageNumber && (
              <span 
                className="text-[8px] font-bold text-gray-600 mr-1"
                style={{ fontFamily: 'Arial, sans-serif' }}
              >
                {pageNumber}
              </span>
            )}
            <p 
              className="text-[9px] font-bold text-black uppercase"
              style={{ fontFamily: 'Arial, sans-serif' }}
            >
              LOTTO TICKET {ticket.ticket_number}
            </p>
            {isSelected && (
              <span className="text-amber-500 text-[10px] font-bold">✓</span>
            )}
          </div>
          {bookedByName && (
            <span 
              className="text-[9px] font-bold text-black"
              style={{ fontFamily: 'Arial, sans-serif' }}
            >
              {bookedByName.length > 8 ? bookedByName.slice(0, 8) + '..' : bookedByName}
            </span>
          )}
        </div>
      </div>
      
      {/* Number Grid - 3 rows x 9 columns */}
      <div className="grid grid-cols-9">
        {ticket.numbers.map((row, rowIndex) => (
          row.map((num, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className="flex items-center justify-center border-r border-b border-gray-200 last:border-r-0"
              style={{
                height: '18px',
                fontFamily: 'Arial, sans-serif',
                fontSize: '10px',
                fontWeight: 'bold',
                color: '#000'
              }}
            >
              {num || ''}
            </div>
          ))
        ))}
      </div>
    </div>
  );
}

// Full Sheet Component - 6 tickets stacked vertically with individual selection
function FullSheet({ sheetId, tickets, selectedTickets, onToggleTicket, onSelectAll, pageNumber }) {
  // Check booking status
  const hasBookedTickets = tickets.some(t => t.is_booked);
  const allBooked = tickets.every(t => t.is_booked);
  const availableTickets = tickets.filter(t => !t.is_booked);
  const selectedCount = tickets.filter(t => selectedTickets.includes(t.ticket_id)).length;
  const allAvailableSelected = availableTickets.length > 0 && availableTickets.every(t => selectedTickets.includes(t.ticket_id));
  
  return (
    <div data-testid={`full-sheet-${sheetId}`}>
      {/* Sheet header with ID, status, and Select All button */}
      <div className="flex items-center justify-between mb-1 px-1">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${selectedCount > 0 ? 'text-amber-400' : 'text-amber-500/80'}`}>
            {sheetId}
          </span>
          <span className="text-[10px] text-gray-500">
            {tickets[0]?.ticket_number} - {tickets[5]?.ticket_number}
          </span>
          {selectedCount > 0 && (
            <span className="text-xs text-amber-400 font-bold">{selectedCount}/6 selected</span>
          )}
        </div>
        {!allBooked && (
          <button
            onClick={() => onSelectAll(tickets)}
            className={`text-[10px] px-2 py-0.5 rounded ${
              allAvailableSelected 
                ? 'bg-amber-500 text-black' 
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            {allAvailableSelected ? '✓ All Selected' : 'Select All 6'}
          </button>
        )}
      </div>
      
      {/* The Full Sheet - Mustard Yellow background */}
      <div 
        className="p-1"
        style={{
          backgroundColor: '#E6B800',
          border: selectedCount > 0 ? '2px solid #f59e0b' : '1px solid #cca300'
        }}
      >
        {/* 6 Tickets stacked vertically - each individually selectable */}
        {tickets.map((ticket, index) => (
          <LottoTicketCard
            key={ticket.ticket_id}
            ticket={ticket}
            isFirst={index === 0}
            pageNumber={pageNumber}
            isSelected={selectedTickets.includes(ticket.ticket_id)}
            onToggle={onToggleTicket}
            isBooked={ticket.is_booked}
          />
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
  const [filterMode, setFilterMode] = useState('all');
  const [tickets, setTickets] = useState([]);
  
  // Payment flow state
  const [showPaymentPanel, setShowPaymentPanel] = useState(false);
  const [txnRef, setTxnRef] = useState('');
  const [copied, setCopied] = useState(false);
  const [bookingRequestId, setBookingRequestId] = useState(null);
  const [isCreatingBooking, setIsCreatingBooking] = useState(false);
  const [userRegion, setUserRegion] = useState('india'); // Default to India
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('upi');
  const [paymentStep, setPaymentStep] = useState(1); // 1 = select method, 2 = payment details
  
  // Timer state (10 minutes = 600 seconds)
  const [timeLeft, setTimeLeft] = useState(600);
  const [timerActive, setTimerActive] = useState(false);

  // Detect user region on mount
  useEffect(() => {
    const detectRegion = async () => {
      try {
        // Using free IP geolocation API
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        const countryCode = data.country_code?.toUpperCase();
        
        let region = 'india'; // Default
        if (countryCode === 'CA') {
          region = 'canada';
        } else if (['FR', 'DE', 'IT', 'ES', 'NL', 'BE', 'AT', 'PT', 'IE', 'FI', 'GR', 'LU'].includes(countryCode)) {
          region = 'europe';
        } else if (countryCode === 'IN') {
          region = 'india';
        }
        
        setUserRegion(region);
        setSelectedPaymentMethod(REGION_DEFAULTS[region] || 'upi');
      } catch (error) {
        console.log('Region detection failed, using default');
        setUserRegion('india');
        setSelectedPaymentMethod('upi');
      }
    };
    detectRegion();
  }, []);

  // Timer countdown effect
  useEffect(() => {
    let interval = null;
    if (timerActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((time) => time - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      // Timer expired
      setShowPaymentPanel(false);
      setTimerActive(false);
      toast.error('Payment time expired. Please try again.');
      setSelectedTickets([]);
    }
    return () => clearInterval(interval);
  }, [timerActive, timeLeft]);

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    fetchGame();
    fetchAllTickets();
    
    const interval = setInterval(fetchAllTickets, 10000);
    return () => clearInterval(interval);
  }, [gameId]);

  // Generate transaction reference when payment panel opens
  useEffect(() => {
    if (showPaymentPanel && !txnRef) {
      generateTxnRef();
    }
  }, [showPaymentPanel]);

  const generateTxnRef = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let ref = 'TMB';
    for (let i = 0; i < 6; i++) {
      ref += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setTxnRef(ref);
  };

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
      const response = await axios.get(`${API}/games/${gameId}/tickets?page=1&limit=1000`);
      const allTickets = response.data.tickets;
      setTickets(allTickets);
      
      // Group tickets by Full Sheet ID
      const sheetsMap = {};
      allTickets.forEach(ticket => {
        let sheetId = ticket.full_sheet_id;
        if (!sheetId) {
          const ticketNum = parseInt(ticket.ticket_number.replace(/\D/g, '')) || 0;
          const sheetNum = Math.ceil(ticketNum / 6);
          sheetId = `FS${String(sheetNum).padStart(3, '0')}`;
          ticket.ticket_position_in_sheet = ((ticketNum - 1) % 6) + 1;
          ticket.full_sheet_id = sheetId;
        }
        if (!sheetsMap[sheetId]) {
          sheetsMap[sheetId] = [];
        }
        sheetsMap[sheetId].push(ticket);
      });
      
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
      
      // Clear selection if selected tickets are now booked
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

  // Get selected ticket numbers
  const getSelectedTicketNumbers = () => {
    return tickets
      .filter(t => selectedTickets.includes(t.ticket_id))
      .map(t => t.ticket_number)
      .join(', ');
  };

  // Calculate total amount in INR (base currency)
  const getTotalAmount = () => {
    return selectedTickets.length * (game?.price || 0);
  };

  // Convert INR amount to selected payment method currency
  const getConvertedAmount = (paymentMethodId = selectedPaymentMethod) => {
    const amountINR = getTotalAmount();
    const method = PAYMENT_METHODS[paymentMethodId];
    if (!method || method.currencyCode === 'INR') {
      return amountINR;
    }
    const converted = amountINR * method.exchangeRate;
    // Round to 2 decimal places
    return Math.round(converted * 100) / 100;
  };

  // Format amount with currency symbol
  const formatAmount = (paymentMethodId = selectedPaymentMethod) => {
    const method = PAYMENT_METHODS[paymentMethodId];
    const amount = getConvertedAmount(paymentMethodId);
    if (method.currencyCode === 'INR') {
      return `₹${amount}`;
    }
    return `${method.currency}${amount.toFixed(2)} ${method.currencyCode}`;
  };

  // Copy UPI ID to clipboard
  const copyUPIId = () => {
    navigator.clipboard.writeText(UPI_ID);
    setCopied(true);
    toast.success('UPI ID copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  // Create booking request and open payment panel
  const handleProceedToPayment = async () => {
    if (selectedTickets.length === 0) {
      toast.error('Please select at least one ticket');
      return;
    }
    
    setIsCreatingBooking(true);
    
    try {
      // Get auth token
      const session = localStorage.getItem('tambola_session');
      if (!session) {
        toast.error('Please login first');
        navigate('/login');
        return;
      }
      
      // Create booking request
      const response = await axios.post(
        `${API}/booking-requests`,
        {
          game_id: gameId,
          ticket_ids: selectedTickets
        },
        {
          headers: { 'Authorization': `Bearer ${session}` },
          withCredentials: true
        }
      );
      
      if (response.data.request_id) {
        setBookingRequestId(response.data.request_id);
        generateTxnRef();
        setTimeLeft(600); // Reset timer to 10 minutes
        setTimerActive(true);
        setShowPaymentPanel(true);
        toast.success('Booking request created! Complete payment within 10 minutes.');
      }
    } catch (error) {
      console.error('Failed to create booking request:', error);
      if (error.response?.status === 400) {
        toast.error(error.response.data?.detail || 'Some tickets are no longer available');
        fetchAllTickets(); // Refresh tickets
      } else {
        toast.error('Failed to create booking. Please try again.');
      }
    } finally {
      setIsCreatingBooking(false);
    }
  };

  // Cancel booking and close panel
  const handleCancelBooking = () => {
    setShowPaymentPanel(false);
    setTimerActive(false);
    setTimeLeft(600);
    setSelectedTickets([]);
    setBookingRequestId(null);
    toast.info('Booking cancelled');
  };

  // Filter sheets
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

      {/* Game Details Section */}
      <div className="max-w-7xl mx-auto px-3 py-3">
        <div className="glass-card p-4 flex">
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
                <p className="text-xl font-bold text-amber-500">₹{game.prize_pool?.toLocaleString()}</p>
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

          <div className="w-px bg-white/20 mx-2" />

          <div className="w-40 pl-3">
            <div className="flex items-center gap-1 mb-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-white">Dividends</h3>
            </div>
            <div className="space-y-1">
              {Object.entries(game.prizes || {}).map(([prize, amount]) => (
                <div key={prize} className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 truncate mr-2">{prize}</span>
                  <span className="text-amber-500 font-semibold whitespace-nowrap">₹{amount?.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-amber-500/30 mx-3" />

      {/* Tickets Section */}
      <div className="max-w-7xl mx-auto px-3 py-3">
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

        {filterMode === 'fullsheets' && displayedSheets.length === 0 && (
          <div className="glass-card p-8 text-center">
            <p className="text-gray-400">No full sheets available</p>
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

        {/* Full Sheets Display - Print-ready style with individual ticket selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedSheets.map((sheet, sheetIndex) => {
            const pageNumber = sheetIndex + 1;
            
            return (
              <FullSheet
                key={sheet.sheetId}
                sheetId={sheet.sheetId}
                tickets={sheet.tickets}
                selectedTickets={selectedTickets}
                onToggleTicket={toggleTicket}
                onSelectAll={selectFullSheet}
                pageNumber={pageNumber}
              />
            );
          })}
        </div>

        <div className="h-24" />
      </div>

      {/* Fixed Bottom Bar - Proceed to Payment */}
      {!showPaymentPanel && (
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
                  ? `₹${getTotalAmount().toLocaleString()}`
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
                onClick={handleProceedToPayment}
                disabled={selectedTickets.length === 0 || isCreatingBooking}
                className={`font-bold h-10 px-6 ${
                  selectedTickets.length > 0 && !isCreatingBooking
                    ? 'bg-amber-500 hover:bg-amber-600 text-black' 
                    : 'bg-gray-600 cursor-not-allowed'
                }`}
                data-testid="proceed-to-payment-btn"
              >
                {isCreatingBooking ? 'Creating...' : 'Proceed to Payment'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ===== PAYMENT PANEL (Slide-up) ===== */}
      {showPaymentPanel && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60" onClick={handleCancelBooking}>
          <div 
            className="w-full max-w-lg bg-[#0f0f14] rounded-t-3xl border-t border-white/10 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Panel Header with Timer */}
            <div className="sticky top-0 bg-[#0f0f14] px-4 py-3 border-b border-white/10 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {paymentStep === 2 && (
                    <Button variant="ghost" size="icon" onClick={() => setPaymentStep(1)} className="h-8 w-8 text-gray-400 hover:text-white">
                      <ArrowLeft className="w-5 h-5" />
                    </Button>
                  )}
                  <h2 className="text-lg font-bold text-white">
                    {paymentStep === 1 ? 'Select Payment Method' : 'Complete Payment'}
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  {/* Timer */}
                  <div className={`px-3 py-1 rounded-full font-mono text-sm font-bold ${
                    timeLeft <= 60 ? 'bg-red-500/20 text-red-400' : 
                    timeLeft <= 180 ? 'bg-amber-500/20 text-amber-400' : 
                    'bg-green-500/20 text-green-400'
                  }`}>
                    ⏱️ {formatTime(timeLeft)}
                  </div>
                  <Button variant="ghost" size="icon" onClick={handleCancelBooking} className="h-8 w-8 text-gray-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>
              {/* Booking Request ID */}
              {bookingRequestId && (
                <p className="text-xs text-gray-500 mt-1">
                  Booking ID: <span className="text-amber-500 font-mono">{bookingRequestId}</span>
                </p>
              )}
            </div>

            <div className="p-4 space-y-4">
              {/* Timer Warning */}
              {timeLeft <= 120 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                  <p className="text-red-400 text-sm text-center font-medium">
                    ⚠️ Complete payment within {formatTime(timeLeft)} or booking will expire!
                  </p>
                </div>
              )}

              {/* ===== STEP 1: PAYMENT METHOD SELECTION ===== */}
              {paymentStep === 1 && (
                <>
                  {/* Booking Summary */}
                  <div className="bg-[#1a1a2e] rounded-xl p-4 border border-white/10">
                    <h3 className="text-base font-bold text-white mb-3">🧾 Booking Summary</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Game:</span>
                        <span className="text-white font-semibold text-sm">{game.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Tickets:</span>
                        <span className="text-white font-mono text-sm">{getSelectedTicketNumbers()}</span>
                      </div>
                      <div className="border-t border-white/10 pt-2 mt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-white font-bold">Total Amount:</span>
                          <span className="text-amber-500 font-bold text-xl">
                            {PAYMENT_METHODS[selectedPaymentMethod]?.currency}{getTotalAmount()}
                            {selectedPaymentMethod !== 'upi' && (
                              <span className="text-xs text-gray-400 ml-1">
                                ({PAYMENT_METHODS[selectedPaymentMethod]?.currencyCode})
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Payment Method Selection */}
                  <div className="space-y-2">
                    <p className="text-gray-400 text-sm">Choose your payment method:</p>
                    
                    {/* Payment methods ordered by region */}
                    {(() => {
                      const methodOrder = userRegion === 'canada' 
                        ? ['interac', 'upi', 'wero']
                        : userRegion === 'europe'
                        ? ['wero', 'upi', 'interac']
                        : ['upi', 'interac', 'wero'];
                      
                      return methodOrder.map((methodId) => {
                        const method = PAYMENT_METHODS[methodId];
                        const isRecommended = REGION_DEFAULTS[userRegion] === methodId;
                        const isSelected = selectedPaymentMethod === methodId;
                        
                        return (
                          <button
                            key={methodId}
                            onClick={() => setSelectedPaymentMethod(methodId)}
                            className={`w-full p-4 rounded-xl border-2 transition-all flex items-center justify-between ${
                              isSelected
                                ? 'border-amber-500 bg-amber-500/10'
                                : 'border-white/10 bg-[#1a1a2e] hover:border-white/30'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{method.icon}</span>
                              <div className="text-left">
                                <p className="text-white font-semibold">{method.name}</p>
                                <p className="text-gray-400 text-xs">Pay in {method.currency} {method.currencyCode}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {isRecommended && (
                                <span className="px-2 py-0.5 text-[10px] rounded-full bg-green-500/20 text-green-400 font-medium">
                                  Recommended
                                </span>
                              )}
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                isSelected ? 'border-amber-500 bg-amber-500' : 'border-gray-500'
                              }`}>
                                {isSelected && <CheckCircle className="w-3 h-3 text-black" />}
                              </div>
                            </div>
                          </button>
                        );
                      });
                    })()}
                    
                    <p className="text-gray-500 text-xs text-center mt-2">
                      Not in this country? You can change payment method above.
                    </p>
                  </div>

                  {/* Continue Button */}
                  <Button
                    onClick={() => setPaymentStep(2)}
                    className="w-full h-14 text-lg font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black rounded-xl"
                  >
                    Continue with {PAYMENT_METHODS[selectedPaymentMethod]?.name}
                  </Button>
                </>
              )}

              {/* ===== STEP 2: PAYMENT DETAILS ===== */}
              {paymentStep === 2 && (
                <>
                  {/* UPI Payment (India) */}
                  {selectedPaymentMethod === 'upi' && (
                    <div className="space-y-4">
                      <div className="bg-[#1a1a2e] rounded-xl p-4 border border-white/10">
                        <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                          🇮🇳 Pay via UPI
                        </h3>
                        
                        {/* UPI Details */}
                        <div className="space-y-3">
                          <div className="bg-black/30 rounded-lg p-3">
                            <p className="text-gray-400 text-xs mb-1">UPI ID</p>
                            <div className="flex items-center justify-between">
                              <span className="text-white font-mono text-lg">{UPI_ID}</span>
                              <Button variant="ghost" size="sm" onClick={copyUPIId} className="text-amber-500 hover:text-amber-400 h-8 px-2">
                                {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                <span className="ml-1 text-xs">Copy</span>
                              </Button>
                            </div>
                          </div>
                          
                          <div className="bg-black/30 rounded-lg p-3">
                            <p className="text-gray-400 text-xs mb-1">Amount</p>
                            <div className="flex items-center justify-between">
                              <span className="text-amber-500 font-bold text-xl">₹{getTotalAmount()}</span>
                              <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(getTotalAmount().toString()); toast.success('Amount copied!'); }} className="text-amber-500 hover:text-amber-400 h-8 px-2">
                                <Copy className="w-4 h-4" /><span className="ml-1 text-xs">Copy</span>
                              </Button>
                            </div>
                          </div>
                          
                          <div className="bg-black/30 rounded-lg p-3">
                            <p className="text-gray-400 text-xs mb-1">Reference / Note</p>
                            <div className="flex items-center justify-between">
                              <span className="text-white font-mono text-sm">{bookingRequestId} – {JSON.parse(localStorage.getItem('tambola_user') || '{}').name || 'Player'}</span>
                              <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(`${bookingRequestId} – ${JSON.parse(localStorage.getItem('tambola_user') || '{}').name || 'Player'}`); toast.success('Reference copied!'); }} className="text-amber-500 hover:text-amber-400 h-8 px-2">
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* UPI App Buttons */}
                        <div className="mt-4 space-y-2">
                          <a href={`upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(UPI_PAYEE_NAME)}&am=${getTotalAmount()}&cu=INR&tn=${encodeURIComponent(bookingRequestId + ' - ' + (JSON.parse(localStorage.getItem('tambola_user') || '{}').name || 'Player'))}`}
                            className="block w-full h-12 text-base font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black rounded-xl flex items-center justify-center no-underline"
                          >
                            Open UPI App
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Interac e-Transfer (Canada) */}
                  {selectedPaymentMethod === 'interac' && (
                    <div className="space-y-4">
                      <div className="bg-[#1a1a2e] rounded-xl p-4 border border-white/10">
                        <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                          🇨🇦 Pay via Interac e-Transfer
                        </h3>
                        
                        {INTERAC_AUTO_DEPOSIT && (
                          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-2 mb-3">
                            <p className="text-green-400 text-xs text-center">✓ Auto-Deposit Enabled</p>
                          </div>
                        )}
                        
                        <div className="space-y-3">
                          <div className="bg-black/30 rounded-lg p-3">
                            <p className="text-gray-400 text-xs mb-1">Payment Email</p>
                            <div className="flex items-center justify-between">
                              <span className="text-white font-mono">{INTERAC_EMAIL}</span>
                              <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(INTERAC_EMAIL); toast.success('Email copied!'); }} className="text-amber-500 hover:text-amber-400 h-8 px-2">
                                <Copy className="w-4 h-4" /><span className="ml-1 text-xs">Copy</span>
                              </Button>
                            </div>
                          </div>
                          
                          <div className="bg-black/30 rounded-lg p-3">
                            <p className="text-gray-400 text-xs mb-1">Amount</p>
                            <div className="flex items-center justify-between">
                              <span className="text-amber-500 font-bold text-xl">${getTotalAmount()} CAD</span>
                              <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(getTotalAmount().toString()); toast.success('Amount copied!'); }} className="text-amber-500 hover:text-amber-400 h-8 px-2">
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          
                          <div className="bg-black/30 rounded-lg p-3">
                            <p className="text-gray-400 text-xs mb-1">Message / Reference</p>
                            <div className="flex items-center justify-between">
                              <span className="text-white font-mono text-sm">{bookingRequestId} – {JSON.parse(localStorage.getItem('tambola_user') || '{}').name || 'Player'}</span>
                              <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(`${bookingRequestId} – ${JSON.parse(localStorage.getItem('tambola_user') || '{}').name || 'Player'}`); toast.success('Reference copied!'); }} className="text-amber-500 hover:text-amber-400 h-8 px-2">
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Wero Payment (Europe) */}
                  {selectedPaymentMethod === 'wero' && (
                    <div className="space-y-4">
                      <div className="bg-[#1a1a2e] rounded-xl p-4 border border-white/10">
                        <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                          🇪🇺 Pay with Wero
                        </h3>
                        <p className="text-gray-400 text-xs mb-3">Send money instantly from your bank using Wero.</p>
                        
                        <div className="space-y-3">
                          <div className="bg-black/30 rounded-lg p-3">
                            <p className="text-gray-400 text-xs mb-1">Recipient Name</p>
                            <div className="flex items-center justify-between">
                              <span className="text-white">{WERO_RECIPIENT}</span>
                              <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(WERO_RECIPIENT); toast.success('Copied!'); }} className="text-amber-500 hover:text-amber-400 h-8 px-2">
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          
                          <div className="bg-black/30 rounded-lg p-3">
                            <p className="text-gray-400 text-xs mb-1">Phone / Alias</p>
                            <div className="flex items-center justify-between">
                              <span className="text-white font-mono">{WERO_PHONE}</span>
                              <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(WERO_PHONE); toast.success('Phone copied!'); }} className="text-amber-500 hover:text-amber-400 h-8 px-2">
                                <Copy className="w-4 h-4" /><span className="ml-1 text-xs">Copy</span>
                              </Button>
                            </div>
                          </div>
                          
                          <div className="bg-black/30 rounded-lg p-3">
                            <p className="text-gray-400 text-xs mb-1">Amount</p>
                            <div className="flex items-center justify-between">
                              <span className="text-amber-500 font-bold text-xl">€{getTotalAmount()} EUR</span>
                              <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(getTotalAmount().toString()); toast.success('Amount copied!'); }} className="text-amber-500 hover:text-amber-400 h-8 px-2">
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          
                          <div className="bg-black/30 rounded-lg p-3">
                            <p className="text-gray-400 text-xs mb-1">Reference</p>
                            <div className="flex items-center justify-between">
                              <span className="text-white font-mono text-sm">{bookingRequestId} – {JSON.parse(localStorage.getItem('tambola_user') || '{}').name || 'Player'}</span>
                              <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(`${bookingRequestId} – ${JSON.parse(localStorage.getItem('tambola_user') || '{}').name || 'Player'}`); toast.success('Reference copied!'); }} className="text-amber-500 hover:text-amber-400 h-8 px-2">
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* SEPA Fallback */}
                        <details className="mt-4">
                          <summary className="text-gray-400 text-sm cursor-pointer hover:text-white">
                            Bank Transfer (SEPA) - Alternative
                          </summary>
                          <div className="mt-2 space-y-2 p-3 bg-black/20 rounded-lg">
                            <div className="flex justify-between">
                              <span className="text-gray-400 text-xs">Recipient:</span>
                              <span className="text-white text-xs">{WERO_RECIPIENT}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400 text-xs">IBAN:</span>
                              <span className="text-white font-mono text-xs">{SEPA_IBAN}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-400 text-xs">BIC:</span>
                              <span className="text-white font-mono text-xs">{SEPA_BIC}</span>
                            </div>
                          </div>
                        </details>
                      </div>
                    </div>
                  )}

                  {/* Confirmation Instruction */}
                  <div className="bg-green-900/20 rounded-xl p-4 border border-green-500/30">
                    <p className="text-green-300 text-center font-medium text-sm">
                      After completing your payment, click the button below.<br />
                      Admin will verify and confirm your booking.
                    </p>
                  </div>

                  {/* I've Sent Payment Button */}
                  <Button
                    onClick={() => {
                      // Open WhatsApp with payment details
                      const userName = JSON.parse(localStorage.getItem('tambola_user') || '{}').name || 'Player';
                      const method = PAYMENT_METHODS[selectedPaymentMethod];
                      const message = `✅ PAYMENT SENT\n\nBooking ID: ${bookingRequestId}\nGame: ${game?.name || 'Tambola Game'}\nTickets: ${getSelectedTicketNumbers()}\nAmount: ${method.currency}${getTotalAmount()} ${method.currencyCode}\nPayment Method: ${method.name}\nName: ${userName}\n\n📸 Screenshot attached`;
                      window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank');
                    }}
                    className="w-full h-14 text-lg font-bold bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl"
                  >
                    ✅ I&apos;ve Sent Payment
                  </Button>

                  {/* Done button */}
                  <Button
                    onClick={() => {
                      setShowPaymentPanel(false);
                      setTimerActive(false);
                      setSelectedTickets([]);
                      setBookingRequestId(null);
                      setPaymentStep(1);
                      toast.success('Your booking is pending! We will confirm after payment verification.');
                    }}
                    variant="outline"
                    className="w-full h-12 border-white/20 text-white"
                  >
                    Done
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
