/**
 * A provider-neutral description of the information needed to open a bank
 * account. Applications can render these fields in their own UI and submit
 * the resulting values to the provider-specific onboarding flow.
 */
const partnerSchemas = new Map();

const unitBusinessFields = [
  { name: 'businessName', providerName: 'business_name', label: 'Business Name', description: 'The legal name of the business.', type: 'text', autocomplete: 'organization', required: true },
  { name: 'contactName', providerName: 'contact_name', label: 'Contact Name', description: 'The name of the person submitting this application.', type: 'text', autocomplete: 'name', required: true },
  { name: 'contactEmail', providerName: 'contact_email', label: 'Contact Email', description: 'A business contact email address.', type: 'text', autocomplete: 'email', required: true },
  { name: 'businessWebsite', providerName: 'website', label: 'Website', description: 'Your business website, if you have one.', type: 'text', autocomplete: 'url', required: false },
  { name: 'businessTaxId', providerName: 'ein', label: 'EIN', description: 'The business tax identification number. Enter numbers only.', type: 'text', inputMode: 'numeric', placeholder: '12-3456789', required: true },
  { name: 'businessEntityType', providerName: 'entity_type', label: 'Entity Type', type: 'select', required: true, options: [
    { value: 'LLC', label: 'LLC' }, { value: 'Partnership', label: 'Partnership' },
    { value: 'PrivatelyHeldCorporation', label: 'Privately Held Corporation' },
    { value: 'PubliclyTradedCorporation', label: 'Publicly Traded Corporation' },
    { value: 'NotForProfitOrganization', label: 'Not-For-Profit Organization' }
  ], description: 'Select the legal structure of the business.' },
  { name: 'incorporationState', providerName: 'state_of_incorporation', label: 'State Of Incorporation', description: 'The two-letter US state where the business was incorporated.', type: 'text', autocomplete: 'address-level1', required: true },
  { name: 'incorporationYear', providerName: 'year_of_incorporation', label: 'Year Of Incorporation', description: 'The year the business was incorporated.', type: 'number', inputMode: 'numeric', required: true },
  { name: 'officerTitle', providerName: 'officer_title', label: 'Officer Title', type: 'select', required: true, options: [
    { value: 'CEO', label: 'CEO' }, { value: 'COO', label: 'COO' }, { value: 'CFO', label: 'CFO' },
    { value: 'President', label: 'President' }, { value: 'VP', label: 'VP' }, { value: 'Manager', label: 'Manager' },
    { value: 'Partner', label: 'Partner' }, { value: 'Member', label: 'Member' }
  ], description: 'The authorized officer’s role at the business.' },
  { name: 'officerDateOfBirth', providerName: 'dob', label: 'Date Of Birth', description: 'The authorized officer’s date of birth.', type: 'date', autocomplete: 'bday', required: true },
  { name: 'officerTaxId', providerName: 'ssn', label: 'SSN', description: 'The authorized officer’s Social Security number.', type: 'text', inputMode: 'numeric', autocomplete: 'off', placeholder: '123-45-6789', required: true },
  { name: 'businessPhone', providerName: 'phone', label: 'Phone', description: 'A US phone number for the business.', type: 'tel', autocomplete: 'tel', placeholder: '+1 555 010 1234', required: true },
  { name: 'businessStreetAddress', providerName: 'street', label: 'Street Address', description: 'The business’s physical US street address.', type: 'text', autocomplete: 'street-address', required: true },
  { name: 'businessCity', providerName: 'city', label: 'City', description: 'The city for the business’s physical address.', type: 'text', autocomplete: 'address-level2', required: true },
  { name: 'businessState', providerName: 'state', label: 'State', description: 'The two-letter US state for the business’s physical address.', type: 'text', autocomplete: 'address-level1', required: true },
  { name: 'businessPostalCode', providerName: 'zip', label: 'Postal Code', description: 'The postal code for the business’s physical address.', type: 'text', inputMode: 'numeric', autocomplete: 'postal-code', required: true },
  { name: 'businessCountry', providerName: 'country', label: 'Country', description: 'The country for the business’s physical address.', type: 'text', autocomplete: 'country-name', defaultValue: 'US', required: true }
];

