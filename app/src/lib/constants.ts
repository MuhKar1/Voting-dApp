// Shared constants across the app
export const RPC_ENDPOINT = 'https://api.devnet.solana.com';
export const COMMITMENT = 'confirmed' as const;
export const NETWORK = 'devnet';

// UI utility functions
export const truncateAddress = (address: string, chars = 6) => 
  address.length <= chars * 2 + 3 ? address : `${address.slice(0, chars)}...${address.slice(-chars)}`;

// Common error parsing for Anchor transactions
export const parseAnchorError = (err: any): string => {
  if (!err) return 'Unknown error';
  if (err.error?.errorMessage) return err.error.errorMessage;
  if (err.message) return err.message;
  // Anchor logs sometimes in logs array
  if (Array.isArray(err.logs)) {
    const anchorLine = err.logs.find((l: string) => l.toLowerCase().includes('error'));
    if (anchorLine) return anchorLine;
  }
  return 'Transaction failed';
};