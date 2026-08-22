import { Contract, JsonRpcProvider, type ContractEventPayload, type InterfaceAbi, type Provider } from 'ethers';

export const BANKING_BURN_ADDRESS = '0x0000000000000000000000000000000000000000';

export type BankingBurnEvent = {
  from: string;
  to: string;
  value: bigint;
  transactionHash: string;
  blockNumber?: number;
  logIndex?: number;
};

export type BankingBurnWatcherOptions = {
  provider?: Provider;
  rpcUrl?: string;
  tokenAddress: string;
  tokenAbi: InterfaceAbi;
  burnAddress?: string;
  onBurn: (event: BankingBurnEvent) => void | Promise<void>;
  onError?: (error: Error) => void;
};

export type BankingWatcherHandle = {
  provider: Provider;
  stop: () => void;
};

function providerFor(options: Pick<BankingBurnWatcherOptions, 'provider' | 'rpcUrl'>) {
  if (options.provider) return options.provider;
  if (!options.rpcUrl) throw new Error('provider or rpcUrl is required');
  return new JsonRpcProvider(options.rpcUrl);
}

function eventPayload(payload: unknown): ContractEventPayload | undefined {
  return payload && typeof payload === 'object' && 'log' in payload
    ? payload as ContractEventPayload
    : undefined;
}

export function startBankingBurnWatcher(options: BankingBurnWatcherOptions): BankingWatcherHandle {
  const provider = providerFor(options);
  const burnAddress = (options.burnAddress || BANKING_BURN_ADDRESS).toLowerCase();
  const contract = new Contract(options.tokenAddress, options.tokenAbi, provider);

  const handleTransfer = async (
    from: string,
    to: string,
    value: bigint,
    payload?: unknown,
  ) => {
    if (String(to).toLowerCase() !== burnAddress) return;
    const event = eventPayload(payload);
    try {
      await options.onBurn({
        from,
        to,
        value,
        transactionHash: event?.log?.transactionHash || '',
        blockNumber: event?.log?.blockNumber,
        logIndex: event?.log?.index,
      });
    } catch (error) {
      options.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  };

  contract.on('Transfer', handleTransfer);
  if (options.onError && 'on' in provider) {
    provider.on('error', options.onError);
  }

  return {
    provider,
    stop: () => {
      contract.off('Transfer', handleTransfer);
      if (options.onError && 'off' in provider) {
        provider.off('error', options.onError);
      }
    },
  };
}
