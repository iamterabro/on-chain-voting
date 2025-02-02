import { beforeAll, describe, expect, test } from '@jest/globals';
import { algorandFixture } from '@algorandfoundation/algokit-utils/testing';
import { AlgorandClient, Config } from '@algorandfoundation/algokit-utils';
import { AlgoAmount } from '@algorandfoundation/algokit-utils/types/amount';
import { OnChainVotingClient, OnChainVotingFactory } from '../contracts/clients/OnChainVotingClient';

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

    test('creates the application', async () => {
      appClient = await createAndFundApplication(clientFactory, algorandClient);
    });

    test('adds voting options', async () => {
      await appClient.send.addOption({ args: { option: BigInt(1), description: 'Option 1' } });
      await appClient.send.addOption({ args: { option: BigInt(2), description: 'Option 2' } });
    });

    test('adds a voter', async () => {
      await appClient.send.addVoter({
        args: { votingPower: BigInt(1), voterAddress: fixture.context.testAccount.addr },
      });
    });

    test('starts the voting', async () => {
      const start = BigInt(Math.floor(Date.now() / 1000) - 10000);
      const end = BigInt(Math.floor(Date.now() / 1000) + 10000);
      await appClient.send.updateTimes({ args: { start, end } });
      await sleep(1000);
    });

    test('votes', async () => {
      await appClient.send.vote({
        args: { choice: BigInt(1), votingPower: BigInt(1) },
        populateAppCallResources: true,
      });
    });

    test('cannot vote again', async () => {
      await expect(
        appClient.send.vote({
          args: { choice: BigInt(1), votingPower: BigInt(1) },
          populateAppCallResources: true,
        })
      ).rejects.toThrow(/logic eval error/);
    });
  });
});

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
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
