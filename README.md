# On-chain voting

This is an algorand smart contract used for weighted on-chain voting.

## How it works

Boxes are used for store a user wallet and vote - simple key/value pairs.

```
{user_address}{voting_power} -> {vote}
```

The application will accept votes from a given timestamp in the contract and prevent votes after a given timestamp.

The boxes keys are filled by the creator before voting starts. This means that a separate process mmust define the boxe before voting starts. A simple example would be to increment the voting power by 1 for each NFT held in a collection - if a user holds 20 NFTs their voting power is 20. However this is really up to the creator to define.
