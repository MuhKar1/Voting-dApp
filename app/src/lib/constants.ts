// Shared constants across the app
export const RPC_ENDPOINT = 'https://api.devnet.solana.com';
export const COMMITMENT = 'confirmed' as const;
export const NETWORK = 'devnet';

// UI utility functions
export const truncateAddress = (address: string, chars = 6) => 
  address.length <= chars * 2 + 3 ? address : `${address.slice(0, chars)}...${address.slice(-chars)}`;

// Common error parsing for Anchor transactions
export const parseAnchorError = async (err: any): Promise<string> => {
  try {
    if (!err) return 'Unknown error';

    // Prefer Anchor structured error message when available
    if (err.error?.errorMessage) return String(err.error.errorMessage);

    // If error has a direct message, return it as fallback
    if (err.message && !err.getLogs) return String(err.message);

    // Try to obtain logs from SendTransactionError if available
    let logs: string[] | null = null;
    if (typeof err.getLogs === 'function') {
      try {
        // getLogs may be async and return an array of strings
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const gl = await err.getLogs();
        if (Array.isArray(gl)) logs = gl;
      } catch (gerr) {
        // ignore getLogs failure
      }
    }

    if (!logs && err.logs && Array.isArray(err.logs)) logs = err.logs;

    const logsText = logs ? logs.join('\n') : '';

    // Common patterns and friendly messages
    if (logsText) {
      // Duplicate vote / account in use
      if (logsText.includes('already in use') || logsText.includes('Allocate: account')) {
        return 'You have already voted on this poll. Each user can only vote once.';
      }

      // Insufficient funds
      if (logsText.toLowerCase().includes('insufficient') || logsText.toLowerCase().includes('insufficient funds')) {
        return 'Insufficient balance to complete this transaction. Try funding your wallet or using Dev Airdrop.';
      }

      // Blockhash expired
      if (logsText.toLowerCase().includes('blockhash') || logsText.toLowerCase().includes('blockhash not found')) {
        return 'Transaction expired (stale blockhash). Please retry.';
      }

      // Generic program error (custom program error)
      if (logsText.toLowerCase().includes('custom program error')) {
        // Try to extract a helpful line from logs
        const progLine = logs!.find(l => l.toLowerCase().includes('program log:')) || logs![logs!.length - 1];
        return `Program error: ${progLine ?? 'See console logs for details.'}`;
      }

      // Any explicit 'error' line
      const explicit = logs!.find(l => /error/i.test(l) || /failed/i.test(l));
      if (explicit) return explicit;
    }

    // Fallbacks: prefer the message property if present
    if (err.message) return String(err.message);

    return 'Transaction failed. See developer console or transaction logs for details.';
  } catch (finalErr) {
    // If our parser fails, return a safe generic message
    return 'An unexpected error occurred while processing the transaction.';
  }
};