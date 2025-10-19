# Evoter: Solana Voting dApp

A decentralized voting application built on Solana blockchain using Anchor framework. Users can create polls, vote on them, and close polls through a React frontend with wallet integration.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
- [Deployment](#deployment)
- [Monitoring and Tracing](#monitoring-and-tracing)
- [API Reference](#api-reference)
- [Troubleshooting](#troubleshooting)
- [Security Considerations](#security-considerations)
- [Contributing](#contributing)
- [License](#license)

## Overview

Evoter is a full-stack decentralized application that enables users to create and participate in polls on the Solana blockchain. The application consists of:

- **Backend**: Anchor program (Rust) deployed on Solana devnet
- **Frontend**: React application with TypeScript, Vite, and Tailwind CSS
- **Wallet Integration**: Phantom wallet support for transaction signing

The smart contract uses Program Derived Addresses (PDAs) to manage poll accounts and prevent double-voting through vote records.

## Features

### Core Functionality
- **Create Polls**: Users can create polls with custom questions and multiple options
- **Vote on Polls**: Authenticated voting with duplicate prevention
- **Close Polls**: Poll creators can close their polls to stop voting
- **Real-time Updates**: Poll results update immediately after votes

### Technical Features
- **Wallet Integration**: Seamless connection with Phantom wallet
- **Transaction Handling**: Robust error handling and transaction confirmation
- **Account Management**: Automatic PDA derivation for polls and vote records
- **Balance Checking**: Real-time SOL balance display and airdrop functionality
- **Responsive UI**: Modern, mobile-friendly interface

### Security Features
- **Duplicate Vote Prevention**: PDA-based vote records prevent multiple votes per user
- **Creator Authorization**: Only poll creators can close their polls
- **Input Validation**: Comprehensive client and program-side validation
- **Transaction Safety**: Fresh blockhash fetching to prevent expiration

## Architecture

### Backend (Anchor Program)

The smart contract is written in Rust using the Anchor framework and consists of three main instructions:

#### Data Structures
- **PollAccount**: Stores poll metadata, options, votes, and status
- **VoteRecord**: Tracks individual votes to prevent duplicates

#### Instructions
- `create_poll`: Initializes a new poll with PDA derivation
- `vote_poll`: Records a vote and updates poll statistics
- `close_poll`: Deactivates a poll (creator-only)

#### Account Derivation
- Poll PDA: `["poll", creator_pubkey, poll_id]`
- Vote Record PDA: `["vote", poll_pubkey, voter_pubkey]`

### Frontend (React Application)

Built with modern React patterns and consists of several key components:

#### Core Components
- **App**: Main application wrapper with wallet providers
- **CreatePollForm**: Poll creation interface with validation
- **PollList**: Displays polls with voting and closing functionality
- **WalletConnectButton**: Wallet connection management

#### Key Features
- **State Management**: React hooks for local state and effects
- **Error Handling**: Comprehensive error parsing and user feedback
- **Transaction Monitoring**: Real-time transaction status updates

## Prerequisites

Before running this application, ensure you have:

### System Requirements
- **Node.js**: v16 or higher
- **Rust**: Latest stable version
- **Solana CLI**: v1.18 or higher
- **Anchor CLI**: v0.31.1 or higher
- **Phantom Wallet**: Browser extension for Solana

### Development Environment
```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/v1.18.4/install)"

# Install Anchor CLI
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install latest
avm use latest

# Install Node.js dependencies
npm install -g yarn
```

## Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd evoter
```

### 2. Backend Setup
```bash
# Install Rust dependencies
cargo build

# Build the Anchor program
anchor build

# Run tests
anchor test
```

### 3. Frontend Setup
```bash
cd app

# Install dependencies
npm install

# Start development server
npm run dev
```

### 4. Wallet Configuration
1. Install Phantom wallet browser extension
2. Create or import a Solana wallet
3. Switch to Devnet network in Phantom settings

## Usage

### Running Locally

1. **Start Solana Validator** (for local development):
```bash
solana-test-validator
```

2. **Deploy Program Locally**:
```bash
anchor deploy
```

3. **Start Frontend**:
```bash
cd app
npm run dev
```

4. **Access Application**:
   - Open http://localhost:5173 in your browser
   - Connect your Phantom wallet
   - Use the devnet airdrop feature to get test SOL

### Creating a Poll

1. Connect your wallet
2. Ensure you have sufficient SOL balance (use airdrop if needed)
3. Fill in the poll question
4. Add at least 2 options (maximum 10)
5. Click "Create Poll"

### Voting on a Poll

1. Browse existing polls in the "Existing Polls" section
2. Click "Vote" next to your chosen option
3. Confirm the transaction in Phantom wallet
4. View updated results immediately

### Closing a Poll

1. As the poll creator, locate your poll
2. Click "Close Poll" button
3. Confirm the transaction
4. Poll will no longer accept votes

## Deployment

### Deploying to Devnet

1. **Configure Solana CLI for Devnet**:
```bash
solana config set --url https://api.devnet.solana.com
solana config get
```

2. **Fund Your Wallet**:
```bash
# Request airdrop (2 SOL for deployment)
solana airdrop 2

# Check balance
solana balance
```

3. **Build and Deploy Program**:
```bash
# Build optimized version
anchor build --provider.cluster devnet

# Deploy to devnet
anchor deploy --provider.cluster devnet
```

4. **Update Program ID**:
   - Note the deployed program ID from deployment output
   - Update `Anchor.toml` and `lib.rs` with the new program ID
   - Rebuild and redeploy if necessary

5. **Build Frontend for Production**:
```bash
cd app
npm run build
```

6. **Deploy Frontend** (using Vercel, Netlify, etc.):
```bash
# Example with Vercel CLI
npm install -g vercel
vercel --prod
```

### Environment Variables

Create a `.env` file in the `app` directory:

```env
VITE_RPC_ENDPOINT=https://api.devnet.solana.com
VITE_COMMITMENT=confirmed
```

## Monitoring and Tracing

### Program Logs

Monitor program execution on devnet:

```bash
# Get program logs
solana logs <PROGRAM_ID> --url https://api.devnet.solana.com

# Monitor specific transactions
solana confirm <TRANSACTION_SIGNATURE> --url https://api.devnet.solana.com
```

### Transaction Tracing

1. **Browser Console**: Check browser developer tools for detailed logs
2. **Phantom Wallet**: View transaction history and status
3. **Solana Explorer**: Use https://explorer.solana.com/ to inspect transactions

### Account Inspection

```bash
# Get account info
solana account <ACCOUNT_PUBKEY> --url https://api.devnet.solana.com

# Get program accounts
solana program show <PROGRAM_ID> --url https://api.devnet.solana.com
```

### Performance Monitoring

- **Transaction Latency**: Monitor confirmation times in browser console
- **Blockhash Freshness**: Check for blockhash expiration errors
- **Balance Updates**: Verify automatic balance refreshing

## API Reference

### Anchor Program Instructions

#### `create_poll(poll_id: u64, question: String, options: Vec<String>)`

Creates a new poll with the specified parameters.

**Parameters:**
- `poll_id`: Unique identifier for the poll (timestamp-based)
- `question`: Poll question (max 200 characters)
- `options`: Array of voting options (2-10 options, max 50 chars each)

**Accounts:**
- `poll`: PDA for poll storage
- `creator`: Transaction signer
- `system_program`: System program for account creation

**Events:** `PollCreated`

#### `vote_poll(option_index: u8)`

Records a vote for the specified poll option.

**Parameters:**
- `option_index`: Index of the chosen option (0-based)

**Accounts:**
- `poll`: Poll account to vote on
- `vote_record`: PDA for vote tracking
- `voter`: Transaction signer
- `creator`: Poll creator (for validation)

**Events:** `Voted`

#### `close_poll()`

Deactivates a poll, preventing further voting.

**Accounts:**
- `poll`: Poll account to close
- `creator`: Poll creator (must match signer)

**Events:** `PollClosed`

### Data Structures

#### PollAccount
```rust
pub struct PollAccount {
    pub creator: Pubkey,
    pub poll_id: u64,
    pub question: String,
    pub options: Vec<String>,
    pub votes: Vec<u64>,
    pub is_active: bool,
    pub bump: u8,
}
```

#### VoteRecord
```rust
pub struct VoteRecord {
    pub voter: Pubkey,
    pub poll: Pubkey,
    pub option_index: u8,
    pub bump: u8,
}
```

### Error Codes

- `NotEnoughOptions`: Minimum 2 options required
- `TooManyOptions`: Maximum 10 options allowed
- `QuestionTooLong`: Question exceeds 200 characters
- `OptionTooLong`: Option exceeds 50 characters
- `EmptyOption`: Empty option strings not allowed
- `PollClosed`: Attempting to vote on closed poll
- `InvalidOption`: Option index out of bounds
- `Unauthorized`: Non-creator attempting to close poll
- `VoteOverflow`: Vote count overflow (theoretical)
- `AlreadyVoted`: User attempting to vote twice

## Troubleshooting

### Common Issues

#### "Blockhash not found" Error
- **Cause**: Transaction blockhash expired
- **Solution**: The app automatically fetches fresh blockhashes; try again

#### "Insufficient balance" Error
- **Cause**: Not enough SOL for transaction fees
- **Solution**: Use the "Dev Airdrop" button or fund wallet via CLI

#### "Program ID mismatch" Error
- **Cause**: Frontend using old program ID after redeployment
- **Solution**: Update program ID in `lib.rs` and rebuild

#### "Already voted" Error
- **Cause**: Attempting to vote multiple times
- **Solution**: Each user can only vote once per poll

#### Wallet Connection Issues
- **Cause**: Phantom wallet not connected or wrong network
- **Solution**: Ensure Phantom is connected and set to Devnet

### Debug Commands

```bash
# Check Solana configuration
solana config get

# Check wallet balance
solana balance

# Check program deployment
solana program show <PROGRAM_ID>

# Monitor logs
solana logs <PROGRAM_ID> --url https://api.devnet.solana.com
```

### Browser Debugging

1. Open Developer Tools (F12)
2. Check Console tab for detailed logs
3. Look for transaction signatures and error messages
4. Verify wallet connection status

## Security Considerations

### Smart Contract Security
- **Access Control**: Creator-only poll closing
- **Input Validation**: Comprehensive parameter checking
- **PDA Security**: Deterministic address derivation prevents conflicts
- **Overflow Protection**: Vote counting with overflow checks

### Frontend Security
- **Wallet Integration**: Secure connection via official adapters
- **Transaction Safety**: User confirmation required for all transactions
- **Input Sanitization**: Client-side validation before submission

### Best Practices
- Always verify transaction details in wallet before signing
- Use devnet for testing before mainnet deployment
- Keep wallet software updated
- Never share private keys

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Run tests: `anchor test`
5. Submit a pull request with detailed description

### Development Guidelines
- Follow Rust and TypeScript best practices
- Add tests for new functionality
- Update documentation for API changes
- Ensure all tests pass before submitting

## License

This project is licensed under the MIT License. See LICENSE file for details.

---

**Program ID (Devnet)**: `At2NcESoMB48ULsY7XPQFHAdjR1B5kEzfkP2Hk7WKrfD`

For support or questions, please open an issue on the GitHub repository.