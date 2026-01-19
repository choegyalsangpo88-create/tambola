import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trophy, Calendar, Users, Award, Ticket, Filter, CreditCard, MessageCircle, Copy, CheckCircle, Info, X } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// ===== PAYMENT CONFIGURATION (Single source of truth) =====
const UPI_ID = 'choegyalsangpo@ibl';
const UPI_NAME = 'SixSevenTambola';
const WHATSAPP_NUMBER = '918837489781';
const WHATSAPP_DISPLAY = '+91 8837489781';

// Single Lotto Ticket Component (for inside the sheet)
function LottoTicketCard({ ticket, isFirst, pageNumber }) {
  return (
    <div 
      className="bg-white"
      style={{ borderBottom: '1px solid #000' }}
    >
      {/* Header with ticket number and page number */}
      <div className="relative py-1 border-b border-black">
        {/* Page number on first ticket only - left side */}
        {isFirst && pageNumber && (
          <span 
            className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-black"
            style={{ fontFamily: 'Arial, sans-serif' }}
          >
            {pageNumber}
          </span>
        )}
        {/* Centered ticket header */}
        <p 
          className="text-center text-xs font-bold text-black uppercase tracking-wide"
          style={{ fontFamily: 'Arial, sans-serif' }}
        >
          LOTTO TICKET {ticket.ticket_number}
        </p>
      </div>
      
      {/* Number Grid - 3 rows x 9 columns */}
      <div className="grid grid-cols-9">
        {ticket.numbers.map((row, rowIndex) => (
          row.map((num, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              className="flex items-center justify-center border-r border-b border-black last:border-r-0"
              style={{
                height: '28px',
                fontFamily: 'Arial, sans-serif',
                fontSize: '14px',
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

// Full Sheet Component - 6 tickets stacked vertically (matches ChatGPT image)
function FullSheet({ sheetId, tickets, isSelected, onToggle, pageNumber }) {
  // Check if any ticket in the sheet is booked
  const hasBookedTickets = tickets.some(t => t.is_booked);
  const allBooked = tickets.every(t => t.is_booked);
  
  // Get booked by name for display
  const bookedByName = tickets.find(t => t.is_booked)?.booked_by_name;
  const shortName = bookedByName ? (
    bookedByName.split(' ').length > 1 
      ? bookedByName.split(' ')[0][0] + '. ' + bookedByName.split(' ')[1].slice(0, 6)
      : bookedByName.slice(0, 8)
  ) : null;
  
  return (
    <div
      className={`cursor-pointer transition-all duration-200 ${
        allBooked
          ? 'opacity-50 cursor-not-allowed'
          : isSelected
          ? 'scale-[1.02] z-10'
          : 'hover:scale-[1.01]'
      }`}
      onClick={() => !allBooked && onToggle(tickets)}
      data-testid={`full-sheet-${sheetId}`}
    >
      {/* Sheet header with ID and status */}
      <div className="flex items-center justify-between mb-1 px-1">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${isSelected ? 'text-amber-400' : 'text-amber-500/80'}`}>
            {sheetId}
          </span>
          <span className="text-[10px] text-gray-500">
            {tickets[0]?.ticket_number} - {tickets[5]?.ticket_number}
          </span>
          {shortName && (
            <span className="text-[10px] text-purple-400">• {shortName}</span>
          )}
        </div>
        {isSelected && (
          <span className="text-xs text-amber-400 font-bold">✓ Selected</span>
        )}
        {hasBookedTickets && !allBooked && (
          <span className="text-[10px] text-red-400">Partially Booked</span>
        )}
      </div>
      
      {/* The Full Sheet - Mustard Yellow background with white margin */}
      <div 
        className={`p-2 ${isSelected ? 'ring-3 ring-amber-500 shadow-xl shadow-amber-500/30' : ''}`}
        style={{
          backgroundColor: '#E6B800', // Mustard yellow
          border: isSelected ? '3px solid #f59e0b' : '2px solid #cca300'
        }}
      >
        {/* White inner margin */}
        <div 
          className="bg-white"
          style={{ border: '1px solid #000' }}
        >
          {/* 6 Tickets stacked vertically */}
          {tickets.map((ticket, index) => (
            <LottoTicketCard
              key={ticket.ticket_id}
              ticket={ticket}
              isFirst={index === 0}
              pageNumber={pageNumber}
            />
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
  const [filterMode, setFilterMode] = useState('all');
  const [tickets, setTickets] = useState([]);
  
  // Payment flow state
  const [showPaymentPanel, setShowPaymentPanel] = useState(false);
  const [txnRef, setTxnRef] = useState('');
  const [copied, setCopied] = useState(false);

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

  // Calculate total amount
  const getTotalAmount = () => {
    return selectedTickets.length * (game?.price || 0);
  };

  // ===== BUTTON 1: PAY VIA UPI =====
  // Opens UPI app ONLY - no WhatsApp, no navigation
  const handlePayViaUPI = () => {
    const amount = getTotalAmount();
    const note = `SixSevenTambola-${txnRef}`;
    const upiLink = `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(UPI_NAME)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
    
    // Open UPI app - ONLY this action, nothing else
    window.location.href = upiLink;
  };

  // ===== BUTTON 2: SEND WHATSAPP CONFIRMATION =====
  // Opens WhatsApp ONLY on click - exact message format
  const handleSendWhatsApp = () => {
    const ticketNumbers = getSelectedTicketNumbers();
    const amount = getTotalAmount();
    const gameName = game?.name || 'Tambola Game';
    
    // Exact message format as specified
    const message = `✅ PAYMENT DONE

Game: ${gameName}
Tickets: ${ticketNumbers}
Amount: ₹${amount}
Txn Ref: ${txnRef}

📸 Screenshot attached`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;
    
    // Open WhatsApp - ONLY on click, no async, no auto-redirect
    window.open(whatsappUrl, '_blank');
  };

  // Copy UPI ID to clipboard
  const copyUPIId = () => {
    navigator.clipboard.writeText(UPI_ID);
    setCopied(true);
    toast.success('UPI ID copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  // Open payment panel
  const handleProceedToPayment = () => {
    if (selectedTickets.length === 0) {
      toast.error('Please select at least one ticket');
      return;
    }
    generateTxnRef();
    setShowPaymentPanel(true);
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

        {/* Full Sheets Display - Print-ready style like ChatGPT image */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedSheets.map((sheet, sheetIndex) => {
            const isSelected = isFullSheetSelected(sheet.tickets);
            const allBooked = sheet.tickets.every(t => t.is_booked);
            const pageNumber = sheetIndex + 1;
            
            return (
              <FullSheet
                key={sheet.sheetId}
                sheetId={sheet.sheetId}
                tickets={sheet.tickets}
                isSelected={isSelected}
                onToggle={(tickets) => selectFullSheet(tickets)}
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
                disabled={selectedTickets.length === 0}
                className={`font-bold h-10 px-6 ${
                  selectedTickets.length > 0 
                    ? 'bg-amber-500 hover:bg-amber-600 text-black' 
                    : 'bg-gray-600 cursor-not-allowed'
                }`}
                data-testid="proceed-to-payment-btn"
              >
                Proceed to Payment
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ===== PAYMENT PANEL (Slide-up) ===== */}
      {showPaymentPanel && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60" onClick={() => setShowPaymentPanel(false)}>
          <div 
            className="w-full max-w-lg bg-[#0f0f14] rounded-t-3xl border-t border-white/10 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Panel Header */}
            <div className="sticky top-0 bg-[#0f0f14] px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Complete Payment</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowPaymentPanel(false)}
                className="h-8 w-8 text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="p-4 space-y-4">
              {/* ===== A. BOOKING SUMMARY (Read-only) ===== */}
              <div className="bg-[#1a1a2e] rounded-xl p-4 border border-white/10">
                <h3 className="text-base font-bold text-white mb-3">🧾 Booking Summary</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Game:</span>
                    <span className="text-white font-semibold">{game.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Tickets:</span>
                    <span className="text-white font-mono text-sm">{getSelectedTicketNumbers()}</span>
                  </div>
                  <div className="border-t border-white/10 pt-2 mt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-white font-bold">Total Amount:</span>
                      <span className="text-amber-500 font-bold text-xl">₹{getTotalAmount()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ===== B. BUTTON 1 — UPI PAYMENT ===== */}
              <div className="bg-[#1a1a2e] rounded-xl p-4 border border-white/10">
                <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-amber-500" />
                  Step 1: Pay via UPI
                </h3>
                
                <Button
                  onClick={handlePayViaUPI}
                  className="w-full h-14 text-lg font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black rounded-xl"
                  data-testid="pay-upi-btn"
                >
                  Pay ₹{getTotalAmount()} via UPI
                </Button>

                {/* Fallback for UPI */}
                <div className="mt-3 p-3 bg-black/30 rounded-lg">
                  <p className="text-gray-400 text-sm mb-1 flex items-center gap-1">
                    <Info className="w-4 h-4" />
                    If UPI app did not open, pay manually to:
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-white font-mono">{UPI_ID}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={copyUPIId}
                      className="text-amber-500 hover:text-amber-400 h-8 px-2"
                    >
                      {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              {/* ===== C. INSTRUCTION TEXT (MANDATORY) ===== */}
              <div className="bg-green-900/20 rounded-xl p-4 border border-green-500/30">
                <p className="text-green-300 text-center font-medium">
                  After completing your UPI payment,<br />
                  click the WhatsApp button below and send payment screenshot.
                </p>
              </div>

              {/* ===== D. BUTTON 2 — WHATSAPP CONFIRMATION ===== */}
              <div className="bg-[#1a1a2e] rounded-xl p-4 border border-white/10">
                <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-green-500" />
                  Step 2: Send Confirmation
                </h3>

                {/* Transaction Reference */}
                <div className="bg-black/30 rounded-lg p-3 mb-3">
                  <p className="text-gray-400 text-xs mb-1">Your Transaction Reference</p>
                  <p className="text-amber-500 font-mono text-lg font-bold">{txnRef}</p>
                </div>

                <Button
                  onClick={handleSendWhatsApp}
                  className="w-full h-14 text-lg font-bold bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl"
                  data-testid="send-whatsapp-btn"
                >
                  Send Payment Confirmation on WhatsApp
                </Button>

                {/* Fallback for WhatsApp */}
                <div className="mt-3 p-3 bg-black/30 rounded-lg">
                  <p className="text-gray-400 text-sm mb-1 flex items-center gap-1">
                    <Info className="w-4 h-4" />
                    If WhatsApp did not open, message us at:
                  </p>
                  <p className="text-green-400 font-mono">{WHATSAPP_DISPLAY}</p>
                </div>
              </div>

              {/* Done button */}
              <Button
                onClick={() => {
                  setShowPaymentPanel(false);
                  setSelectedTickets([]);
                  toast.success('Your booking will be confirmed after payment verification');
                }}
                variant="outline"
                className="w-full h-12 border-white/20 text-white"
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
