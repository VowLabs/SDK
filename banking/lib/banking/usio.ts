import axios from 'axios'
import { EscrowAcct, ExitAcct, Cheque, User, Auth, BankingProvider } from './types'
import { die } from './utils'

export class Provider implements BankingProvider {
    debug: boolean = false
    API: string
    key: string
    secret: string

    constructor() {
        this.API = process.env.USIO_API || ''
        this.key = process.env.USIO_KEY || ''
        this.secret = process.env.USIO_SECRET || ''
        if (!this.API) die('No USIO_API in env')
        if (!this.key || !this.secret) die('No USIO credentials in env')
    }

    headers() {
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `${this.key}:${this.secret}`
        }
        if (this.debug) console.log('usio: headers', headers)
        return { headers }
    }

    async getUser(auth?: Auth) {
        const url = `${this.API}/v1/user`
        try {
            const res = await axios.get(url, this.headers())
            return res.data.user
        } catch (error: any) {
            throw new Error('.checkbook.user-get', { cause: error.response?.data?.error })
        }
    }

    async newUser(o: User): Promise<string> {
        const url = `${this.API}/v1/user`
        const {id, name} = o
        if (!name) throw new Error('.checkbook.user-new-no-name')
        try {
            const res = await axios.post(url, { user_id: id, name }, this.headers())
            return res.data.id
        } catch (error: any) {
            throw new Error('.checkbook.user-new', { cause: error.response?.data?.error })
        }
    }

    async editUser(user: {dob: string}) {
        const url = `${this.API}/v1/user`
        try {
            const res = await axios.put(url, { user }, this.headers())
            return res.data
        } catch (error: any) {
            throw new Error('.checkbook.user-edit', { cause: error.response?.data?.error })
        }
    }

    async delUser(user_id: string) {
        if (!user_id) throw new Error('.checkbook.user-del-no-id')
        const url = `${this.API}/v1/user/${user_id}`
        try {
            const res = await axios.delete(url, this.headers())
            return { success: res.status >= 200 && res.status < 300 }
        } catch (error: any) {
            throw new Error('.checkbook.user-del', { cause: error.response?.data?.error })
        }
    }

    async getEscrowAcct(): Promise<EscrowAcct> {
        const url = `${this.API}/v1/account/wallet`
        try {
            const res = await axios.get(url, this.headers())
            return res.data.wallets[0]
        } catch (error: any) {
            throw new Error('.checkbook.escrow-acct-get', { cause: error.response?.data?.error })
        }
    }

    async addEscrowAcct(): Promise<EscrowAcct> {
        const url = `${this.API}/v1/account/wallet`
        const data = { name: 'Primary Wallet' }
        try {
            const res = await axios.post(url, data, this.headers())
            res.data.balance = 0
            return res.data
        } catch (error: any) {
            throw new Error('.checkbook.escrow-acct-add', { cause: error.response?.data?.error })
        }
    }

    async getExitAcct(): Promise<ExitAcct> {
        const url = `${this.API}/v1/account/bank`
        try {
            const res = await axios.get(url, this.headers())
            return res.data.banks[0]
        } catch (error: any) {
            throw new Error('.checkbook.exit-acct-add', { cause: error.response?.data?.error })
        }
    }

    async addExitAcct(account: ExitAcct): Promise<string> {
        const url = `${this.API}/v1/account/bank`
        try {
            const res = await axios.post(url, account, this.headers())
            return res.data.id
        } catch (error: any) {
            throw new Error('.checkbook.exit-acct-add', { cause: error.response?.data?.error })
        }
    }

    async addPaypal(user: User, username: string): Promise<string> {
        const url = `${this.API}/v1/account/paypal`
        try {
            const res = await axios.post(url, { username }, this.headers())
            return res.data.id
        } catch (error: any) {
            throw new Error('.checkbook.paypal-add', { cause: error.response?.data?.error })
        }
    }

    async addVenmo(user: User, username: string): Promise<string> {
        const url = `${this.API}/v1/account/venmo`
        try {
            const res = await axios.post(url, { username }, this.headers())
            return res.data.id
        } catch (error: any) {
            throw new Error('.checkbook.venmo-add', { cause: error.response?.data?.error })
        }
    }

    async createCheque(cheque: Cheque, auth?: Auth) {
        const url = `${this.API}/v1/check/digital`
        if (!cheque.deposit_options) {
            const opts = 'BANK,RTP,CARD,PAYPAL,VENMO,WIRE,VCC,WALLET'
            cheque.deposit_options = opts.split(',')
        }
        try {
            const res = await axios.post(url, cheque, this.headers())
            return res.data
        } catch (error: any) {
            throw new Error('.checkbook.cheque-create', { cause: error.response?.data?.error })
        }
    }

    async depositCheque(id: string, account: string) {
        const url = `${this.API}/v1/check/deposit/${id}`
        try {
            const res = await axios.post(url, { account }, this.headers())
            return res.data
        } catch (error: any) {
            throw new Error('.checkbook.cheque-deposit', { cause: error.response?.data?.error })
        }
    }
}
