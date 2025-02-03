import { beforeAll, describe, expect, test } from '@jest/globals';
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing';
import { AlgorandClient, Config } from '@algorandfoundation/algokit-utils';
import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount';
import { Account, generateAccount, makeBasicAccountTransactionSigner } from 'algosdk';
import { OnChainVotingClient, OnChainVotingFactory } from '../contracts/clients/OnChainVotingClient';
import { decodeOptionsBoxValue, getResults } from "../lib/voting";

const fixture = algorandFixture();
Config.configure({ populateAppCallResources: true });

let clientFactory: OnChainVotingFactory;
let algorandClient: AlgorandClient;

describe('OnChainVoting', () => {
  beforeAll(async () => {
    await fixture.newScope();
    const { testAccount } = fixture.context;
    const { algorand } = fixture;

    await algorand.account.ensureFunded(
      testAccount.addr,
      await algorand.account.localNetDispenser(),
      AlgoAmount.Algos(5)
    );

    clientFactory = new OnChainVotingFactory({
      algorand,
      defaultSender: testAccount.addr,
    });
    algorandClient = algorand;
  });

  describe('happy path flow', () => {
    let appClient: OnChainVotingClient;
    let eligibleVotingAccount: Account;
    let nonEligibleVotingAccount: Account;

    test('creates the application', async () => {
      appClient = await createAndFundApplication(clientFactory, algorandClient);
    });

    test('creates voting accounts', async () => {
      eligibleVotingAccount = await createAccount(algorandClient);
      nonEligibleVotingAccount = await createAccount(algorandClient);
    });

    test('adds voting options', async () => {
      await addVotingOption(appClient, { optionId: 1, description: 'Option 1' });
      await addVotingOption(appClient, { optionId: 2, description: 'Option 2' });
    });

    test('adds voters', async () => {
      await addVoter(appClient, { address: fixture.context.testAccount.addr, votingPower: 1 });
      await addVoter(appClient, { address: eligibleVotingAccount.addr, votingPower: 2 });
    });

    test('starts the voting', async () => {
      const start = BigInt(Math.floor(Date.now() / 1000) - 10000);
      const end = BigInt(Math.floor(Date.now() / 1000) + 10000);
      await updateVotingTimes(appClient, start, end);
    });

    test('eligible users votes', async () => {
      await vote(appClient.appId, { choice: 1, votingPower: 1 }, fixture.context.testAccount);
      await vote(appClient.appId, { choice: 2, votingPower: 2 }, eligibleVotingAccount);
    });

    test('cannot vote again', async () => {
      await expect(
        vote(
          appClient.appId,
          {
            choice: 2,
            votingPower: 2,
          },
          eligibleVotingAccount
        )
      ).rejects.toThrow(/logic eval error/);
    });

    test('non-eligible user cannot vote', async () => {
      await expect(vote(appClient.appId, { choice: 1, votingPower: 1 }, nonEligibleVotingAccount)).rejects.toThrow(
        /logic eval error/
      );
    });

    test('stores the correct voting results', async () => {
      const results = await getResults(appClient);
      expect(results[0].description).toEqual('Option 1');
      expect(results[0].votes).toEqual(BigInt(1));

      expect(results[1].description).toEqual('Option 2');
      expect(results[1].votes).toEqual(BigInt(2));
    });
  });
});

async function vote(appId: bigint, userVote: { choice: number; votingPower: number }, account: Account): Promise<void> {
  const appClient = clientFactory.getAppClientById({ appId });
  const signer = makeBasicAccountTransactionSigner(account);
  await appClient.send.vote({
    args: { choice: BigInt(userVote.choice), votingPower: BigInt(userVote.votingPower) },
    populateAppCallResources: true,
    sender: account.addr,
    signer,
  });
}

async function createAndFundApplication(
  factory: OnChainVotingFactory,
  algorand: AlgorandClient
): Promise<OnChainVotingClient> {
  const start = BigInt(Math.floor(Date.now() / 1000) + 10); // 10 seconds in future
  const end = BigInt(Math.floor(Date.now() / 1000) + 60); // 60 seconds in future
  const createResult = await factory.send.create.createApplication({ args: [start, end] });
  const { appClient } = createResult;

  await algorand.account.ensureFunded(
    appClient.appAddress,
    await algorand.account.localNetDispenser(),
    AlgoAmount.Algos(5)
  );

  return appClient;
}

async function addVoter(appClient: OnChainVotingClient, voter: { address: string; votingPower: number }) {
  await appClient.send.addVoter({
    args: { votingPower: BigInt(voter.votingPower), voterAddress: voter.address },
  });
}

async function updateVotingTimes(appClient: OnChainVotingClient, start: bigint, end: bigint) {
  await appClient.send.updateTimes({ args: { start, end } });
  await sleep(1000);
}

async function addVotingOption(appClient: OnChainVotingClient, option: { optionId: number; description: string }) {
  await appClient.send.addOption({ args: { option: BigInt(option.optionId), description: option.description } });
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function createAccount(algorand: AlgorandClient): Promise<Account> {
  const acct = generateAccount();
  await algorand.account.ensureFunded(acct.addr, await algorand.account.localNetDispenser(), AlgoAmount.Algos(5));
  return acct;
}
