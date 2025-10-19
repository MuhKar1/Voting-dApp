import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Evoter } from "../target/types/evoter";
import { expect } from "chai";

describe("evoter", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.evoter as Program<Evoter>;

  let pollPda: anchor.web3.PublicKey;
  let pollId = new anchor.BN(1);
  const question = "What's your favorite color?";
  const options = ["Red", "Blue", "Green"];

  it("Creates a poll", async () => {
    [pollPda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("poll"), program.provider.publicKey.toBuffer(), pollId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    await program.methods
      .createPoll(pollId, question, options)
      .accounts({
        poll: pollPda,
        creator: program.provider.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    // Fetch the poll account
    const pollAccount = await program.account.pollAccount.fetch(pollPda);
    expect(pollAccount.pollId.toNumber()).to.equal(1);
    expect(pollAccount.question).to.equal(question);
    expect(pollAccount.options).to.deep.equal(options);
    expect(pollAccount.votes.map(v => v.toNumber())).to.deep.equal([0, 0, 0]);
    expect(pollAccount.isActive).to.be.true;
  });

  it("Votes on a poll", async () => {
    const voter = anchor.web3.Keypair.generate();
    const optionIndex = 0; // Vote for Red

    // Airdrop some SOL to voter
    await program.provider.connection.confirmTransaction(
      await program.provider.connection.requestAirdrop(voter.publicKey, 1 * anchor.web3.LAMPORTS_PER_SOL)
    );

    const [voteRecordPda] = await anchor.web3.PublicKey.findProgramAddress(
      [Buffer.from("vote"), pollPda.toBuffer(), voter.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .votePoll(optionIndex)
      .accounts({
        poll: pollPda,
        voteRecord: voteRecordPda,
        voter: voter.publicKey,
        creator: program.provider.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .signers([voter])
      .rpc();

    // Fetch updated poll account
    const pollAccount = await program.account.pollAccount.fetch(pollPda);
    expect(pollAccount.votes[0].toNumber()).to.equal(1);
    expect(pollAccount.votes[1].toNumber()).to.equal(0);
    expect(pollAccount.votes[2].toNumber()).to.equal(0);

    // Fetch vote record
    const voteRecord = await program.account.voteRecord.fetch(voteRecordPda);
    expect(voteRecord.voter).to.deep.equal(voter.publicKey);
    expect(voteRecord.poll).to.deep.equal(pollPda);
    expect(voteRecord.optionIndex).to.equal(optionIndex);
  });

  it("Closes a poll", async () => {
    await program.methods
      .closePoll()
      .accounts({
        poll: pollPda,
        creator: program.provider.publicKey,
      })
      .rpc();

    // Fetch poll account
    const pollAccount = await program.account.pollAccount.fetch(pollPda);
    expect(pollAccount.isActive).to.be.false;
  });
});
