import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Phone, MessageSquare, ArrowLeft, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Country codes for international support
const COUNTRY_CODES = [
  { code: '+91', country: 'IN', flag: '🇮🇳', name: 'India' },
  { code: '+1', country: 'US', flag: '🇺🇸', name: 'USA/Canada' },
  { code: '+44', country: 'GB', flag: '🇬🇧', name: 'UK' },
  { code: '+49', country: 'DE', flag: '🇩🇪', name: 'Germany' },
  { code: '+33', country: 'FR', flag: '🇫🇷', name: 'France' },
  { code: '+39', country: 'IT', flag: '🇮🇹', name: 'Italy' },
  { code: '+34', country: 'ES', flag: '🇪🇸', name: 'Spain' },
  { code: '+31', country: 'NL', flag: '🇳🇱', name: 'Netherlands' },
  { code: '+61', country: 'AU', flag: '🇦🇺', name: 'Australia' },
  { code: '+971', country: 'AE', flag: '🇦🇪', name: 'UAE' },
  { code: '+966', country: 'SA', flag: '🇸🇦', name: 'Saudi Arabia' },
  { code: '+65', country: 'SG', flag: '🇸🇬', name: 'Singapore' },
];

export default function LoginScreen() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [loginMethod, setLoginMethod] = useState('choice'); // choice, phone, otp
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [isNewUser, setIsNewUser] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  const handleGoogleLogin = () => {
    setIsLoading(true);
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const handleSendOTP = async () => {
    if (!phone || phone.length < 7) {
      toast.error('Please enter a valid phone number');
      return;
    }

    setIsLoading(true);
    try {
      const fullPhone = selectedCountry.code + phone;
      await axios.post(`${API}/auth/send-otp`, { phone: fullPhone });
      toast.success('OTP sent to your WhatsApp!');
      setLoginMethod('otp');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }

    if (isNewUser && !name.trim()) {
      toast.error('Please enter your name');
      return;
    }

    setIsLoading(true);
    try {
      const fullPhone = selectedCountry.code + phone;
      const response = await axios.post(
        `${API}/auth/verify-otp`,
        { phone: fullPhone, otp, name: name.trim() || undefined },
        { withCredentials: true }
      );

      if (response.data.new_user && !name) {
        setIsNewUser(true);
        toast.info('Please enter your name to complete registration');
        setIsLoading(false);
        return;
      }

      toast.success('Login successful!');
      navigate('/', { state: { user: response.data.user }, replace: true });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const renderChoiceScreen = () => (
    <>
      {/* Google Login Button */}
      <Button
        data-testid="google-login-btn"
        onClick={handleGoogleLogin}
        disabled={isLoading}
        className="w-full h-14 text-lg font-bold rounded-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white shadow-lg hover:shadow-amber-500/50 transition-all duration-300 hover:scale-105"
      >
        {isLoading ? (
          <div className="flex items-center justify-center gap-2">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            <span>Connecting...</span>
          </div>
        ) : (
          <>
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
              <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </>
        )}
      </Button>

      {/* Divider */}
      <div className="flex items-center gap-4 my-6">
        <div className="flex-1 h-px bg-white/20"></div>
        <span className="text-gray-400 text-sm">OR</span>
        <div className="flex-1 h-px bg-white/20"></div>
      </div>

      {/* WhatsApp Login Button */}
      <Button
        data-testid="whatsapp-login-btn"
        onClick={() => setLoginMethod('phone')}
        variant="outline"
        className="w-full h-14 text-lg font-bold rounded-full border-2 border-green-500 text-green-400 hover:bg-green-500/10 transition-all duration-300"
      >
        <MessageSquare className="w-5 h-5 mr-2" />
        Continue with WhatsApp
      </Button>
    </>
  );

  const renderPhoneScreen = () => (
    <>
      <button
        onClick={() => setLoginMethod('choice')}
        className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
          <MessageSquare className="w-8 h-8 text-green-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Login with WhatsApp</h2>
        <p className="text-gray-400 text-sm">We'll send a 6-digit OTP to your WhatsApp</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <Phone className="inline w-4 h-4 mr-1" /> Phone Number
          </label>
          <div className="flex gap-2">
            {/* Country Code Picker */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowCountryPicker(!showCountryPicker)}
                className="flex items-center gap-1 px-3 h-12 bg-white/5 border border-white/10 rounded-lg text-white hover:bg-white/10 transition-colors"
              >
                <span className="text-lg">{selectedCountry.flag}</span>
                <span className="text-sm">{selectedCountry.code}</span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </button>
              
              {showCountryPicker && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-[#1a1a1e] border border-white/10 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                  {COUNTRY_CODES.map((country) => (
                    <button
                      key={country.code}
                      type="button"
                      onClick={() => {
                        setSelectedCountry(country);
                        setShowCountryPicker(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-white/10 transition-colors ${
                        selectedCountry.code === country.code ? 'bg-white/5' : ''
                      }`}
                    >
                      <span className="text-lg">{country.flag}</span>
                      <span className="text-white text-sm">{country.name}</span>
                      <span className="text-gray-400 text-sm ml-auto">{country.code}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <Input
              type="tel"
              placeholder="Enter your phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 15))}
              className="flex-1 h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-500 text-lg"
            />
          </div>
        </div>

        <Button
          onClick={handleSendOTP}
          disabled={isLoading || phone.length < 7}
          className="w-full h-14 text-lg font-bold rounded-full bg-green-500 hover:bg-green-600 text-white"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Sending OTP...
            </div>
          ) : (
            'Send OTP via WhatsApp'
          )}
        </Button>
      </div>
    </>
  );

  const renderOTPScreen = () => (
    <>
      <button
        onClick={() => { setLoginMethod('phone'); setOtp(''); setIsNewUser(false); }}
        className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
          <MessageSquare className="w-8 h-8 text-green-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Enter OTP</h2>
        <p className="text-gray-400 text-sm">
          OTP sent to WhatsApp on {selectedCountry.code} {phone}
        </p>
      </div>

      <div className="space-y-4">
        {isNewUser && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Your Name
            </label>
            <Input
              type="text"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            6-Digit OTP
          </label>
          <Input
            type="text"
            placeholder="Enter OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="h-14 bg-white/5 border-white/10 text-white placeholder:text-gray-500 text-center text-2xl tracking-[0.5em] font-mono"
            maxLength={6}
          />
        </div>

        <Button
          onClick={handleVerifyOTP}
          disabled={isLoading || otp.length !== 6 || (isNewUser && !name.trim())}
          className="w-full h-14 text-lg font-bold rounded-full bg-green-500 hover:bg-green-600 text-white"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Verifying...
            </div>
          ) : (
            'Verify & Login'
          )}
        </Button>

        <button
          onClick={handleSendOTP}
          disabled={isLoading}
          className="w-full text-center text-green-400 hover:text-green-300 text-sm"
        >
          Didn't receive OTP? Resend
        </button>
      </div>
    </>
  );

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #000000 0%, #0a3d2c 50%, #1a1a1a 100%)'
      }}
    >
      {/* Premium glow effect */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500 rounded-full blur-[120px]"></div>
      </div>

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md px-6">
        <div
          className="glass-card p-8 md:p-10"
          data-testid="login-card"
        >
          {loginMethod === 'choice' && (
            <>
              {/* Ultra-Realistic 4K 3D Tambola Ball Logo */}
              <div className="mb-6 text-center">
                <div className="relative w-full h-40 mx-auto mb-4 flex items-center justify-center">
                  {/* Single Blue Ball with 67 - 4K Quality */}
                  <div className="relative w-36 h-36">
                    {/* 3D Blue Ball - Ultra Realistic */}
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-200 via-blue-400 to-blue-800 shadow-2xl" style={{
                      boxShadow: '0 30px 90px rgba(37, 99, 235, 0.8), inset 0 -15px 45px rgba(0,0,0,0.6), inset 0 15px 45px rgba(255,255,255,0.5), 0 0 60px rgba(59, 130, 246, 0.4)'
                    }}>
                      {/* Top highlight - creating glass-like shine */}
                      <div className="absolute top-6 left-8 w-16 h-16 bg-gradient-to-br from-white to-transparent rounded-full opacity-70 blur-2xl"></div>
                      
                      {/* Secondary highlight for depth */}
                      <div className="absolute top-3 left-5 w-10 h-10 bg-white rounded-full opacity-50 blur-xl"></div>
                      
                      {/* White Circle Label in center - 4K crisp */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center" style={{
                          boxShadow: 'inset 0 3px 10px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.15), inset 0 -2px 6px rgba(0,0,0,0.1)'
                        }}>
                          {/* Number 67 in crisp black */}
                          <span className="text-5xl font-black text-black tracking-tight" style={{
                            fontFamily: 'JetBrains Mono, monospace',
                            textShadow: '0 1px 2px rgba(0,0,0,0.1)'
                          }}>67</span>
                        </div>
                      </div>
                      
                      {/* Bottom shadow gradient for sphere depth */}
                      <div className="absolute inset-0 rounded-full bg-gradient-to-t from-black/30 to-transparent pointer-events-none"></div>
                    </div>
                    
                    {/* Realistic Ground Shadow */}
                    <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-32 h-8 bg-black opacity-50 rounded-full blur-2xl"></div>
                    
                    {/* Ambient glow around ball */}
                    <div className="absolute inset-0 rounded-full bg-blue-400 opacity-20 blur-3xl scale-110"></div>
                  </div>
                </div>
                
                {/* SIX SEVEN Text - Shiny Modern Style */}
                <p className="text-2xl md:text-3xl font-black tracking-[0.3em] mb-2" style={{
                  fontFamily: 'Outfit, sans-serif',
                  background: 'linear-gradient(135deg, #fff 0%, #a8d8ff 25%, #fff 50%, #60b8ff 75%, #fff 100%)',
                  backgroundSize: '200% 200%',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  animation: 'shimmer 3s ease-in-out infinite',
                  textShadow: '0 0 30px rgba(96, 184, 255, 0.5)',
                  filter: 'drop-shadow(0 0 10px rgba(96, 184, 255, 0.3))'
                }}>
                  SIX SEVEN
                </p>
                
                {/* TAMBOLA Text - Modern Premium Font */}
                <h1 className="text-5xl md:text-6xl font-black mb-3" style={{
                  fontFamily: 'Outfit, sans-serif',
                  background: 'linear-gradient(135deg, #FCD34D 0%, #F59E0B 50%, #D97706 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  letterSpacing: '0.05em',
                  textShadow: '0 0 30px rgba(251, 191, 36, 0.3)'
                }}>
                  TAMBOLA
                </h1>
                
                {/* New Tagline */}
                <p className="text-lg text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400 font-semibold tracking-wide" style={{
                  fontFamily: 'Dancing Script, cursive',
                  fontSize: '1.25rem'
                }}>
                  Turn ur free time into fun time
                </p>
              </div>
            </>
          )}

          {loginMethod === 'choice' && renderChoiceScreen()}
          {loginMethod === 'phone' && renderPhoneScreen()}
          {loginMethod === 'otp' && renderOTPScreen()}

          {loginMethod === 'choice' && (
            <p className="mt-6 text-xs text-gray-500 text-center">
              By continuing, you agree to our Terms & Conditions
            </p>
          )}
        </div>

        {/* Info text */}
        {loginMethod === 'choice' && (
          <p className="text-center mt-6 text-gray-400 text-sm">
            Join thousands of players winning daily!
          </p>
        )}
      </div>
      
      {/* Add Dancing Script font */}
      <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600;700&display=swap" rel="stylesheet" />
    </div>
  );
}
