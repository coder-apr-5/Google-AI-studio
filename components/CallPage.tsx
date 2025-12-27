/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ANNA BAZAAR - VOICE/VIDEO CALL PAGE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * 1-on-1 Voice/Video calling using ZEGOCLOUD UIKit
 * Uses negotiationId as the roomID for the call
 * 
 * @author Anna Bazaar Team - Calcutta Hacks 2025
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ZegoUIKitPrebuilt } from '@zegocloud/zego-uikit-prebuilt';
import { User, CallStatus } from '../types';
import { firebaseService } from '../services/firebaseService';

// ═══════════════════════════════════════════════════════════════════════════════
// ZEGOCLOUD CREDENTIALS (Hackathon Demo)
// ═══════════════════════════════════════════════════════════════════════════════
const ZEGO_APP_ID = 272124016;
const ZEGO_SERVER_SECRET = '769c2e05bf965406f95e8d218ffc1a2e';

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

interface CallPageProps {
  negotiationId: string;
  currentUser: User;
  onLeaveCall: () => void;
  productName?: string;
  otherPartyName?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export const CallPage: React.FC<CallPageProps> = ({
  negotiationId,
  currentUser,
  onLeaveCall,
  productName,
  otherPartyName,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const zegoInstanceRef = useRef<ZegoUIKitPrebuilt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);

  /**
   * Handle leaving the room - update Firestore and navigate back
   */
  const handleLeaveRoom = useCallback(async () => {
    try {
      await firebaseService.endCall(negotiationId);
    } catch (err) {
      console.error('[CallPage] Error ending call:', err);
    }
    onLeaveCall();
  }, [negotiationId, onLeaveCall]);

  /**
   * Generate ZEGOCLOUD Kit Token for test/demo
   */
  const generateToken = useCallback(() => {
    const userID = currentUser.uid;
    const userName = currentUser.name || 'User';
    const roomID = negotiationId;
    
    // Use generateKitTokenForTest for hackathon demo
    return ZegoUIKitPrebuilt.generateKitTokenForTest(
      ZEGO_APP_ID,
      ZEGO_SERVER_SECRET,
      roomID,
      userID,
      userName
    );
  }, [currentUser.uid, currentUser.name, negotiationId]);

  /**
   * Initialize ZEGOCLOUD and join the room
   */
  useEffect(() => {
    if (!containerRef.current || zegoInstanceRef.current) return;

    const initCall = async () => {
      try {
        setIsJoining(true);
        setError(null);

        // Check for media permissions first
        try {
          await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch (permErr: any) {
          if (permErr.name === 'NotAllowedError' || permErr.name === 'PermissionDeniedError') {
            setPermissionDenied(true);
            setError('Camera and microphone access denied. Please allow access to make calls.');
            setIsJoining(false);
            return;
          }
          throw permErr;
        }

        const kitToken = generateToken();
        
        // Create ZegoUIKitPrebuilt instance
        const zp = ZegoUIKitPrebuilt.create(kitToken);
        zegoInstanceRef.current = zp;

        // Join room with 1-on-1 call configuration
        zp.joinRoom({
          container: containerRef.current!,
          scenario: {
            mode: ZegoUIKitPrebuilt.OneONoneCall,
          },
          showPreJoinView: false, // Skip pre-join for faster connection
          turnOnCameraWhenJoining: true,
          turnOnMicrophoneWhenJoining: true,
          showRoomTimer: true,
          showLeavingView: false,
          
          // Branding
          branding: {
            logoURL: 'https://lh3.googleusercontent.com/aida-public/AB6AXuALwxxDrpLMQ0PAEXnp1MIHSzbZRt1sD_WfaHf96_rURNNJS5EQ9YN_m376vwNz2v20bBh81xnlwPHeSFyN7diR183u08oIzt5BlzuTrl1ddjcv29m3DXG4HVMzoA2hSEIHsVd7sLJQSBywZsBXoT1yPQ-OLA_tQKIGuZ2NMRmmCwY7dGGMsb8a52OnVQCiPj5SXiyB7Vay27nZzB7qw3datcM9XQ59woQ8Pp5IOGPchlOOCKGbBlzESvjsNiqoUmBlER9dZTRReP-Z',
          },

          // Callbacks
          onJoinRoom: () => {
            console.log('[CallPage] Successfully joined room:', negotiationId);
            setIsJoining(false);
          },
          onLeaveRoom: () => {
            console.log('[CallPage] Left room:', negotiationId);
            handleLeaveRoom();
          },
          onUserJoin: (users) => {
            console.log('[CallPage] User(s) joined:', users);
          },
          onUserLeave: (users) => {
            console.log('[CallPage] User(s) left:', users);
          },
        });

      } catch (err: any) {
        console.error('[CallPage] Error initializing call:', err);
        setError(err.message || 'Failed to initialize video call');
        setIsJoining(false);
      }
    };

    initCall();

    // Cleanup on unmount
    return () => {
      if (zegoInstanceRef.current) {
        zegoInstanceRef.current.destroy();
        zegoInstanceRef.current = null;
      }
    };
  }, [negotiationId, generateToken, handleLeaveRoom]);

  // ═══════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════════

  // Permission denied state
  if (permissionDenied) {
    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md mx-4 text-center shadow-2xl">
          <div className="w-20 h-20 mx-auto mb-6 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-red-600">videocam_off</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            Camera & Microphone Access Required
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            To make video calls, please allow access to your camera and microphone in your browser settings.
          </p>
          <button
            onClick={onLeaveCall}
            className="w-full py-3 px-6 bg-[#2E7D32] hover:bg-[#256029] text-white rounded-xl font-bold transition-all"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md mx-4 text-center shadow-2xl">
          <div className="w-20 h-20 mx-auto mb-6 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-red-600">error</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            Call Error
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">{error}</p>
          <button
            onClick={onLeaveCall}
            className="w-full py-3 px-6 bg-[#2E7D32] hover:bg-[#256029] text-white rounded-xl font-bold transition-all"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-gray-900">
      {/* Call Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent p-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#2E7D32] rounded-full flex items-center justify-center">
              <span className="material-symbols-outlined text-white">agriculture</span>
            </div>
            <div>
              <h1 className="text-white font-bold text-lg">Anna Bazaar Call</h1>
              {productName && (
                <p className="text-white/70 text-sm">Discussing: {productName}</p>
              )}
            </div>
          </div>
          {otherPartyName && (
            <div className="text-right">
              <p className="text-white/70 text-sm">Connected with</p>
              <p className="text-white font-medium">{otherPartyName}</p>
            </div>
          )}
        </div>
      </div>

      {/* Loading Overlay */}
      {isJoining && (
        <div className="absolute inset-0 z-20 bg-gray-900/90 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-[#2E7D32] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white text-lg font-medium">Connecting to call...</p>
            <p className="text-white/60 text-sm mt-2">Please wait while we set up your video</p>
          </div>
        </div>
      )}

      {/* ZEGOCLOUD Container */}
      <div 
        ref={containerRef} 
        className="w-full h-full"
        style={{ minHeight: '100vh' }}
      />
    </div>
  );
};

export default CallPage;
