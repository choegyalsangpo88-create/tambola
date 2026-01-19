import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CreditCard, MessageCircle, CheckCircle, Copy, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// UPI Payment Details - Configure these in your backend/env
const UPI_ID = '9876543210@paytm'; // Replace with actual UPI ID
const UPI_NAME = '67 TAMBOLA';
const WHATSAPP_NUMBER = '918837489781'; // WhatsApp number without +

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
  const [step, setStep] = useState(1); // 1: Review, 2: Pay, 3: Confirm
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
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `TXN${timestamp}${random}`;
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
    const note = `67Tambola-${txnRef}`;
    
    // UPI deep link format
    const upiLink = `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(UPI_NAME)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}`;
    return upiLink;
  };

  // Handle UPI Payment Button Click - Opens UPI app
  const handlePayViaUPI = () => {
    const upiLink = generateUPILink();
    
    // Try to open UPI app
    window.location.href = upiLink;
    
    // Move to next step after a short delay
    setTimeout(() => {
      setStep(2);
    }, 1000);
  };

  // Generate WhatsApp message
  const generateWhatsAppMessage = () => {
    const ticketNumbers = booking?.ticket_numbers?.join(', ') || booking?.tickets?.map(t => t.ticket_number).join(', ') || 'N/A';
    const amount = booking?.total_amount || 0;
    const gameName = booking?.game_name || booking?.game?.name || 'Tambola Game';
    
    const message = `✅ *PAYMENT DONE*

🎮 *Game:* ${gameName}
🎟️ *Tickets:* ${ticketNumbers}
💰 *Amount:* ₹${amount}
🆔 *Txn Ref:* ${txnRef}

📸 *Screenshot attached*

Please confirm my booking.`;

    return encodeURIComponent(message);
  };

  // Handle WhatsApp Button Click - Opens WhatsApp directly on user click
  const handleSendWhatsApp = (e) => {
    e.preventDefault();
    
    const message = generateWhatsAppMessage();
    
    // Detect if mobile or desktop
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    let whatsappUrl;
    if (isMobile) {
      // Mobile - use whatsapp:// protocol
      whatsappUrl = `whatsapp://send?phone=${WHATSAPP_NUMBER}&text=${message}`;
    } else {
      // Desktop - use wa.me
      whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
    }
    
    // Open WhatsApp synchronously on click
    window.open(whatsappUrl, '_blank');
    
    // Move to final step
    setStep(3);
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

  const ticketNumbers = booking?.ticket_numbers?.join(', ') || booking?.tickets?.map(t => t.ticket_number).join(', ') || 'N/A';
  const totalAmount = booking?.total_amount || 0;
  const gameName = booking?.game_name || booking?.game?.name || 'Tambola Game';
  const ticketCount = booking?.ticket_count || booking?.tickets?.length || 0;

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1a1a2e] to-[#16213e] border-b border-white/10 px-4 py-3 sticky top-0 z-50">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-8 w-8 text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold text-white">Complete Booking</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              step >= 1 ? 'bg-amber-500 text-black' : 'bg-gray-700 text-gray-400'
            }`}>1</div>
            <div className={`w-12 h-1 ${step >= 2 ? 'bg-amber-500' : 'bg-gray-700'}`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              step >= 2 ? 'bg-amber-500 text-black' : 'bg-gray-700 text-gray-400'
            }`}>2</div>
            <div className={`w-12 h-1 ${step >= 3 ? 'bg-amber-500' : 'bg-gray-700'}`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              step >= 3 ? 'bg-amber-500 text-black' : 'bg-gray-700 text-gray-400'
            }`}>3</div>
          </div>
        </div>

        {/* Step Labels */}
        <div className="flex justify-between text-xs text-gray-400 mb-8 px-2">
          <span className={step >= 1 ? 'text-amber-500' : ''}>Review</span>
          <span className={step >= 2 ? 'text-amber-500' : ''}>Pay</span>
          <span className={step >= 3 ? 'text-amber-500' : ''}>Confirm</span>
        </div>

        {/* Booking Summary Card */}
        <div className="bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] rounded-2xl p-5 mb-6 border border-white/10">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            🎟️ Booking Summary
          </h2>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Game</span>
              <span className="text-white font-semibold">{gameName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Tickets</span>
              <span className="text-white font-mono text-sm">{ticketNumbers}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Quantity</span>
              <span className="text-white">{ticketCount} ticket(s)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Txn Reference</span>
              <span className="text-amber-500 font-mono text-sm">{txnRef}</span>
            </div>
            <div className="border-t border-white/10 pt-3 mt-3">
              <div className="flex justify-between">
                <span className="text-white font-bold text-lg">Total Amount</span>
                <span className="text-amber-500 font-bold text-2xl">₹{totalAmount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Step 1 & 2: Payment Section */}
        {step <= 2 && (
          <div className="space-y-4">
            {/* UPI Payment Card */}
            <div className="bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] rounded-2xl p-5 border border-white/10">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-amber-500" />
                Pay via UPI
              </h3>
              
              {/* UPI ID Display */}
              <div className="bg-black/30 rounded-xl p-4 mb-4">
                <p className="text-gray-400 text-xs mb-1">UPI ID</p>
                <div className="flex items-center justify-between">
                  <span className="text-white font-mono text-lg">{UPI_ID}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyUPIId}
                    className="text-amber-500 hover:text-amber-400"
                  >
                    {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {/* Pay Button */}
              <Button
                onClick={handlePayViaUPI}
                className="w-full h-14 text-lg font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black rounded-xl"
                data-testid="pay-upi-btn"
              >
                Pay ₹{totalAmount} via UPI
              </Button>

              <p className="text-gray-500 text-xs text-center mt-3">
                This will open your UPI app (GPay, PhonePe, Paytm, etc.)
              </p>
            </div>

            {/* After Payment Instructions */}
            {step === 2 && (
              <div className="bg-gradient-to-br from-green-900/20 to-green-800/10 rounded-2xl p-5 border border-green-500/30">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-green-400 font-bold mb-2">Payment Initiated?</h4>
                    <p className="text-gray-300 text-sm">
                      After completing UPI payment, click the WhatsApp button below and <strong>send your payment screenshot</strong> for confirmation.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* WhatsApp Confirmation Section */}
        {step >= 2 && (
          <div className="mt-6">
            <div className="bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] rounded-2xl p-5 border border-white/10">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-green-500" />
                Send Payment Confirmation
              </h3>
              
              <p className="text-gray-400 text-sm mb-4">
                Click below to open WhatsApp with a pre-filled message. <strong className="text-white">Attach your payment screenshot</strong> before sending.
              </p>

              {/* WhatsApp Button - Direct Click Handler */}
              <Button
                onClick={handleSendWhatsApp}
                className="w-full h-14 text-lg font-bold bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl"
                data-testid="send-whatsapp-btn"
              >
                <MessageCircle className="w-5 h-5 mr-2" />
                Send Payment Confirmation on WhatsApp
              </Button>

              {/* Fallback */}
              <div className="mt-4 p-3 bg-black/20 rounded-lg">
                <p className="text-gray-500 text-xs text-center">
                  WhatsApp not opening? Send screenshot to: <br />
                  <a 
                    href={`https://wa.me/${WHATSAPP_NUMBER}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-green-400 font-mono"
                  >
                    +{WHATSAPP_NUMBER}
                  </a>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 3 && (
          <div className="mt-6">
            <div className="bg-gradient-to-br from-amber-900/20 to-amber-800/10 rounded-2xl p-6 border border-amber-500/30 text-center">
              <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-amber-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Almost Done!</h3>
              <p className="text-gray-300 text-sm mb-4">
                We've received your booking request. Your tickets will be confirmed once we verify your payment.
              </p>
              <div className="bg-black/30 rounded-xl p-4 mb-4">
                <p className="text-gray-400 text-xs mb-1">Reference ID</p>
                <p className="text-amber-500 font-mono text-lg">{txnRef}</p>
              </div>
              <p className="text-gray-500 text-xs">
                You'll receive a confirmation message on WhatsApp within 5-10 minutes.
              </p>
            </div>

            <Button
              onClick={() => navigate('/my-tickets')}
              variant="outline"
              className="w-full mt-4 h-12 border-white/20 text-white"
            >
              View My Tickets
            </Button>

            <Button
              onClick={() => navigate('/')}
              className="w-full mt-2 h-12 bg-amber-500 hover:bg-amber-600 text-black font-bold"
            >
              Back to Home
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
