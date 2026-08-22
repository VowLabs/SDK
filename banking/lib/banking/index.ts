import { BankingProvider, User, Auth, ExitAcct, Cheque, EscrowAcct } from './types'
import { Provider as CheckbookProvider } from './checkbook'
import { Provider as UsioProvider } from './usio'
import { Provider as BridgeProvider } from './bridge'
import { Provider as UnitProvider } from './unit'

export const AVAILABLE_BANKING_SERVICES = ['checkbook', 'usio', 'bridge', 'unit'] as const
export type BankingServiceName = typeof AVAILABLE_BANKING_SERVICES[number]

export class Banking {
	provider!: BankingProvider
	debug: boolean = false

	constructor(provider: BankingServiceName = 'checkbook') {
		this.loadProvider(provider)
	}

	static async create(provider: BankingServiceName = 'checkbook') {
		const banking = new Banking(provider)
		await banking.loadProvider(provider)
		return banking
	}

	async loadProvider(name: BankingServiceName) {
		try {
			const Provider = { checkbook: CheckbookProvider, usio: UsioProvider, bridge: BridgeProvider, unit: UnitProvider }[name]
			if (typeof Provider === 'function') {
				this.provider = new Provider()
			} else {
				throw new Error('Provider not found in module ' + name)
			}
		}
		catch (err: any) {
			console.error('Failed to load banking provider', err)
		}
	}

	headers(...args: any[]) { return (this.provider as any).headers?.(...args) }
	get auth() { return (this.provider as any).auth }
	get admin() { return (this.provider as any).admin }
	getUser(auth?: Auth) { return this.provider.getUser(auth) }
	newUser(o: User) { return this.provider.newUser(o) }
	editUser(user: { dob: string }) { return this.provider.editUser(user) }
	delUser(user_id: string) { return this.provider.delUser(user_id) }
	getEscrowAcct(auth?: Auth) { return this.provider.getEscrowAcct(auth) }
	addEscrowAcct() { return this.provider.addEscrowAcct() }
	getExitAcct(auth?: Auth) { return this.provider.getExitAcct(auth) }
	addExitAcct(account: ExitAcct) { return this.provider.addExitAcct(account) }
	addPaypal(user: User, username: string) { return this.provider.addPaypal(user, username) }
	addVenmo(user: User, username: string) { return this.provider.addVenmo(user, username) }
	createCheque(cheque: Cheque, auth?: Auth) { return this.provider.createCheque(cheque, auth) }
	depositCheque(id: string, account: string) { return this.provider.depositCheque(id, account) }
}

export class Checkbook extends Banking {
	constructor() {
		super('checkbook')
	}
}

export type { Auth, Cheque, EscrowAcct, ExitAcct, User }
