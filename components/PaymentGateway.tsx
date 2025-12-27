/**
 * ANNA BAZAAR - PAYMENT GATEWAY (Real DodoPayments Integration)
 * 
 * Production-ready payment with real-time verification
 * UPI QR codes, Cards, Net Banking support
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { DodoPayments } from 'dodopayments-checkout';
import { XIcon, CheckCircleIcon, ShieldCheckIcon } from './icons';
import { firebaseService } from '../services/firebaseService';
import { CartItem } from '../types';

// ============================================================================
// TYPES
// ============================================================================

type PaymentStatus = 'idle' | 'selecting' | 'processing' | 'verifying' | 'success' | 'failure';
type PaymentMethod = 'upi' | 'cards' | 'netbanking' | null;

interface PaymentGatewayProps {
  isOpen: boolean;
  onClose: () => void;
  totalAmount: number;
  orderId?: string;
  productName?: string;
  deliveryFee?: number;
  buyerId?: string;
  buyerEmail?: string;
  cartItems?: CartItem[];
  onPaymentComplete: (success: boolean, transactionId?: string) => void;
}

// ============================================================================
// CONFIG
// ============================================================================

const DODO_API_KEY = import.meta.env.VITE_DODO_API_KEY || '';
const DODO_MODE: 'test' | 'live' = import.meta.env.VITE_DODO_MODE === 'live' ? 'live' : 'test';
const UPI_MERCHANT_ID = 'annabazaar@upi'; // Replace with real UPI ID
const MERCHANT_NAME = 'Anna Bazaar';

// Popular UPI Apps
const UPI_APPS = [
  { name: 'Google Pay', icon: '💳', scheme: 'gpay', color: 'from-blue-500 to-blue-600' },
  { name: 'PhonePe', icon: '📱', scheme: 'phonepe', color: 'from-purple-500 to-purple-600' },
  { name: 'Paytm', icon: '💰', scheme: 'paytm', color: 'from-sky-400 to-sky-500' },
  { name: 'BHIM', icon: '🏛️', scheme: 'bhim', color: 'from-orange-500 to-orange-600' },
];

// Popular Banks
const BANKS = [
  { name: 'SBI', code: 'SBIN', color: 'bg-blue-600' },
  { name: 'HDFC', code: 'HDFC', color: 'bg-red-600' },
  { name: 'ICICI', code: 'ICIC', color: 'bg-orange-500' },
  { name: 'Axis', code: 'UTIB', color: 'bg-purple-600' },
  { name: 'Kotak', code: 'KKBK', color: 'bg-red-500' },
  { name: 'PNB', code: 'PUNB', color: 'bg-orange-600' },
  { name: 'BOB', code: 'BARB', color: 'bg-orange-500' },
  { name: 'Canara', code: 'CNRB', color: 'bg-yellow-600' },
];

// ============================================================================
// ICONS
// ============================================================================

const LockIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2" />
    <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const CreditCardIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);

const SmartphoneIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
    <line x1="12" y1="18" x2="12.01" y2="18" />
  </svg>
);

const BankIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" />
  </svg>
);

const ArrowLeftIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const PaymentGateway: React.FC<PaymentGatewayProps> = ({
  isOpen,
  onClose,
  totalAmount,
  orderId: initialOrderId,
  productName = 'Anna Bazaar Order',
  deliveryFee = 0,
  buyerId,
  buyerEmail,
  cartItems,
  onPaymentComplete,
}) => {
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(null);
  const [transactionId, setTransactionId] = useState('');
  const [orderId, setOrderId] = useState(initialOrderId || '');
  const [error, setError] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Card form state
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  // Polling for payment verification
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollCountRef = useRef(0);
  const MAX_POLL_ATTEMPTS = 60; // 5 minutes at 5s intervals

  // Generate order ID on open
  useEffect(() => {
    if (isOpen && !orderId) {
      setOrderId(`AB-${Date.now()}-${Math.floor(Math.random() * 1000)}`);
    }
  }, [isOpen, orderId]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setPaymentStatus('idle');
      setSelectedMethod(null);
      setTransactionId('');
      setError(null);
      setCheckoutUrl(null);
      setSessionId(null);
      setCardNumber('');
      setCardName('');
      setCardExpiry('');
      setCardCvv('');
      pollCountRef.current = 0;
    }
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [isOpen]);

  // Initialize DodoPayments SDK
  useEffect(() => {
    if (!isOpen) return;
    try {
      DodoPayments.Initialize({
        mode: DODO_MODE,
        onEvent: (event) => {
          console.log('[PaymentGateway] Dodo event:', event);
          if (event.event_type === 'checkout.closed') {
            // When checkout overlay closes, start verification
            if (sessionId) {
              startPaymentVerification(sessionId);
            }
          }
          if (event.event_type === 'checkout.error') {
            setError(String(event.data?.message || 'Payment error'));
            setPaymentStatus('failure');
          }
        },
      });
    } catch (err) {
      console.error('[PaymentGateway] Failed to initialize:', err);
    }
  }, [isOpen, sessionId]);

  // Generate UPI payment string
  const generateUPIString = useCallback(() => {
    const txnId = `TXN${Date.now()}`;
    return `upi://pay?pa=${UPI_MERCHANT_ID}&pn=${encodeURIComponent(MERCHANT_NAME)}&am=${totalAmount}&cu=INR&tn=${encodeURIComponent(orderId)}&tr=${txnId}`;
  }, [totalAmount, orderId]);

  // Start payment verification polling
  const startPaymentVerification = useCallback(async (sid: string) => {
    setPaymentStatus('verifying');
    pollCountRef.current = 0;

    const checkStatus = async () => {
      try {
        const response = await fetch(`https://api.dodopayments.com/checkout_sessions/${sid}`, {
          headers: { 'Authorization': `Bearer ${DODO_API_KEY}` },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.status === 'complete' || data.status === 'paid') {
            handlePaymentSuccess(sid);
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            return;
          } else if (data.status === 'failed' || data.status === 'expired') {
            setError('Payment was declined or expired');
            setPaymentStatus('failure');
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            return;
          }
        }

        pollCountRef.current++;
        if (pollCountRef.current >= MAX_POLL_ATTEMPTS) {
          setError('Payment verification timed out. Please check your bank statement.');
          setPaymentStatus('failure');
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        }
      } catch (err) {
        console.error('[PaymentGateway] Verification error:', err);
      }
    };

    // Start polling every 5 seconds
    pollIntervalRef.current = setInterval(checkStatus, 5000);
    checkStatus(); // Check immediately
  }, []);

  // Handle successful payment
  const handlePaymentSuccess = useCallback(async (txnId: string) => {
    setTransactionId(txnId);
    setPaymentStatus('success');
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    try {
      await firebaseService.recordOrderPayment({
        orderId,
        buyerId: buyerId || 'anonymous',
        totalAmount,
        transactionId: txnId,
        paymentMethod: selectedMethod || 'dodo_payments',
        productName,
        items: cartItems?.map(item => ({
          productId: item.id,
          farmerId: item.farmerId,
          quantity: item.cartQuantity,
          price: item.price,
        })),
      });
    } catch (err) {
      console.error('[PaymentGateway] Failed to record payment:', err);
    }

    onPaymentComplete(true, txnId);
  }, [orderId, buyerId, totalAmount, selectedMethod, productName, cartItems, onPaymentComplete]);

  // Create Dodo checkout session
  const createCheckoutSession = async (paymentMethodType?: string) => {
    if (!DODO_API_KEY) {
      setError('Payment service not configured. Please contact support.');
      setPaymentStatus('failure');
      return null;
    }

    try {
      const response = await fetch('https://api.dodopayments.com/checkout_sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DODO_API_KEY}`,
        },
        body: JSON.stringify({
          customer: buyerEmail ? { email: buyerEmail } : undefined,
          return_url: `${window.location.origin}?payment=success&order=${orderId}`,
          metadata: {
            order_id: orderId,
            buyer_id: buyerId || 'anonymous',
            total_amount: String(totalAmount),
            product_name: productName,
          },
          billing_currency: 'INR',
          allowed_payment_method_types: paymentMethodType
            ? [paymentMethodType]
            : ['credit', 'debit', 'upi_collect', 'upi_intent', 'google_pay'],
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      setSessionId(data.session_id);
      setCheckoutUrl(data.checkout_url);
      return data;
    } catch (err: any) {
      console.error('[PaymentGateway] Checkout creation failed:', err);
      setError(err.message || 'Failed to initialize payment');
      setPaymentStatus('failure');
      return null;
    }
  };

  // Handle payment method selection
  const handleMethodSelect = (method: PaymentMethod) => {
    setSelectedMethod(method);
    setPaymentStatus('selecting');
    setError(null);
  };

  // Start UPI payment via Dodo
  const handleUPIPayment = async (appScheme?: string) => {
    setPaymentStatus('processing');
    const session = await createCheckoutSession('upi_intent');
    if (session?.checkout_url) {
      await DodoPayments.Checkout.open({ checkoutUrl: session.checkout_url });
    }
  };

  // Start card payment via Dodo
  const handleCardPayment = async () => {
    if (!cardNumber || !cardName || !cardExpiry || !cardCvv) {
      setError('Please fill in all card details');
      return;
    }
    setPaymentStatus('processing');
    const session = await createCheckoutSession('credit');
    if (session?.checkout_url) {
      await DodoPayments.Checkout.open({ checkoutUrl: session.checkout_url });
    }
  };

  // Start net banking payment
  const handleNetBankingPayment = async (bankCode: string) => {
    setPaymentStatus('processing');
    const session = await createCheckoutSession('netbanking');
    if (session?.checkout_url) {
      await DodoPayments.Checkout.open({ checkoutUrl: session.checkout_url });
    }
  };

  // Format card number with spaces
  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(' ') : v;
  };

  // Format expiry date
  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  if (!isOpen) return null;

  // ============================================================================
  // RENDER: SUCCESS
  // ============================================================================
  if (paymentStatus === 'success') {
    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-br from-green-50 via-white to-green-50 overflow-auto">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-green-200 p-8 max-w-md w-full text-center">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
              <div className="relative w-20 h-20 bg-primary rounded-full flex items-center justify-center">
                <CheckCircleIcon className="w-10 h-10 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-stone-800 mb-2">Payment Successful!</h1>
            <p className="text-stone-500 mb-6">Transaction verified and confirmed.</p>
            <div className="bg-primary/10 rounded-xl p-4 mb-6">
              <p className="text-3xl font-bold text-primary">₹{totalAmount.toLocaleString('en-IN')}</p>
              <p className="text-xs text-stone-500 mt-1">Order: {orderId}</p>
            </div>
            <button onClick={onClose} className="w-full py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-colors">
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER: FAILURE
  // ============================================================================
  if (paymentStatus === 'failure') {
    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-br from-red-50 to-stone-100 overflow-auto">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
            <div className="w-20 h-20 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
              <XIcon className="w-10 h-10 text-red-500" />
            </div>
            <h1 className="text-2xl font-bold text-stone-800 mb-2">Payment Failed</h1>
            <p className="text-stone-500 mb-6">{error || 'Unable to process payment. Please try again.'}</p>
            <div className="space-y-3">
              <button onClick={() => { setPaymentStatus('idle'); setError(null); setSelectedMethod(null); }} className="w-full py-3 bg-primary text-white rounded-xl font-bold">
                Try Again
              </button>
              <button onClick={onClose} className="w-full py-3 border-2 border-stone-200 rounded-xl font-semibold text-stone-600">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER: VERIFYING
  // ============================================================================
  if (paymentStatus === 'verifying') {
    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-br from-blue-50 to-stone-50 flex items-center justify-center">
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-stone-200 rounded-full" />
            <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
          <h1 className="text-xl font-bold text-stone-800 mb-2">Verifying Payment...</h1>
          <p className="text-stone-500 text-sm">Please wait while we confirm your transaction.</p>
          <p className="text-xs text-stone-400 mt-4">This may take up to 30 seconds</p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER: PROCESSING
  // ============================================================================
  if (paymentStatus === 'processing') {
    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-br from-green-50/50 to-stone-50 flex items-center justify-center">
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-stone-200 rounded-full" />
            <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <LockIcon className="absolute inset-0 m-auto h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-stone-800 mb-2">Processing Payment</h1>
          <p className="text-stone-500 text-sm">Complete payment in the secure window. Do not close this page.</p>
          <div className="mt-6 py-3 px-4 bg-primary/10 rounded-xl">
            <p className="text-2xl font-bold text-primary">₹{totalAmount.toLocaleString('en-IN')}</p>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER: UPI SELECTION
  // ============================================================================
  if (selectedMethod === 'upi' && paymentStatus === 'selecting') {
    const upiString = generateUPIString();
    return (
      <div className="fixed inset-0 z-50 bg-stone-100 overflow-auto">
        <header className="sticky top-0 bg-white border-b border-stone-200 z-10">
          <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
            <button onClick={() => setSelectedMethod(null)} className="flex items-center gap-2 text-stone-600 hover:text-primary">
              <ArrowLeftIcon className="h-5 w-5" /> Back
            </button>
            <span className="font-bold text-stone-800">Pay with UPI</span>
            <button onClick={onClose} className="text-stone-500 hover:text-red-500"><XIcon className="h-5 w-5" /></button>
          </div>
        </header>

        <main className="max-w-2xl mx-auto p-6">
          {/* QR Code Card */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 text-center">
            <h2 className="text-lg font-bold text-stone-800 mb-4">Scan QR to Pay</h2>
            <div className="inline-block p-4 bg-white rounded-xl border-2 border-stone-200 mb-4">
              <QRCodeSVG value={upiString} size={200} level="H" includeMargin />
            </div>
            <p className="text-2xl font-bold text-primary mb-2">₹{totalAmount.toLocaleString('en-IN')}</p>
            <p className="text-xs text-stone-500 bg-stone-100 rounded-lg py-2 px-3 inline-block">{UPI_MERCHANT_ID}</p>
          </div>

          {/* UPI Apps */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-sm font-semibold text-stone-600 mb-4">Or pay using UPI app</h3>
            <div className="grid grid-cols-2 gap-3">
              {UPI_APPS.map((app) => (
                <button key={app.scheme} onClick={() => handleUPIPayment(app.scheme)}
                  className={`p-4 bg-gradient-to-r ${app.color} text-white rounded-xl font-semibold flex items-center gap-3 hover:opacity-90 transition-opacity`}>
                  <span className="text-2xl">{app.icon}</span>
                  <span>{app.name}</span>
                </button>
              ))}
            </div>
          </div>

          <p className="text-center text-xs text-stone-400 mt-6 flex items-center justify-center gap-2">
            <LockIcon className="h-4 w-4" /> Secured by DodoPayments
          </p>
        </main>
      </div>
    );
  }

  // ============================================================================
  // RENDER: CARDS FORM
  // ============================================================================
  if (selectedMethod === 'cards' && paymentStatus === 'selecting') {
    return (
      <div className="fixed inset-0 z-50 bg-stone-100 overflow-auto">
        <header className="sticky top-0 bg-white border-b border-stone-200 z-10">
          <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
            <button onClick={() => setSelectedMethod(null)} className="flex items-center gap-2 text-stone-600 hover:text-primary">
              <ArrowLeftIcon className="h-5 w-5" /> Back
            </button>
            <span className="font-bold text-stone-800">Card Payment</span>
            <button onClick={onClose} className="text-stone-500 hover:text-red-500"><XIcon className="h-5 w-5" /></button>
          </div>
        </header>

        <main className="max-w-md mx-auto p-6">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Card Number</label>
                <input type="text" placeholder="1234 5678 9012 3456" maxLength={19}
                  value={cardNumber} onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  className="w-full px-4 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1">Cardholder Name</label>
                <input type="text" placeholder="John Doe" value={cardName} onChange={(e) => setCardName(e.target.value)}
                  className="w-full px-4 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">Expiry</label>
                  <input type="text" placeholder="MM/YY" maxLength={5}
                    value={cardExpiry} onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                    className="w-full px-4 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 mb-1">CVV</label>
                  <input type="password" placeholder="•••" maxLength={4}
                    value={cardCvv} onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                    className="w-full px-4 py-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary" />
                </div>
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button onClick={handleCardPayment}
                className="w-full py-4 bg-primary text-white rounded-xl font-bold text-lg hover:bg-primary-dark transition-colors flex items-center justify-center gap-2">
                <LockIcon className="h-5 w-5" /> Pay ₹{totalAmount.toLocaleString('en-IN')}
              </button>
            </div>
            <div className="flex items-center justify-center gap-4 mt-6 text-xs text-stone-400">
              <span>Visa</span><span>Mastercard</span><span>RuPay</span>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ============================================================================
  // RENDER: NET BANKING
  // ============================================================================
  if (selectedMethod === 'netbanking' && paymentStatus === 'selecting') {
    return (
      <div className="fixed inset-0 z-50 bg-stone-100 overflow-auto">
        <header className="sticky top-0 bg-white border-b border-stone-200 z-10">
          <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
            <button onClick={() => setSelectedMethod(null)} className="flex items-center gap-2 text-stone-600 hover:text-primary">
              <ArrowLeftIcon className="h-5 w-5" /> Back
            </button>
            <span className="font-bold text-stone-800">Net Banking</span>
            <button onClick={onClose} className="text-stone-500 hover:text-red-500"><XIcon className="h-5 w-5" /></button>
          </div>
        </header>

        <main className="max-w-2xl mx-auto p-6">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-sm font-semibold text-stone-600 mb-4">Select Your Bank</h3>
            <div className="grid grid-cols-4 gap-3">
              {BANKS.map((bank) => (
                <button key={bank.code} onClick={() => handleNetBankingPayment(bank.code)}
                  className={`p-4 ${bank.color} text-white rounded-xl font-bold text-sm hover:opacity-90 transition-opacity`}>
                  {bank.name}
                </button>
              ))}
            </div>
            <div className="mt-6 pt-4 border-t border-stone-200">
              <p className="text-sm text-stone-600 mb-2">Other Banks</p>
              <select className="w-full p-3 border border-stone-300 rounded-xl" defaultValue=""
                onChange={(e) => e.target.value && handleNetBankingPayment(e.target.value)}>
                <option value="" disabled>Select from all banks...</option>
                <option value="other">More banks available in checkout</option>
              </select>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ============================================================================
  // RENDER: PAYMENT METHOD SELECTION (IDLE)
  // ============================================================================
  return (
    <div className="fixed inset-0 z-50 bg-stone-100 overflow-auto">
      <header className="sticky top-0 bg-white border-b border-stone-200 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌱</span>
            <span className="font-bold text-xl text-stone-800">Anna Bazaar</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1.5 bg-primary/10 text-primary text-xs font-bold rounded-full flex items-center gap-1">
              <LockIcon className="h-3 w-3" /> Secure Checkout
            </span>
            <button onClick={onClose} className="text-stone-500 hover:text-red-500"><XIcon className="h-5 w-5" /></button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Payment Methods */}
          <div className="lg:col-span-3 space-y-4">
            <h2 className="text-xl font-bold text-stone-800">Choose Payment Method</h2>

            <button onClick={() => handleMethodSelect('upi')}
              className="w-full p-5 bg-white rounded-2xl shadow-sm border-2 border-transparent hover:border-primary hover:shadow-lg transition-all flex items-center gap-4 group">
              <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                <SmartphoneIcon className="h-7 w-7 text-white" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-bold text-stone-800 group-hover:text-primary">UPI Payment</h3>
                <p className="text-sm text-stone-500">GPay, PhonePe, Paytm, BHIM & more</p>
              </div>
              <span className="text-stone-400 group-hover:text-primary">→</span>
            </button>

            <button onClick={() => handleMethodSelect('cards')}
              className="w-full p-5 bg-white rounded-2xl shadow-sm border-2 border-transparent hover:border-primary hover:shadow-lg transition-all flex items-center gap-4 group">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                <CreditCardIcon className="h-7 w-7 text-white" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-bold text-stone-800 group-hover:text-primary">Credit / Debit Card</h3>
                <p className="text-sm text-stone-500">Visa, Mastercard, RuPay</p>
              </div>
              <span className="text-stone-400 group-hover:text-primary">→</span>
            </button>

            <button onClick={() => handleMethodSelect('netbanking')}
              className="w-full p-5 bg-white rounded-2xl shadow-sm border-2 border-transparent hover:border-primary hover:shadow-lg transition-all flex items-center gap-4 group">
              <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center">
                <BankIcon className="h-7 w-7 text-white" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-bold text-stone-800 group-hover:text-primary">Net Banking</h3>
                <p className="text-sm text-stone-500">All major banks supported</p>
              </div>
              <span className="text-stone-400 group-hover:text-primary">→</span>
            </button>

            <div className="flex items-center justify-center gap-4 pt-4 text-xs text-stone-400">
              <span className="flex items-center gap-1"><LockIcon className="h-4 w-4" /> SSL Encrypted</span>
              <span className="flex items-center gap-1"><ShieldCheckIcon className="h-4 w-4" /> 100% Secure</span>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-24">
              <h3 className="font-bold text-stone-800 mb-4">Order Summary</h3>
              <div className="space-y-2 text-sm border-b border-stone-100 pb-4 mb-4">
                {cartItems?.slice(0, 3).map((item, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-stone-600 truncate max-w-[150px]">{item.name} x{item.cartQuantity}</span>
                    <span className="font-medium">₹{(item.price * item.cartQuantity).toLocaleString('en-IN')}</span>
                  </div>
                ))}
                {cartItems && cartItems.length > 3 && (
                  <p className="text-stone-400 text-xs">+{cartItems.length - 3} more items</p>
                )}
                {deliveryFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-stone-600">Delivery</span>
                    <span className="font-medium">₹{deliveryFee}</span>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-700 font-medium">Total</span>
                <span className="text-2xl font-bold text-primary">₹{totalAmount.toLocaleString('en-IN')}</span>
              </div>
              <p className="text-xs text-stone-400 mt-4">Order ID: {orderId}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PaymentGateway;
