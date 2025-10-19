use anchor_lang::prelude::*; // Import Anchor framework prelude for Solana program development
// This provides essential types like Context, Account, Signer, and error handling macros
// Using prelude is efficient as it imports commonly used items without verbose imports

declare_id!("At2NcESoMB48ULsY7XPQFHAdjR1B5kEzfkP2Hk7WKrfD"); // Declare the program's on-chain address
// This ID is generated during deployment and must match the deployed program
// Hardcoding it here ensures the program knows its own address for PDA derivation

#[program] // Macro that defines this module as the main program entry point
// Anchor automatically generates the program's instruction handlers from functions in this module
pub mod evoter { // Main program module containing all voting logic
    use super::*; // Bring parent module items into scope for cleaner code

    // create_poll instruction: Allows users to create new polls with multiple options
    // Uses PDA for deterministic addressing and prevents address collisions
    pub fn create_poll(
        ctx: Context<CreatePoll>, // Context provides access to accounts and program state
        poll_id: u64, // Unique identifier for the poll (timestamp-based for uniqueness)
        question: String, // The poll question text
        options: Vec<String>, // Vector of voting options (flexible length)
    ) -> Result<()> { // Returns Result for error handling
        // Input validation: Ensure poll meets minimum requirements
        // Prevents invalid polls that could cause runtime errors or waste resources
        require!(options.len() >= 2, VotingError::NotEnoughOptions); // Minimum 2 options for meaningful poll
        require!(options.len() <= PollAccount::MAX_OPTIONS, VotingError::TooManyOptions); // Prevent excessive storage usage
        require!(question.len() <= PollAccount::MAX_QUESTION_LEN, VotingError::QuestionTooLong); // Prevent spam/long questions
        for opt in &options { // Validate each option individually
            require!(opt.len() <= PollAccount::MAX_OPTION_LEN, VotingError::OptionTooLong); // Consistent option length limits
            require!(opt.len() > 0, VotingError::EmptyOption); // Prevent empty options that confuse voters
        }

        let poll = &mut ctx.accounts.poll; // Mutable reference to poll account for initialization

        // Initialize poll state with provided data
        // Setting fields explicitly ensures all data is properly stored
        poll.creator = ctx.accounts.creator.key(); // Store creator for authorization checks
        poll.poll_id = poll_id; // Unique identifier for poll lookup
        poll.question = question; // The actual question text
        poll.options = options.clone(); // Copy options vector to account
        poll.votes = vec![0u64; options.len()]; // Initialize vote counts to zero for each option
        poll.is_active = true; // New polls start active to accept votes
        poll.bump = ctx.bumps.poll; // Store bump for PDA recreation (security best practice)

        // Emit event for off-chain indexing and monitoring
        // Events provide transparency and enable external services to track poll creation
        emit!(PollCreated {
            poll: poll.key(), // Poll account address
            creator: poll.creator, // Who created the poll
            poll_id, // Poll identifier
            option_count: poll.options.len() as u8, // Number of options
            ts: Clock::get()?.unix_timestamp, // Creation timestamp for ordering
        });

        Ok(()) // Return success - poll created successfully
    }

    // vote_poll instruction: Records a vote for a specific poll option
    // Uses PDA-based vote records to prevent double voting
    // Atomic operation ensures vote is recorded and count updated together
    pub fn vote_poll(ctx: Context<VotePoll>, option_index: u8) -> Result<()> {
        let poll = &mut ctx.accounts.poll; // Mutable reference to update vote counts
        let voter = &ctx.accounts.voter; // Reference to voter account for event emission

        // Validate poll is still accepting votes
        // Prevents voting on closed polls which could manipulate results
        require!(poll.is_active, VotingError::PollClosed);

        // Validate option index is within bounds
        // Prevents out-of-bounds access that could cause runtime panics
        require!((option_index as usize) < poll.options.len(), VotingError::InvalidOption);

        // Initialize vote record fields (Anchor handles account creation with init constraint)
        // VoteRecord PDA ensures one vote per user per poll
        let vote_record = &mut ctx.accounts.vote_record;
        vote_record.voter = ctx.accounts.voter.key(); // Store voter identity
        vote_record.poll = poll.key(); // Link to specific poll
        vote_record.option_index = option_index; // Record chosen option
        vote_record.bump = ctx.bumps.vote_record; // Store bump for security

        // Create vote record (init in account validation) — prevents double voting
        // PDA derivation ensures unique record per voter-poll combination
        let idx = option_index as usize;
        poll.votes[idx] = poll
            .votes[idx]
            .checked_add(1) // Use checked_add to prevent overflow
            .ok_or(VotingError::VoteOverflow)?; // Handle theoretical overflow gracefully

        // Emit vote event for transparency and external tracking
        // Allows off-chain services to monitor voting activity
        emit!(Voted {
            poll: poll.key(), // Poll being voted on
            voter: voter.key(), // Who voted
            option_index, // Which option was chosen
            ts: Clock::get()?.unix_timestamp, // Vote timestamp
        });

        Ok(()) // Vote recorded successfully
    }

