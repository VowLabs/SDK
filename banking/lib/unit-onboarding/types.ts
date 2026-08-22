export type UnitCreatedAccount = {
  id: string
  customer_id: string
  name: string
  balance: number
  created_at: string
  ach: {
    account_number: string
    routing_number: string
  }
  rtp: {
    account_number: string
    routing_number: string
  }
  wire: {
    account_number: string
    routing_number: string
  }
}

export type UnitOnboardingFormState = {
  first_name: string
  last_name: string
  email: string
  dob: string
  ssn: string
  phone: string
  street: string
  city: string
  state: string
  zip: string
  country: string
}
