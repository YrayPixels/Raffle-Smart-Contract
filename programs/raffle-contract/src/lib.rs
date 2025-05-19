use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("9WVXrk3G4XLiKtaqCpViTgNuUodMLaGsqnGqhzPqxrKC");

#[program]
pub mod raffle_contract {
    use super::*;

    pub fn initialize_raffle(
        ctx: Context<InitializeRaffle>,
        nft_mint: Pubkey,
        entry_fee: u64,
        max_entries: u8,
    ) -> Result<()> {
        let raffle = &mut ctx.accounts.raffle;
        raffle.entry_fee = entry_fee;
        raffle.max_entries = max_entries;
        raffle.nft_mint = nft_mint;
        raffle.creator = ctx.accounts.creator.key();
        raffle.entries = Vec::new();
        raffle.is_active = true;
        Ok(())
    }

    pub fn enter_raffle(ctx: Context<EnterRaffle>) -> Result<()> {
        let raffle = &mut ctx.accounts.raffle;

        // Check if raffle is active
        require!(raffle.is_active, RaffleError::RaffleNotActive);

        // Check if max entries reached
        require!(
            raffle.entries.len() < raffle.max_entries as usize,
            RaffleError::MaxEntriesReached
        );

        // Check if entry fee is correct
        require!(
            ctx.accounts.participants.lamports >= raffle.entry_fee,
            RaffleError::InsufficientEntryFee
        );

        // Add participant to entries
        raffle.entries.push(ctx.accounts.participant.key());

        // Transfer entry fee to creator
        let transfer_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.participant.to_account_info(),
                to: ctx.accounts.creator.to_account_info(),
            },
        );
        anchor_lang::system_program::transfer(transfer_ctx, raffle.entry_fee)?;

        Ok(())
    }

    pub fn pick_winner(ctx: Context<PickWinner>) -> Result<()> {
        let raffle = &mut ctx.accounts.raffle;

        // Check if raffle is active
        require!(raffle.is_active, RaffleError::RaffleNotActive);

        // Check if there are entries
        require!(!raffle.entries.is_empty(), RaffleError::NoEntries);

        // Generate random number using current slot as seed
        let clock = Clock::get()?;
        let seed = clock.slot.to_le_bytes();
        let winner_index = (seed[0] as usize) % raffle.entries.len();
        let winner = raffle.entries[winner_index];

        // Transfer NFT to winner
        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.nft_token_account.to_account_info(),
                to: ctx.accounts.winner_token_account.to_account_info(),
                authority: ctx.accounts.creator.to_account_info(),
            },
        );
        token::transfer(transfer_ctx, 1)?;

        // Deactivate raffle
        raffle.is_active = false;

        Ok(())
    }

    pub fn close_raffle(ctx: Context<CloseRaffle>) -> Result<()> {
        let raffle = &mut ctx.accounts.raffle;

        // Only creator can close raffle
        require!(
            raffle.creator == ctx.accounts.creator.key(),
            RaffleError::Unauthorized
        );

        // Deactivate raffle
        raffle.is_active = false;

        Ok(())
    }
}

#[account]
pub struct Raffle {
    pub entry_fee: u64,
    pub max_entries: u8,
    pub entries: Vec<Pubkey>,
    pub nft_mint: Pubkey,
    pub creator: Pubkey,
    pub is_active: bool,
}

#[derive(Accounts)]
pub struct InitializeRaffle<'info> {
    #[account(init, payer = creator, space = 8 + 8 + 1 + 4 + 32 + 32 + 1 + 4 + (32 * 100))]
    pub raffle: Account<'info, Raffle>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct EnterRaffle<'info> {
    #[account(mut)]
    pub raffle: Account<'info, Raffle>,
    #[account(mut)]
    pub participant: Signer<'info>,
    #[account(mut)]
    pub creator: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct PickWinner<'info> {
    #[account(mut)]
    pub raffle: Account<'info, Raffle>,
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(mut)]
    pub nft_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub winner_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CloseRaffle<'info> {
    #[account(mut)]
    pub raffle: Account<'info, Raffle>,
    pub creator: Signer<'info>,
}

#[error_code]
pub enum RaffleError {
    #[msg("Raffle is not active")]
    RaffleNotActive,
    #[msg("Maximum entries reached")]
    MaxEntriesReached,
    #[msg("Insufficient entry fee")]
    InsufficientEntryFee,
    #[msg("No entries in raffle")]
    NoEntries,
    #[msg("Unauthorized")]
    Unauthorized,
}
