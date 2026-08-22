export type BankAccountOpeningField = { name: string; providerName: string; label: string; description?: string; type: 'text' | 'tel' | 'date' | 'select'; required: boolean; inputMode?: string; autocomplete?: string; placeholder?: string; defaultValue?: string; options?: Array<{ value: string; label: string }> }
export declare function registerBankAccountOpeningFields(partner: string, accountType: string, fields: BankAccountOpeningField[]): void
export declare function getBankAccountOpeningFields(partner: string, options?: { accountType?: string }): BankAccountOpeningField[]
export declare function listBankAccountOpeningPartners(): string[]
export declare function normalizeBankAccountOpeningData(partner: string, values?: Record<string, unknown>, options?: { accountType?: string }): Record<string, string>
