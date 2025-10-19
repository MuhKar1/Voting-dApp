import { useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { AnchorProvider, Program, type Idl } from '@coral-xyz/anchor';
import { Connection } from '@solana/web3.js';
import { RPC_ENDPOINT, COMMITMENT } from '../lib/constants';
import idl from '../idl/evoter.json';

const connection = new Connection(RPC_ENDPOINT, COMMITMENT);

export function useAnchorProgram() {
  const wallet = useWallet();

  return useMemo(() => {
    console.log('🏛️ useAnchorProgram called:', {
      connected: wallet.connected,
      publicKey: wallet.publicKey?.toBase58(),
      wallet: wallet.wallet?.adapter?.name,
      hasIdl: !!idl,
      idlAddress: idl?.address,
      endpoint: RPC_ENDPOINT
    });

    if (!wallet.publicKey) {
      console.log('❌ No wallet public key, returning null');
      return null;
    }
    
    try {
      console.log('🔗 Creating AnchorProvider...');
      const provider = new AnchorProvider(connection, wallet as any, { commitment: COMMITMENT });
      
      console.log('📄 IDL details:', {
        hasIdl: !!idl,
        idlAddress: idl?.address,
        idlInstructions: idl?.instructions?.length,
        idlAccounts: idl?.accounts?.length
      });
      
      if (!idl || !idl.address) {
        throw new Error('IDL is missing or malformed');
      }
      
      console.log('🏭 Creating Program...');
      const program = new Program(idl as Idl, provider);
      
      console.log('✅ Program initialized successfully:', {
        programId: program.programId.toBase58(),
        hasMethods: !!program.methods,
        methodNames: Object.keys(program.methods || {})
      });
      
      return program;
    } catch (e: any) {
      console.error('❌ Failed to init Anchor Program:', {
        error: e.message,
        stack: e.stack,
        name: e.name
      });
      return null;
    }
  }, [wallet.publicKey, wallet.connected, wallet]);
}
