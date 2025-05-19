import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { RaffleContract } from "../target/types/raffle_contract";
import { PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, createAccount, mintTo } from "@solana/spl-token";
import { assert } from "chai";

describe("raffle-contract", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.RaffleContract as Program<RaffleContract>;

  // Test accounts
  const creator = Keypair.generate();
  const participant1 = Keypair.generate();
  const participant2 = Keypair.generate();
  const participant3 = Keypair.generate();

  // NFT mint and token accounts
  let nftMint: PublicKey;
  let creatorTokenAccount: PublicKey;
  let participant1TokenAccount: PublicKey;
  let participant2TokenAccount: PublicKey;
  let participant3TokenAccount: PublicKey;

  // Raffle account
  let raffleAccount: PublicKey;
  const entryFee = new anchor.BN(0.1 * LAMPORTS_PER_SOL); // 0.1 SOL
  const maxEntries = 3;

  before(async () => {
    // Airdrop SOL to accounts
    await provider.connection.requestAirdrop(creator.publicKey, 2 * LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(participant1.publicKey, 2 * LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(participant2.publicKey, 2 * LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(participant3.publicKey, 2 * LAMPORTS_PER_SOL);

    // Create NFT mint
    nftMint = await createMint(
      provider.connection,
      creator,
      creator.publicKey,
      null,
      0
    );

    // Create token accounts
    creatorTokenAccount = await createAccount(
      provider.connection,
      creator,
      nftMint,
      creator.publicKey
    );

    participant1TokenAccount = await createAccount(
      provider.connection,
      participant1,
      nftMint,
      participant1.publicKey
    );

    participant2TokenAccount = await createAccount(
      provider.connection,
      participant2,
      nftMint,
      participant2.publicKey
    );

    participant3TokenAccount = await createAccount(
      provider.connection,
      participant3,
      nftMint,
      participant3.publicKey
    );

    // Mint NFT to creator
    await mintTo(
      provider.connection,
      creator,
      nftMint,
      creatorTokenAccount,
      creator,
      1
    );
  });

  it("Initializes raffle", async () => {
    const [raffle] = PublicKey.findProgramAddressSync(
      [Buffer.from("raffle"), creator.publicKey.toBuffer()],
      program.programId
    );
    raffleAccount = raffle;

    await program.methods
      .initializeRaffle(nftMint, entryFee, maxEntries)
      .accounts({
        raffle: raffleAccount,
        creator: creator.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

    const raffleState = await program.account.raffle.fetch(raffleAccount);
    assert.equal(raffleState.entryFee.toString(), entryFee.toString());
    assert.equal(raffleState.maxEntries, maxEntries);
    assert.equal(raffleState.nftMint.toString(), nftMint.toString());
    assert.equal(raffleState.creator.toString(), creator.publicKey.toString());
    assert.equal(raffleState.isActive, true);
    assert.equal(raffleState.entries.length, 0);
  });

  it("Allows participants to enter raffle", async () => {
    // First participant enters
    await program.methods
      .enterRaffle()
      .accounts({
        raffle: raffleAccount,
        participant: participant1.publicKey,
        creator: creator.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([participant1])
      .rpc();

    let raffleState = await program.account.raffle.fetch(raffleAccount);
    assert.equal(raffleState.entries.length, 1);
    assert.equal(raffleState.entries[0].toString(), participant1.publicKey.toString());

    // Second participant enters
    await program.methods
      .enterRaffle()
      .accounts({
        raffle: raffleAccount,
        participant: participant2.publicKey,
        creator: creator.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([participant2])
      .rpc();

    raffleState = await program.account.raffle.fetch(raffleAccount);
    assert.equal(raffleState.entries.length, 2);
    assert.equal(raffleState.entries[1].toString(), participant2.publicKey.toString());
  });

  it("Prevents entry when max entries reached", async () => {
    // Third participant enters
    await program.methods
      .enterRaffle()
      .accounts({
        raffle: raffleAccount,
        participant: participant3.publicKey,
        creator: creator.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([participant3])
      .rpc();

    // Fourth participant should fail
    try {
      await program.methods
        .enterRaffle()
        .accounts({
          raffle: raffleAccount,
          participant: Keypair.generate().publicKey,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([Keypair.generate()])
        .rpc();
      assert.fail("Should have thrown an error");
    } catch (err) {
      assert.include(err.message, "Maximum entries reached");
    }
  });

  it("Picks winner and transfers NFT", async () => {
    const initialCreatorBalance = await provider.connection.getTokenAccountBalance(creatorTokenAccount);
    const initialParticipant1Balance = await provider.connection.getTokenAccountBalance(participant1TokenAccount);
    const initialParticipant2Balance = await provider.connection.getTokenAccountBalance(participant2TokenAccount);
    const initialParticipant3Balance = await provider.connection.getTokenAccountBalance(participant3TokenAccount);

    await program.methods
      .pickWinner()
      .accounts({
        raffle: raffleAccount,
        creator: creator.publicKey,
        nftTokenAccount: creatorTokenAccount,
        winnerTokenAccount: participant1TokenAccount, // This will be the winner's account
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([creator])
      .rpc();

    const raffleState = await program.account.raffle.fetch(raffleAccount);
    assert.equal(raffleState.isActive, false);

    // Verify NFT transfer
    const finalCreatorBalance = await provider.connection.getTokenAccountBalance(creatorTokenAccount);
    const finalParticipant1Balance = await provider.connection.getTokenAccountBalance(participant1TokenAccount);
    const finalParticipant2Balance = await provider.connection.getTokenAccountBalance(participant2TokenAccount);
    const finalParticipant3Balance = await provider.connection.getTokenAccountBalance(participant3TokenAccount);

    // One of the participants should have received the NFT
    const balances = [
      finalParticipant1Balance.value.uiAmount,
      finalParticipant2Balance.value.uiAmount,
      finalParticipant3Balance.value.uiAmount,
    ];
    assert.equal(balances.filter(b => b === 1).length, 1);
    assert.equal(finalCreatorBalance.value.uiAmount, 0);
  });

  it("Prevents entry after raffle is closed", async () => {
    try {
      await program.methods
        .enterRaffle()
        .accounts({
          raffle: raffleAccount,
          participant: Keypair.generate().publicKey,
          creator: creator.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([Keypair.generate()])
        .rpc();
      assert.fail("Should have thrown an error");
    } catch (err) {
      assert.include(err.message, "Raffle is not active");
    }
  });

  it("Allows creator to close raffle", async () => {
    // Create a new raffle for this test
    const [newRaffle] = PublicKey.findProgramAddressSync(
      [Buffer.from("raffle"), creator.publicKey.toBuffer(), Buffer.from("2")],
      program.programId
    );

    await program.methods
      .initializeRaffle(nftMint, entryFee, maxEntries)
      .accounts({
        raffle: newRaffle,
        creator: creator.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

    await program.methods
      .closeRaffle()
      .accounts({
        raffle: newRaffle,
        creator: creator.publicKey,
      })
      .signers([creator])
      .rpc();

    const raffleState = await program.account.raffle.fetch(newRaffle);
    assert.equal(raffleState.isActive, false);
  });

  it("Prevents non-creator from closing raffle", async () => {
    try {
      await program.methods
        .closeRaffle()
        .accounts({
          raffle: raffleAccount,
          creator: participant1.publicKey,
        })
        .signers([participant1])
        .rpc();
      assert.fail("Should have thrown an error");
    } catch (err) {
      assert.include(err.message, "Unauthorized");
    }
  });
});
