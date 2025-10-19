#!/bin/bash

# Helper script to fund a wallet address on localnet
# Usage: ./fund-wallet.sh <wallet-address> [amount]

WALLET_ADDRESS=$1
AMOUNT=${2:-2}

if [ -z "$WALLET_ADDRESS" ]; then
    echo "Usage: $0 <wallet-address> [amount-in-sol]"
    echo "Example: $0 ABC123...DEF789 2"
    exit 1
fi

echo "🏦 Funding wallet: $WALLET_ADDRESS"
echo "💰 Amount: $AMOUNT SOL"

# Ensure we're on localnet
solana config set --url http://127.0.0.1:8899

# Fund the wallet
solana transfer $WALLET_ADDRESS $AMOUNT

echo "✅ Done! Check balance with: solana balance $WALLET_ADDRESS"