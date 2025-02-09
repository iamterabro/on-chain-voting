# On-chain voting

This is an algorand smart contract used for weighted on-chain voting.

## Storage

This contract assumes the creator manages storage separately and covers costs associated with on-chain storage. Methods are provided to remove storage (without affecting voting results) and to withdraw algos from the contract.

Boxes are used for storing a user wallet and vote - simple key/value pairs.

```
{user_address}{voting_power} -> {vote}
```

The application will accept votes from a given timestamp in the contract and prevent votes after a given timestamp.

The boxes keys are filled by the creator before voting starts. This means that a separate process must define the box before voting starts. A simple example would be to increment the voting power by 1 for each NFT held in a collection - if a user holds 20 NFTs their voting power is 20. However this is really up to the creator to define.

## Vote box storage cost

The voter box is keyed by:

```text
{ address: voterAddress, votingPower: votingPower }
```

- Address Size: 32 bytes (Algorand addresses are 32 bytes)
- Voting Power: uint64 = 8 bytes

So the key size is: 32 + 8 = 40 bytes

The box value holds: `HAS_NOT_VOTED` or `HAS_VOTED` → uint64 (8 bytes)

MBR for each voter box:

2500 + 400 * (40 + 8) = 2500 + 400 * 48 = 2500 + 19,200 = 21,700 microAlgos

Or 0.0217 Algos.

## Options box storage cost

The options box is keyed by 

```text
VoteOptionId (uint64) → 8 bytes
```

The box value holds

```text
OptionDetails = { votes: uint64 (8 bytes), description: string (varies) }
```

Assuming the description is 50 characters, the MBR is for each option is

2500 + 400 * (8 + 58) = 2500 + 400 * 66 = 2500 + 26,400 = 28,900 microAlgos

Or 0.0289 Algos.


