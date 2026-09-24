/** SwipeLux v3 wire types. Monetary values and bank identifiers stay strings. */
export interface SwipeLuxOptions {
    apiKey?: string
    apiUrl?: string
    customerId?: string
}

export interface SwipeLuxWriteOptions {
    /** Persist before sending; reuse only with the identical operation and body. */
    idempotencyKey: string
}

export type SwipeLuxCustomerInput = (
    { type: 'individual'; individual?: Record<string, unknown> } |
    { type: 'business'; business: { legalName: string; [key: string]: unknown } }
) & { externalId?: string; financialProfile?: Record<string, unknown>; metadata?: Record<string, string | number | boolean> }

export interface SwipeLuxCustomer {
    id: string
    type: 'individual' | 'business'
    externalId?: string | null
    individual?: Record<string, unknown>
    business?: Record<string, unknown>
    [key: string]: unknown
}

export interface SwipeLuxPage<T> {
    data: T[]
    nextCursor: string | null
    hasMore: boolean
}

export interface SwipeLuxPageOptions {
    cursor?: string
    limit?: number
}

export type SwipeLuxAccountInput = (
    { origin: 'issued'; type: 'wallet'; network: string } |
    { origin: 'external'; type: 'wallet'; network: string; details: { address: string } } |
    { origin: 'issued'; type: 'bank'; method: string; country: string; settlement: { accountId: string } } |
    { origin: 'external'; type: 'bank'; methods: string[]; country: string; details: Record<string, string> }
) & { currency: string; label?: string }

export interface SwipeLuxAccount {
    id: string
    type: 'wallet' | 'bank'
    origin: 'issued' | 'external'
    status: string
    openTaskIds: string[]
    currency: string
    details: Record<string, unknown> | null
    balances?: Array<{ currency: string; available: string; pending: string }>
    [key: string]: unknown
}

export interface SwipeLuxCapability {
    id: string
    status: string
    openTaskIds: string[]
    [key: string]: unknown
}

export type SwipeLuxQuoteInput = {
    capabilityId: string
    destinationId: string
    externalId?: string
} & (
    { in: { amount: string; currency: string; accountId?: string }; out: { currency: string; amount?: never } } |
    { in: { currency: string; accountId?: string; amount?: never }; out: { amount: string; currency: string } }
)

export interface SwipeLuxQuote {
    id: string
    status: string
    expiresAt: string
    in: { amount: string; currency: string; [key: string]: unknown }
    out: { amount: string; currency: string; [key: string]: unknown }
    [key: string]: unknown
}

export interface SwipeLuxTransferInput {
    quoteId: string
    externalId?: string
    memo?: string
    checkoutMethod?: string
    redirectUrl?: string
    supportingDocuments?: string[]
}

export interface SwipeLuxTransfer {
    id: string
    state: string
    openTaskIds: string[]
    [key: string]: unknown
}
