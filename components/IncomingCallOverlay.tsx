/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ANNA BAZAAR - INCOMING CALL OVERLAY
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Glassmorphic modal that appears when receiving an incoming call
 * Displays caller info with Accept/Decline buttons
 * 
 * @author Anna Bazaar Team - Calcutta Hacks 2025
 */

import React, { useEffect, useState } from 'react';
import { Negotiation, CallStatus } from '../types';

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

interface IncomingCallOverlayProps {
  negotiation: Negotiation;
  callerName: string;
  productName: string;
  onAccept: () => void;
  onDecline: () => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export const IncomingCallOverlay: React.FC<IncomingCallOverlayProps> = ({
  negotiation,
  callerName,
  productName,
  onAccept,
  onDecline,
}) => {
  const [ringDuration, setRingDuration] = useState(0);

  // Increment ring duration every second
  useEffect(() => {
    const interval = setInterval(() => {
      setRingDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-decline after 60 seconds (missed call)
  useEffect(() => {
    if (ringDuration >= 60) {
      onDecline();
    }
  }, [ringDuration, onDecline]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop with blur */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onDecline}
      />
      
      {/* Call Card - Glassmorphic Design */}
      <div className="relative z-10 w-full max-w-sm animate-[pulse_2s_ease-in-out_infinite]">
        {/* Pulsing Ring Animation */}
        <div className="absolute inset-0 -m-4">
          <div className="absolute inset-0 bg-[#2E7D32]/20 rounded-3xl animate-ping" />
          <div className="absolute inset-0 bg-[#2E7D32]/10 rounded-3xl animate-pulse" />
        </div>

        {/* Main Card */}
        <div className="relative bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl">
          {/* Call Icon with Animation */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              {/* Outer ring animation */}
              <div className="absolute inset-0 -m-4 bg-[#2E7D32]/30 rounded-full animate-ping" />
              <div className="absolute inset-0 -m-2 bg-[#2E7D32]/20 rounded-full animate-pulse" />
              
              {/* Phone icon */}
              <div className="relative w-20 h-20 bg-gradient-to-br from-[#2E7D32] to-[#1B5E20] rounded-full flex items-center justify-center shadow-lg shadow-[#2E7D32]/30">
                <span className="material-symbols-outlined text-4xl text-white animate-[wiggle_0.5s_ease-in-out_infinite]">
                  call
                </span>
              </div>
            </div>
          </div>

          {/* Caller Info */}
          <div className="text-center mb-8">
            <p className="text-white/60 text-sm uppercase tracking-wider mb-2">Incoming Call</p>
            <h2 className="text-white text-2xl font-bold mb-1">{callerName}</h2>
            <p className="text-white/70 text-sm">
              Regarding: <span className="font-medium text-white">{productName}</span>
            </p>
            <p className="text-white/50 text-xs mt-2">
              Ringing for {ringDuration}s...
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            {/* Decline Button */}
            <button
              onClick={onDecline}
              className="flex-1 py-4 px-6 bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 rounded-2xl transition-all group"
            >
              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 bg-red-500 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-red-500/30">
                  <span className="material-symbols-outlined text-2xl text-white">call_end</span>
                </div>
                <span className="text-red-400 font-medium text-sm">Decline</span>
              </div>
            </button>

            {/* Accept Button */}
            <button
              onClick={onAccept}
              className="flex-1 py-4 px-6 bg-[#2E7D32]/20 hover:bg-[#2E7D32]/40 border border-[#2E7D32]/30 rounded-2xl transition-all group"
            >
              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 bg-[#2E7D32] rounded-full flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-[#2E7D32]/30 animate-pulse">
                  <span className="material-symbols-outlined text-2xl text-white">videocam</span>
                </div>
                <span className="text-[#4CAF50] font-medium text-sm">Accept</span>
              </div>
            </button>
          </div>

          {/* Anna Bazaar Branding */}
          <div className="mt-6 flex items-center justify-center gap-2 text-white/40 text-xs">
            <span className="material-symbols-outlined text-sm">agriculture</span>
            <span>Anna Bazaar Video Call</span>
          </div>
        </div>
      </div>

      {/* Custom Animation Styles */}
      <style>{`
        @keyframes wiggle {
          0%, 100% { transform: rotate(-10deg); }
          50% { transform: rotate(10deg); }
        }
      `}</style>
    </div>
  );
};

export default IncomingCallOverlay;
