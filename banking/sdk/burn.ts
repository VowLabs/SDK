import { ethers, type InterfaceAbi, type Provider } from 'ethers';
import { Banking } from './banking';
import type { Auth, Cheque, EscrowAcct } from './banking';
import { startBankingBurnWatcher, type BankingBurnEvent, type BankingWatcherHandle } from './watch';

export const DEFAULT_MAX_LIQUIDITY_TRANSFER = 2000;

export type BankingBurnUser = {
  id: string;
  name: string;
  wallet: string;
  auth: Auth;
  escrow?: string;
};

export type BankingLiquidityAccounts = Record<string, number>;

export type BankingBurnProcessorOptions = {
  provider?: Provider;
  rpcUrl?: string;
  tokenAddress: string;
  tokenAbi: InterfaceAbi;
  burnAddress?: string;
  decimals?: number;
  maxLiquidityTransfer?: number;
  getUser: (key: string) => Promise<BankingBurnUser | undefined | null>;
  getLiquidityAccounts?: () => Promise<BankingLiquidityAccounts>;
  setLiquidityAccounts?: (accounts: BankingLiquidityAccounts) => Promise<void> | void;
  bankingFactory?: () => Promise<Banking>;
  onBurn?: (event: BankingBurnEvent & { amount: number }) => void | Promise<void>;
  onWithdraw?: (result: BankingBurnWithdrawResult) => void | Promise<void>;
  onCollectionShortfall?: (result: BankingBurnCollectionShortfall) => void | Promise<void>;
  onUnregisteredWallet?: (wallet: string, event: BankingBurnEvent) => void | Promise<void>;
  onMissingEscrow?: (user: BankingBurnUser, event: BankingBurnEvent) => void | Promise<void>;
  onMissingExitAccount?: (user: BankingBurnUser, event: BankingBurnEvent) => void | Promise<void>;
  onError?: (error: Error) => void;
};

export type BankingBurnWithdrawResult = {
  user: BankingBurnUser;
  amount: number;
  chequeId: string;
  status?: string;
  transactionHash: string;
};

export type BankingBurnCollectionShortfall = {
  user: BankingBurnUser;
  requestedAmount: number;
  shortfall: number;
  transactionHash: string;
};

export type BankingBurnProcessorHandle = BankingWatcherHandle;

export function startBankingBurnProcessor(options: BankingBurnProcessorOptions): BankingBurnProcessorHandle {
  return startBankingBurnWatcher({
    provider: options.provider,
    rpcUrl: options.rpcUrl,
    tokenAddress: options.tokenAddress,
    tokenAbi: options.tokenAbi,
    burnAddress: options.burnAddress,
    onError: options.onError,
    onBurn: async event => {
      const amount = Number(ethers.formatUnits(event.value, options.decimals ?? 2));
      await options.onBurn?.({ ...event, amount });
      await withdrawBankingBurn(options, event.from, amount, event);
    },
  });
}

export async function withdrawBankingBurn(
  options: BankingBurnProcessorOptions,
  wallet: string,
  amount: number,
  event: BankingBurnEvent,
): Promise<BankingBurnWithdrawResult | undefined> {
  const user = await options.getUser(wallet);
  if (!user) {
    await options.onUnregisteredWallet?.(wallet, event);
    return undefined;
  }

  const banking = await createBanking(options);
  const escrow: EscrowAcct = await banking.getEscrowAcct(user.auth);
  if (!escrow) {
    await options.onMissingEscrow?.(user, event);
    return undefined;
  }

  if (escrow.balance < amount) {
    user.escrow = escrow.id;
    const shortfall = await collectBankingLiquidity(options, user, amount - escrow.balance);
    if (shortfall > 0) {
      await options.onCollectionShortfall?.({
        user,
        requestedAmount: amount,
        shortfall,
        transactionHash: event.transactionHash,
      });
    }
  }

  const cheque: Cheque = {
    name: user.name,
    amount,
    account: escrow.id,
    recipient: user.id,
  };
  const created = await banking.createCheque(cheque, user.auth);

  const bank = await banking.getExitAcct(user.auth);
  if (!bank || !bank.id) {
    await options.onMissingExitAccount?.(user, event);
    return undefined;
  }

  const deposited = await banking.depositCheque(created.id, bank.id);
  const result = {
    user,
    amount,
    chequeId: created.id,
    status: deposited?.status,
    transactionHash: event.transactionHash,
  };
  await options.onWithdraw?.(result);
  return result;
}

export async function collectBankingLiquidity(
  options: BankingBurnProcessorOptions,
  recipient: BankingBurnUser,
  amount: number,
): Promise<number> {
  if (!options.getLiquidityAccounts || !recipient.escrow) return amount;

  const liquidityAccounts = await options.getLiquidityAccounts();
  const sortedKeys = Object.keys(liquidityAccounts).sort((a, b) => liquidityAccounts[a] - liquidityAccounts[b]);
  const banking = await createBanking(options);
  const maxTransfer = options.maxLiquidityTransfer ?? DEFAULT_MAX_LIQUIDITY_TRANSFER;

  for (const key of sortedKeys) {
    const transferAmount = Math.min(liquidityAccounts[key], randomRoundedAmount(amount), maxTransfer);
    const sender = await options.getUser(key);
    if (!sender || transferAmount <= 0) continue;

    const escrow: EscrowAcct = await banking.getEscrowAcct(sender.auth);
    const cheque: Cheque = {
      name: recipient.name,
      amount: transferAmount,
      account: escrow.id,
      recipient: recipient.id,
    };
    const created = await banking.createCheque(cheque, sender.auth);
    await banking.depositCheque(created.id, recipient.escrow);

    liquidityAccounts[key] -= transferAmount;
    amount -= transferAmount;
    if (amount <= 0) break;
  }

  await options.setLiquidityAccounts?.(liquidityAccounts);
  return amount;
}

function createBanking(options: Pick<BankingBurnProcessorOptions, 'bankingFactory'>): Promise<Banking> {
  return options.bankingFactory ? options.bankingFactory() : Banking.create();
}

function randomRoundedAmount(maxValue: number, round = 50): number {
  const randomNum = Math.random() * (maxValue + 1);
  const roundedNum = Math.round(randomNum / round) * round;
  return Math.min(roundedNum, maxValue);
}
