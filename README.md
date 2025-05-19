# Solana Raffle Contract

A Solana smart contract built with Anchor framework that enables NFT raffles on the Solana blockchain.

## Features

- Create raffles with customizable entry fees and maximum entries
- Enter raffles by paying the entry fee
- Random winner selection
- NFT transfer to winner
- Raffle closure functionality
- Secure and decentralized

## Prerequisites

- Rust (latest stable version)
- Solana CLI (v1.28.0 or later)
- Anchor Framework (v0.31.0)
- Node.js and Yarn

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd Raffle-Smart-Contract
```

2. Install dependencies:
```bash
yarn install
```

3. Build the program:
```bash
anchor build or npm run build
```

## Program Structure

### Account Structure
```rust
pub struct Raffle {
    pub entry_fee: u64,        // Cost to enter the raffle
    pub max_entries: u8,       // Maximum number of participants
    pub entries: Vec<Pubkey>,  // List of participant public keys
    pub nft_mint: Pubkey,      // The NFT mint address
    pub creator: Pubkey,       // Raffle creator's address
    pub is_active: bool,       // Raffle status
}
```

### Instructions

1. `initialize_raffle`
   - Creates a new raffle
   - Parameters:
     - `nft_mint`: NFT mint address
     - `entry_fee`: Cost to enter (in lamports)
     - `max_entries`: Maximum number of participants

2. `enter_raffle`
   - Allows users to enter the raffle
   - Requires payment of entry fee
   - Checks for maximum entries limit

3. `pick_winner`
   - Randomly selects a winner
   - Transfers NFT to winner
   - Deactivates raffle

4. `close_raffle`
   - Allows creator to manually close raffle
   - Only accessible by raffle creator

## Testing

Run the test suite:
```bash
anchor test
```

The test suite includes:
- Raffle initialization
- Participant entry
- Maximum entries limit
- Winner selection
- NFT transfer
- Raffle closure
- Authorization checks

## Deployment

1. Configure your Solana wallet:
```bash
solana config set --url devnet
```

2. Deploy the program:
```bash
anchor deploy
```

## Security Considerations

- Entry fee validation
- Maximum entries enforcement
- Creator-only operations
- Secure random number generation
- Proper token transfer handling

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

For support, please open an issue in the repository or contact the maintainers. 