/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ANNA BAZAAR - DODO PAYMENTS SERVICE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Real payment integration using DodoPayments API
 * With proper session creation and payment verification
 * 
 * @author Anna Bazaar Team - Calcutta Hacks 2025
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const DODO_API_KEY = import.meta.env.VITE_DODO_API_KEY || '';
const DODO_API_BASE = 'https://api.dodopayments.com';
const IS_TEST_MODE = import.meta.env.VITE_DODO_MODE !== 'live';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface CheckoutItem {
    productId: string;
    name: string;
    price: number;
    quantity: number;
    farmerId?: string;
}

export interface CreateCheckoutParams {
    items: CheckoutItem[];
    totalAmount: number;
    buyerId?: string;
    buyerEmail?: string;
    buyerName?: string;
    orderId?: string;
    returnUrl?: string;
    paymentMethodType?: string;
    metadata?: Record<string, string>;
}

export interface CheckoutSessionResult {
    success: boolean;
    sessionId?: string;
    checkoutUrl?: string;
    error?: string;
}

export interface PaymentStatus {
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'expired';
    transactionId?: string;
    amount?: number;
    currency?: string;
    completedAt?: Date;
    paymentMethod?: string;
    error?: string;
}

export interface VerifyPaymentResult {
    verified: boolean;
    status: PaymentStatus['status'];
    transactionId?: string;
    error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

class DodoPaymentService {
    /**
     * Check if the service is properly configured
     */
    isConfigured(): boolean {
        return !!DODO_API_KEY && DODO_API_KEY.length > 0;
    }

    /**
     * Get the current mode (test or live)
     */
    getMode(): 'test' | 'live' {
        return IS_TEST_MODE ? 'test' : 'live';
    }

    /**
     * Create a checkout session for one-time payment
     * Returns a checkout URL that user should be redirected to
     */
    async createCheckoutSession(params: CreateCheckoutParams): Promise<CheckoutSessionResult> {
        if (!this.isConfigured()) {
            console.error('[DodoPaymentService] API key not configured');
            return {
                success: false,
                error: 'Payment service not configured. Please set VITE_DODO_API_KEY.',
            };
        }

        try {
            const orderId = params.orderId || `AB-${Date.now()}`;
            const returnUrl = params.returnUrl || `${window.location.origin}?payment=complete&order=${orderId}`;

            const response = await fetch(`${DODO_API_BASE}/checkout_sessions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${DODO_API_KEY}`,
                },
                body: JSON.stringify({
                    customer: params.buyerEmail ? {
                        email: params.buyerEmail,
                        name: params.buyerName,
                    } : undefined,
                    return_url: returnUrl,
                    metadata: {
                        order_id: orderId,
                        buyer_id: params.buyerId || 'anonymous',
                        total_amount: String(params.totalAmount),
                        items_json: JSON.stringify(params.items.map(i => ({
                            name: i.name,
                            price: i.price,
                            qty: i.quantity,
                            farmerId: i.farmerId,
                        }))),
                        ...params.metadata,
                    },
                    allowed_payment_method_types: params.paymentMethodType
                        ? [params.paymentMethodType]
                        : ['credit', 'debit', 'upi_collect', 'upi_intent', 'google_pay', 'netbanking'],
                    billing_currency: 'INR',
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `API error: ${response.status}`);
            }

            const data = await response.json();

            return {
                success: true,
                sessionId: data.session_id || data.id,
                checkoutUrl: data.checkout_url || data.url,
            };
        } catch (error: any) {
            console.error('[DodoPaymentService] Failed to create checkout session:', error);
            return {
                success: false,
                error: error.message || 'Failed to create checkout session',
            };
        }
    }