    // close_poll instruction: Deactivates a poll to stop accepting votes
    // Only the poll creator can close their poll
    // Prevents manipulation by closing polls at desired times
    pub fn close_poll(ctx: Context<ClosePoll>) -> Result<()> {
        let poll = &mut ctx.accounts.poll; // Mutable reference to update poll status
        let creator = &ctx.accounts.creator; // Reference to creator for authorization

        // Authorization check: Only poll creator can close
        // Prevents unauthorized users from closing others' polls
        require_keys_eq!(poll.creator, creator.key(), VotingError::Unauthorized);

        // Ensure poll is still active before closing
        // Prevents double-closing and provides clear error messages
        require!(poll.is_active, VotingError::PollAlreadyClosed);

        // Deactivate the poll
        // Simple boolean flag prevents further voting
        poll.is_active = false;

        // Emit close event for transparency
        // Allows external monitoring of poll lifecycle
        emit!(PollClosed {
            poll: poll.key(), // Poll being closed
            creator: creator.key(), // Who closed it
            ts: Clock::get()?.unix_timestamp, // Close timestamp
        });

        Ok(()) // Poll closed successfully
    }
}

// -------------------- Accounts --------------------

/// CreatePoll uses a PDA for poll to make address deterministic:
/// seeds = ["poll", creator, poll_id_le_bytes]
// PDA ensures predictable addresses and prevents address collisions
#[derive(Accounts)] // Macro generates account validation logic
#[instruction(poll_id: u64)] // Pass poll_id to account validation for PDA derivation
pub struct CreatePoll<'info> { // Struct defining accounts required for create_poll
    #[account( // Account macro specifies validation and initialization rules
        init, // Initialize new account if it doesn't exist
        payer = creator, // Creator pays for account rent
        space = PollAccount::calculate_max_space(), // Allocate maximum possible space
        seeds = [b"poll", creator.key().as_ref(), &poll_id.to_le_bytes()], // PDA seeds for deterministic address
        bump // Anchor calculates and validates bump automatically
    )]
    pub poll: Account<'info, PollAccount>, // The poll account being created

    #[account(mut)] // Account will be modified (pays for creation)
    pub creator: Signer<'info>, // Transaction signer and poll creator

    pub system_program: Program<'info, System>, // Required for account creation
    pub rent: Sysvar<'info, Rent>, // Rent sysvar for validation (though Anchor handles this)
}

#[derive(Accounts)] // Account validation for vote_poll instruction
#[instruction(option_index: u8)] // Pass option_index for validation context
pub struct VotePoll<'info> {
    /// Poll must be mutable so we can update votes.
    /// VoteRecord is a PDA (initialized here) used to prevent double voting:
    /// seeds = ["vote", poll.key(), voter.key()]
    // PDA ensures one vote record per voter per poll
    #[account(mut, has_one = creator)] // Mutable for vote updates, validates creator matches
    pub poll: Account<'info, PollAccount>, // Poll account to vote on

    #[account( // Vote record PDA to track individual votes
        init, // Create new account for each vote
        payer = voter, // Voter pays for their vote record
        space = VoteRecord::SIZE, // Fixed size for vote records
        seeds = [b"vote", poll.key().as_ref(), voter.key().as_ref()], // Unique per voter-poll
        bump // Automatic bump calculation
    )]
    pub vote_record: Account<'info, VoteRecord>, // Vote tracking account

    #[account(mut)] // Mutable as voter pays for vote record creation
    pub voter: Signer<'info>, // Transaction signer casting the vote

    /// CHECK: This is the creator pubkey for has_one check.
    // Unchecked account since we only use it for validation
    pub creator: UncheckedAccount<'info>, // Poll creator for validation

    pub system_program: Program<'info, System>, // For account creation
    pub rent: Sysvar<'info, Rent>, // Rent sysvar (Anchor handles validation)
}

#[derive(Accounts)] // Account validation for close_poll instruction
pub struct ClosePoll<'info> {
    #[account(mut)] // Mutable to update is_active flag
    pub poll: Account<'info, PollAccount>, // Poll to be closed

    #[account(mut)] // Mutable as signer (though not directly modified)
    pub creator: Signer<'info>, // Must be poll creator
}

// -------------------- Data Structures --------------------

