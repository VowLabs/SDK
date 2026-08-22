import axios from 'axios'
import { Auth, BankingProvider, Cheque, EscrowAcct, ExitAcct, User } from './types'
import { die } from './utils'

type JsonApiDocument = {
    data: {
        id: string
        type: string
        attributes?: Record<string, any>
        relationships?: Record<string, any>
    }
}

export class Provider implements BankingProvider {
    API: string
    token: string
    auth: Auth
    admin: Auth
    customerId?: string
    applicationId?: string
    depositAccountId?: string

    constructor() {
        this.API = process.env.UNIT_API_URL || 'https://api.s.unit.sh'
        this.token = process.env.UNIT_TOKEN || ''
        this.token || die('No UNIT_TOKEN in env')
        this.auth = this.admin = { key: this.token, secret: '' }
    }

    headers() {
        return {
            headers: {
                Authorization: `Bearer ${this.token}`,
                'Content-Type': 'application/vnd.api+json'
            }
        }
    }

    async getUser(auth?: Auth): Promise<any> {
        const explicitId = auth?.key
        const customerId = explicitId || this.customerId
        if (customerId) {
            try {
                const res = await axios.get<JsonApiDocument>(`${this.API}/customers/${customerId}`, this.headers())
                return res.data.data
            } catch (error: any) {
                throw new (Error as any)('.unit.user-get', { cause: error.response?.data?.errors || error.response?.data })
            }
        }

        if (!this.applicationId) {
            throw new (Error as any)('.unit.user-get-no-id')
        }

        try {
            const res = await axios.get<JsonApiDocument>(`${this.API}/applications/${this.applicationId}`, this.headers())
            return res.data.data
        } catch (error: any) {
            throw new (Error as any)('.unit.user-get', { cause: error.response?.data?.errors || error.response?.data })
        }
    }

    async newUser(o: User): Promise<string> {
        if (!o.name) throw new (Error as any)('.unit.user-new-no-name')
        if (!o.ssn) throw new (Error as any)('.unit.user-new-no-ssn')
        if (!o.dob) throw new (Error as any)('.unit.user-new-no-dob')
        if (!o.email) throw new (Error as any)('.unit.user-new-no-email')
        if (!o.address?.street || !o.address.city || !o.address.state || !o.address.zip) {
            throw new (Error as any)('.unit.user-new-no-address')
        }

        const [first, ...rest] = o.name.trim().split(/\s+/)
        const payload = {
            data: {
                type: 'individualApplication',
                attributes: {
                    ssn: o.ssn,
                    fullName: {
                        first: first || 'User',
                        last: rest.join(' ') || 'Account'
                    },
                    dateOfBirth: o.dob,
                    address: {
                        street: o.address.street,
                        city: o.address.city,
                        state: o.address.state,
                        postalCode: o.address.zip,
                        country: o.address.country || 'US'
                    },
                    email: o.email,
                    ...(o.phone ? { phone: { countryCode: '1', number: String(o.phone).replace(/\D/g, '') } } : {}),
                    ...(o.ip ? { ip: o.ip } : {}),
                    tags: {
                        userId: o.id
                    },
                    idempotencyKey: `${o.id}-${Date.now()}`
                }
            }
        }

        try {
            const res = await axios.post<JsonApiDocument>(`${this.API}/applications`, payload, this.headers())
            const relationships = res.data.data.relationships || {}
            this.applicationId = res.data.data.id
            this.customerId = relationships.customer?.data?.id || relationships.customers?.data?.[0]?.id
            return this.customerId || this.applicationId
        } catch (error: any) {
            throw new (Error as any)('.unit.user-new', { cause: error.response?.data?.errors || error.response?.data })
        }
    }

    async editUser(user: { dob: string }): Promise<any> {
        throw new (Error as any)('.unit.user-edit-not-supported', {
            cause: 'Unit onboarding data is managed through applications/customers and does not support this generic dob-only update flow.'
        })
    }

    async delUser(user_id: string): Promise<{ success: boolean }> {
        throw new (Error as any)('.unit.user-del-not-supported', {
            cause: `Archiving or deleting Unit customers is not implemented for user ${user_id}.`
        })
    }

    async getEscrowAcct(auth?: Auth): Promise<EscrowAcct> {
        const accountId = auth?.key || this.depositAccountId
        try {
            const res = accountId
                ? await axios.get<JsonApiDocument>(`${this.API}/accounts/${accountId}`, this.headers())
                : await axios.get<{ data: Array<any> }>(
                    `${this.API}/accounts?filter[customerId]=${encodeURIComponent(this.requireCustomerId())}&page[limit]=1`,
                    this.headers()
                )
            const account = Array.isArray((res.data as any).data) ? (res.data as any).data[0] : (res.data as any).data
            if (!account) throw new (Error as any)('No deposit account found')
            this.depositAccountId = account.id
            return this.normalizeEscrowAccount(account)
        } catch (error: any) {
            throw new (Error as any)('.unit.escrow-acct-get', { cause: error.response?.data?.errors || error.response?.data || error.message })
        }
    }

    async addEscrowAcct(): Promise<EscrowAcct> {
        const payload = {
            data: {
                type: 'depositAccount',
                attributes: {
                    depositProduct: process.env.UNIT_DEPOSIT_PRODUCT || 'checking',
                    tags: {
                        customerId: this.requireCustomerId()
                    }
                },
                relationships: {
                    customer: {
                        data: {
                            type: 'customer',
                            id: this.requireCustomerId()
                        }
                    }
                }
            }
        }

        try {
            const res = await axios.post<JsonApiDocument>(`${this.API}/accounts`, payload, this.headers())
            this.depositAccountId = res.data.data.id
            return this.normalizeEscrowAccount(res.data.data)
        } catch (error: any) {
            throw new (Error as any)('.unit.escrow-acct-add', { cause: error.response?.data?.errors || error.response?.data })
        }
    }

