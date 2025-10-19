import React, { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { truncateAddress } from '../lib/constants';

interface ToastProps {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose, duration = 4000 }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
  
  return (
    <div className={`fixed top-4 right-4 z-50 ${bgColor} text-white px-4 py-3 rounded-lg shadow-lg animate-in slide-in-from-right-full fade-in duration-300`}>
      <div className="flex items-center gap-3">
        {type === 'success' && (
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        )}
        <span className="text-sm font-medium">{message}</span>
        <button onClick={onClose} className="ml-2 text-white/80 hover:text-white">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export const WalletConnectionToast: React.FC = () => {
  const wallet = useWallet();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [previousConnected, setPreviousConnected] = useState(wallet.connected);

  useEffect(() => {
    console.log('👛 Wallet state changed:', { 
      connected: wallet.connected, 
      publicKey: wallet.publicKey?.toBase58(), 
      previousConnected,
      connecting: wallet.connecting,
      wallet: wallet.wallet?.adapter?.name
    });
    
    // Only show toast on connection state changes, not initial load
    if (wallet.connected && !previousConnected && wallet.publicKey) {
      console.log('✅ Wallet connection detected, showing success toast');
      setToast({
        message: `Wallet connected: ${truncateAddress(wallet.publicKey.toBase58())}`,
        type: 'success'
      });
    } else if (!wallet.connected && previousConnected) {
      console.log('❌ Wallet disconnection detected, showing info toast');
      setToast({
        message: 'Wallet disconnected',
        type: 'info'
      });
    }
    
    setPreviousConnected(wallet.connected);
  }, [wallet.connected, wallet.publicKey, previousConnected, wallet.connecting, wallet.wallet]);

  if (!toast) return null;

  return (
    <Toast 
      message={toast.message}
      type={toast.type}
      onClose={() => setToast(null)}
    />
  );
};