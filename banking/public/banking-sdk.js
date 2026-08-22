(function () {
  function resolveTarget(target) {
    if (!target) return null;
    if (typeof target === 'string') return document.querySelector(target);
    return target;
  }

  function normalizeBaseUrl(baseUrl) {
    return String(baseUrl || window.location.origin).replace(/\/+$/, '');
  }

  var merchantUnitFormStylesInjected = false;

  function injectMerchantUnitFormStyles() {
    if (merchantUnitFormStylesInjected || !document || !document.head) return;
    var style = document.createElement('style');
    style.setAttribute('data-banking-merchant-unit-form', 'true');
    style.textContent = '' +
      '.banking-unit-form{display:grid;gap:14px;}' +
      '.banking-unit-form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;}' +
      '.banking-unit-form-grid-compact{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;}' +
      '.banking-unit-form label{display:grid;gap:8px;color:#f0f0f5;font:inherit;}' +
      '.banking-unit-form span{font-size:0.95rem;font-weight:500;}' +
      '.banking-unit-form input,.banking-unit-form select{width:100%;border-radius:14px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.04);color:#f0f0f5;padding:0.8rem 0.9rem;font:inherit;}' +
      '.banking-unit-form input::placeholder{color:#66667d;}' +
      '.banking-unit-form select option{color:#0a0a0f;}' +
      '.banking-unit-form-note{margin:0;color:#9090a8;line-height:1.55;}' +
      '.banking-unit-form-status{min-height:1.4rem;color:#9090a8;font-size:0.95rem;}' +
      '.banking-unit-form-status[data-state="error"]{color:#ff9e8e;}' +
      '@media (max-width:720px){.banking-unit-form-grid,.banking-unit-form-grid-compact{grid-template-columns:1fr;}}';
    document.head.appendChild(style);
    merchantUnitFormStylesInjected = true;
  }

  function normalizeMerchantUnitPayload(values, options) {
    var context = options && options.context || {};
    return {
      ein: String(values.ein || '').trim(),
      entity_type: String(values.entity_type || '').trim(),
      state_of_incorporation: String(values.state_of_incorporation || '').trim(),
      officer_title: String(values.officer_title || '').trim(),
      dob: String(values.dob || '').trim(),
      ssn: String(values.ssn || '').trim(),
      phone: String(values.phone || '').trim(),
      street: String(values.street || '').trim(),
      city: String(values.city || '').trim(),
      state: String(values.state || '').trim(),
      zip: String(values.zip || '').trim(),
      country: String(context.country || values.country || 'US').trim(),
      beneficial_owners: Array.isArray(context.beneficial_owners) ? context.beneficial_owners : []
    };
  }

  function buildStateOptions() {
    var states = [
      ['AL', 'Alabama'],
      ['AK', 'Alaska'],
      ['AZ', 'Arizona'],
      ['AR', 'Arkansas'],
      ['CA', 'California'],
      ['CO', 'Colorado'],
      ['CT', 'Connecticut'],
      ['DE', 'Delaware'],
      ['FL', 'Florida'],
      ['GA', 'Georgia'],
      ['HI', 'Hawaii'],
      ['ID', 'Idaho'],
      ['IL', 'Illinois'],
      ['IN', 'Indiana'],
      ['IA', 'Iowa'],
      ['KS', 'Kansas'],
      ['KY', 'Kentucky'],
      ['LA', 'Louisiana'],
      ['ME', 'Maine'],
      ['MD', 'Maryland'],
      ['MA', 'Massachusetts'],
      ['MI', 'Michigan'],
      ['MN', 'Minnesota'],
      ['MS', 'Mississippi'],
      ['MO', 'Missouri'],
      ['MT', 'Montana'],
      ['NE', 'Nebraska'],
      ['NV', 'Nevada'],
      ['NH', 'New Hampshire'],
      ['NJ', 'New Jersey'],
      ['NM', 'New Mexico'],
      ['NY', 'New York'],
      ['NC', 'North Carolina'],
      ['ND', 'North Dakota'],
      ['OH', 'Ohio'],
      ['OK', 'Oklahoma'],
      ['OR', 'Oregon'],
      ['PA', 'Pennsylvania'],
      ['RI', 'Rhode Island'],
      ['SC', 'South Carolina'],
      ['SD', 'South Dakota'],
      ['TN', 'Tennessee'],
      ['TX', 'Texas'],
      ['UT', 'Utah'],
      ['VT', 'Vermont'],
      ['VA', 'Virginia'],
      ['WA', 'Washington'],
      ['WV', 'West Virginia'],
      ['WI', 'Wisconsin'],
      ['WY', 'Wyoming'],
      ['DC', 'District of Columbia']
    ];

    return '<option value="">Select one</option>' + states.map(function (entry) {
      return '<option value="' + entry[0] + '">' + entry[1] + ' (' + entry[0] + ')</option>';
    }).join('');
  }

  function digitsOnly(value) {
    return String(value || '').replace(/\D+/g, '');
  }

  function isValidEin(value) {
    var digits = digitsOnly(value);
    if (!/^\d{9}$/.test(digits)) return false;
    if (digits.slice(0, 2) === '00') return false;
    return true;
  }

  function isValidSsn(value) {
    var digits = digitsOnly(value);
    if (!/^\d{9}$/.test(digits)) return false;

    var area = digits.slice(0, 3);
    var group = digits.slice(3, 5);
    var serial = digits.slice(5, 9);

    if (area === '000' || area === '666' || Number(area) >= 900) return false;
    if (group === '00') return false;
    if (serial === '0000') return false;
    return true;
  }

  function validateMerchantUnitPayload(payload) {
    var required = [
      'ein',
      'entity_type',
      'state_of_incorporation',
      'officer_title',
      'dob',
      'ssn',
      'phone',
      'street',
      'city',
      'state',
      'zip'
    ];
    var missing = required.filter(function (field) {
      return !String(payload[field] || '').trim();
    });
    var invalid = [];

    if (missing.indexOf('ein') === -1 && !isValidEin(payload.ein)) {
      invalid.push('ein');
    }

    if (missing.indexOf('ssn') === -1 && !isValidSsn(payload.ssn)) {
      invalid.push('ssn');
    }

    return {
      complete: missing.length === 0 && invalid.length === 0,
      missing: missing,
      invalid: invalid
    };
  }

  function mountMerchantUnitApplication(target, options) {
    var node = resolveTarget(target);
    if (!node) return null;

    injectMerchantUnitFormStyles();

    var config = Object.assign({}, options || {});
    var initialData = config.initialData || {};
    var stateOptions = buildStateOptions();
    var values = {
      ein: String(initialData.ein || ''),
      entity_type: String(initialData.entity_type || ''),
      state_of_incorporation: String(initialData.state_of_incorporation || ''),
      officer_title: String(initialData.officer_title || 'Member'),
      dob: String(initialData.dob || ''),
      ssn: String(initialData.ssn || ''),
      phone: String(initialData.phone || ''),
      street: String(initialData.street || ''),
      city: String(initialData.city || ''),
      state: String(initialData.state || ''),
      zip: String(initialData.zip || '')
    };

    node.innerHTML = '' +
      '<div class="banking-unit-form">' +
        '<div class="banking-unit-form-grid">' +
          '<label><span>EIN</span><input name="ein" type="text" inputmode="numeric" placeholder="12-3456789" required></label>' +
          '<label><span>Entity type</span><select name="entity_type" required>' +
            '<option value="">Select one</option>' +
            '<option value="LLC">LLC</option>' +
            '<option value="Partnership">Partnership</option>' +
            '<option value="PrivatelyHeldCorporation">Privately held corporation</option>' +
            '<option value="PubliclyTradedCorporation">Publicly traded corporation</option>' +
            '<option value="NotForProfitOrganization">Not-for-profit</option>' +
          '</select></label>' +
          '<label><span>State of incorporation</span><select name="state_of_incorporation" required>' +
            stateOptions +
          '</select></label>' +
          '<label><span>Officer title</span><select name="officer_title" required>' +
            '<option value="">Select one</option>' +
            '<option value="CEO">CEO</option>' +
            '<option value="COO">COO</option>' +
            '<option value="CFO">CFO</option>' +
            '<option value="President">President</option>' +
            '<option value="VP">VP</option>' +
            '<option value="Manager">Manager</option>' +
            '<option value="Partner">Partner</option>' +
            '<option value="Member">Member</option>' +
          '</select></label>' +
          '<label><span>Date of birth</span><input name="dob" type="date" required></label>' +
          '<label><span>SSN</span><input name="ssn" type="text" inputmode="numeric" placeholder="123-45-6789" required></label>' +
          '<label><span>Phone</span><input name="phone" type="tel" placeholder="+1 555 010 1234" required></label>' +
          '<label><span>Street</span><input name="street" type="text" placeholder="123 Market Street" required></label>' +
        '</div>' +
        '<div class="banking-unit-form-grid-compact">' +
          '<label><span>City</span><input name="city" type="text" placeholder="San Francisco" required></label>' +
          '<label><span>State</span><select name="state" required>' +
            stateOptions +
          '</select></label>' +
          '<label><span>ZIP</span><input name="zip" type="text" inputmode="numeric" placeholder="94105" required></label>' +
        '</div>' +
        '<div class="banking-unit-form-status" data-state="ready"></div>' +
      '</div>';

    var form = node.querySelector('.banking-unit-form');
    var statusNode = node.querySelector('.banking-unit-form-status');
    var fields = {};

    Array.prototype.forEach.call(form.querySelectorAll('input, select'), function (field) {
      fields[field.name] = field;
      if (Object.prototype.hasOwnProperty.call(values, field.name)) {
        field.value = values[field.name];
      }
      field.addEventListener('input', handleInput);
      field.addEventListener('change', handleInput);
    });

    var showValidationErrors = false;

    function updateStatus(meta) {
      if (!statusNode) return;
      if (meta.complete) {
        statusNode.dataset.state = 'ready';
        statusNode.textContent = 'Banking has the Unit application details it needs for merchant account opening.';
        return;
      }

      if (!showValidationErrors) {
        statusNode.dataset.state = 'ready';
        statusNode.textContent = 'Complete the Banking application to continue merchant onboarding.';
        return;
      }

      statusNode.dataset.state = 'error';
      if (meta.missing.length > 0) {
        statusNode.textContent = 'Complete the remaining Banking application fields: ' + meta.missing.join(', ') + '.';
        return;
      }

      statusNode.textContent = 'Correct the invalid Banking application fields: ' + meta.invalid.join(', ') + '. EIN must be 9 digits and SSN must be a valid 9-digit SSN.';
    }

    function emitChange() {
      var payload = normalizeMerchantUnitPayload(values, config);
      var meta = validateMerchantUnitPayload(payload);
      updateStatus(meta);
      if (typeof config.onChange === 'function') {
        config.onChange(payload, meta);
      }
      return { payload: payload, meta: meta };
    }

    function handleInput(event) {
      var targetField = event && event.target;
      if (!targetField || !targetField.name) return;
      values[targetField.name] = targetField.value;
      emitChange();
    }

    emitChange();

    return {
      getData: function getData() {
        return normalizeMerchantUnitPayload(values, config);
      },
      validate: function validate() {
        showValidationErrors = true;
        var meta = validateMerchantUnitPayload(normalizeMerchantUnitPayload(values, config));
        updateStatus(meta);
        return meta;
      },
      update: function update(nextConfig) {
        config = Object.assign({}, config, nextConfig || {});
        emitChange();
      },
      destroy: function destroy() {
        node.innerHTML = '';
      }
    };
  }

  function mountUnitOnboarding(target, options) {
    var node = resolveTarget(target);
    if (!node) return null;

    var config = options || {};
    var baseUrl = normalizeBaseUrl(config.baseUrl || node.getAttribute('data-banking-base-url'));
    var minHeight = config.minHeight || node.getAttribute('data-banking-min-height') || '1100px';
    var radius = config.radius || node.getAttribute('data-banking-radius') || '18px';
    var origin = new URL(baseUrl).origin;
    var params = new URLSearchParams({ embed: '1' });

    if (config.walletAddress) params.set('wallet-address', String(config.walletAddress));
    if (config.walletChainId) params.set('wallet-chain-id', String(config.walletChainId));

    var iframe = document.createElement('iframe');
    iframe.src = baseUrl + '/onboarding/unit?' + params.toString();
    iframe.title = 'Banking Unit Onboarding';
    iframe.loading = 'lazy';
    iframe.style.width = '100%';
    iframe.style.minHeight = minHeight;
    iframe.style.border = '0';
    iframe.style.borderRadius = radius;
    iframe.style.background = '#ffffff';

    var listenersAttached = false;

    function post(type, payload) {
      if (!iframe.contentWindow) return;
      iframe.contentWindow.postMessage(
        Object.assign({ type: type }, payload || {}),
        origin
      );
    }

    function syncContext() {
      if (config.walletAddress) {
        post('banking-wallet-address', { address: String(config.walletAddress) });
      }
      if (config.walletChainId) {
        post('banking-wallet-chain-id', { chainId: String(config.walletChainId) });
      }
      if (config.account) {
        post('banking-funding-account-details', { account: config.account });
      }
    }

    function onMessage(event) {
      if (event.origin !== origin || event.source !== iframe.contentWindow || !event.data || typeof event.data !== 'object') {
        return;
      }

      if (event.data.type === 'banking-unit-onboarding-height' && typeof config.onHeight === 'function') {
        config.onHeight(event.data.height || 0, iframe);
      }

      if (event.data.type === 'banking-unit-onboarding-complete' && typeof config.onComplete === 'function') {
        config.onComplete(event.data.account || null, iframe);
      }
    }

    if (!listenersAttached) {
      window.addEventListener('message', onMessage);
      listenersAttached = true;
    }

    iframe.addEventListener('load', syncContext);

    node.innerHTML = '';
    node.appendChild(iframe);

    return {
      iframe: iframe,
      update: function update(nextConfig) {
        config = Object.assign({}, config, nextConfig || {});
        syncContext();
      },
      destroy: function destroy() {
        if (listenersAttached) {
          window.removeEventListener('message', onMessage);
          listenersAttached = false;
        }
        iframe.remove();
      }
    };
  }

  async function openMerchantFundingAccount(options) {
    var endpoint = String(options && options.endpoint || '/api/merchant/onboarding');
    var apiKey = String(options && options.apiKey || '');
    var payload = options && options.payload || {};

    var response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify(payload)
    });
    var result = await response.json().catch(function () { return {}; });

    if (!response.ok) {
      return {
        ok: false,
        error: String(result.error || 'Unable to open merchant funding account.')
      };
    }

    return {
      ok: true,
      account: result.account || null
    };
  }

  window.VowLabs = window.VowLabs || {};
  window.VowLabs.Banking = {
    mountUnitOnboarding: mountUnitOnboarding,
    mountMerchantUnitApplication: mountMerchantUnitApplication,
    openMerchantFundingAccount: openMerchantFundingAccount
  };

  window.VowLabs.BankingUnitOnboarding = {
    mount: mountUnitOnboarding
  };
})();