    async getExitAcct(auth?: Auth): Promise<ExitAcct> {
        const linkedId = auth?.key
        if (linkedId) {
            try {
                const res = await axios.get<JsonApiDocument>(`${this.API}/counterparties/${linkedId}`, this.headers())
                return this.normalizeExitAccount(res.data.data)
            } catch (error: any) {
                throw new (Error as any)('.unit.exit-acct-get', { cause: error.response?.data?.errors || error.response?.data })
            }
        }

        try {
            const res = await axios.get<{ data: Array<any> }>(
                `${this.API}/counterparties?filter[customerId]=${encodeURIComponent(this.requireCustomerId())}&page[limit]=1`,
                this.headers()
            )
            const account = res.data.data?.[0]
            if (!account) throw new (Error as any)('No counterparties found')
            return this.normalizeExitAccount(account)
        } catch (error: any) {
            throw new (Error as any)('.unit.exit-acct-get', { cause: error.response?.data?.errors || error.response?.data || error.message })
        }
    }

    async addExitAcct(account: ExitAcct): Promise<string> {
        const payload = {
            data: {
                type: 'achCounterparty',
                attributes: {
                    name: 'Primary Exit Account',
                    routingNumber: String(account.routing),
                    accountNumber: String(account.account),
                    accountType: account.type === 'SAVINGS' ? 'Savings' : 'Checking',
                    type: 'Person',
                    permissions: 'CreditOnly'
                },
                relationships: {
                    customer: {
                        data: {
                            type: 'customer',
                            id: this.requireCustomerId()
                        }
                    }
                }
            }
        }

        try {
            const res = await axios.post<JsonApiDocument>(`${this.API}/counterparties`, payload, this.headers())
            return res.data.data.id
        } catch (error: any) {
            throw new (Error as any)('.unit.exit-acct-add', { cause: error.response?.data?.errors || error.response?.data })
        }
    }

    async addPaypal(user: User, username: string): Promise<string> {
        throw new (Error as any)('.unit.paypal-not-supported', { cause: `Unit does not expose native PayPal account support for ${username}.` })
    }

    async addVenmo(user: User, username: string): Promise<string> {
        throw new (Error as any)('.unit.venmo-not-supported', { cause: `Unit does not expose native Venmo account support for ${username}.` })
    }

    async createCheque(cheque: Cheque, auth?: Auth): Promise<any> {
        const payload = {
            data: {
                type: 'achPayment',
                attributes: {
                    amount: Math.round(Number(cheque.amount) * 100),
                    direction: 'Credit',
                    description: String(cheque.name || 'Payout').slice(0, 10),
                    addenda: cheque.name || 'PriceEdge payout',
                    idempotencyKey: `${cheque.account}-${cheque.recipient}-${Date.now()}`
                },
                relationships: {
                    account: {
                        data: {
                            type: 'account',
                            id: cheque.account || this.requireDepositAccountId()
                        }
                    },
                    counterparty: {
                        data: {
                            type: 'counterparty',
                            id: cheque.recipient
                        }
                    }
                }
            }
        }

        try {
            const res = await axios.post<JsonApiDocument>(`${this.API}/payments`, payload, this.headers())
            return res.data.data
        } catch (error: any) {
            throw new (Error as any)('.unit.cheque-create', { cause: error.response?.data?.errors || error.response?.data })
        }
    }

    async depositCheque(id: string, account: string): Promise<any> {
        throw new (Error as any)('.unit.cheque-deposit-not-supported', {
            cause: `Unit ACH payments are created directly and do not support depositCheque(${id}, ${account}).`
        })
    }

    private requireCustomerId(): string {
        if (!this.customerId) throw new (Error as any)('.unit.customer-id-missing')
        return this.customerId
    }

    private requireDepositAccountId(): string {
        if (!this.depositAccountId) throw new (Error as any)('.unit.deposit-account-id-missing')
        return this.depositAccountId
    }

    private normalizeEscrowAccount(account: any): EscrowAcct {
        const attrs = account?.attributes ?? {}
        return {
            id: account?.id,
            balance: Number(attrs.balance || 0) / 100,
            date: attrs.createdAt || new Date().toISOString(),
            name: attrs.name || 'Unit Deposit Account',
            numbers: {
                ACH: {
                    account_number: attrs.accountNumber || '',
                    routing_number: attrs.routingNumber || ''
                },
                RTP: {
                    account_number: attrs.accountNumber || '',
                    routing_number: attrs.routingNumber || ''
                },
                WIRE: {
                    account_number: attrs.accountNumber || '',
                    routing_number: attrs.routingNumber || ''
                }
            }
        }
    }

    private normalizeExitAccount(account: any): ExitAcct {
        const attrs = account?.attributes ?? {}
        return {
            id: account?.id,
            type: String(attrs.accountType || '').toLowerCase() === 'savings' ? 'SAVINGS' : 'CHECKING',
            routing: parseInt(attrs.routingNumber || '0', 10),
            account: parseInt(attrs.accountNumber || '0', 10),
            date: attrs.createdAt,
            status: attrs.status
        }
    }
}