    /**
     * Verify payment status by session ID
     * CRITICAL: This is how we confirm payment actually happened
     */
    async verifyPayment(sessionId: string): Promise<VerifyPaymentResult> {
        if (!this.isConfigured()) {
            return { verified: false, status: 'failed', error: 'Service not configured' };
        }

        try {
            const response = await fetch(`${DODO_API_BASE}/checkout_sessions/${sessionId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${DODO_API_KEY}`,
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to verify: ${response.status}`);
            }

            const data = await response.json();

            // Map Dodo's status to our internal status
            const statusMap: Record<string, PaymentStatus['status']> = {
                'complete': 'completed',
                'paid': 'completed',
                'succeeded': 'completed',
                'pending': 'pending',
                'processing': 'processing',
                'failed': 'failed',
                'cancelled': 'cancelled',
                'expired': 'expired',
            };

            const normalizedStatus = statusMap[data.status?.toLowerCase()] || 'pending';
            const isVerified = normalizedStatus === 'completed';

            return {
                verified: isVerified,
                status: normalizedStatus,
                transactionId: data.payment_id || data.transaction_id || sessionId,
            };
        } catch (error: any) {
            console.error('[DodoPaymentService] Payment verification failed:', error);
            return {
                verified: false,
                status: 'failed',
                error: error.message || 'Verification failed',
            };
        }
    }

    /**
     * Poll for payment completion with timeout
     * Use this when waiting for user to complete payment
     */
    async waitForPaymentCompletion(
        sessionId: string,
        options: {
            maxAttempts?: number;
            intervalMs?: number;
            onStatusChange?: (status: PaymentStatus['status']) => void;
        } = {}
    ): Promise<VerifyPaymentResult> {
        const { maxAttempts = 60, intervalMs = 5000, onStatusChange } = options;
        let attempts = 0;
        let lastStatus: PaymentStatus['status'] = 'pending';

        return new Promise((resolve) => {
            const poll = async () => {
                attempts++;

                const result = await this.verifyPayment(sessionId);

                if (result.status !== lastStatus && onStatusChange) {
                    lastStatus = result.status;
                    onStatusChange(result.status);
                }

                // Payment completed successfully
                if (result.verified) {
                    resolve(result);
                    return;
                }

                // Payment failed or expired
                if (result.status === 'failed' || result.status === 'cancelled' || result.status === 'expired') {
                    resolve(result);
                    return;
                }

                // Max attempts reached
                if (attempts >= maxAttempts) {
                    resolve({
                        verified: false,
                        status: 'pending',
                        error: 'Payment verification timed out. Please check your bank statement.',
                    });
                    return;
                }

                // Continue polling
                setTimeout(poll, intervalMs);
            };

            poll();
        });
    }

    /**
     * Get payment details by session ID
     */
    async getPaymentDetails(sessionId: string): Promise<PaymentStatus> {
        if (!this.isConfigured()) {
            return { status: 'failed', error: 'Service not configured' };
        }

        try {
            const response = await fetch(`${DODO_API_BASE}/checkout_sessions/${sessionId}`, {
                headers: {
                    'Authorization': `Bearer ${DODO_API_KEY}`,
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to get details: ${response.status}`);
            }

            const data = await response.json();

            return {
                status: data.status === 'complete' || data.status === 'paid' ? 'completed' : 'pending',
                transactionId: data.payment_id || sessionId,
                amount: data.amount,
                currency: data.currency || 'INR',
                paymentMethod: data.payment_method_type,
                completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
            };
        } catch (error: any) {
            console.error('[DodoPaymentService] Failed to get payment details:', error);
            return { status: 'failed', error: error.message };
        }
    }

    /**
     * Generate UPI payment string for QR code
     */
    generateUPIString(params: {
        amount: number;
        merchantUPI: string;
        merchantName: string;
        orderId: string;
        transactionNote?: string;
    }): string {
        const { amount, merchantUPI, merchantName, orderId, transactionNote } = params;
        const txnId = `TXN${Date.now()}`;
        const note = transactionNote || `Payment for ${orderId}`;

        return `upi://pay?pa=${encodeURIComponent(merchantUPI)}&pn=${encodeURIComponent(merchantName)}&am=${amount}&cu=INR&tn=${encodeURIComponent(note)}&tr=${txnId}`;
    }

    /**
     * Generate deep link for specific UPI app
     */
    generateUPIDeepLink(appScheme: string, upiString: string): string {
        const appSchemes: Record<string, string> = {
            'gpay': 'gpay://upi/',
            'phonepe': 'phonepe://pay',
            'paytm': 'paytmmp://pay',
            'bhim': 'bhim://pay',
        };

        const scheme = appSchemes[appScheme.toLowerCase()];
        if (!scheme) {
            return upiString; // Return standard UPI string as fallback
        }

        // Extract parameters from UPI string and rebuild for specific app
        return upiString.replace('upi://', scheme);
    }
}

// Export singleton instance
export const dodoPaymentService = new DodoPaymentService();
export default dodoPaymentService;
