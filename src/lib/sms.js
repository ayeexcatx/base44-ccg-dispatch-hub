export const PHONE_CONTACT_TYPES = ['Office', 'Cell', 'Fax'];

export function formatPhoneNumber(value) {
  const rawDigits = String(value || '').replace(/\D/g, '');
  const digits = rawDigits.length === 11 && rawDigits.startsWith('1')
    ? rawDigits.slice(1)
    : rawDigits.slice(0, 10);

  if (!digits) return '';
  if (digits.length < 4) return `(${digits}`;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function normalizeSmsPhone(value) {
  const rawDigits = String(value || '').replace(/\D/g, '');
  const tenDigitNumber = rawDigits.length === 11 && rawDigits.startsWith('1')
    ? rawDigits.slice(1)
    : rawDigits;

  if (tenDigitNumber.length !== 10) {
    const trimmed = String(value || '').trim();
    return trimmed.startsWith('+') ? trimmed : trimmed;
  }

  return `+1${tenDigitNumber}`;
}

export function normalizeContactMethods(company) {
  if (Array.isArray(company?.contact_methods) && company.contact_methods.length > 0) {
    return company.contact_methods.map((method) => ({
      type: method?.type || 'Other',
      value: method?.value || '',
    }));
  }

  if (company?.contact_info) return [{ type: 'Other', value: company.contact_info }];
  return [{ type: 'Office', value: '' }];
}

export function getCompanySmsContact(company) {
  const methods = normalizeContactMethods(company);
  const selectedIndex = Number.isInteger(company?.sms_contact_method_index)
    ? company.sms_contact_method_index
    : -1;

  const selectedMethod = methods[selectedIndex] || null;
  if (selectedMethod && PHONE_CONTACT_TYPES.includes(selectedMethod.type) && normalizeSmsPhone(selectedMethod.value).startsWith('+')) {
    return {
      index: selectedIndex,
      method: selectedMethod,
      phone: normalizeSmsPhone(selectedMethod.value),
    };
  }

  const fallbackIndex = methods.findIndex((method) =>
    PHONE_CONTACT_TYPES.includes(method?.type) && normalizeSmsPhone(method?.value).startsWith('+')
  );

  if (fallbackIndex >= 0) {
    return {
      index: fallbackIndex,
      method: methods[fallbackIndex],
      phone: normalizeSmsPhone(methods[fallbackIndex].value),
    };
  }

  return {
    index: selectedIndex >= 0 ? selectedIndex : null,
    method: methods[selectedIndex] || null,
    phone: '',
  };
}

export function getDriverSmsState(driver) {
  const ownerEnabled = driver?.owner_sms_enabled === true;
  const driverOptedIn = driver?.driver_sms_opt_in === true || (driver?.driver_sms_opt_in == null && driver?.sms_enabled === true);
  const normalizedPhone = normalizeSmsPhone(driver?.phone || '');
  const hasValidPhone = normalizedPhone.startsWith('+');
  const effective = ownerEnabled && driverOptedIn && hasValidPhone;

  return {
    ownerEnabled,
    driverOptedIn,
    hasValidPhone,
    normalizedPhone,
    effective,
  };
}

export function getCompanyOwnerSmsState({ accessCode, company }) {
  const optedIn = accessCode?.sms_enabled === true;
  const target = getCompanySmsContact(company);
  const hasValidPhone = Boolean(target.phone);
  return {
    optedIn,
    hasValidPhone,
    normalizedPhone: target.phone,
    target,
    effective: optedIn && hasValidPhone,
  };
}

export function buildCompanyProfileRequestPayload({ form, currentCompany }) {
  const cleanedContactMethods = (form.contact_methods || [])
    .map((method) => ({ type: method?.type || 'Other', value: (method?.value || '').trim() }))
    .filter((method) => method.value);

  return {
    requested_name: form.name.trim(),
    requested_address: form.address.trim(),
    requested_contact_methods: cleanedContactMethods,
    requested_contact_info: cleanedContactMethods.map((method) => `${method.type}: ${method.value}`).join(' • '),
    current_name: currentCompany?.name || '',
    current_address: currentCompany?.address || '',
    current_contact_methods: normalizeContactMethods(currentCompany),
    current_contact_info: currentCompany?.contact_info || '',
    status: 'Pending',
    requested_at: new Date().toISOString(),
  };
}
