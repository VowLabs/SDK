import { Contract, ethers, JsonRpcProvider, Wallet, type ContractTransactionResponse, type Provider } from 'ethers';

export type StablecoinStakeTransferEvent = {
  tokenAddress: string; from: string; to: string; value: bigint;
  transactionHash: string; blockNumber?: number; logIndex?: number;
};
export type StablecoinStakeProcessedEvent = StablecoinStakeTransferEvent & {
  processTransactionHash: string; processBlockNumber?: number;
};
export type VLStakingProcessorOptions = {
  provider?: Provider; rpcUrl?: string; signer?: Wallet; privateKey?: string;
  stakingAddress: string; stakingAbi: ethers.InterfaceAbi; confirmations?: number;
  onTransfer?: (event: StablecoinStakeTransferEvent) => void | Promise<void>;
  onProcessed?: (event: StablecoinStakeProcessedEvent) => void | Promise<void>;
  onError?: (error: Error) => void;
};
export type VLStakingProcessorHandle = { provider: Provider; stop: () => void };

export function startVLStakingProcessor(options: VLStakingProcessorOptions): VLStakingProcessorHandle {
  const provider = options.provider || (options.rpcUrl ? new JsonRpcProvider(options.rpcUrl) : null);
  if (!provider) throw new Error('provider or rpcUrl is required');
  const signer = options.signer ? options.signer.connect(provider) :
    options.privateKey ? new Wallet(options.privateKey, provider) : null;
  if (!signer) throw new Error('signer or privateKey is required');
  const stakingAddress = ethers.getAddress(options.stakingAddress);
  const staking = new Contract(stakingAddress, options.stakingAbi, signer);
  const filter = { topics: [ethers.id('Transfer(address,address,uint256)'), null, ethers.zeroPadValue(stakingAddress, 32)] };
  const handleTransfer = async (log: any) => {
    try {
      const event: StablecoinStakeTransferEvent = {
        tokenAddress: log.address,
        from: ethers.getAddress(ethers.dataSlice(log.topics[1], 12)),
        to: stakingAddress,
        value: ethers.toBigInt(log.data),
        transactionHash: log.transactionHash,
        blockNumber: log.blockNumber,
        logIndex: log.index,
      };
      await options.onTransfer?.(event);
      const tx = await staking.processStablecoinTransfer(event.tokenAddress, event.value, event.from) as ContractTransactionResponse;
      const receipt = await tx.wait(options.confirmations);
      await options.onProcessed?.({ ...event, processTransactionHash: tx.hash, processBlockNumber: receipt?.blockNumber });
    } catch (error) { options.onError?.(error instanceof Error ? error : new Error(String(error))); }
  };
  provider.on(filter, handleTransfer);
  if (options.onError && 'on' in provider) provider.on('error', options.onError);
  return { provider, stop: () => {
    provider.off(filter, handleTransfer);
    if (options.onError && 'off' in provider) provider.off('error', options.onError);
  } };
}
