import { Contract } from '@algorandfoundation/tealscript';

type VoterKey = {
  address: Address;
  votingPower: uint64;
};

type OptionDetails = {
  votes: uint64;
  description: string;
};

export type VoteOptionId = uint64;

const HAS_VOTED: uint64 = 1;
const HAS_NOT_VOTED: uint64 = 0;

export class OnChainVoting extends Contract {
  programVersion = 11;

  // timestamp when the voting starts
  votingStart = GlobalStateKey<uint64>({ key: 'start' });

  // timestamp when the voting ends
  votingEnd = GlobalStateKey<uint64>({ key: 'end' });

  // the voters and their voting power. Value is whether the user has voted or not - 0 not voted, 1 voted
  voters = BoxMap<VoterKey, uint64>({ prefix: 'voters' });

  // the options that can be voted for. The key is the option voted for and the value is the number of votes and description.
  options = BoxMap<VoteOptionId, OptionDetails>({ prefix: 'options' });

  createApplication(start: uint64, end: uint64): void {
    assert(start < end);
    assert(globals.latestTimestamp < start);

    this.votingStart.value = start;
    this.votingEnd.value = end;
  }

  addOption(option: VoteOptionId, description: string): void {
    assert(this.canEdit());
    assert(!this.options(option).exists);

    this.options(option).value = {
      description: description,
      votes: 0,
    };
  }

  removeOption(option: VoteOptionId): void {
    assert(this.canEdit());
    assert(this.options(option).exists);

    this.options(option).delete();
  }

  // can only be called after voting has finished. Does not alter the results - only reclaims box storage.
  removeVoterStorage(voterAddress: Address, votingPower: uint64): void {
    assert(globals.latestTimestamp > this.votingEnd.value);
    assert(this.txn.sender === globals.creatorAddress);

    this.voters({ address: voterAddress, votingPower: votingPower }).delete();
  }

  vote(votingPower: uint64, choice: VoteOptionId): void {
    const voterAddress: Address = this.txn.sender;

    assert(this.votingStart.value < globals.latestTimestamp);
    assert(this.votingEnd.value > globals.latestTimestamp);
    assert(this.voters({ address: voterAddress, votingPower: votingPower }).exists);
    assert(this.voters({ address: voterAddress, votingPower: votingPower }).value === HAS_NOT_VOTED);
    assert(this.options(choice).exists);

    // increment the votes for the option
    this.options(choice).value.votes += votingPower;

    // mark voted
    this.voters({ address: voterAddress, votingPower: votingPower }).value = HAS_VOTED;
  }

  addVoter(voterAddress: Address, votingPower: uint64): void {
    assert(this.canEdit());
    assert(!this.voters({ address: voterAddress, votingPower: votingPower }).exists);

    this.voters({ address: voterAddress, votingPower: votingPower }).value = HAS_NOT_VOTED;
    assert(this.voters({ address: voterAddress, votingPower: votingPower }).exists);
    assert(this.voters({ address: voterAddress, votingPower: votingPower }).value === HAS_NOT_VOTED);
  }

  updateTimes(start: uint64, end: uint64): void {
    assert(this.canEdit());
    assert(start < end);
    assert(start < this.votingEnd.value);
    assert(end > this.votingStart.value);

    this.votingStart.value = start;
    this.votingEnd.value = end;
  }

  canEdit(): boolean {
    return globals.latestTimestamp < this.votingStart.value && this.txn.sender === globals.creatorAddress;
  }

  withdraw(amount: uint64): void {
    assert(this.txn.sender === this.app.creator);

    sendPayment({
      receiver: this.app.creator,
      amount: amount,
      fee: 0,
    });
  }
}
