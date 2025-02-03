import algosdk from 'algosdk';
import { OnChainVotingClient } from '../contracts/clients/OnChainVotingClient';

export type OptionsBoxValue = {
  votes: bigint;
  description: string;
};

export const getResults = async (client: OnChainVotingClient): Promise<OptionsBoxValue[]> => {
  const optionsBoxes = await client.appClient.getBoxValues((box) => box.name.startsWith('options'));
  const results = await Promise.all(
    optionsBoxes.map(async (box) => {
      const value = await client.appClient.getBoxValue(box.name.nameRaw);
      return decodeOptionsBoxValue(value);
    })
  );

  results.sort((a: OptionsBoxValue, b: OptionsBoxValue): number => {
    if (a.description > b.description) return 1;
    if (a.description < b.description) return -1;
    return 0;
  });

  return results;
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