// These schemas mirror the fields submitted by Banking's current banking adapters.
// They intentionally describe only the information this SDK integration collects;
// a provider may request additional verification after account creation.
const checkbookBusinessFields = [
  { name: 'contactName', providerName: 'name', label: 'Contact Name', description: 'The name of the person creating the Checkbook marketplace user.', type: 'text', autocomplete: 'name', required: true },
  { name: 'contactEmail', providerName: 'email', label: 'Contact Email', description: 'The email address for the Checkbook marketplace user.', type: 'text', autocomplete: 'email', required: false },
  { name: 'businessName', providerName: 'business_name', label: 'Business Name', description: 'The legal name of the business, when applicable.', type: 'text', autocomplete: 'organization', required: false },
  { name: 'businessTaxId', providerName: 'ein', label: 'EIN', description: 'The business tax identification number, when applicable.', type: 'text', inputMode: 'numeric', placeholder: '12-3456789', required: false },
  { name: 'businessStreetAddress', providerName: 'street', label: 'Street Address', description: 'The street address for the user or business.', type: 'text', autocomplete: 'street-address', required: false },
  { name: 'businessCity', providerName: 'city', label: 'City', description: 'The city for the user or business address.', type: 'text', autocomplete: 'address-level2', required: false },
  { name: 'businessState', providerName: 'state', label: 'State', description: 'The state for the user or business address.', type: 'text', autocomplete: 'address-level1', required: false },
  { name: 'businessPostalCode', providerName: 'zip', label: 'Postal Code', description: 'The postal code for the user or business address.', type: 'text', inputMode: 'numeric', autocomplete: 'postal-code', required: false },
  { name: 'businessCountry', providerName: 'country', label: 'Country', description: 'The country for the user or business address.', type: 'text', autocomplete: 'country-name', defaultValue: 'US', required: false }
];

const usioBusinessFields = [
  { name: 'contactName', providerName: 'name', label: 'Contact Name', description: 'The name used to create the USIO user.', type: 'text', autocomplete: 'name', required: true }
];

const bridgeIndividualFields = [
  { name: 'contactName', providerName: 'name', label: 'Full Name', description: 'The individual customer’s first and last name.', type: 'text', autocomplete: 'name', required: true }
];

partnerSchemas.set('unit', { business: unitBusinessFields });
partnerSchemas.set('checkbook', { business: checkbookBusinessFields });
partnerSchemas.set('usio', { business: usioBusinessFields });
partnerSchemas.set('bridge', { individual: bridgeIndividualFields });

function clone(value) { return JSON.parse(JSON.stringify(value)); }

export function registerBankAccountOpeningFields(partner, accountType, fields) {
  const partnerKey = String(partner || '').trim().toLowerCase();
  const typeKey = String(accountType || 'business').trim().toLowerCase();
  if (!partnerKey || !Array.isArray(fields)) throw new Error('A partner name and field array are required.');
  const schema = partnerSchemas.get(partnerKey) || {};
  schema[typeKey] = clone(fields);
  partnerSchemas.set(partnerKey, schema);
}

export function getBankAccountOpeningFields(partner, { accountType = 'business' } = {}) {
  const partnerKey = String(partner || '').trim().toLowerCase();
  const typeKey = String(accountType || 'business').trim().toLowerCase();
  const fields = partnerSchemas.get(partnerKey)?.[typeKey];
  if (!fields) throw new Error(`No bank-account opening field schema is registered for ${partnerKey || 'this partner'} (${typeKey}).`);
  return clone(fields);
}

export function listBankAccountOpeningPartners() {
  return Array.from(partnerSchemas.keys()).sort();
}

export function normalizeBankAccountOpeningData(partner, values = {}, { accountType = 'business' } = {}) {
  return Object.fromEntries(getBankAccountOpeningFields(partner, { accountType }).map(field => [
    field.name,
    String(values[field.name] ?? values[field.providerName] ?? '').trim()
  ]));
}
