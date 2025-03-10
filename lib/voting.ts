import algosdk, { decodeUint64, encodeAddress } from 'algosdk';
import { OnChainVotingClient } from '../contracts/clients/OnChainVotingClient';

export type VotingPower = {
  address: string;
  votingPower: bigint;
};

export type UserVote = {
  hasVoted: boolean;
  votingPower: VotingPower;
};

export type Option = {
  optionId: bigint;
  option: OptionsBoxValue;
};

export type OptionsBoxValue = {
  votes: bigint;
  description: string;
};

export type GlobalState = {
  votingStart: bigint;
  votingEnd: bigint;
  proposal: string;
};

export const getGlobalState = async (client: OnChainVotingClient): Promise<GlobalState> => {
  const all = await client.state.global.getAll();
  return {
    votingStart: all.votingStart as bigint,
    votingEnd: all.votingEnd as bigint,
    proposal: all.proposal as string,
  };
};

export const getOptions = async (client: OnChainVotingClient): Promise<Option[]> => {
  const optionsBoxes = await client.appClient.getBoxValues((box) => box.name.startsWith('options'));
  const results = await Promise.all(
    optionsBoxes.map(async (box) => {
      const optionId = decodeOptionsBoxName(box.name.nameRaw);
      const value = await client.appClient.getBoxValue(box.name.nameRaw);
      return { optionId, option: decodeOptionsBoxValue(value) };
    })
  );

  results.sort((a: Option, b: Option): number => {
    if (a.optionId > b.optionId) return 1;
    if (a.optionId < b.optionId) return -1;
    return 0;
  });

  return results;
};

export const getProposal = async (client: OnChainVotingClient): Promise<string | undefined> => {
  return client.state.global.proposal();
};

export const decodeOptionsBoxValue = (value: Uint8Array): OptionsBoxValue => {
  const votes = algosdk.bytesToBigInt(value.slice(0, 8));

  const descriptionBytes = value.slice(8);
  const textDecoder = new TextDecoder('utf-8');
  let description = textDecoder.decode(descriptionBytes);

  // Remove prefix (e.g., non-visible characters or metadata)
  description = description.replace(/^\x00[\s\S]*?\b/, '');

  return {
    votes,
    description,
  };
};

export async function getUserVote(client: OnChainVotingClient, userAddress: string): Promise<UserVote | undefined> {
  const boxNames = await client.appClient.getBoxNames();
  let decodedVoterBox: VotingPower | undefined;
  let rawBoxName: Uint8Array | undefined;

  const voterBox = boxNames.find((boxName) => {
    if (!boxName.name.startsWith('voters')) {
      return false;
    }
    const decodedBox = decodeVoterBoxName(boxName.nameRaw);
    if (decodedBox.address === userAddress) {
      decodedVoterBox = decodedBox;
      rawBoxName = boxName.nameRaw;
      return true;
    }
    return false;
  });

  let hasVoted = false;
  if (voterBox) {
    const value = await client.appClient.getBoxValue(rawBoxName!);
    hasVoted = algosdk.bytesToBigInt(value.slice(0, 8)) === BigInt(1);
  }

  return decodedVoterBox ? { votingPower: decodedVoterBox!, hasVoted } : undefined;
}

export function decodeVoterBoxName(boxNameRaw: Uint8Array): { address: string; votingPower: bigint } {
  const prefix = new TextEncoder().encode('voters');
  const withoutPrefix = boxNameRaw.slice(prefix.length);
  const address = encodeAddress(withoutPrefix.slice(0, 32));
  const votingPower = decodeUint64(withoutPrefix.slice(32, 40), 'bigint');
  return { address, votingPower };
}

export function decodeOptionsBoxName(boxNameRaw: Uint8Array): bigint {
  const prefix = new TextEncoder().encode('options');
  const withoutPrefix = boxNameRaw.slice(prefix.length);
  return decodeUint64(withoutPrefix.slice(0, 8), 'bigint');
}
