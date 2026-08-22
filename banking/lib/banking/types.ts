export interface User {
    id: string;
    name?: string;
    email?: string;
    dob?: string;
    ssn?: string;
    phone?: string;
    ip?: string;
    business_name?: string;
    ein?: string;
    address?: {
        street: string;
        city: string;
        state: string;
        zip: string;
        country?: string;
    };
    daily_dollar_volume?: number;
    liquidity_commitment_months?: number;
}
export interface Auth {
    key: string;
    secret: string;
}
export interface ExitAcct {
    id?: string,
    type: 'CHECKING' | 'SAVINGS',
    routing: number,
    account: number,
    date?: string,
    status?: string
}
export interface EscrowAcct {
    id: string,
    balance: number,
    date: string,
    name: string,
    numbers: {
        ACH: {
            account_number: string,
            routing_number: string
        },
        RTP: {
            account_number: string,
            routing_number: string
        },
        WIRE: {
            account_number: string,
            routing_number: string
        }
    }
}
export interface Cheque {
    name: string;
    amount: number;
    account: string;
    recipient: string;
    deposit_options?: string[];
    balance?: number;
}

export interface BankingProvider {
    getUser(auth?: Auth): Promise<any>
    newUser(o: User): Promise<string>
    editUser(user: {dob: string}): Promise<any>
    delUser(user_id: string): Promise<{success: boolean}>
    getEscrowAcct(auth?: Auth): Promise<EscrowAcct>
    addEscrowAcct(): Promise<EscrowAcct>
    getExitAcct(auth?: Auth): Promise<ExitAcct>
    addExitAcct(account: ExitAcct): Promise<string>
    addPaypal(user: User, username: string): Promise<string>
    addVenmo(user: User, username: string): Promise<string>
    createCheque(cheque: Cheque, auth?: Auth): Promise<any>
    depositCheque(id: string, account: string): Promise<any>
}
