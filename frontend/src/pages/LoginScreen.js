import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Phone, Lock, User, ArrowLeft, ChevronDown, Eye, EyeOff } from 'lucide-react';
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
  { code: '+61', country: 'AU', flag: '🇦🇺', name: 'Australia' },
  { code: '+971', country: 'AE', flag: '🇦🇪', name: 'UAE' },
  { code: '+65', country: 'SG', flag: '🇸🇬', name: 'Singapore' },
];

export default function LoginScreen() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState('phone'); // phone, pin, register, name
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [name, setName] = useState('');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [sameAsPhone, setSameAsPhone] = useState(true);
  const [showPin, setShowPin] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [userExists, setUserExists] = useState(false);
  const [existingUserName, setExistingUserName] = useState('');

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      const session = localStorage.getItem('tambola_session');
      if (session) {
        try {
          const response = await axios.get(`${API}/auth/me`, {
            headers: { Authorization: `Bearer ${session}` }
          });
          if (response.data) {
            navigate('/', { replace: true });
          }
        } catch (error) {
          // Session invalid, clear it
          localStorage.removeItem('tambola_session');
          localStorage.removeItem('tambola_user');
        }
      }
    };
    checkSession();
  }, [navigate]);

  const getFullPhone = () => {
    return selectedCountry.code + phone;
  };

  const handleGoogleLogin = () => {
    setIsLoading(true);
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const handleCheckPhone = async () => {
    if (!phone || phone.length < 7) {
      toast.error('Please enter a valid phone number');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(`${API}/auth/phone/check`, { 
        phone: getFullPhone() 
      });
      
      if (response.data.is_blocked) {
        toast.error(response.data.message || 'This account has been blocked');
        setIsLoading(false);
        return;
      }

      if (response.data.exists) {
        setUserExists(true);
        setExistingUserName(response.data.name || '');
        setStep('pin');
      } else {
        setUserExists(false);
        setStep('register');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to check phone number');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!pin || pin.length !== 4) {
      toast.error('Please enter your 4-digit PIN');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(
        `${API}/auth/phone/login`,
        { phone: getFullPhone(), pin },
        { withCredentials: true }
      );

      // Store session
      if (response.data.session_token) {
        localStorage.setItem('tambola_session', response.data.session_token);
      }
      if (response.data.user) {
        localStorage.setItem('tambola_user', JSON.stringify(response.data.user));
      }

      // Check if user needs to set name
      if (response.data.needs_name) {
        setStep('name');
        toast.info('Please enter your name to continue');
        setIsLoading(false);
        return;
      }

      toast.success(`Welcome back, ${response.data.user?.name || 'Player'}!`);
      navigate('/', { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!pin || pin.length !== 4) {
      toast.error('PIN must be exactly 4 digits');
      return;
    }
    if (pin !== confirmPin) {
      toast.error('PINs do not match');
      return;
    }
    if (!name.trim() || name.trim().length < 2) {
      toast.error('Please enter your name (at least 2 characters)');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(
        `${API}/auth/phone/register`,
        { 
          phone: getFullPhone(), 
          pin, 
          name: name.trim(),
          whatsapp_number: sameAsPhone ? null : (selectedCountry.code + whatsappNumber)
        },
        { withCredentials: true }
      );

      // Store session
      if (response.data.session_token) {
        localStorage.setItem('tambola_session', response.data.session_token);
      }
      if (response.data.user) {
        localStorage.setItem('tambola_user', JSON.stringify(response.data.user));
      }

      toast.success('Account created successfully!');
      navigate('/', { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateName = async () => {
    if (!name.trim() || name.trim().length < 2) {
      toast.error('Please enter your name (at least 2 characters)');
      return;
    }

    setIsLoading(true);
    try {
      const session = localStorage.getItem('tambola_session');
      await axios.put(
        `${API}/auth/update-name`,
        { name: name.trim() },
        { headers: { Authorization: `Bearer ${session}` } }
      );

      // Update stored user
      const user = JSON.parse(localStorage.getItem('tambola_user') || '{}');
      user.name = name.trim();
      localStorage.setItem('tambola_user', JSON.stringify(user));

      toast.success('Welcome to 67Tambola!');
      navigate('/', { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update name');
    } finally {
      setIsLoading(false);
    }
  };

  const renderPhoneInput = () => (
    <>
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
          <Phone className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Enter Phone Number</h2>
        <p className="text-gray-400 text-sm">Login or create account with your phone</p>
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
              data-testid="phone-input"
            />
          </div>
        </div>

        <Button
          onClick={handleCheckPhone}
          disabled={isLoading || phone.length < 7}
          className="w-full h-14 text-lg font-bold rounded-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
          data-testid="continue-btn"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Checking...
            </div>
          ) : (
            'Continue'
          )}
        </Button>

        {/* Divider */}
        <div className="flex items-center gap-4 my-4">
          <div className="flex-1 h-px bg-white/20"></div>
          <span className="text-gray-400 text-sm">OR</span>
          <div className="flex-1 h-px bg-white/20"></div>
        </div>

        {/* Google Login Button */}
        <Button
          data-testid="google-login-btn"
          onClick={handleGoogleLogin}
          disabled={isLoading}
          variant="outline"
          className="w-full h-12 text-base font-medium rounded-full border border-white/20 text-white hover:bg-white/10 transition-all"
        >
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </Button>
      </div>
    </>
  );

  const renderPinInput = () => (
    <>
      <button
        onClick={() => { setStep('phone'); setPin(''); }}
        className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-green-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">
          {existingUserName ? `Welcome back, ${existingUserName}!` : 'Enter PIN'}
        </h2>
        <p className="text-gray-400 text-sm">Enter your 4-digit PIN to login</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <Lock className="inline w-4 h-4 mr-1" /> 4-Digit PIN
          </label>
          <div className="relative">
            <Input
              type={showPin ? 'text' : 'password'}
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="h-14 bg-white/5 border-white/10 text-white placeholder:text-gray-500 text-center text-2xl tracking-[0.5em] font-mono pr-12"
              maxLength={4}
              data-testid="pin-input"
            />
            <button
              type="button"
              onClick={() => setShowPin(!showPin)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <Button
          onClick={handleLogin}
          disabled={isLoading || pin.length !== 4}
          className="w-full h-14 text-lg font-bold rounded-full bg-green-500 hover:bg-green-600 text-white"
          data-testid="login-btn"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Logging in...
            </div>
          ) : (
            'Login'
          )}
        </Button>

        <p className="text-xs text-gray-500 text-center">
          Forgot your PIN? Contact support to reset it.
        </p>
      </div>
    </>
  );

  const renderRegisterForm = () => (
    <>
      <button
        onClick={() => { setStep('phone'); setPin(''); setConfirmPin(''); setName(''); }}
        className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
          <User className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Create Account</h2>
        <p className="text-gray-400 text-sm">Set up your account for {getFullPhone()}</p>
      </div>

      <div className="space-y-4">
        {/* Name Input */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <User className="inline w-4 h-4 mr-1" /> Your Name
          </label>
          <Input
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
            data-testid="name-input"
          />
        </div>

        {/* WhatsApp Number */}
        <div>
          <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
            <input
              type="checkbox"
              checked={sameAsPhone}
              onChange={(e) => setSameAsPhone(e.target.checked)}
              className="rounded"
            />
            WhatsApp same as phone number
          </label>
          {!sameAsPhone && (
            <Input
              type="tel"
              placeholder="WhatsApp number (without country code)"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value.replace(/\D/g, '').slice(0, 15))}
              className="h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
            />
          )}
        </div>

        {/* PIN Input */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <Lock className="inline w-4 h-4 mr-1" /> Create 4-Digit PIN
          </label>
          <div className="relative">
            <Input
              type={showPin ? 'text' : 'password'}
              placeholder="••••"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-500 text-center text-xl tracking-[0.3em] font-mono pr-12"
              maxLength={4}
              data-testid="create-pin-input"
            />
            <button
              type="button"
              onClick={() => setShowPin(!showPin)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Confirm PIN */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <Lock className="inline w-4 h-4 mr-1" /> Confirm PIN
          </label>
          <Input
            type={showPin ? 'text' : 'password'}
            placeholder="••••"
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className="h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-500 text-center text-xl tracking-[0.3em] font-mono"
            maxLength={4}
            data-testid="confirm-pin-input"
          />
          {confirmPin && pin !== confirmPin && (
            <p className="text-red-400 text-xs mt-1">PINs do not match</p>
          )}
        </div>

        <Button
          onClick={handleRegister}
          disabled={isLoading || pin.length !== 4 || pin !== confirmPin || !name.trim()}
          className="w-full h-14 text-lg font-bold rounded-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
          data-testid="register-btn"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Creating Account...
            </div>
          ) : (
            'Create Account'
          )}
        </Button>
      </div>
    </>
  );

  const renderNameInput = () => (
    <>
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
          <User className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">One Last Step!</h2>
        <p className="text-gray-400 text-sm">Please enter your name to continue</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <User className="inline w-4 h-4 mr-1" /> Your Name
          </label>
          <Input
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-12 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
            data-testid="update-name-input"
          />
        </div>

        <Button
          onClick={handleUpdateName}
          disabled={isLoading || !name.trim() || name.trim().length < 2}
          className="w-full h-14 text-lg font-bold rounded-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white"
          data-testid="save-name-btn"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Saving...
            </div>
          ) : (
            'Continue to Play'
          )}
        </Button>
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
        <div className="glass-card p-8 md:p-10" data-testid="login-card">
          {step === 'phone' && (
            <>
              {/* Logo */}
              <div className="mb-6 text-center">
                <div className="relative w-full h-40 mx-auto mb-4 flex items-center justify-center">
                  <div className="relative w-36 h-36">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-br from-blue-200 via-blue-400 to-blue-800 shadow-2xl" style={{
                      boxShadow: '0 30px 90px rgba(37, 99, 235, 0.8), inset 0 -15px 45px rgba(0,0,0,0.6), inset 0 15px 45px rgba(255,255,255,0.5)'
                    }}>
                      <div className="absolute top-6 left-8 w-16 h-16 bg-gradient-to-br from-white to-transparent rounded-full opacity-70 blur-2xl"></div>
                      <div className="absolute top-3 left-5 w-10 h-10 bg-white rounded-full opacity-50 blur-xl"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center" style={{
                          boxShadow: 'inset 0 3px 10px rgba(0,0,0,0.25)'
                        }}>
                          <span className="text-5xl font-black text-black tracking-tight" style={{
                            fontFamily: 'JetBrains Mono, monospace'
                          }}>67</span>
                        </div>
                      </div>
                      <div className="absolute inset-0 rounded-full bg-gradient-to-t from-black/30 to-transparent pointer-events-none"></div>
                    </div>
                    <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2 w-32 h-8 bg-black opacity-50 rounded-full blur-2xl"></div>
                  </div>
                </div>
                
                <h1 className="text-5xl md:text-6xl font-black mb-3" style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  background: 'linear-gradient(135deg, #FCD34D 0%, #F59E0B 30%, #FFD700 50%, #F59E0B 70%, #FCD34D 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  letterSpacing: '-0.02em'
                }}>
                  67tambola
                </h1>
                
                <p className="text-lg text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-400 font-semibold" style={{
                  fontFamily: 'Dancing Script, cursive'
                }}>
                  Turn ur free time into fun time
                </p>
              </div>
            </>
          )}

          {step === 'phone' && renderPhoneInput()}
          {step === 'pin' && renderPinInput()}
          {step === 'register' && renderRegisterForm()}
          {step === 'name' && renderNameInput()}

          {step === 'phone' && (
            <p className="mt-6 text-xs text-gray-500 text-center">
              By continuing, you agree to our Terms & Conditions
            </p>
          )}
        </div>

        {step === 'phone' && (
          <p className="text-center mt-6 text-gray-400 text-sm">
            Join thousands of players winning daily!
          </p>
        )}
      </div>
      
      <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@600;700&display=swap" rel="stylesheet" />
    </div>
  );
}
