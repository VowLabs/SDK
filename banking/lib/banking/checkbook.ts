import axios from 'axios'
import { User, Auth, EscrowAcct, ExitAcct, Cheque, BankingProvider } from './types'
import { die } from './utils'

export class Provider implements BankingProvider {
    API: string
    admin: Auth
    auth: Auth

    constructor() {
        this.API = process.env.CHKBK_URL || die('No CHECKBOOK in env')
        const key: string = process.env.CHKBK_PUBLIC ?? ''
        const secret: string = process.env.CHKBK_SECRET ?? ''
        key && secret || die('No CHECKBOOK credentials in env')
        this.admin = this.auth = { key, secret }
    }

    headers(auth?: Auth) {
        const a = auth || this.auth
        var headers = {
            'Content-Type': 'application/json',
            'Authorization': a.key + ':' + a.secret
        }
        return { headers }
    }

    async getUser(auth?: Auth) {
        const url = this.API + '/v3/user'
        const headers = this.headers(auth)
        try {
            const ret = await axios.get(url, headers)
            return ret.data.user
        } catch (error: any) {
            const cause = error.response?.data.error
            throw new (Error as any)('.checkbook.user-get', { cause })
        }
    }

    async newUser(o: User): Promise<string> {
        const url = this.API + '/v3/user'
        const { id, name, email, business_name, ein, address } = o
        if (!name) throw new (Error as any)('.checkbook.user-new-no-name')
        const headers = this.headers(this.admin)
        try {
            const payload = {
                user_id: id,
                name,
                email,
                business_name,
                ein,
                ...address
            }
            const res = await axios.post(url, payload, headers)
            this.auth = { key: res.data.key, secret: res.data.secret }
            return res.data.id
        } catch (error: any) {
            throw new (Error as any)('.checkbook.user-new', { cause: error.response?.data.error })
        }
    }

    async editUser(user: { dob: string }) {
        const url = this.API + '/v3/user'
        try {
            const headers = this.headers(this.auth)
            const res = await axios.put(url, { user }, headers)
            return res.data
        } catch (error: any) {
            throw new (Error as any)('.checkbook.user-edit', { cause: error.response?.data.error })
        }
    }

    async delUser(user_id: string) {
        if (!user_id) throw new (Error as any)('.checkbook.user-del-no-id')
        const url = this.API + '/v3/user/' + user_id
        try {
            const res = await axios.delete(url, this.headers(this.admin))
            return { success: res.status >= 200 && res.status < 300 }
        } catch (error: any) {
            throw new (Error as any)('.checkbook.user-del', { cause: error.response?.data.error })
        }
    }

    async getEscrowAcct(auth?: Auth): Promise<EscrowAcct> {
        const url = this.API + '/v3/account/wallet'
        try {
            const headers = this.headers(auth)
            const res = await axios.get(url, headers)
            return res.data.wallets[0]
        } catch (error: any) {
            throw new (Error as any)('.checkbook.escrow-acct-get', { cause: error.response?.data.error })
        }
    }

    async addEscrowAcct(): Promise<EscrowAcct> {
        const url = this.API + '/v3/account/wallet'
        const data = { name: 'Primary Wallet' }
        try {
            const headers = this.headers(this.auth)
            const res = await axios.post(url, data, headers)
            res.data.balance = 0
            return res.data
        } catch (error: any) {
            throw new (Error as any)('.checkbook.escrow-acct-add', { cause: error.response?.data.error })
        }
    }

    async getExitAcct(auth?: Auth): Promise<ExitAcct> {
        const url = this.API + '/v3/account/bank'
        try {
            const headers = this.headers(this.auth)
            const res = await axios.get(url, headers)
            return res.data.banks[0]
        } catch (error: any) {
            throw new (Error as any)('.checkbook.exit-acct-add', { cause: error.response?.data.error })
        }
    }

    async addExitAcct(account: ExitAcct): Promise<string> {
        const url = this.API + '/v3/account/bank'
        try {
            const headers = this.headers(this.auth)
            const payload = {
                type: account.type,
                account: account.account.toString(),
                routing: account.routing.toString()
            }
            const res = await axios.post(url, payload, headers)
            return res.data.id
        } catch (error: any) {
            throw new (Error as any)('.checkbook.exit-acct-add', { cause: error.response?.data.error })
        }
    }

    async addPaypal(user: User, username: string): Promise<string> {
        const url = this.API + '/v3/account/paypal'
        try {
            const headers = this.headers(this.auth)
            const res = await axios.post(url, { username }, headers)
            return res.data.id
        } catch (error: any) {
            throw new (Error as any)('.checkbook.paypal-add', { cause: error.response?.data.error })
        }
    }

    async addVenmo(user: User, username: string): Promise<string> {
        const url = this.API + '/v3/account/venmo'
        try {
            const headers = this.headers(this.auth)
            const res = await axios.post(url, { username }, headers)
            return res.data.id
        } catch (error: any) {
            throw new (Error as any)('.checkbook.venmo-add', { cause: error.response?.data.error })
        }
    }

    async createCheque(cheque: Cheque, auth?: Auth) {
        const url = this.API + '/v3/check/digital'
        if (!cheque.deposit_options) {
            const opts = 'BANK,RTP,CARD,PAYPAL,VENMO,WIRE,VCC,WALLET'
            cheque.deposit_options = opts.split(',')
        }
        try {
            const headers = this.headers(auth || this.auth)
            const res = await axios.post(url, cheque, headers)
            return res.data
        } catch (error: any) {
            throw new (Error as any)('.checkbook.cheque-create', { cause: error.response?.data.error })
        }
    }

    async depositCheque(id: string, account: string) {
        const url = this.API + '/v3/check/deposit/' + id
        try {
            const headers = this.headers(this.auth)
            const res = await axios.post(url, { account }, headers)
            return res.data
        } catch (error: any) {
            throw new (Error as any)('.checkbook.cheque-deposit', { cause: error.response?.data.error })
        }
    }
}
