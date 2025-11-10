import React from 'react'; // React library for building UI components
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'; // Wallet connection providers
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'; // Wallet selection modal
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets'; // Phantom wallet adapter
import { CreatePollForm, PollList, WalletConnectButton, WalletConnectionToast } from './components'; // Custom components
import { useWallet } from '@solana/wallet-adapter-react'; // Wallet state hook
import { RPC_ENDPOINT, COMMITMENT, truncateAddress } from './lib/constants'; // Configuration constants

// Inner component that has access to wallet context
// Separated to ensure wallet context is available
const AppContent: React.FC = () => {
  const wallet = useWallet(); // Access wallet state and methods
  const [refreshSignal, setRefreshSignal] = React.useState(0); // Signal to refresh poll list
  
  const handlePollCreated = React.useCallback(() => { // Handler for poll creation events
    setRefreshSignal(prev => prev + 1); // Increment signal to trigger refresh
  }, []);
  return (
    <>
      <WalletConnectionToast />
      <div className="min-h-screen flex flex-col items-center justify-center gap-8 bg-gradient-to-br from-gray-900 via-slate-800 to-gray-900 px-4">
        <div className="text-center space-y-2">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white">Evoter dApp</h1>
          <p className="text-gray-300">Connect your wallet to begin</p>
        </div>
        
        {!wallet.connected && (
          <div className="w-full max-w-xl mx-auto bg-gray-800/80 backdrop-blur rounded-lg shadow p-6 space-y-6">
            {/* Introductory Message */}
            <div className="text-center space-y-4">
              <h1 className="text-2xl font-bold text-white">Welcome to Evoter</h1>
              <div className="text-gray-300 space-y-3">
                <p>
                  Evoter is a decentralized voting application built on the Solana blockchain using Anchor framework.
                  It allows you to create polls, vote on them, and close polls securely on-chain.
                </p>
                <p>
                  <strong>Why connect your wallet?</strong> To interact with the blockchain, you'll need to connect a Solana-compatible wallet
                  (like Phantom) to sign transactions for creating polls, casting votes, and managing your polls.
                </p>
                <p>
                  <strong>Deployment:</strong> The smart contract is deployed on Solana Devnet for testing and development.
                  All transactions are recorded immutably on the blockchain.
                </p>
              </div>
            </div>

            {/* Wallet Connection Section */}
            <div className="text-center space-y-3">
              <div className="text-gray-300">Connect your wallet to get started.</div>
              {wallet.connecting && <div className="text-xs text-blue-400 animate-pulse">Connecting to wallet...</div>}
            </div>
          </div>
        )}
        
        <WalletConnectButton />
        <div className="text-sm font-medium min-h-[1.5rem]">
          {wallet.publicKey ? (
            <div className="flex items-center gap-3 text-green-400 bg-gray-800/80 backdrop-blur px-3 py-2 rounded-md shadow-sm border border-green-600 animate-in fade-in slide-in-from-top-1">
              <span className="relative flex h-5 w-5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-60 animate-ping" />
                <span className="relative inline-flex h-5 w-5 rounded-full bg-green-500 flex items-center justify-center text-white">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </span>
              </span>
              <span className="font-semibold text-green-300">Wallet Connected</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-red-400 bg-gray-800/80 backdrop-blur px-3 py-2 rounded-md border border-red-600 shadow-sm">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
              <span className="font-medium text-red-300">Wallet Disconnected</span>
            </div>
          )}
        </div>
        <div className="w-full mt-4 flex flex-col gap-8">
          <CreatePollForm onPollCreated={handlePollCreated} />
          {wallet.connected && <PollList refreshSignal={refreshSignal} />}
        </div>
      </div>
    </>
  );
};

// Main App component that provides wallet context
// Wraps the entire app with necessary providers for Solana and wallet functionality
export const App: React.FC = () => {
  const wallets = React.useMemo(() => [ // Memoized wallet adapters array
    new PhantomWalletAdapter() // Only Phantom wallet supported for simplicity
  ], []); // Empty dependency array since wallet config doesn't change

  return (
    <ConnectionProvider endpoint={RPC_ENDPOINT} config={{ commitment: COMMITMENT }}>
      <WalletProvider
        wallets={wallets}
        autoConnect={false}
        localStorageKey="evoter-wallet"
        onError={(error) => {
          console.error('Wallet connection error:', error);
        }}
      >
        <WalletModalProvider>
          <AppContent />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
