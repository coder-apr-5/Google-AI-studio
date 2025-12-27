/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ANNA BAZAAR - DODO PAYMENTS SERVICE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Real payment integration using DodoPayments API
 * Handles checkout session creation and payment processing
 * 
 * @author Anna Bazaar Team - Calcutta Hacks 2025
 */

import DodoPayments from 'dodopayments';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const DODO_API_KEY = import.meta.env.VITE_DODO_API_KEY || '';
const IS_TEST_MODE = import.meta.env.VITE_DODO_MODE !== 'live';

// Initialize DodoPayments client
const dodoClient = new DodoPayments({
    bearerToken: DODO_API_KEY,
});

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
    metadata?: Record<string, string>;
}

export interface CheckoutSessionResult {
    success: boolean;
    sessionId?: string;
    checkoutUrl?: string;
    error?: string;
}

export interface PaymentStatus {
    status: 'pending' | 'completed' | 'failed' | 'cancelled';
    transactionId?: string;
    amount?: number;
    currency?: string;
    completedAt?: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE CLASS
// ═══════════════════════════════════════════════════════════════════════════════

class DodoPaymentService {
    private isInitialized = false;

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
     * This calls the DodoPayments API to create a checkout session
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
            // For DodoPayments, we need to create products first or use dynamic pricing
            // Since this is a marketplace, we'll use custom checkout with metadata
            const response = await dodoClient.checkoutSessions.create({
                // For one-time payments without pre-registered products,
                // we'll use the metadata to store item details
                product_cart: params.items.map(item => ({
                    product_id: item.productId,
                    quantity: item.quantity,
                })),
                customer: params.buyerEmail ? {
                    email: params.buyerEmail,
                    name: params.buyerName,
                } : undefined,
                return_url: params.returnUrl || `${window.location.origin}/payment/success`,
                metadata: {
                    order_id: params.orderId || `AB-${Date.now()}`,
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
                allowed_payment_method_types: ['credit', 'debit', 'upi_collect', 'upi_intent', 'google_pay'],
                billing_currency: 'INR',
            });

            return {
                success: true,
                sessionId: response.session_id,
                checkoutUrl: response.checkout_url || undefined,
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
     * Create a simple checkout URL for direct payment
     * This is useful when you want to redirect to DodoPayments hosted checkout
     */
    async createPaymentLink(params: {
        amount: number;
        productName: string;
        productDescription?: string;
        buyerEmail?: string;
        orderId?: string;
        returnUrl?: string;
    }): Promise<CheckoutSessionResult> {
        if (!this.isConfigured()) {
            // In test mode without API key, return a mock checkout URL
            console.warn('[DodoPaymentService] API key not configured, using mock mode');
            return {
                success: true,
                sessionId: `mock_session_${Date.now()}`,
                checkoutUrl: `https://checkout.dodopayments.com/demo?amount=${params.amount}&name=${encodeURIComponent(params.productName)}`,
            };
        }

        try {
            const response = await dodoClient.checkoutSessions.create({
                product_cart: [{
                    product_id: 'dynamic_product',
                    quantity: 1,
                }],
                customer: params.buyerEmail ? {
                    email: params.buyerEmail,
                } : undefined,
                return_url: params.returnUrl || `${window.location.origin}/payment/success`,
                metadata: {
                    order_id: params.orderId || `AB-${Date.now()}`,
                    product_name: params.productName,
                    amount: String(params.amount),
                },
                billing_currency: 'INR',
            });

            return {
                success: true,
                sessionId: response.session_id,
                checkoutUrl: response.checkout_url || undefined,
            };
        } catch (error: any) {
            console.error('[DodoPaymentService] Failed to create payment link:', error);
            return {
                success: false,
                error: error.message || 'Failed to create payment link',
            };
        }
    }

    /**
     * Get the status of a checkout session
     */
    async getSessionStatus(sessionId: string): Promise<PaymentStatus> {
        if (!this.isConfigured()) {
            return { status: 'pending' };
        }

        try {
            const session = await dodoClient.checkoutSessions.retrieve(sessionId);

            // Map DodoPayments status to our internal status
            // Adjust based on actual DodoPayments response structure
            return {
                status: 'pending', // Will be updated based on actual response
                transactionId: sessionId,
            };
        } catch (error) {
            console.error('[DodoPaymentService] Failed to get session status:', error);
            return { status: 'failed' };
        }
    }
}

// Export singleton instance
export const dodoPaymentService = new DodoPaymentService();
export default dodoPaymentService;
