import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CreditCard, MessageCircle, CheckCircle, Copy, Info } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// ===== PAYMENT CONFIGURATION (Single source of truth) =====
const UPI_ID = 'choegyalsangpo@ibl';
const UPI_NAME = 'SixSevenTambola';
const WHATSAPP_NUMBER = '918837489781'; // Without + prefix
const WHATSAPP_DISPLAY = '+91 8837489781';

// Get auth headers for API calls
const getAuthHeaders = () => {
  const session = localStorage.getItem('tambola_session');
  return session ? { 'Authorization': `Bearer ${session}` } : {};
};

export default function BookingCheckout() {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upiClicked, setUpiClicked] = useState(false); // Track if UPI button was clicked
  const [whatsappClicked, setWhatsappClicked] = useState(false); // Track if WhatsApp was clicked
  const [txnRef, setTxnRef] = useState('');
  const [copied, setCopied] = useState(false);

  // Get booking data from location state or fetch from API
  useEffect(() => {
    if (location.state?.booking) {
      setBooking(location.state.booking);
      setTxnRef(generateTxnRef());
      setLoading(false);
    } else if (requestId) {
      fetchBookingDetails();
    } else {
      toast.error('No booking found');
      navigate('/');
    }
  }, [requestId, location.state]);

  const generateTxnRef = () => {
    // Format: TMB + 6 random alphanumeric characters
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding I,O,0,1 to avoid confusion
    let ref = 'TMB';
    for (let i = 0; i < 6; i++) {
      ref += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return ref;
  };

  const fetchBookingDetails = async () => {
    try {
      const response = await axios.get(`${API}/booking-requests/${requestId}`, {
        withCredentials: true,
        headers: getAuthHeaders()
      });
      setBooking(response.data);
      setTxnRef(generateTxnRef());
    } catch (error) {
      console.error('Failed to fetch booking:', error);
      toast.error('Failed to load booking details');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  // Generate UPI deep link
  const generateUPILink = () => {
    const amount = booking?.total_amount || 0;
    const note = `SixSevenTambola-${txnRef}`;
    
    // Standard UPI deep link format
    return `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(UPI_NAME)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
  };

  // Handle UPI Payment Button Click - ONLY opens UPI app, nothing else
  const handlePayViaUPI = () => {
    const upiLink = generateUPILink();
    
    // Open UPI app - NO automatic redirects after this
    window.location.href = upiLink;
    
    // Just mark that UPI was clicked (no auto navigation)
    setUpiClicked(true);
  };

  // Generate WhatsApp message - Exact format as specified
  const generateWhatsAppMessage = () => {
    const ticketNumbers = booking?.ticket_numbers?.join(', ') || 'N/A';
    const amount = booking?.total_amount || 0;
    const gameName = booking?.game_name || 'Tambola Game';
    
    // Exact format requested by user
    const message = `✅ PAYMENT DONE

Game: ${gameName}
Tickets: ${ticketNumbers}
Amount: ₹${amount}
Txn Ref: ${txnRef}

📸 Screenshot attached`;

    return encodeURIComponent(message);
  };

  // Handle WhatsApp Button Click - ONLY opens WhatsApp, nothing else
  const handleSendWhatsApp = (e) => {
    e.preventDefault();
    
    const message = generateWhatsAppMessage();
    
    // Use wa.me for universal compatibility (works on both mobile and desktop)
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
    
    // Open WhatsApp in new tab/app - NO automatic navigation after this
    window.open(whatsappUrl, '_blank');
    
    // Mark that WhatsApp was clicked
    setWhatsappClicked(true);
  };

  // Copy UPI ID to clipboard
  const copyUPIId = () => {
    navigator.clipboard.writeText(UPI_ID);
    setCopied(true);
    toast.success('UPI ID copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <p className="text-white">Booking not found</p>
      </div>
    );
  }

  const ticketNumbers = booking?.ticket_numbers?.join(', ') || 'N/A';
  const totalAmount = booking?.total_amount || 0;
  const gameName = booking?.game_name || 'Tambola Game';

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1a1a2e] to-[#16213e] border-b border-white/10 px-4 py-3 sticky top-0 z-50">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-8 w-8 text-white hover:bg-white/10"
            data-testid="back-button"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold text-white">Complete Booking</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        
        {/* ===== SECTION A: Booking Summary (Read-only) ===== */}
        <div className="bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] rounded-2xl p-5 border border-white/10" data-testid="booking-summary">
          <h2 className="text-lg font-bold text-white mb-4">🧾 Booking Summary</h2>
          
          <div className="space-y-3 text-base">
            <div className="flex justify-between items-start">
              <span className="text-gray-400">Game:</span>
              <span className="text-white font-semibold text-right">{gameName}</span>
            </div>
            <div className="flex justify-between items-start">
              <span className="text-gray-400">Tickets:</span>
              <span className="text-white font-mono text-right">{ticketNumbers}</span>
            </div>
            <div className="border-t border-white/10 pt-3 mt-3">
              <div className="flex justify-between items-center">
                <span className="text-white font-bold text-lg">Total Amount:</span>
                <span className="text-amber-500 font-bold text-2xl">₹{totalAmount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ===== SECTION B: Button 1 - UPI Payment ===== */}
        <div className="bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] rounded-2xl p-5 border border-white/10">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-amber-500" />
            Step 1: Pay via UPI
          </h3>
          
          {/* UPI Payment Button - Exact text as specified */}
          <Button
            onClick={handlePayViaUPI}
            className="w-full h-14 text-lg font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black rounded-xl"
            data-testid="pay-upi-btn"
          >
            Pay ₹{totalAmount} via UPI
          </Button>

          {/* Fallback text for UPI */}
          <div className="mt-4 p-3 bg-black/30 rounded-lg">
            <p className="text-gray-400 text-sm mb-2 flex items-center gap-1">
              <Info className="w-4 h-4" />
              If UPI app didn&apos;t open, pay manually to:
            </p>
            <div className="flex items-center justify-between">
              <span className="text-white font-mono text-base">{UPI_ID}</span>
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

        {/* ===== SECTION C: Instruction Text (VERY IMPORTANT) ===== */}
        <div className="bg-gradient-to-br from-green-900/20 to-green-800/10 rounded-2xl p-4 border border-green-500/30">
          <p className="text-green-300 text-center font-medium">
            After completing your UPI payment,<br />
            click the WhatsApp button below and send payment screenshot.
          </p>
        </div>

        {/* ===== SECTION D: Button 2 - WhatsApp Confirmation ===== */}
        <div className="bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] rounded-2xl p-5 border border-white/10">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-green-500" />
            Step 2: Send Confirmation
          </h3>

          {/* Reference ID Display */}
          <div className="bg-black/30 rounded-lg p-3 mb-4">
            <p className="text-gray-400 text-xs mb-1">Your Transaction Reference</p>
            <p className="text-amber-500 font-mono text-lg font-bold">{txnRef}</p>
          </div>

          {/* WhatsApp Button - Exact text as specified */}
          <Button
            onClick={handleSendWhatsApp}
            className="w-full h-14 text-lg font-bold bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl"
            data-testid="send-whatsapp-btn"
          >
            Send Payment Confirmation on WhatsApp
          </Button>

          {/* Fallback text for WhatsApp */}
          <div className="mt-4 p-3 bg-black/30 rounded-lg">
            <p className="text-gray-400 text-sm mb-1 flex items-center gap-1">
              <Info className="w-4 h-4" />
              If WhatsApp doesn&apos;t open:
            </p>
            <p className="text-green-400 font-mono text-base">
              WhatsApp Number: {WHATSAPP_DISPLAY}
            </p>
          </div>
        </div>

        {/* ===== After WhatsApp Sent: Confirmation Message ===== */}
        {whatsappClicked && (
          <div className="bg-gradient-to-br from-amber-900/20 to-amber-800/10 rounded-2xl p-6 border border-amber-500/30 text-center">
            <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-amber-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Almost Done!</h3>
            <p className="text-gray-300 text-sm mb-4">
              Your tickets will be confirmed once we verify your payment screenshot.
            </p>
            <div className="bg-black/30 rounded-xl p-4 mb-4">
              <p className="text-gray-400 text-xs mb-1">Reference ID</p>
              <p className="text-amber-500 font-mono text-lg">{txnRef}</p>
            </div>
            <p className="text-gray-500 text-xs">
              You'll receive a confirmation on WhatsApp within 5-10 minutes.
            </p>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="space-y-2 pt-2">
          <Button
            onClick={() => navigate('/my-tickets')}
            variant="outline"
            className="w-full h-12 border-white/20 text-white hover:bg-white/10"
            data-testid="view-tickets-btn"
          >
            View My Tickets
          </Button>

          <Button
            onClick={() => navigate('/')}
            className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-black font-bold"
            data-testid="back-home-btn"
          >
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
