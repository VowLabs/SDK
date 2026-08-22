import { describe, it, expect, beforeEach, vi } from 'vitest'
import axios from 'axios'
import { Provider } from '../lib/banking/bridge'

vi.mock('axios')

describe('Bridge Banking Provider', () => {
    let provider: Provider
    const mockCustomerId = 'cust_test_123'
    const mockExternalAccountId = 'ea_test_456'

    beforeEach(() => {
        vi.clearAllMocks()
        process.env.BRIDGE_API_KEY = 'test_key_123'
        process.env.BRIDGE_API_URL = 'https://api.bridge.xyz/v0'
        provider = new Provider()
    })

    describe('User Management', () => {
        it('should create a new user', async () => {
            const mockResponse = {
                data: {
                    id: mockCustomerId,
                    first_name: 'John',
                    last_name: 'Doe',
                    email: 'john@example.com',
                    status: 'active',
                    type: 'individual',
                    created_at: '2024-01-01T00:00:00Z'
                }
            }

            vi.mocked(axios.post).mockResolvedValue(mockResponse)

            const result = await provider.newUser({
                id: 'user_123',
                name: 'John Doe'
            })

            expect(result).toBe(mockCustomerId)
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining('/customers'),
                expect.objectContaining({
                    type: 'individual',
                    first_name: 'John',
                    last_name: 'Doe'
                }),
                expect.any(Object)
            )
        })

        it('should get user information', async () => {
            provider.userId = mockCustomerId

            const mockResponse = {
                data: {
                    id: mockCustomerId,
                    first_name: 'John',
                    last_name: 'Doe',
                    email: 'john@example.com',
                    status: 'active'
                }
            }

            vi.mocked(axios.get).mockResolvedValue(mockResponse)

            const result = await provider.getUser()

            expect(result).toEqual(mockResponse.data)
            expect(axios.get).toHaveBeenCalledWith(
                expect.stringContaining(`/customers/${mockCustomerId}`),
                expect.any(Object)
            )
        })

        it('should edit user information', async () => {
            provider.userId = mockCustomerId

            const mockResponse = {
                data: { success: true }
            }

            vi.mocked(axios.put).mockResolvedValue(mockResponse)

            const result = await provider.editUser({ dob: '1990-01-15' })

            expect(axios.put).toHaveBeenCalledWith(
                expect.stringContaining(`/customers/${mockCustomerId}`),
                expect.objectContaining({
                    birth_date: '1990-01-15'
                }),
                expect.any(Object)
            )
        })

        it('should delete a user', async () => {
            const mockResponse = { status: 204 }
            vi.mocked(axios.delete).mockResolvedValue(mockResponse)

            const result = await provider.delUser(mockCustomerId)

            expect(result).toEqual({ success: true })
            expect(axios.delete).toHaveBeenCalledWith(
                expect.stringContaining(`/customers/${mockCustomerId}`),
                expect.any(Object)
            )
        })

        it('should throw error when creating user without API key', async () => {
            delete process.env.BRIDGE_API_KEY

            expect(() => {
                new Provider()
            }).toThrow('No BRIDGE_API_KEY in env')
        })
    })

    describe('External Accounts (Bank Accounts)', () => {
        it('should add an external bank account', async () => {
            provider.userId = mockCustomerId

            const mockResponse = {
                data: {
                    id: mockExternalAccountId,
                    account_type: 'us',
                    currency: 'usd',
                    account_owner_name: 'John Doe',
                    account: {
                        routing_number: '121000248',
                        last_4: '1234'
                    }
                }
            }

            vi.mocked(axios.post).mockResolvedValue(mockResponse)

            const result = await provider.addExitAcct({
                type: 'CHECKING',
                routing: 121000248,
                account: 1234
            })

            expect(result).toBe(mockExternalAccountId)
            expect(axios.post).toHaveBeenCalledWith(
                expect.stringContaining(`/customers/${mockCustomerId}/external_accounts`),
                expect.any(Object),
                expect.any(Object)
            )
        })

        it('should get external bank account', async () => {
            provider.userId = mockCustomerId

            const mockResponse = {
                data: {
                    data: [{
                        id: mockExternalAccountId,
                        account_type: 'us',
                        account: {
                            routing_number: '121000248',
                            account_number: '1234567890',
                            checking_or_savings: 'checking',
                            last_4: '7890'
                        },
                        active: true,
                        created_at: '2024-01-01T00:00:00Z'
                    }]
                }
            }

            vi.mocked(axios.get).mockResolvedValue(mockResponse)

            const result = await provider.getExitAcct()

            expect(result).toEqual({
                id: mockExternalAccountId,
                type: 'CHECKING',
                routing: 121000248,
                account: 7890,
                status: 'active',
                date: '2024-01-01T00:00:00Z'
            })
        })

        it('should throw error when no external accounts exist', async () => {
            provider.userId = mockCustomerId

            const mockResponse = {
                data: {
                    data: []
                }
            }

            vi.mocked(axios.get).mockResolvedValue(mockResponse)

            await expect(provider.getExitAcct()).rejects.toThrow('.bridge.exit-acct-get')
        })
    })

    describe('Escrow Accounts (Bridge Wallets)', () => {
        it('should get escrow account', async () => {
            provider.userId = mockCustomerId

            const mockResponse = {
                data: {
                    id: mockCustomerId,
                    first_name: 'John',
                    last_name: 'Doe',
                    created_at: '2024-01-01T00:00:00Z'
                }
            }

            vi.mocked(axios.get).mockResolvedValue(mockResponse)

            const result = await provider.getEscrowAcct()

            expect(result).toEqual({
                id: mockCustomerId,
                name: 'John Doe',
                balance: 0,
                date: '2024-01-01T00:00:00Z',
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
            })
        })

        it('should add escrow account', async () => {
            provider.userId = mockCustomerId

            const mockResponse = {
                data: {
                    id: mockCustomerId,
                    first_name: 'John',
                    last_name: 'Doe',
                    created_at: '2024-01-01T00:00:00Z'
                }
            }

            vi.mocked(axios.get).mockResolvedValue(mockResponse)

            const result = await provider.addEscrowAcct()

            expect(result.id).toBe(mockCustomerId)
            expect(result.balance).toBe(0)
            expect(result.numbers.ACH).toBeDefined()
        })
    })

    describe('Transfers (Cheques)', () => {
        it('should create a cheque', async () => {
            provider.userId = mockCustomerId

            const result = await provider.createCheque({
                name: 'John Doe',
                amount: 1000,
                account: 'checking',
                recipient: 'user_123'
            })

            expect(result).toEqual(
                expect.objectContaining({
                    amount: 1000,
                    account: 'checking',
                    recipient: 'user_123',
                    status: 'pending'
                })
            )
        })

        it('should deposit cheque', async () => {
            provider.userId = mockCustomerId

            const result = await provider.depositCheque('chq_123', 'checking')

            expect(result).toEqual(
                expect.objectContaining({
                    id: 'chq_123',
                    account: 'checking',
                    status: 'submitted'
                })
            )
        })
    })

    describe('Unsupported Methods', () => {
        it('should throw error for PayPal', async () => {
            await expect(
                provider.addPaypal({ id: 'user_123', name: 'John' }, 'john_paypal')
            ).rejects.toThrow('.bridge.paypal-not-supported')
        })

        it('should throw error for Venmo', async () => {
            await expect(
                provider.addVenmo({ id: 'user_123', name: 'John' }, 'john_venmo')
            ).rejects.toThrow('.bridge.venmo-not-supported')
        })
    })

    describe('Error Handling', () => {
        it('should throw error when getting user without userId', async () => {
            provider.userId = undefined

            await expect(provider.getUser()).rejects.toThrow('.bridge.user-get-no-id')
        })

        it('should throw error when getting exit account without userId', async () => {
            provider.userId = undefined

            await expect(provider.getExitAcct()).rejects.toThrow('.bridge.exit-acct-get-no-id')
        })

        it('should handle API errors', async () => {
            provider.userId = mockCustomerId

            const mockError = {
                response: {
                    data: {
                        error: 'Invalid request'
                    }
                }
            }

            vi.mocked(axios.get).mockRejectedValue(mockError)

            await expect(provider.getUser()).rejects.toThrow('.bridge.user-get')
        })
    })
})
