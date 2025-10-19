import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { truncateAddress } from '../lib/constants';

export const WalletConnectButton: React.FC = () => {
  const { connected, publicKey, connecting, disconnecting, wallet } = useWallet();
  
  React.useEffect(() => {
    console.log('🔌 WalletConnectButton state:', { connected, connecting, disconnecting, wallet: wallet?.adapter?.name });
  }, [connected, connecting, disconnecting, wallet]);
  
  return (
  <div className="flex flex-col items-center gap-3">
      <WalletMultiButton className="!bg-sky-600 hover:!bg-sky-700 !transition-colors !rounded-md" />
      {connecting && (
        <div className="text-xs text-blue-400 animate-pulse">Connecting...</div>
      )}
      {disconnecting && (
        <div className="text-xs text-orange-400 animate-pulse">Disconnecting...</div>
      )}
      {connected && publicKey && (
        <code className="text-xs bg-gray-700/80 backdrop-blur px-2 py-1 rounded border border-gray-600 text-gray-300 shadow-sm">
          {truncateAddress(publicKey.toBase58())}
        </code>
      )}
    </div>
  );
};
