import axios from 'axios'
import { createHash, randomUUID } from 'node:crypto'
import type { Auth, BankingProvider, Cheque, EscrowAcct, ExitAcct, User } from './types.js'
import type {
    SwipeLuxOptions, SwipeLuxWriteOptions, SwipeLuxCustomerInput, SwipeLuxCustomer,
    SwipeLuxPage, SwipeLuxPageOptions, SwipeLuxAccountInput, SwipeLuxAccount,
    SwipeLuxCapability, SwipeLuxQuoteInput, SwipeLuxQuote, SwipeLuxTransferInput, SwipeLuxTransfer
} from './swipelux-types.js'

export class SwipeLuxError extends Error {
    readonly cause: unknown
    constructor(operation: string, cause?: unknown, readonly idempotencyKey?: string) {
        super(`.swipelux.${operation}`)
        this.name = 'SwipeLuxError'
        this.cause = cause
    }
}

/** Server-only adapter. Keep one instance per customer context. */
export class Provider implements BankingProvider {
    readonly API: string
    private readonly apiKey: string
    userId?: string

    constructor(options: SwipeLuxOptions = {}) {
        this.apiKey = options.apiKey ?? process.env.SWIPELUX_API_KEY ?? ''
        if (!this.apiKey.trim()) throw new SwipeLuxError('config-no-api-key')
        this.API = (options.apiUrl ?? process.env.SWIPELUX_API_URL ?? 'https://platform.swipelux.com').replace(/\/+$/, '')
        const url = new URL(this.API)
        if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
            throw new SwipeLuxError('config-invalid-api-url')
        }
        this.userId = options.customerId
    }

    headers(options?: SwipeLuxWriteOptions) {
        if (options && (!options.idempotencyKey?.trim() || options.idempotencyKey.length > 255)) {
            throw new SwipeLuxError('idempotency-key-invalid')
        }
        return { headers: {
            'Content-Type': 'application/json',
            'X-API-Key': this.apiKey,
            ...(options ? { 'Idempotency-Key': options.idempotencyKey } : {})
        } }
    }

    private segment(value: string, label: string) {
        if (!value?.trim() || value === '.' || value === '..') throw new SwipeLuxError(`${label}-no-id`)
        return encodeURIComponent(value)
    }

    private customerPath() {
        return `/v3/customers/${this.segment(this.userId ?? '', 'user')}`
    }

    private async request<T>(operation: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string,
        data?: unknown, options?: SwipeLuxWriteOptions, params?: object, page = false): Promise<T> {
        if (method !== 'GET' && !options) throw new SwipeLuxError('idempotency-key-required')
        const config = this.headers(options)
        try {
            const response = await axios.request({
                method, url: this.API + path, data, params, ...config,
                timeout: 30_000, maxRedirects: 0
            })
            if (response.status === 204) return undefined as T
            if (!response.data || !Object.prototype.hasOwnProperty.call(response.data, 'data')) {
                throw new SwipeLuxError('invalid-response')
            }
            return page ? response.data : response.data.data
        } catch (error: unknown) {
            // Do not retain the Axios request/config: it contains the secret API key.
            const cause = axios.isAxiosError(error) ? error.response?.data ?? { code: error.code } : error
            throw new SwipeLuxError(operation, cause, options?.idempotencyKey)
        }
    }

    private rejectAuth(auth?: Auth) {
        if (auth) throw new SwipeLuxError('per-user-auth-not-supported')
    }

    async getUser(auth?: Auth): Promise<SwipeLuxCustomer> {
        this.rejectAuth(auth)
        return this.request('user-get', 'GET', this.customerPath())
    }

    async createCustomer(input: SwipeLuxCustomerInput, options: SwipeLuxWriteOptions): Promise<SwipeLuxCustomer> {
        const customer = await this.request<SwipeLuxCustomer>('user-new', 'POST', '/v3/customers', input, options)
        if (!customer?.id) throw new SwipeLuxError('user-new-invalid-response', undefined, options.idempotencyKey)
        this.userId = customer.id
        return customer
    }

    async newUser(user: User, options?: SwipeLuxWriteOptions): Promise<string> {
        if (!user.id?.trim()) throw new SwipeLuxError('user-new-no-id')
        const address = user.address && {
            streetLine1: user.address.street, city: user.address.city, state: user.address.state,
            postalCode: user.address.zip, country: user.address.country
        }
        const [firstName, ...lastName] = (user.name?.trim() || '').split(/\s+/)
        const input: SwipeLuxCustomerInput = user.business_name ? {
            type: 'business', externalId: user.id,
            business: { legalName: user.business_name, email: user.email, phone: user.phone,
                registeredAddress: address,
                ...(user.ein ? { taxIdentifiers: [{ type: 'ein', country: 'US', value: user.ein }] } : {}) }
        } : {
            type: 'individual', externalId: user.id,
            individual: { firstName: firstName || undefined, lastName: lastName.join(' ') || undefined,
                email: user.email, phone: user.phone, birthDate: user.dob,
                residenceCountry: user.address?.country, residentialAddress: address,
                ...(user.ssn ? { taxIdentifiers: [{ type: 'ssn', country: 'US', value: user.ssn }] } : {}) }
        }
        // A stable key lets the legacy facade safely retry the same customer creation.
        const key = 'customer-' + createHash('sha256').update(JSON.stringify(input)).digest('hex')
        return (await this.createCustomer(input, options ?? { idempotencyKey: key })).id
    }

    async editUser(user: { dob: string }, options: SwipeLuxWriteOptions = { idempotencyKey: randomUUID() }): Promise<SwipeLuxCustomer> {
        return this.request('user-edit', 'PATCH', this.customerPath(), { individual: { birthDate: user.dob } }, options)
    }

    async delUser(id: string, options: SwipeLuxWriteOptions = { idempotencyKey: randomUUID() }): Promise<{ success: boolean }> {
        await this.request('user-del', 'DELETE', `/v3/customers/${this.segment(id, 'user-del')}`, undefined, options)
        if (this.userId === id) this.userId = undefined
        return { success: true }
    }

    listCapabilities(): Promise<SwipeLuxCapability[]> {
        return this.request('capabilities-list', 'GET', `${this.customerPath()}/capabilities`)
    }

    getSupportedCapabilities(): Promise<unknown> {
        return this.request('capabilities-supported', 'GET', `${this.customerPath()}/capabilities/supported`)
    }

    requestCapability(id: string, options: SwipeLuxWriteOptions, institutions?: string[]): Promise<SwipeLuxCapability> {
        return this.request('capability-request', 'POST', `${this.customerPath()}/capabilities/${this.segment(id, 'capability')}`, { institutions }, options)
    }

    getTask(id: string): Promise<Record<string, unknown>> {
        return this.request('task-get', 'GET', `${this.customerPath()}/tasks/${this.segment(id, 'task')}`)
    }

    submitTask(id: string, input: Record<string, unknown>, options: SwipeLuxWriteOptions): Promise<Record<string, unknown>> {
        return this.request('task-submit', 'POST', `${this.customerPath()}/tasks/${this.segment(id, 'task')}/submissions`, input, options)
    }

    createAccount(input: SwipeLuxAccountInput, options: SwipeLuxWriteOptions): Promise<SwipeLuxAccount> {
        return this.request('account-create', 'POST', `${this.customerPath()}/accounts`, input, options)
    }

    listAccounts(params: SwipeLuxPageOptions = {}): Promise<SwipeLuxPage<SwipeLuxAccount>> {
        return this.request('accounts-list', 'GET', `${this.customerPath()}/accounts`, undefined, undefined, params, true)
    }

    getAccount(id: string): Promise<SwipeLuxAccount> {
        return this.request('account-get', 'GET', `${this.customerPath()}/accounts/${this.segment(id, 'account')}`)
    }

    createQuote(input: SwipeLuxQuoteInput, options: SwipeLuxWriteOptions): Promise<SwipeLuxQuote> {
        this.customerPath()
        return this.request('quote-create', 'POST', '/v3/quotes', { ...input, customerId: this.userId }, options)
    }

    getQuote(id: string): Promise<SwipeLuxQuote> {
        return this.request('quote-get', 'GET', `/v3/quotes/${this.segment(id, 'quote')}`)
    }

    createTransfer(input: SwipeLuxTransferInput, options: SwipeLuxWriteOptions): Promise<SwipeLuxTransfer> {
        return this.request('transfer-create', 'POST', '/v3/transfers', input, options)
    }

    getTransfer(id: string): Promise<SwipeLuxTransfer> {
        return this.request('transfer-get', 'GET', `/v3/transfers/${this.segment(id, 'transfer')}`)
    }

    getTransferInstructions(id: string): Promise<Record<string, unknown>> {
        return this.request('transfer-instructions', 'GET', `/v3/transfers/${this.segment(id, 'transfer')}/instructions`)
    }

    // The legacy shapes cannot express settlement wallets, currencies, capability
    // requirements, string bank identifiers or quote execution. Never fabricate them.
    async getEscrowAcct(_auth?: Auth): Promise<EscrowAcct> { throw new SwipeLuxError('escrow-acct-get-not-supported') }
    async addEscrowAcct(): Promise<EscrowAcct> { throw new SwipeLuxError('escrow-acct-add-not-supported') }
    async getExitAcct(_auth?: Auth): Promise<ExitAcct> { throw new SwipeLuxError('exit-acct-get-not-supported') }
    async addExitAcct(_account: ExitAcct): Promise<string> { throw new SwipeLuxError('exit-acct-add-not-supported') }
    async addPaypal(_user: User, _username: string): Promise<string> { throw new SwipeLuxError('paypal-not-supported') }
    async addVenmo(_user: User, _username: string): Promise<string> { throw new SwipeLuxError('venmo-not-supported') }
    async createCheque(_cheque: Cheque, _auth?: Auth): Promise<never> { throw new SwipeLuxError('cheque-create-not-supported') }
    async depositCheque(_id: string, _account: string): Promise<never> { throw new SwipeLuxError('cheque-deposit-not-supported') }
}