#[account] // Macro makes this a Solana account that can be serialized/deserialized
pub struct PollAccount { // Main poll data structure stored on-chain
    pub creator: Pubkey, // Poll creator's public key for authorization
    pub poll_id: u64, // Unique poll identifier
    pub question: String, // The poll question text
    pub options: Vec<String>, // Vector of voting options
    pub votes: Vec<u64>, // Vote counts corresponding to options
    pub is_active: bool, // Whether poll accepts new votes
    pub bump: u8, // PDA bump for address recreation
}

/* Conservative constants */ // Fixed limits prevent abuse and ensure predictable costs
impl PollAccount { // Implementation block for PollAccount
    pub const MAX_OPTIONS: usize = 10; // Reasonable limit prevents storage bloat
    pub const MAX_QUESTION_LEN: usize = 200; // Sufficient for detailed questions
    pub const MAX_OPTION_LEN: usize = 50; // Keeps options concise and readable

    // Calculate a safe, conservative max space for the account.
    // Over-estimating space prevents allocation failures
    pub fn calculate_max_space() -> usize {
        // discriminator: 8 bytes for Anchor account identification
        let mut size = 8;
        // creator pubkey: 32 bytes for Solana public key
        size += 32;
        // poll_id: 8 bytes for u64
        size += 8;
        // question: string (4 bytes length + bytes): Vec prefix + max content
        size += 4 + Self::MAX_QUESTION_LEN;
        // options: vector (4 bytes len + each option: 4 bytes len + bytes)
        // MAX_OPTIONS * (4 + MAX_OPTION_LEN) covers all options
        size += 4 + (Self::MAX_OPTIONS * (4 + Self::MAX_OPTION_LEN));
        // votes: vector (4 bytes len + MAX_OPTIONS * 8): u64 per vote count
        size += 4 + (Self::MAX_OPTIONS * 8);
        // is_active: 1 byte for boolean
        size += 1;
        // bump: 1 byte for PDA bump
        size += 1;
        // padding (safety): Extra space for future fields or alignment
        size += 32;
        size // Return total calculated size
    }
}

#[account] // Account macro for VoteRecord
pub struct VoteRecord { // Tracks individual votes to prevent double voting
    pub voter: Pubkey, // Who cast the vote
    pub poll: Pubkey, // Which poll was voted on
    pub option_index: u8, // Which option was chosen (0-based index)
    pub bump: u8, // PDA bump for security
}

impl VoteRecord { // Implementation for VoteRecord
    // fixed size: discriminator(8) + voter(32) + poll(32) + option_index(1) + bump(1)
    // Pre-calculated size ensures consistent account allocation
    pub const SIZE: usize = 8 + 32 + 32 + 1 + 1; // 74 bytes total
}

// -------------------- Events --------------------

#[event] // Macro defines this as an event that can be emitted
pub struct PollCreated { // Event emitted when a new poll is created
    pub poll: Pubkey, // Address of the created poll
    pub creator: Pubkey, // Who created the poll
    pub poll_id: u64, // Unique poll identifier
    pub option_count: u8, // Number of voting options
    pub ts: i64, // Unix timestamp of creation
}

#[event] // Event for vote recording
pub struct Voted { // Event emitted when a vote is cast
    pub poll: Pubkey, // Poll that received the vote
    pub voter: Pubkey, // Who cast the vote
    pub option_index: u8, // Which option was chosen
    pub ts: i64, // Unix timestamp of vote
}

#[event] // Event for poll closure
pub struct PollClosed { // Event emitted when a poll is closed
    pub poll: Pubkey, // Poll that was closed
    pub creator: Pubkey, // Who closed the poll
    pub ts: i64, // Unix timestamp of closure
}

// -------------------- Errors --------------------
#[error_code] // Macro generates error handling code
pub enum VotingError { // Custom error enum for voting-specific errors
    #[msg("Not enough options provided (minimum 2).")] // User-friendly error message
    NotEnoughOptions, // Enforce minimum meaningful poll options
    #[msg("Too many options provided.")]
    TooManyOptions, // Prevent storage abuse and UI complexity
    #[msg("Question string too long.")]
    QuestionTooLong, // Prevent spam and ensure readability
    #[msg("Option string too long.")]
    OptionTooLong, // Keep options concise
    #[msg("Empty option is not allowed.")]
    EmptyOption, // Prevent confusing empty choices
    #[msg("Poll is already closed.")]
    PollClosed, // Clear feedback for closed polls
    #[msg("Poll is already closed or not active.")]
    PollAlreadyClosed, // Prevent double-closing
    #[msg("Invalid option index.")]
    InvalidOption, // Handle out-of-bounds voting attempts
    #[msg("Only the poll creator can close this poll.")]
    Unauthorized, // Authorization error for poll management
    #[msg("Vote count overflow.")]
    VoteOverflow, // Theoretical overflow protection
    #[msg("User has already voted on this poll.")]
    AlreadyVoted, // Double-voting prevention feedback
}
