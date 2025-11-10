import React, { useCallback, useEffect, useMemo, useState } from 'react'; // React hooks for state management and effects
// useCallback prevents unnecessary re-renders, useMemo optimizes expensive calculations
import { BN } from '@coral-xyz/anchor'; // BigNumber for Solana's u64 types (handles large numbers safely)
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'; // Core Solana types and constants
import { useWallet, useConnection } from '@solana/wallet-adapter-react'; // Wallet integration hooks
import { useAnchorProgram } from '../hooks/useAnchorProgram'; // Custom hook for Anchor program instance
import { parseAnchorError, truncateAddress, COMMITMENT } from '../lib/constants'; // Utility functions and constants

// Type definition for UI status states - better than string enums for type safety
// Provides clear state management for form submission flow
type UiStatus = { kind: 'idle' } | { kind: 'working'; msg: string } | { kind: 'success'; signature: string; pollPda: string } | { kind: 'error'; msg: string };

// Main component for poll creation - handles form state, validation, and blockchain interaction
export const CreatePollForm: React.FC<{ onPollCreated?: () => void }> = ({ onPollCreated }) => {
  const wallet = useWallet(); // Access wallet state and methods
  const program = useAnchorProgram(); // Get Anchor program instance
  const { connection } = useConnection(); // Solana connection for RPC calls
  const [question, setQuestion] = useState(''); // Poll question state
  const [options, setOptions] = useState<string[]>(['', '']); // Voting options array (starts with 2 empty)
  const [submitting, setSubmitting] = useState(false); // Loading state for form submission
  const [status, setStatus] = useState<UiStatus>({ kind: 'idle' }); // UI status for user feedback
  const [balance, setBalance] = useState<number | null>(null); // User's SOL balance
  const [airdropLoading, setAirdropLoading] = useState(false); // Airdrop request loading state
  const [pendingTx, setPendingTx] = useState<string | null>(null); // Prevent duplicate transactions

  // Fetch balance whenever wallet changes or after tx
  // Automatic balance updates provide real-time feedback to users
  useEffect(() => {
    let active = true; // Prevent state updates on unmounted component
    const fetchBalance = async () => {
      if (wallet.publicKey) {
        try {
          console.log('💰 Fetching balance for wallet:', wallet.publicKey.toBase58()); // Debug logging for development
          console.log('🔗 Copy this address to fund with CLI:', wallet.publicKey.toBase58()); // Easy copy for funding
          const lamports = await connection.getBalance(wallet.publicKey); // Get balance in lamports
          const solBalance = lamports / 1_000_000_000; // Convert to SOL (1 SOL = 1e9 lamports)
          console.log('💰 Balance result:', solBalance, 'SOL'); // Log converted balance
          
          // Also log as a single line for easy copying
          console.log(`WALLET_ADDRESS=${wallet.publicKey.toBase58()}`); // CLI-friendly format
          if (active) setBalance(solBalance); // Update state only if component still mounted
        } catch (e) {
          console.error('❌ Balance fetch failed:', e); // Error logging
          if (active) setBalance(null); // Clear balance on error
        }
      } else {
        setBalance(null); // Clear balance when wallet disconnected
      }
    };
    fetchBalance(); // Execute balance fetch
    return () => { active = false; }; // Cleanup function prevents memory leaks
  }, [wallet.publicKey, connection, status]); // Dependencies: refetch on wallet change or status update

  const addOption = () => setOptions(o => [...o, '']); // Add new empty option to array
  const updateOption = (i: number, val: string) => setOptions(o => o.map((v, idx) => idx === i ? val : v)); // Update specific option
  const removeOption = (i: number) => setOptions(o => o.length > 2 ? o.filter((_, idx) => idx !== i) : o); // Remove option (minimum 2)

  // Memoized cleaned options - filters empty strings and trims whitespace
  // Prevents unnecessary recalculations on every render
  const cleanedOptions = useMemo(() => options.map(o => o.trim()).filter(Boolean), [options]);

  // Memoized duplicate check - compares lowercase versions for case-insensitive detection
  // Efficient duplicate prevention without case sensitivity issues
  const duplicateOption = useMemo(() => {
    const lower = cleanedOptions.map(o => o.toLowerCase());
    return lower.some((opt, idx) => lower.indexOf(opt) !== idx);
  }, [cleanedOptions]);

  // Memoized form validation - combines all validation rules
  // Centralized validation logic prevents form submission with invalid data
  const canSubmit = question.trim().length > 0 && cleanedOptions.length >= 2 && !duplicateOption && !!program && !!wallet.publicKey;

  // Debug canSubmit state
  // Console logging helps developers understand form validation state during development
  React.useEffect(() => {
    console.log('🔍 canSubmit state:', {
      canSubmit,
      questionLength: question.trim().length,
      cleanedOptionsCount: cleanedOptions.length,
      duplicateOption,
      hasProgram: !!program,
      hasWallet: !!wallet.publicKey,
      walletConnected: wallet.connected
    });
  }, [canSubmit, question, cleanedOptions, duplicateOption, program, wallet.publicKey, wallet.connected]);

  // Airdrop function for devnet testing
  // Allows users to get test SOL without leaving the app
  const requestAirdrop = useCallback(async () => {
    if (!wallet.publicKey) return; // Guard clause prevents errors
    setAirdropLoading(true); // Set loading state for UI feedback
    console.log('💧 Requesting airdrop for:', wallet.publicKey.toBase58()); // Debug logging
    try {
      const sig = await connection.requestAirdrop(wallet.publicKey, 1_000_000_000); // Request 1 SOL
      console.log('💧 Airdrop signature:', sig); // Log transaction signature
      await connection.confirmTransaction(sig, COMMITMENT); // Wait for confirmation
      console.log('✅ Airdrop confirmed'); // Success confirmation
      // Force balance refresh by updating a dependency
      const newBalance = await connection.getBalance(wallet.publicKey); // Get updated balance
      setBalance(newBalance / 1_000_000_000); // Update state with new balance
    } catch (e: any) {
      console.error('❌ Airdrop failed:', e); // Error logging
      setStatus({ kind: 'error', msg: `Airdrop failed: ${e.message}` }); // User-friendly error
    } finally {
      setAirdropLoading(false); // Clear loading state
    }
  }, [wallet.publicKey, connection]); // Dependencies for useCallback



  const onSubmit = async (e: React.FormEvent) => { // Main form submission handler
    console.log('📝 Form onSubmit called!'); // Debug logging for form submission
    e.preventDefault(); // Prevent default form behavior (page reload)
    
    if (!canSubmit || !program || !wallet.publicKey) { // Final validation check
      console.log('❌ Submit blocked:', { canSubmit, program: !!program, wallet: !!wallet.publicKey }); // Debug why blocked
      return; // Exit early if validation fails
    }

    // Prevent duplicate transactions
    // Critical for UX - prevents multiple submissions while one is processing
    if (pendingTx) {
      console.log('⏳ Transaction already pending:', pendingTx); // Log pending transaction
      return; // Exit if transaction already in progress
    }

    setSubmitting(true); // Set loading state for UI
    setStatus({ kind: 'working', msg: 'Deriving PDA...' }); // Update status for user feedback
    setPendingTx('create-poll'); // Mark transaction as pending
    
    console.log('🚀 Starting poll creation...'); // Debug start of process
    console.log('📊 Question:', question); // Log poll data
    console.log('📝 Options:', cleanedOptions); // Log options
    console.log('💰 Balance:', balance, 'SOL'); // Log current balance
    
    try {
      const pollId = new BN(Date.now()); // simple unique id (ms timestamp)
      // Using timestamp provides uniqueness without external dependencies
      const pollIdBytes = pollId.toArrayLike(Buffer, 'le', 8); // Convert to little-endian bytes for PDA
      const [pollPda, bump] = await PublicKey.findProgramAddress( // Derive PDA deterministically
        [Buffer.from('poll'), wallet.publicKey.toBuffer(), pollIdBytes], // PDA seeds
        program.programId // Program ID for derivation
      );

      console.log('🔑 PDA derived:', pollPda.toBase58()); // Log derived address
      console.log('📋 Poll ID:', pollId.toString()); // Log poll ID
      console.log('🏷️ Bump:', bump); // Log bump value
      console.log('🏛️ Program ID:', program.programId.toBase58()); // Log program ID

      setStatus({ kind: 'working', msg: 'Checking account requirements...' }); // Update status
      
      // Check if PDA account already exists
      // Prevents attempting to create account that already exists
      try {
        const existingAccount = await connection.getAccountInfo(pollPda); // Query account info
        if (existingAccount) {
          throw new Error(`Poll account already exists at ${pollPda.toBase58()}`); // Clear error message
        }
      } catch (checkErr: any) {
        if (!checkErr.message.includes('already exists')) { // If error is not "already exists"
          console.log('✅ PDA account does not exist (good)'); // Log success
        } else {
          throw checkErr; // Re-throw if account exists
        }
      }

      // Estimate rent for poll account (conservative estimate)
      // Ensures user has enough SOL for account creation
      const estimatedSize = 8 + 32 + 8 + (4 + question.length) + (4 + cleanedOptions.reduce((sum, opt) => sum + 4 + opt.length, 0)) + (4 + cleanedOptions.length * 8) + 1 + 1 + 32; // padding
      const rentExemption = await connection.getMinimumBalanceForRentExemption(estimatedSize); // Get rent cost
      console.log('💰 Estimated account size:', estimatedSize, 'bytes'); // Log size calculation
      console.log('💰 Rent exemption required:', rentExemption / 1e9, 'SOL'); // Log rent in SOL
      
      if (balance && balance < (rentExemption / 1e9) + 0.001) { // Extra 0.001 SOL for transaction fees
        throw new Error(`Insufficient balance. Need ${(rentExemption / 1e9 + 0.001).toFixed(4)} SOL, have ${balance.toFixed(4)} SOL. Use Dev Airdrop.`); // User-friendly error
      }

      setStatus({ kind: 'working', msg: 'Sending transaction...' }); // Update status for transaction

      // Get fresh blockhash right before sending
      // Critical for preventing "blockhash not found" errors on devnet
      console.log('🔄 Fetching fresh blockhash...'); // Debug logging
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed'); // Get fresh blockhash
      console.log('✅ Fresh blockhash obtained'); // Confirm success

      // Submit transaction using Anchor's rpc method
      // Handles signing, sending, and confirmation automatically
      const signature: string = await (program.methods as any) // Type assertion for Anchor methods
        .createPoll(pollId, question, cleanedOptions) // Call createPoll instruction
        .accounts({ // Specify account addresses
          poll: pollPda, // Poll account to create
          creator: wallet.publicKey, // Transaction signer
          systemProgram: SystemProgram.programId, // System program for account creation
          rent: SYSVAR_RENT_PUBKEY, // Rent sysvar
        })
        .rpc({ // Execute transaction
          skipPreflight: false, // Enable preflight checks for safety
          preflightCommitment: 'confirmed' // Use confirmed commitment for reliability
        });

      console.log('✅ Transaction successful!'); // Success logging
      console.log('📝 Signature:', signature); // Log transaction signature
      console.log('🏠 Poll PDA:', pollPda.toBase58()); // Log poll address
      
      setStatus({ kind: 'success', signature, pollPda: pollPda.toBase58() }); // Update status with success
      setQuestion(''); // Clear form
      setOptions(['', '']); // Reset options
      
      // Notify parent component to refresh poll list
      // Enables immediate display of newly created poll
      onPollCreated?.();
    } catch (err: any) { // Catch all errors from poll creation process
      console.error('❌ create_poll error', err); // Comprehensive error logging
      console.log('📊 Error details:', { // Detailed error information for debugging
        message: err.message,
        logs: err.logs, // Solana program logs
        programErrorStack: err.programErrorStack, // Program error details
        transactionMessage: err.transactionMessage // Transaction error message
      });
      
      // Enhanced error parsing for common Anchor/Solana errors
      // Provides user-friendly error messages instead of technical errors
      let errorMsg = 'Failed to create poll';
      try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        errorMsg = await parseAnchorError(err) || err.message || errorMsg;
      } catch (pe) {
        errorMsg = err.message || errorMsg;
      }

      if (err.message?.includes('0x1')) { // Insufficient funds error code
        errorMsg = 'Insufficient funds for account creation. Try using Dev Airdrop first.'; // Clear guidance
      } else if (err.message?.includes('0x0')) { // Account creation error
        errorMsg = 'Account already exists or invalid PDA derivation.'; // Specific error
      } else if (err.message?.includes('blockhash')) { // Blockhash expiration
        errorMsg = 'Transaction expired. Please try again.'; // Retry suggestion
      } else if (err.message?.includes('already been processed')) { // Duplicate transaction
        errorMsg = 'This transaction was already submitted. Please wait for confirmation.'; // Wait message
      }

      setStatus({ kind: 'error', msg: errorMsg }); // Update UI with error
    } finally { // Always execute cleanup
      setSubmitting(false); // Clear loading state
      setPendingTx(null); // Clear pending transaction flag
    }
  };

  if (!wallet.connected) {
    return null; // Welcome message is now shown in App.tsx
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-xl mx-auto bg-gray-800/80 backdrop-blur rounded-lg shadow p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Create Poll</h2>
        <div className="text-xs text-gray-400 space-x-2 flex items-center flex-wrap">
          {wallet.publicKey && (
            <div className="flex items-center gap-2">
              <code className="bg-blue-900/50 text-blue-300 border border-blue-600 rounded px-2 py-1 text-[10px]">
                {truncateAddress(wallet.publicKey.toBase58(), 4)}
              </code>
              {balance !== null && balance < 0.01 && (
                <div className="text-[10px] text-orange-400 bg-orange-900/50 border border-orange-600 rounded px-2 py-1">
                  ⚠️ Low balance! Fund via CLI: <code className="font-mono">solana transfer {wallet.publicKey.toBase58()} 1</code>
                </div>
              )}
            </div>
          )}
          {balance !== null && (
            <span className={`inline-flex items-center gap-1 rounded px-2 py-1 ${balance < 0.01 ? 'bg-red-100 text-red-700' : 'bg-gray-100'}`}>
              Balance: <strong>{balance.toFixed(4)}</strong> SOL
            </span>
          )}
          <button type="button" disabled={!wallet.publicKey || airdropLoading} onClick={requestAirdrop} className="text-[11px] px-2 py-1 rounded bg-emerald-600 text-white disabled:opacity-50 hover:bg-emerald-700">
            {airdropLoading ? 'Airdropping...' : 'Dev Airdrop'}
          </button>
          <button
            type="button"
            disabled={!wallet.publicKey}
            onClick={() => {
              if (wallet.publicKey) {
                connection.getBalance(wallet.publicKey).then(lamports => {
                  setBalance(lamports / 1_000_000_000);
                  console.log('🔄 Manual balance refresh:', lamports / 1_000_000_000, 'SOL');
                });
              }
            }}
            className="text-[11px] px-2 py-1 rounded bg-blue-600 text-white disabled:opacity-50 hover:bg-blue-700"
          >
            🔄
          </button>
          <button
            type="button"
            disabled={!wallet.publicKey}
            onClick={() => {
              if (wallet.publicKey) {
                navigator.clipboard.writeText(wallet.publicKey.toBase58());
                setStatus({ kind: 'success', signature: 'copied', pollPda: 'Address copied to clipboard' });
                setTimeout(() => setStatus({ kind: 'idle' }), 2000);
              }
            }}
            className="text-[11px] px-2 py-1 rounded bg-purple-600 text-white disabled:opacity-50 hover:bg-purple-700"
            title="Copy wallet address to clipboard"
          >
            📋
          </button>
        </div>
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-200">Question</label>
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
          placeholder="Your question"
          maxLength={200}
        />
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-200">Options</span>
          <button type="button" onClick={addOption} className="text-sky-600 text-sm hover:underline">Add</button>
        </div>
        <div className="space-y-2">
          {options.map((opt, i) => (
            <div key={i} className="flex gap-2 items-center">
              <input
                value={opt}
                onChange={e => updateOption(i, e.target.value)}
                className="flex-1 rounded border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-500"
                placeholder={`Option ${i + 1}`}
                maxLength={50}
              />
              {options.length > 2 && (
                <button type="button" onClick={() => removeOption(i)} className="text-xs px-2 py-1 bg-rose-500 text-white rounded hover:bg-rose-600">X</button>
              )}
            </div>
          ))}
          {duplicateOption && (
            <div className="text-xs text-rose-600">Duplicate options detected (case-insensitive). Please make each option unique.</div>
          )}
        </div>
      </div>
      <button
        type="submit"
        disabled={!canSubmit || submitting}
        className="w-full inline-flex items-center justify-center gap-2 rounded bg-sky-600 text-white py-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-sky-700 transition"
        onClick={(e) => {
          console.log('🔘 Create Poll button clicked!');
          console.log('📊 Form state:', { canSubmit, submitting, question, cleanedOptions, program: !!program, wallet: !!wallet.publicKey });
        }}
      >
        {submitting ? 'Creating...' : 'Create Poll'}
      </button>
      {!canSubmit && !submitting && (
        <div className="text-xs text-gray-400 mt-1">
          {!wallet.publicKey ? '🔐 Connect wallet first' :
           !program ? '⚙️ Program not loaded' :
           question.trim().length === 0 ? '❓ Enter a question' :
           cleanedOptions.length < 2 ? '📝 Need at least 2 options' :
           duplicateOption ? '⚠️ Remove duplicate options' : '✅ Ready to create'}
        </div>
      )}
      {status.kind === 'working' && (
        <div className="text-sm text-sky-600 animate-pulse">{status.msg}</div>
      )}
      {status.kind === 'success' && (
        <div className="text-sm text-emerald-600 space-y-1">
          <div>Poll created successfully.</div>
          <div className="font-mono break-all">Poll PDA: {truncateAddress(status.pollPda, 8)}</div>
          <div className="font-mono break-all">Sig: {truncateAddress(status.signature, 8)}</div>
        </div>
      )}
      {status.kind === 'error' && (
        <div className="text-sm text-rose-600">{status.msg}</div>
      )}
    </form>
  );
};
