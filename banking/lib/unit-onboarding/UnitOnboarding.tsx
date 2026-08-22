'use client'

import { useEffect, useState } from 'react'
import { Button, Text } from '@telegram-apps/telegram-ui'

import styles from './UnitOnboarding.module.css'
import type { UnitCreatedAccount, UnitOnboardingFormState } from './types'

const initialForm: UnitOnboardingFormState = {
  first_name: '',
  last_name: '',
  email: '',
  dob: '',
  ssn: '',
  phone: '',
  street: '',
  city: '',
  state: '',
  zip: '',
  country: 'US'
}

export function UnitOnboarding({
  endpoint = '/api/unit/onboarding',
  embedded = false,
  title = 'Create a Banking-linked Unit bank account',
  intro = 'Complete this form with the identity and address details Unit needs to create an individual bank account.',
  initialAccount = null,
  initialFormValues,
  onComplete
}: {
  endpoint?: string
  embedded?: boolean
  title?: string
  intro?: string
  initialAccount?: UnitCreatedAccount | null
  initialFormValues?: Partial<UnitOnboardingFormState> | null
  onComplete?: (account: UnitCreatedAccount) => void
}) {
  const [form, setForm] = useState<UnitOnboardingFormState>(initialForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [account, setAccount] = useState<UnitCreatedAccount | null>(initialAccount)
  const [copied, setCopied] = useState('')

  useEffect(() => {
    if (initialAccount) {
      setAccount(initialAccount)
      setError('')
    }
  }, [initialAccount])

  useEffect(() => {
    if (!initialFormValues) {
      return
    }

    setForm((current) => ({
      ...current,
      ...initialFormValues
    }))
  }, [initialFormValues])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')
    setAccount(null)

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form)
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Unable to create Unit account.')
      }
      setAccount(result.account)
      onComplete?.(result.account)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  function update<K extends keyof UnitOnboardingFormState>(key: K, value: UnitOnboardingFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function copyValue(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(label)
      window.setTimeout(() => setCopied(''), 1500)
    } catch {
      setCopied('')
    }
  }

  return (
    <div className={`${styles.shell} ${embedded ? styles.embedded : ''}`}>
      <Text className={styles.intro}>
        <strong>{title}</strong>
      </Text>
      <Text className={styles.intro}>{intro}</Text>

      <form className={styles.form} onSubmit={onSubmit}>
        <div className={styles.grid}>
          <label>
            <span>First name</span>
            <input value={form.first_name} onChange={(e) => update('first_name', e.target.value)} required />
          </label>
          <label>
            <span>Last name</span>
            <input value={form.last_name} onChange={(e) => update('last_name', e.target.value)} required />
          </label>
        </div>

        <label>
          <span>Email</span>
          <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required />
        </label>

        <div className={styles.grid}>
          <label>
            <span>Date of birth</span>
            <input type="date" value={form.dob} onChange={(e) => update('dob', e.target.value)} required />
          </label>
          <label>
            <span>SSN</span>
            <input value={form.ssn} onChange={(e) => update('ssn', e.target.value)} placeholder="123456789" required />
          </label>
        </div>

        <label>
          <span>Phone</span>
          <input value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="5555555555" />
        </label>

        <label>
          <span>Street</span>
          <input value={form.street} onChange={(e) => update('street', e.target.value)} required />
        </label>

        <div className={`${styles.grid} ${styles.gridTriple}`}>
          <label>
            <span>City</span>
            <input value={form.city} onChange={(e) => update('city', e.target.value)} required />
          </label>
          <label>
            <span>State</span>
            <input value={form.state} onChange={(e) => update('state', e.target.value)} required />
          </label>
          <label>
            <span>ZIP</span>
            <input value={form.zip} onChange={(e) => update('zip', e.target.value)} required />
          </label>
        </div>

        <label>
          <span>Country</span>
          <input value={form.country} onChange={(e) => update('country', e.target.value)} required />
        </label>

        {error ? <div className={styles.error}>{error}</div> : null}

        <div className={styles.actions}>
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create account'}
          </Button>
        </div>
      </form>

      {account ? (
        <section className={styles.account}>
          <h3>Account created</h3>
          <div className={styles.summary}>
            <div><span>Account ID</span><strong>{account.id}</strong></div>
            <div><span>Name</span><strong>{account.name}</strong></div>
            <div><span>Balance</span><strong>${account.balance.toFixed(2)}</strong></div>
            <div><span>Created</span><strong>{new Date(account.created_at).toLocaleString()}</strong></div>
          </div>

          {copied ? <div className={styles.success}>{copied} copied</div> : null}

          <div className={styles.rails}>
            <article>
              <h4>ACH</h4>
              <div className={styles.copyRow}>
                <p>Routing: {account.ach.routing_number}</p>
                <button className={styles.copyButton} type="button" onClick={() => copyValue('ACH routing number', account.ach.routing_number)}>
                  Copy
                </button>
              </div>
              <div className={styles.copyRow}>
                <p>Account: {account.ach.account_number}</p>
                <button className={styles.copyButton} type="button" onClick={() => copyValue('ACH account number', account.ach.account_number)}>
                  Copy
                </button>
              </div>
            </article>
            <article>
              <h4>RTP</h4>
              <div className={styles.copyRow}>
                <p>Routing: {account.rtp.routing_number}</p>
                <button className={styles.copyButton} type="button" onClick={() => copyValue('RTP routing number', account.rtp.routing_number)}>
                  Copy
                </button>
              </div>
              <div className={styles.copyRow}>
                <p>Account: {account.rtp.account_number}</p>
                <button className={styles.copyButton} type="button" onClick={() => copyValue('RTP account number', account.rtp.account_number)}>
                  Copy
                </button>
              </div>
            </article>
            <article>
              <h4>Wire</h4>
              <div className={styles.copyRow}>
                <p>Routing: {account.wire.routing_number}</p>
                <button className={styles.copyButton} type="button" onClick={() => copyValue('Wire routing number', account.wire.routing_number)}>
                  Copy
                </button>
              </div>
              <div className={styles.copyRow}>
                <p>Account: {account.wire.account_number}</p>
                <button className={styles.copyButton} type="button" onClick={() => copyValue('Wire account number', account.wire.account_number)}>
                  Copy
                </button>
              </div>
            </article>
          </div>
        </section>
      ) : null}
    </div>
  )
}
