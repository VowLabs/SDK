import axios from 'axios'
import { User, Auth, EscrowAcct, ExitAcct, Cheque, BankingProvider } from './types'
import { die } from './utils'

export class Provider implements BankingProvider {
    API: string
    apiKey: string
    userId?: string
    debug: boolean = false

    constructor() {
        this.API = process.env.BRIDGE_API_URL || 'https://api.bridge.xyz/v0'
        const key = process.env.BRIDGE_API_KEY ?? ''
        key || die('No BRIDGE_API_KEY in env')
        this.apiKey = key
    }

    private headers(customHeaders?: Record<string, string>) {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Api-Key': this.apiKey,
            'Idempotency-Key': `${Date.now()}-${Math.random()}`,
            ...customHeaders
        }
        return { headers }
    }

    async getUser(auth?: Auth): Promise<any> {
        if (!this.userId) {
            throw new (Error as any)('.bridge.user-get-no-id')
        }
        const url = `${this.API}/customers/${this.userId}`
        try {
            const res = await axios.get(url, this.headers())
            return res.data
        } catch (error: any) {
            const cause = error.response?.data?.error
            throw new (Error as any)('.bridge.user-get', { cause })
        }
    }

    async newUser(o: User): Promise<string> {
        const url = `${this.API}/customers`
        const { id, name } = o
        const nameParts = (name || '').split(' ')
        const firstName = nameParts[0] || 'User'
        const lastName = nameParts.slice(1).join(' ') || 'Account'

        const payload: any = {
            type: 'individual',
            first_name: firstName,
            last_name: lastName,
            endorsements: ['base']
        }

        try {
            const res = await axios.post(url, payload, this.headers())
            this.userId = res.data.id
            if (id) {
            }
            return res.data.id
        } catch (error: any) {
            const cause = error.response?.data?.error
            throw new (Error as any)('.bridge.user-new', { cause })
        }
    }

    async editUser(user: { dob: string }): Promise<any> {
        if (!this.userId) {
            throw new (Error as any)('.bridge.user-edit-no-id')
        }
        
        const url = `${this.API}/customers/${this.userId}`
        const payload = {
            birth_date: user.dob
        }

        try {
            const res = await axios.put(url, payload, this.headers())
            return res.data
        } catch (error: any) {
            const cause = error.response?.data?.error
            throw new (Error as any)('.bridge.user-edit', { cause })
        }
    }

    async delUser(user_id: string): Promise<{ success: boolean }> {
        if (!user_id) {
            throw new (Error as any)('.bridge.user-del-no-id')
        }
        
        const url = `${this.API}/customers/${user_id}`
        try {
            const res = await axios.delete(url, this.headers())
            return { success: res.status >= 200 && res.status < 300 }
        } catch (error: any) {
            const cause = error.response?.data?.error
            throw new (Error as any)('.bridge.user-del', { cause })
        }
    }

    async getEscrowAcct(auth?: Auth): Promise<EscrowAcct> {
        if (!this.userId) {
            throw new (Error as any)('.bridge.escrow-acct-get-no-id')
        }

        try {
            const url = `${this.API}/customers/${this.userId}`
            const res = await axios.get(url, this.headers())
            const customer = res.data

            const escrowAcct: EscrowAcct = {
                id: customer.id,
                name: `${customer.first_name} ${customer.last_name}`,
                balance: 0,
                date: customer.created_at,
                numbers: {
                    ACH: {
                        account_number: 'VIRTUAL',
                        routing_number: '021000021'
                    },
                    RTP: {
                        account_number: 'VIRTUAL',
                        routing_number: '021000021'
                    },
                    WIRE: {
                        account_number: 'VIRTUAL',
                        routing_number: '021000021'
                    }
                }
            }
            return escrowAcct
        } catch (error: any) {
            const cause = error.response?.data?.error
            throw new (Error as any)('.bridge.escrow-acct-get', { cause })
        }
    }

    async addEscrowAcct(): Promise<EscrowAcct> {
        if (!this.userId) {
            throw new (Error as any)('.bridge.escrow-acct-add-no-id')
        }

        try {
            const url = `${this.API}/customers/${this.userId}`
            const res = await axios.get(url, this.headers())
            const customer = res.data

            const escrowAcct: EscrowAcct = {
                id: customer.id,
                name: `${customer.first_name} ${customer.last_name} - Escrow`,
                balance: 0,
                date: new Date().toISOString(),
                numbers: {
                    ACH: {
                        account_number: `ACCT-${customer.id.substring(0, 8)}`,
                        routing_number: '021000021'
                    },
                    RTP: {
                        account_number: `ACCT-${customer.id.substring(0, 8)}`,
                        routing_number: '021000021'
                    },
                    WIRE: {
                        account_number: `ACCT-${customer.id.substring(0, 8)}`,
                        routing_number: '021000021'
                    }
                }
            }
            return escrowAcct
        } catch (error: any) {
            const cause = error.response?.data?.error
            throw new (Error as any)('.bridge.escrow-acct-add', { cause })
        }
    }

    async getExitAcct(auth?: Auth): Promise<ExitAcct> {
        if (!this.userId) {
            throw new (Error as any)('.bridge.exit-acct-get-no-id')
        }

        try {
            const url = `${this.API}/customers/${this.userId}/external_accounts`
            const res = await axios.get(url, this.headers())
            
            if (!res.data.data || res.data.data.length === 0) {
                throw new (Error as any)('No external accounts found')
            }

            const account = res.data.data[0]
            const exitAcct: ExitAcct = {
                id: account.id,
                type: account.account.checking_or_savings?.toUpperCase() === 'SAVINGS' ? 'SAVINGS' : 'CHECKING',
                routing: parseInt(account.account.routing_number),
                account: parseInt(account.account.last_4),
                status: account.active ? 'active' : 'inactive',
                date: account.created_at
            }
            
            return exitAcct
        } catch (error: any) {
            const cause = error.response?.data?.error
            throw new (Error as any)('.bridge.exit-acct-get', { cause })
        }
    }

    async addExitAcct(account: ExitAcct): Promise<string> {
        if (!this.userId) {
            throw new (Error as any)('.bridge.exit-acct-add-no-id')
        }

        const url = `${this.API}/customers/${this.userId}/external_accounts`
        
        const payload = {
            account_type: 'us',
            account_owner_name: account.account?.toString() || 'Account Owner',
            account: {
                routing_number: account.routing?.toString(),
                account_number: account.account?.toString(),
                checking_or_savings: account.type?.toLowerCase() || 'checking'
            }
        }

        try {
            const res = await axios.post(url, payload, this.headers())
            return res.data.id
        } catch (error: any) {
            const cause = error.response?.data?.error
            throw new (Error as any)('.bridge.exit-acct-add', { cause })
        }
    }

    async addPaypal(user: User, username: string): Promise<string> {
        throw new (Error as any)('.bridge.paypal-not-supported')
    }

    async addVenmo(user: User, username: string): Promise<string> {
        throw new (Error as any)('.bridge.venmo-not-supported')
    }

    async createCheque(cheque: Cheque, auth?: Auth): Promise<any> {
        if (!this.userId) {
            throw new (Error as any)('.bridge.cheque-create-no-id')
        }

        try {
            return {
                id: `chq-${Date.now()}`,
                amount: cheque.amount,
                account: cheque.account,
                recipient: cheque.recipient,
                status: 'pending',
                created_at: new Date().toISOString()
            }
        } catch (error: any) {
            const cause = error.response?.data?.error
            throw new (Error as any)('.bridge.cheque-create', { cause })
        }
    }

    async depositCheque(id: string, account: string): Promise<any> {
        if (!this.userId) {
            throw new (Error as any)('.bridge.cheque-deposit-no-id')
        }

        try {
            return {
                id,
                status: 'submitted',
                account,
                updated_at: new Date().toISOString()
            }
        } catch (error: any) {
            const cause = error.response?.data?.error
            throw new (Error as any)('.bridge.cheque-deposit', { cause })
        }
    }
}
