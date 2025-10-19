import React, { useEffect, useState, useCallback } from 'react'; // React hooks for state and effects
// useCallback prevents unnecessary re-renders of child components
import { PublicKey } from '@solana/web3.js'; // Solana public key type
import { useAnchorProgram } from '../hooks/useAnchorProgram'; // Custom hook for program access
import { useWallet } from '@solana/wallet-adapter-react'; // Wallet state hook
import { truncateAddress, parseAnchorError } from '../lib/constants'; // Utility functions

// TypeScript interface for poll data structure
// Ensures type safety when working with poll data from blockchain
interface PollItemData {
  publicKey: PublicKey; // Poll account address
  creator: string; // Creator's public key as string
  pollId: number; // Unique poll identifier
  question: string; // Poll question text
  options: string[]; // Array of voting options
  votes: number[]; // Vote counts corresponding to options
  isActive: boolean; // Whether poll accepts votes
}

// Main component for displaying and interacting with polls
// Handles fetching, voting, and closing poll functionality
export const PollList: React.FC<{ onSelectPoll?: (pubkey: PublicKey) => void; refreshSignal?: any }> = ({ onSelectPoll, refreshSignal }) => {
  const program = useAnchorProgram(); // Get Anchor program instance
  const wallet = useWallet(); // Access wallet state
  const [polls, setPolls] = useState<PollItemData[]>([]); // Array of poll data
  const [loading, setLoading] = useState(false); // Loading state for fetch operations
  const [error, setError] = useState<string | null>(null); // Error state for user feedback
  const [votingStates, setVotingStates] = useState<Record<string, { loading: boolean; error: string | null }>>({}); // Per-poll voting states
  const [closingStates, setClosingStates] = useState<Record<string, { loading: boolean; error: string | null }>>({}); // Per-poll closing states
  const [pendingTx, setPendingTx] = useState<string | null>(null); // Prevent duplicate transactions

  const fetchPolls = useCallback(async () => { // Memoized function to fetch all polls
    if (!program) return; // Guard clause prevents errors when program not loaded
    setLoading(true); // Set loading state for UI feedback
    setError(null); // Clear previous errors
    try {
      const accounts = await (program.account as any).pollAccount.all(); // Fetch all poll accounts
      // program.account.pollAccount.all() returns all accounts of that type
      const mapped: PollItemData[] = accounts.map((acc: any) => ({ // Transform raw account data
        publicKey: acc.publicKey, // Account public key
        creator: acc.account.creator.toBase58(), // Convert creator pubkey to string
        pollId: Number(acc.account.pollId), // Convert BigNumber to number
        question: acc.account.question as string, // Poll question
        options: acc.account.options as string[], // Voting options array
        votes: (acc.account.votes as any[]).map(v => Number(v)), // Convert vote counts to numbers
        isActive: acc.account.isActive as boolean, // Poll active status
      }));
      mapped.sort((a, b) => b.pollId - a.pollId); // Sort by poll ID descending (newest first)
      setPolls(mapped); // Update state with fetched polls
    } catch (e: any) {
      console.error('fetchPolls error', e); // Error logging
      setError(e.message || 'Failed to load polls'); // User-friendly error message
    } finally {
      setLoading(false); // Clear loading state
    }
  }, [program]); // Dependency on program instance

  const voteOnPoll = useCallback(async (pollPubkey: PublicKey, optionIndex: number) => { // Vote on a specific poll
    if (!program || !wallet.publicKey || !wallet.sendTransaction) return; // Guard clauses

    // Prevent duplicate transactions
    // Critical for preventing double-voting and UI confusion
    if (pendingTx) {
      console.log('⏳ Transaction already pending:', pendingTx); // Debug log
      return; // Exit if transaction in progress
    }

    const pollKey = pollPubkey.toBase58(); // Convert to string for state keys
    setVotingStates(prev => ({ ...prev, [pollKey]: { loading: true, error: null } })); // Set loading state
    setPendingTx(`vote-${pollKey}`); // Mark transaction as pending

    try {
      console.log('🗳️ Voting on poll:', { pollPubkey: pollPubkey.toBase58(), optionIndex }); // Debug logging
      const startTime = Date.now(); // Track operation time

      const pollAccount = await (program.account as any).pollAccount.fetch(pollPubkey); // Fetch poll data
      const creatorPubkey = pollAccount.creator as PublicKey; // Get creator for validation
      console.log('✅ Poll account fetched in', Date.now() - startTime, 'ms'); // Performance logging

      const [voteRecordPda] = PublicKey.findProgramAddressSync( // Derive vote record PDA
        [Buffer.from("vote"), pollPubkey.toBuffer(), wallet.publicKey.toBuffer()], // PDA seeds
        program.programId // Program ID for derivation
      );

      console.log('�� Derived PDAs:', { // Debug derived addresses
        voteRecord: voteRecordPda.toBase58(),
        poll: pollPubkey.toBase58(),
        voter: wallet.publicKey.toBase58(),
        creator: creatorPubkey.toBase58()
      });

      if (!pollAccount.isActive) { // Check if poll is still active
        throw new Error('This poll is closed and no longer accepting votes'); // Clear error message
      }

      if (optionIndex >= pollAccount.options.length) { // Validate option index
        throw new Error(`Invalid option index: ${optionIndex}. Poll only has ${pollAccount.options.length} options.`); // Bounds checking
      }

      const balance = await program.provider.connection.getBalance(wallet.publicKey); // Check voter balance
      const minBalance = 0.002; // Minimum SOL needed for transaction
      if (balance < minBalance * 1e9) { // Convert to lamports for comparison
        throw new Error(`Insufficient balance. You need at least ${minBalance} SOL to vote (you have ${(balance / 1e9).toFixed(4)} SOL).`); // User-friendly error
      }
      console.log('✅ Balance checked in', Date.now() - startTime, 'ms'); // Performance logging

      console.log('📝 Submitting vote transaction...'); // Debug logging
      const signature = await program.methods // Submit vote transaction
        .votePoll(optionIndex) // Call vote_poll instruction
        .accounts({ // Specify required accounts
          poll: pollPubkey, // Poll to vote on
          voteRecord: voteRecordPda, // Vote record PDA
          voter: wallet.publicKey, // Transaction signer
          creator: creatorPubkey, // Poll creator for validation
          systemProgram: PublicKey.default, // System program for account creation
          rent: new PublicKey("SysvarRent111111111111111111111111111111111"), // Rent sysvar
        })
        .rpc(); // Execute transaction

      console.log('✅ Vote transaction submitted in', Date.now() - startTime, 'ms, signature:', signature); // Success logging

      await fetchPolls(); // Refresh poll list to show updated vote counts

    } catch (e: any) {
      console.error('❌ Vote failed:', e); // Error logging
      let errorMsg = parseAnchorError(e) || e.message || 'Failed to vote'; // Parse error
      
      // Handle specific "already processed" error
      // Provides better UX for duplicate transaction attempts
      if (e.message && e.message.includes('already been processed')) {
        errorMsg = 'This transaction was already submitted. Please wait for confirmation.'; // Clear message
      }
      
      setVotingStates(prev => ({ ...prev, [pollKey]: { loading: false, error: errorMsg } })); // Update error state
      return; // Exit without clearing pending state
    } finally {
      setPendingTx(null); // Clear pending transaction flag
    }

    setVotingStates(prev => ({ ...prev, [pollKey]: { loading: false, error: null } })); // Clear loading state on success
  }, [program, wallet, fetchPolls, pendingTx]); // Dependencies for useCallback

  const closePoll = useCallback(async (pollPubkey: PublicKey) => { // Close a poll (creator only)
    if (!program || !wallet.publicKey) return; // Guard clauses

    // Prevent duplicate transactions
    // Ensures only one close operation at a time
    if (pendingTx) {
      console.log('⏳ Transaction already pending:', pendingTx); // Debug log
      return; // Exit if transaction in progress
    }

    const pollKey = pollPubkey.toBase58(); // Convert to string for state keys
    setClosingStates(prev => ({ ...prev, [pollKey]: { loading: true, error: null } })); // Set loading state
    setPendingTx(`close-${pollKey}`); // Mark transaction as pending

    try {
      console.log('🔒 Closing poll:', pollPubkey.toBase58()); // Debug logging

      const signature = await program.methods // Submit close transaction
        .closePoll() // Call close_poll instruction
        .accounts({ // Specify required accounts
          poll: pollPubkey, // Poll to close
          creator: wallet.publicKey, // Must be poll creator
        })
        .rpc(); // Execute transaction

      console.log('✅ Poll closed, signature:', signature); // Success logging

      await fetchPolls(); // Refresh poll list to show updated status

    } catch (e: any) {
      console.error('❌ Close poll failed:', e); // Error logging
      let errorMsg = parseAnchorError(e) || e.message || 'Failed to close poll'; // Parse error
      
      // Handle specific "already processed" error
      // Better UX for duplicate close attempts
      if (e.message && e.message.includes('already been processed')) {
        errorMsg = 'This transaction was already submitted. Please wait for confirmation.'; // Clear message
      }
      
      setClosingStates(prev => ({ ...prev, [pollKey]: { loading: false, error: errorMsg } })); // Update error state
      return; // Exit without clearing pending state
    } finally {
      setPendingTx(null); // Clear pending transaction flag
    }

    setClosingStates(prev => ({ ...prev, [pollKey]: { loading: false, error: null } })); // Clear loading state on success
  }, [program, wallet, fetchPolls, pendingTx]); // Dependencies for useCallback

  useEffect(() => { fetchPolls(); }, [fetchPolls, refreshSignal]); // Fetch polls on mount and refresh signal

  if (!wallet.connected) { // Show different UI when wallet not connected
    return <div className="text-sm text-gray-600">Connect wallet to view polls.</div>; // Clear instruction
  }

  return (
    <div className="w-full max-w-4xl mx-auto bg-gray-800/80 backdrop-blur rounded-lg shadow p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Existing Polls</h2>
        <button onClick={fetchPolls} disabled={loading} className="text-sm px-3 py-1 rounded bg-sky-600 text-white disabled:opacity-50 hover:bg-sky-700">
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      {error && <div className="text-sm text-rose-600">{error}</div>}
      {loading && !polls.length && <div className="text-sm text-gray-500 animate-pulse">Loading polls...</div>}
      {!loading && polls.length === 0 && <div className="text-sm text-gray-500">No polls found.</div>}
      <ul className="space-y-4">
        {polls.map(p => {
          const totalVotes = p.votes.reduce((a, b) => a + b, 0);
          return (
            <li key={p.publicKey.toBase58()} className="border border-gray-600 rounded-md p-4 bg-gray-700 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h3 className="font-medium text-gray-100">{p.question}</h3>
                <div className="flex items-center gap-2 text-xs">
                  <span className={`px-2 py-0.5 rounded ${p.isActive ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-600' : 'bg-gray-600 text-gray-300 border border-gray-500'}`}>
                    {p.isActive ? 'Active' : 'Closed'}
                  </span>
                  {p.isActive && wallet.connected && p.creator === wallet.publicKey?.toBase58() && (
                    <button
                      onClick={() => closePoll(p.publicKey)}
                      disabled={closingStates[p.publicKey.toBase58()]?.loading}
                      className="px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                    >
                      {closingStates[p.publicKey.toBase58()]?.loading ? 'Closing...' : 'Close Poll'}
                    </button>
                  )}
                  <code className="bg-gray-600 text-gray-300 border border-gray-500 px-2 py-0.5 rounded">{truncateAddress(p.publicKey.toBase58())}</code>
                </div>
              </div>
              <div className="space-y-2">
                {p.options.map((opt, idx) => {
                  const count = p.votes[idx] || 0;
                  const percent = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                  const pollKey = p.publicKey.toBase58();
                  const votingState = votingStates[pollKey];
                  const isVoting = votingState?.loading;

                  return (
                    <div key={idx} className="text-sm">
                      <div className="flex justify-between items-center mb-1">
                        <span>{opt}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-300">{count} {count === 1 ? 'vote' : 'votes'} ({percent}%)</span>
                          {p.isActive && wallet.connected && (
                            <button
                              onClick={() => voteOnPoll(p.publicKey, idx)}
                              disabled={isVoting}
                              className="text-xs px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isVoting ? 'Voting...' : 'Vote'}
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="h-2 bg-gray-600 rounded overflow-hidden">
                        <div className="h-full bg-sky-500 transition-all" style={{ width: `${percent}%` }} />
                      </div>
                      {votingState?.error && (
                        <div className="text-xs text-rose-600 mt-1">{votingState.error}</div>
                      )}
                    </div>
                  );
                })}
                {closingStates[p.publicKey.toBase58()]?.error && (
                  <div className="text-xs text-rose-600 mt-2">{closingStates[p.publicKey.toBase58()].error}</div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
