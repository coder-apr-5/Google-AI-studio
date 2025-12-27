import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Negotiation, NegotiationStatus, ChatMessage, Farmer, MIN_BULK_QUANTITY_KG, CallStatus, User } from '../types';
import { classifyOffer, type OfferClassification, type PriceBand } from '../services/mandiPriceService';
import { firebaseService } from '../services/firebaseService';

interface BuyerNegotiationConsoleProps {
    negotiation: Negotiation;
    farmer?: Farmer;
    messages: ChatMessage[];
    currentUserId: string;
    currentUser: User;
    onClose: () => void;
    onSendMessage: (text: string) => void;
    onUpdateOffer: (price: number, quantity: number) => void;
    onAcceptOffer: () => void;
    onDeclineOffer: () => void;
    onStartCall?: (negotiationId: string) => void;
}

export const BuyerNegotiationConsole: React.FC<BuyerNegotiationConsoleProps> = ({
    negotiation,
    farmer,
    messages,
    currentUserId,
    currentUser,
    onClose,
    onSendMessage,
    onUpdateOffer,
    onAcceptOffer,
    onDeclineOffer,
    onStartCall,
}) => {
    const [messageInput, setMessageInput] = useState('');
    const [counterPrice, setCounterPrice] = useState(negotiation.offeredPrice);
    const [counterQuantity, setCounterQuantity] = useState(negotiation.quantity);
    const [isStartingCall, setIsStartingCall] = useState(false);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // Get price band from negotiation (computed on creation)
    const priceBand: PriceBand | null = useMemo(() => {
        if (negotiation.floorPrice != null && negotiation.targetPrice != null) {
            return {
                floorPrice: negotiation.floorPrice,
                targetPrice: negotiation.targetPrice,
                stretchPrice: negotiation.targetPrice * 1.1,
                baseMandiPrice: 0, // Not needed for display
                qualityFactor: 1,
                isVerified: negotiation.priceVerified ?? false,
                priceSource: negotiation.priceSource ?? 'Market data',
                updatedAt: null,
            };
        }
        return null;
    }, [negotiation.floorPrice, negotiation.targetPrice, negotiation.priceVerified, negotiation.priceSource]);

    // Classify the current offer
    const offerClassification: OfferClassification | null = useMemo(() => {
        if (!priceBand) return null;
        return classifyOffer(counterPrice, priceBand);
    }, [counterPrice, priceBand]);

    // Check if offer is valid (not below floor)
    const isOfferValid = !offerClassification || offerClassification.status !== 'INVALID';
    
    // Check if quantity is valid (bulk minimum)
    const isQuantityValid = counterQuantity >= MIN_BULK_QUANTITY_KG;
    
    // Can submit only if both price and quantity are valid
    const canSubmitOffer = isOfferValid && isQuantityValid;

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSendMessage = () => {
        if (!messageInput.trim()) return;
        onSendMessage(messageInput.trim());
        setMessageInput('');
    };

    const handleUpdateOffer = () => {
        if (!canSubmitOffer) return;
        onUpdateOffer(counterPrice, counterQuantity);
    };

    /**
     * Start a video/voice call with the farmer
     */
    const handleStartCall = async () => {
        if (isStartingCall || !onStartCall) return;
        
        setIsStartingCall(true);
        try {
            const result = await firebaseService.startCall(
                negotiation.id,
                currentUser.uid,
                currentUser.name || 'Buyer'
            );
            
            if (result.success) {
                onStartCall(negotiation.id);
            } else {
                console.error('[BuyerNegotiationConsole] Failed to start call:', result.error);
            }
        } catch (error) {
            console.error('[BuyerNegotiationConsole] Error starting call:', error);
        } finally {
            setIsStartingCall(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const formatPrice = (price: number) => price.toLocaleString('en-IN');
    const totalEstimate = counterPrice * counterQuantity;
    const logisticsEstimate = 1200;
    const finalTotal = totalEstimate + logisticsEstimate;

    // Determine current negotiation step
    const isAgreement = negotiation.status === NegotiationStatus.Accepted;
    const isRejected = negotiation.status === NegotiationStatus.Rejected;
    const isPending = negotiation.status === NegotiationStatus.Pending || negotiation.status === NegotiationStatus.CounterByFarmer;

    return (
        <div className="fixed inset-0 z-50 bg-background-light dark:bg-background-dark font-display text-text-main dark:text-white flex flex-col overflow-hidden">
            {/* Top Navigation Header - Mobile First */}
            <header className="flex items-center justify-between px-3 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 bg-white dark:bg-[#1a262d] border-b border-stone-200 dark:border-[#27333a] shadow-sm z-20">
                <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
                    <button
                        onClick={onClose}
                        className="p-1.5 sm:p-2 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-full transition-colors"
                    >
                        <span className="material-symbols-outlined text-xl sm:text-2xl">close</span>
                    </button>
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="size-8 sm:size-10 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center text-white">
                            <span className="material-symbols-outlined text-lg sm:text-xl">agriculture</span>
                        </div>
                        <div className="hidden sm:block">
                            <h1 className="text-base sm:text-lg lg:text-xl font-black">Anna Bazaar</h1>
                            <p className="text-[10px] sm:text-xs text-stone-500">Negotiation Console</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Call Farmer Button */}
                    {onStartCall && isPending && (
                        <button
                            onClick={handleStartCall}
                            disabled={isStartingCall}
                            className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-[#2E7D32] hover:bg-[#256029] text-white text-xs sm:text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                        >
                            {isStartingCall ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span className="hidden sm:inline">Calling...</span>
                                </>
                            ) : (
                                <>
                                    <span className="material-symbols-outlined text-[20px]">videocam</span>
                                    <span className="hidden sm:inline">📞 Call Farmer</span>
                                    <span className="sm:hidden">Call</span>
                                </>
                            )}
                        </button>
                    )}
                    <button className="hidden sm:flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs sm:text-sm font-bold hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors">
                        <span className="material-symbols-outlined text-[20px]">help</span>
                        <span>Help</span>
                    </button>
                </div>
            </header>

            {/* Main Layout */}
            <div className="flex flex-1 overflow-hidden">
                {/* Left Column: Chat Interface */}
                <main className="flex-1 flex flex-col min-w-0 bg-background-light dark:bg-background-dark relative">
                    {/* Chat Header */}
                    <div className="flex items-center justify-between px-3 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 bg-white dark:bg-[#1a262d] border-b border-stone-200 dark:border-[#27333a] shadow-sm sticky top-0 z-10">
                        <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
                            <div className="relative">
                                <div
                                    className="size-10 sm:size-12 rounded-full bg-gradient-to-r from-stone-300 to-stone-400 dark:from-stone-700 dark:to-stone-600 flex items-center justify-center text-lg sm:text-2xl border border-stone-300 dark:border-stone-700"
                                >
                                    👨‍🌾
                                </div>
                                <div className="absolute -bottom-0.5 sm:-bottom-1 -right-0.5 sm:-right-1 size-3 sm:size-4 bg-green-500 border-2 border-white dark:border-stone-900 rounded-full"></div>
                            </div>
                            <div>
                                <h3 className="text-base sm:text-lg lg:text-xl font-bold">{farmer?.name || 'Farmer'}</h3>
                                <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm text-stone-500 dark:text-stone-400">
                                    <span className="hidden sm:flex items-center gap-1">
                                        <span className="material-symbols-outlined text-[14px] sm:text-[16px] text-yellow-500">star</span>
                                        4.8/5
                                    </span>
                                    <span className="hidden sm:inline">•</span>
                                    <span className="text-green-600 dark:text-green-400 font-medium">Online</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 dark:text-stone-400 transition-colors">
                                <span className="material-symbols-outlined">call</span>
                            </button>
                            <button className="p-2 rounded-full hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 dark:text-stone-400 transition-colors">
                                <span className="material-symbols-outlined">more_vert</span>
                            </button>
                        </div>
                    </div>

                    {/* Chat Messages Area */}
                    <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6 bg-stone-50 dark:bg-stone-900/30">
                        {/* Date Separator - Dynamic */}
                        {messages.length > 0 && (
                            <div className="flex justify-center">
                                <span className="px-3 py-1 bg-stone-200 dark:bg-stone-800 rounded-full text-xs font-medium text-stone-600 dark:text-stone-400">
                                    {new Date(messages[0]?.timestamp || negotiation.lastUpdated).toLocaleDateString('en-IN', { 
                                        weekday: 'short', 
                                        month: 'short', 
                                        day: 'numeric' 
                                    })}
                                </span>
                            </div>
                        )}

                        {/* Initial Offer Card - Only show if no messages yet */}
                        {messages.length === 0 && (
                            <div className="flex gap-2 sm:gap-4 max-w-[90%] sm:max-w-[80%]">
                                <div className="size-6 sm:size-8 rounded-full bg-gradient-to-r from-stone-400 to-stone-500 flex items-center justify-center text-white text-xs sm:text-sm font-bold shrink-0">
                                    👨‍🌾
                                </div>
                                <div className="flex flex-col gap-1">
                                    <div className="bg-white dark:bg-stone-800 p-0 rounded-2xl rounded-tl-none border border-stone-200 dark:border-stone-700 shadow-sm overflow-hidden w-[240px] sm:w-[280px]">
                                        <div className="bg-orange-50 dark:bg-orange-900/20 px-3 sm:px-4 py-1.5 sm:py-2 border-b border-stone-200 dark:border-stone-700 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-orange-600 text-xs sm:text-sm">local_offer</span>
                                            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-orange-600">Initial Offer</span>
                                        </div>
                                        <div className="p-3 sm:p-4">
                                            <div className="flex justify-between items-baseline mb-2">
                                                <span className="text-xs sm:text-sm text-stone-600 dark:text-stone-400">Price/kg</span>
                                                <span className="text-xl sm:text-2xl font-bold">₹{negotiation.initialPrice}</span>
                                            </div>
                                            <div className="flex justify-between items-baseline mb-3 sm:mb-4">
                                                <span className="text-xs sm:text-sm text-stone-600 dark:text-stone-400">Quantity</span>
                                                <span className="text-sm sm:text-base font-medium">{negotiation.quantity} kg</span>
                                            </div>
                                        </div>
                                    </div>
                                    <span className="text-xs text-stone-500 dark:text-stone-400 ml-2">
                                        {new Date(negotiation.lastUpdated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Current Offer Summary */}
                        <div className="flex justify-center">
                            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl sm:rounded-full border border-emerald-200 dark:border-emerald-800">
                                <span className="text-[10px] sm:text-xs font-medium text-emerald-700 dark:text-emerald-300 text-center">
                                    Your offer: ₹{negotiation.offeredPrice}/kg for {negotiation.quantity}kg
                                </span>
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                    negotiation.status === NegotiationStatus.Accepted ? 'bg-green-500 text-white' :
                                    negotiation.status === NegotiationStatus.Rejected ? 'bg-red-500 text-white' :
                                    'bg-yellow-500 text-black'
                                }`}>
                                    {negotiation.status}
                                </span>
                            </div>
                        </div>

                        {/* All Messages from prop */}
                        {messages.map((msg, idx) => {
                            const isMe = msg.senderId === currentUserId;
                            return (
                                <div key={msg.id || idx} className={`flex gap-2 sm:gap-3 max-w-[90%] sm:max-w-[80%] ${isMe ? 'ml-auto flex-row-reverse' : ''}`}>
                                    <div className={`size-6 sm:size-8 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-bold shrink-0 ${isMe ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-stone-400 to-stone-500'}`}>
                                        {isMe ? 'YOU' : '👨‍🌾'}
                                    </div>
                                    <div className={`flex flex-col gap-1 ${isMe ? 'items-end' : ''}`}>
                                        <div className={`p-3 sm:p-4 rounded-2xl shadow-sm ${isMe ? 'bg-emerald-50 dark:bg-emerald-900/30 rounded-tr-none border border-emerald-200 dark:border-emerald-800' : 'bg-white dark:bg-stone-800 rounded-tl-none border border-stone-200 dark:border-stone-700'}`}>
                                            <p className="text-sm sm:text-base">{msg.text}</p>
                                        </div>
                                        <span className={`text-[10px] sm:text-xs text-stone-500 dark:text-stone-400 ${isMe ? 'mr-2' : 'ml-2'}`}>
                                            {new Date(msg.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Empty State */}
                        {messages.length === 0 && (
                            <div className="flex justify-center py-8">
                                <p className="text-sm text-stone-500 dark:text-stone-400">
                                    Start a conversation with {farmer?.name || 'the farmer'}
                                </p>
                            </div>
                        )}

                        {/* Agreement Message */}
                        {isAgreement && (
                            <div className="flex justify-center">
                                <div className="flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 rounded-full border border-green-300 dark:border-green-800">
                                    <span className="material-symbols-outlined text-green-600 text-sm">check_circle</span>
                                    <span className="text-xs font-bold text-green-700 dark:text-green-300">Offer Accepted!</span>
                                </div>
                            </div>
                        )}

                        {/* Rejection Message */}
                        {isRejected && (
                            <div className="flex justify-center">
                                <div className="flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/30 rounded-full border border-red-300 dark:border-red-800">
                                    <span className="material-symbols-outlined text-red-600 text-sm">cancel</span>
                                    <span className="text-xs font-bold text-red-700 dark:text-red-300">Offer Rejected</span>
                                </div>
                            </div>
                        )}

                        <div className="h-24"></div>
                    </div>

                    {/* Footer: Counter-Offer Tool */}
                    {isPending && (
                        <div className="absolute bottom-0 left-0 w-full bg-white dark:bg-[#1a262d] border-t border-stone-200 dark:border-[#27333a] p-3 sm:p-4 z-20 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
                            <div className="max-w-4xl mx-auto flex flex-col gap-3 sm:gap-4">
                                {/* Price Floor Indicator */}
                                {priceBand && (
                                    <div className="flex items-center justify-between px-3 py-2 bg-stone-50 dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-700">
                                        <div className="flex items-center gap-4 text-xs">
                                            <div className="flex items-center gap-1">
                                                <span className="text-stone-500 dark:text-stone-400">Min Floor:</span>
                                                <span className="font-bold text-red-600">₹{priceBand.floorPrice}/kg</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="text-stone-500 dark:text-stone-400">Fair Target:</span>
                                                <span className="font-bold text-green-600">₹{priceBand.targetPrice}/kg</span>
                                            </div>
                                            {!priceBand.isVerified && (
                                                <span className="text-xs text-orange-600 flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-sm">warning</span>
                                                    Unverified mandi data
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-stone-400">{priceBand.priceSource}</span>
                                    </div>
                                )}

                                {/* Offer Classification Badge */}
                                {offerClassification && (
                                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${offerClassification.bgClass}`}>
                                        <span className={`material-symbols-outlined text-sm ${offerClassification.colorClass}`}>
                                            {offerClassification.status === 'INVALID' ? 'block' :
                                             offerClassification.status === 'LOW' ? 'trending_down' :
                                             offerClassification.status === 'FAIR' ? 'check_circle' : 'trending_up'}
                                        </span>
                                        <span className={`text-xs font-bold ${offerClassification.colorClass}`}>
                                            {offerClassification.status}: {offerClassification.message}
                                        </span>
                                    </div>
                                )}

                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400">Make Counter-Offer (Bulk B2B)</h4>
                                </div>
                                <div className="flex flex-col md:flex-row gap-4 items-stretch">
                                    {/* Price Spinner */}
                                    <div className={`flex-1 flex items-center rounded-xl px-2 py-1 ${
                                        !isOfferValid 
                                            ? 'bg-red-50 dark:bg-red-900/20 border-2 border-red-400' 
                                            : 'bg-stone-100 dark:bg-stone-800 border border-stone-300 dark:border-stone-700'
                                    }`}>
                                        <button
                                            onClick={() => setCounterPrice(Math.max(1, counterPrice - 1))}
                                            className="size-10 flex items-center justify-center rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-400"
                                        >
                                            <span className="material-symbols-outlined">remove</span>
                                        </button>
                                        <div className="flex-1 text-center border-x border-stone-300 dark:border-stone-700 mx-2 py-1">
                                            <span className={`block text-xs font-medium ${!isOfferValid ? 'text-red-600' : 'text-stone-600 dark:text-stone-400'}`}>
                                                Price (₹/kg)
                                            </span>
                                            <input
                                                className={`w-full bg-transparent text-center font-bold text-xl border-none focus:ring-0 p-0 ${!isOfferValid ? 'text-red-600' : ''}`}
                                                type="number"
                                                value={counterPrice}
                                                onChange={(e) => setCounterPrice(Math.max(1, parseInt(e.target.value) || 1))}
                                            />
                                        </div>
                                        <button
                                            onClick={() => setCounterPrice(counterPrice + 1)}
                                            className="size-10 flex items-center justify-center rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700 text-emerald-600 dark:text-emerald-400"
                                        >
                                            <span className="material-symbols-outlined">add</span>
                                        </button>
                                    </div>

                                    {/* Qty Spinner - Bulk Lot (min 100kg) */}
                                    <div className={`flex-1 flex items-center rounded-xl px-2 py-1 ${
                                        !isQuantityValid 
                                            ? 'bg-red-50 dark:bg-red-900/20 border-2 border-red-400' 
                                            : 'bg-stone-100 dark:bg-stone-800 border border-stone-300 dark:border-stone-700'
                                    }`}>
                                        <button
                                            onClick={() => setCounterQuantity(Math.max(MIN_BULK_QUANTITY_KG, counterQuantity - 100))}
                                            className="size-10 flex items-center justify-center rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-400"
                                        >
                                            <span className="material-symbols-outlined">remove</span>
                                        </button>
                                        <div className="flex-1 text-center border-x border-stone-300 dark:border-stone-700 mx-2 py-1">
                                            <span className={`block text-xs font-medium ${!isQuantityValid ? 'text-red-600' : 'text-stone-600 dark:text-stone-400'}`}>
                                                Bulk Lot (kg) - Min {MIN_BULK_QUANTITY_KG}
                                            </span>
                                            <input
                                                className={`w-full bg-transparent text-center font-bold text-xl border-none focus:ring-0 p-0 ${!isQuantityValid ? 'text-red-600' : ''}`}
                                                type="number"
                                                min={MIN_BULK_QUANTITY_KG}
                                                value={counterQuantity}
                                                onChange={(e) => setCounterQuantity(Math.max(1, parseInt(e.target.value) || MIN_BULK_QUANTITY_KG))}
                                            />
                                        </div>
                                        <button
                                            onClick={() => setCounterQuantity(counterQuantity + 100)}
                                            className="size-10 flex items-center justify-center rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700 text-emerald-600 dark:text-emerald-400"
                                        >
                                            <span className="material-symbols-outlined">add</span>
                                        </button>
                                    </div>

                                    {/* Action Button - DISABLED if below floor */}
                                    <button
                                        onClick={handleUpdateOffer}
                                        disabled={!canSubmitOffer}
                                        className={`flex-[0.5] rounded-xl font-bold px-6 py-2 shadow-md transition-all flex flex-col items-center justify-center min-w-[120px] ${
                                            canSubmitOffer 
                                                ? 'bg-orange-600 hover:bg-orange-700 text-white active:scale-95 cursor-pointer'
                                                : 'bg-stone-400 text-stone-200 cursor-not-allowed'
                                        }`}
                                    >
                                        <span className="text-sm">{canSubmitOffer ? 'Update Offer' : 'Invalid Offer'}</span>
                                        <span className="text-[10px] opacity-80">
                                            {!isOfferValid ? 'Below floor price' : !isQuantityValid ? 'Qty too low' : 'Send Card'}
                                        </span>
                                    </button>
                                </div>

                                {/* Simple Chat Input for Text */}
                                <div className="flex gap-3 items-center mt-2 border-t border-stone-300 dark:border-stone-700 pt-3">
                                    <div className="flex-1 relative">
                                        <input
                                            className="w-full h-12 rounded-xl bg-stone-100 dark:bg-stone-800 border border-stone-300 dark:border-stone-700 px-4 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                                            placeholder={`Type a message to ${farmer?.name || 'farmer'}...`}
                                            type="text"
                                            value={messageInput}
                                            onChange={(e) => setMessageInput(e.target.value)}
                                            onKeyPress={handleKeyPress}
                                        />
                                        <button className="absolute right-2 top-2 p-2 text-stone-600 dark:text-stone-400 hover:text-emerald-600 dark:hover:text-emerald-400">
                                            <span className="material-symbols-outlined">mic</span>
                                        </button>
                                    </div>
                                    <button
                                        onClick={handleSendMessage}
                                        disabled={!messageInput.trim()}
                                        className="size-12 rounded-xl bg-emerald-600 dark:bg-emerald-700 text-white flex items-center justify-center shadow-lg hover:bg-emerald-700 dark:hover:bg-emerald-800 disabled:bg-stone-400 disabled:cursor-not-allowed transition-all active:scale-95"
                                    >
                                        <span className="material-symbols-outlined">send</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </main>

                {/* Right Column: Deal Flow Sidebar */}
                <aside className="w-[360px] flex-shrink-0 bg-white dark:bg-[#141d22] border-l border-stone-200 dark:border-[#27333a] flex flex-col shadow-2xl z-30 hidden lg:flex">
                    <div className="p-6 border-b border-stone-200 dark:border-[#27333a]">
                        <h3 className="text-lg font-bold mb-1">Deal Flow</h3>
                        <p className="text-sm text-stone-500 dark:text-stone-400">Ref: #{negotiation.id?.slice(-5)}</p>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-8">
                        {/* Status Stepper */}
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-4">Status</h4>
                            <div className="grid grid-cols-[32px_1fr] gap-x-3">
                                {/* Step 1: Done */}
                                <div className="flex flex-col items-center">
                                    <div className="size-8 rounded-full bg-green-500 flex items-center justify-center text-white shadow-sm">
                                        <span className="material-symbols-outlined text-lg">check</span>
                                    </div>
                                    <div className="w-0.5 bg-green-500 h-8 grow"></div>
                                </div>
                                <div className="pt-1 pb-6">
                                    <p className="text-sm font-bold">Deal Started</p>
                                    <p className="text-xs text-stone-500 dark:text-stone-400">10:30 AM</p>
                                </div>

                                {/* Step 2: Active */}
                                <div className="flex flex-col items-center">
                                    <div className={`size-8 rounded-full flex items-center justify-center text-white shadow-md ring-4 ${isAgreement ? 'bg-green-500 ring-green-500/20' : 'bg-emerald-600 ring-emerald-600/20'} ${!isAgreement ? 'animate-pulse' : ''}`}>
                                        <span className="material-symbols-outlined text-lg">handshake</span>
                                    </div>
                                    <div className={`w-0.5 h-8 grow ${isAgreement ? 'bg-green-500' : 'bg-stone-300 dark:bg-stone-700'}`}></div>
                                </div>
                                <div className="pt-1 pb-6">
                                    <p className={`text-sm font-bold ${isAgreement ? 'text-green-600' : 'text-emerald-600'}`}>
                                        {isAgreement ? 'Deal Finalized' : 'Negotiation Agreed'}
                                    </p>
                                    <p className="text-xs text-stone-500 dark:text-stone-400">{isAgreement ? 'Ready to Pay' : 'Pending Payment'}</p>
                                </div>

                                {/* Step 3: Pending */}
                                <div className="flex flex-col items-center">
                                    <div className={`size-8 rounded-full border flex items-center justify-center ${isAgreement ? 'bg-green-100 dark:bg-green-900/30 border-green-500 text-green-600 dark:text-green-400' : 'bg-stone-100 dark:bg-stone-800 border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-400'}`}>
                                        <span className="material-symbols-outlined text-lg">payments</span>
                                    </div>
                                </div>
                                <div className="pt-1">
                                    <p className={`text-sm font-medium ${isAgreement ? 'text-green-600 dark:text-green-400' : 'text-stone-600 dark:text-stone-400'}`}>Payment Release</p>
                                </div>
                            </div>
                        </div>

                        {/* Calculator Stats */}
                        <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-4">Live Calculator</h4>
                            <div className="flex flex-col gap-3">
                                <div className="flex justify-between items-center p-3 rounded-lg bg-stone-100 dark:bg-stone-800 border border-stone-300 dark:border-stone-700">
                                    <span className="text-sm text-stone-600 dark:text-stone-400 font-medium">Base Price</span>
                                    <span className="text-base font-bold">₹{counterPrice} <span className="text-xs font-normal text-stone-500">/kg</span></span>
                                </div>
                                <div className="flex justify-between items-center p-3 rounded-lg bg-stone-100 dark:bg-stone-800 border border-stone-300 dark:border-stone-700">
                                    <span className="text-sm text-stone-600 dark:text-stone-400 font-medium">Quantity</span>
                                    <span className="text-base font-bold">{counterQuantity} kg</span>
                                </div>
                                <div className="flex justify-between items-center p-3 rounded-lg bg-stone-100 dark:bg-stone-800 border border-stone-300 dark:border-stone-700">
                                    <span className="text-sm text-stone-600 dark:text-stone-400 font-medium">Est. Logistics</span>
                                    <span className="text-base font-bold">₹{logisticsEstimate.toLocaleString('en-IN')}</span>
                                </div>

                                {/* Divider */}
                                <div className="h-px bg-stone-300 dark:bg-stone-700 my-2"></div>

                                <div className="flex justify-between items-center p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                                    <span className="text-sm text-emerald-900 dark:text-emerald-200 font-bold">TOTAL ESTIMATE</span>
                                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">₹{finalTotal.toLocaleString('en-IN')}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Payment Action Area */}
                    <div className="p-6 bg-stone-50 dark:bg-stone-900/50 border-t border-stone-200 dark:border-[#27333a] shadow-[0_-4px_10px_-2px_rgba(0,0,0,0.1)]">
                        {isAgreement ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="material-symbols-outlined text-green-600">lock</span>
                                    <p className="text-xs font-medium text-stone-600 dark:text-stone-400">Payment is held securely in escrow.</p>
                                </div>
                                <button className="w-full relative overflow-hidden group bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-14 px-5 flex items-center justify-center gap-3 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 cursor-pointer active:scale-95 font-bold">
                                    <span className="material-symbols-outlined">payment</span>
                                    Release Payment: ₹{finalTotal.toLocaleString('en-IN')}
                                </button>
                                <p className="text-center text-xs text-stone-600 dark:text-stone-400 font-medium">
                                    Secured by Anna Bazaar Escrow
                                </p>
                            </div>
                        ) : (
                            <button
                                onClick={onAcceptOffer}
                                disabled={isRejected}
                                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-stone-400 disabled:cursor-not-allowed text-white rounded-xl h-12 px-4 flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-xl active:scale-95 font-bold"
                            >
                                <span className="material-symbols-outlined">check_circle</span>
                                Accept: ₹{counterPrice}/kg
                            </button>
                        )}
                    </div>
                </aside>
            </div>
        </div>
    );
};
