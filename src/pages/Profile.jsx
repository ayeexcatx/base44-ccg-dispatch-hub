import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useSession } from '@/components/session/SessionContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { BellRing, Building2, Shield, UserRound } from 'lucide-react';
import { buildCompanyProfileRequestPayload, formatPhoneNumber, getCompanyOwnerSmsState, getCompanySmsContact, getDriverSmsState, normalizeContactMethods, normalizeSmsPhone, PHONE_CONTACT_TYPES } from '@/lib/sms';

const CONTACT_TYPE_OPTIONS = ['Office', 'Cell', 'Email', 'Fax', 'Other'];

async function sendProfileSmsConfirmation(phone, message) {
  if (!phone) return;
  try {
    await base44.functions.invoke('sendNotificationSms/entry', { phone, message });
  } catch (error) {
    console.error('Failed sending profile SMS confirmation', error);
  }
}

async function syncDriverAccessCode(driver) {
  if (!driver?.access_code_id) return;
  const state = getDriverSmsState(driver);
  await base44.entities.AccessCode.update(driver.access_code_id, {
    sms_enabled: state.effective,
    sms_phone: state.normalizedPhone || '',
  });
}

async function syncOwnerAccessCodes(company, accessCodeId = null, accessCodeSmsEnabled = null) {
  const codes = await base44.entities.AccessCode.filter({ company_id: company.id, code_type: 'CompanyOwner' }, '-created_date', 200);
  const { phone } = getCompanySmsContact(company);
  await Promise.all((codes || []).map((code) => {
    const nextEnabled = code.id === accessCodeId && typeof accessCodeSmsEnabled === 'boolean'
      ? accessCodeSmsEnabled
      : code.sms_enabled === true;
    return base44.entities.AccessCode.update(code.id, {
      sms_phone: phone || '',
      sms_enabled: nextEnabled && Boolean(phone),
    });
  }));
}

function ContactMethodEditor({ methods, setMethods, smsIndex, setSmsIndex, readOnly = false }) {
  const updateMethod = (index, key, nextValue) => {
    setMethods((prev) => prev.map((method, i) => {
      if (i !== index) return method;
      if (key === 'type') {
        const nextMethod = { ...method, type: nextValue };
        if (PHONE_CONTACT_TYPES.includes(nextValue)) {
          nextMethod.value = formatPhoneNumber(nextMethod.value);
        }
        return nextMethod;
      }
      if (key === 'value' && PHONE_CONTACT_TYPES.includes(method.type)) {
        return { ...method, value: formatPhoneNumber(nextValue) };
      }
      return { ...method, [key]: nextValue };
    }));
  };

  return (
    <div className="space-y-2">
      {methods.map((method, index) => {
        const isPhoneType = PHONE_CONTACT_TYPES.includes(method.type);
        const canUseForSms = isPhoneType && normalizeSmsPhone(method.value).startsWith('+');
        return (
          <div key={`contact-method-${index}`} className="rounded-lg border border-slate-200 p-3 bg-white space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Select value={method.type} disabled={readOnly} onValueChange={(value) => updateMethod(index, 'type', value)}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>{CONTACT_TYPE_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
              </Select>
              <label className={`flex items-center gap-2 text-xs ${readOnly ? 'text-slate-400' : 'text-slate-600'}`}>
                <input type="radio" disabled={readOnly || !canUseForSms} checked={smsIndex === index} onChange={() => setSmsIndex(index)} />
                SMS target
              </label>
            </div>
            <Input value={method.value} readOnly={readOnly} placeholder={isPhoneType ? '(555) 123-4567' : 'Enter value'} onChange={(e) => updateMethod(index, 'value', e.target.value)} />
            {smsIndex === index && (
              <p className="text-xs text-emerald-700">This contact is used for company owner SMS notifications.</p>
            )}
            {!canUseForSms && smsIndex === index && (
              <p className="text-xs text-red-600">Enter a valid phone number for the selected SMS target.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AdminProfile({ session }) {
  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center"><Shield className="h-5 w-5 text-slate-600" /></div>
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Admin Profile</h2>
            <p className="text-sm text-slate-500">Basic access details for this admin sign-in.</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-lg border p-4">
            <p className="text-xs uppercase text-slate-500">Admin name</p>
            <p className="mt-1 font-medium text-slate-900">{session?.label || session?.name || session?.code || 'Admin'}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-xs uppercase text-slate-500">Contact / SMS</p>
            <p className="mt-1 text-sm text-slate-700">{session?.sms_phone ? formatPhoneNumber(session.sms_phone) : 'No admin SMS phone on this record.'}</p>
            <Badge variant={session?.sms_enabled ? 'default' : 'secondary'} className="mt-2">{session?.sms_enabled ? 'SMS status available' : 'SMS display only'}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DriverProfile({ session }) {
  const queryClient = useQueryClient();
  const { data: drivers = [] } = useQuery({
    queryKey: ['driver-profile', session?.driver_id],
    queryFn: () => base44.entities.Driver.filter({ id: session.driver_id }, '-created_date', 1),
    enabled: !!session?.driver_id,
  });
  const driver = drivers[0] || null;
  const smsState = getDriverSmsState(driver);
  const [optedIn, setOptedIn] = useState(false);

  useEffect(() => {
    setOptedIn(smsState.driverOptedIn);
  }, [smsState.driverOptedIn]);

  const mutation = useMutation({
    mutationFn: async (nextOptIn) => {
      const updated = await base44.entities.Driver.update(driver.id, { driver_sms_opt_in: nextOptIn });
      await syncDriverAccessCode(updated);
      await sendProfileSmsConfirmation(
        normalizeSmsPhone(updated.phone),
        nextOptIn
          ? 'CCG Transit: You are now opted in to receive SMS notifications.'
          : 'CCG Transit: You are now opted out of SMS notifications.'
      );
      return updated;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-profile', session?.driver_id] });
      queryClient.invalidateQueries({ queryKey: ['drivers', session?.company_id] });
      queryClient.invalidateQueries({ queryKey: ['drivers-all'] });
      queryClient.invalidateQueries({ queryKey: ['access-codes'] });
      toast.success('SMS preference updated');
    },
  });

  if (!driver) return <div className="text-sm text-slate-500">Driver profile not found.</div>;

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center"><UserRound className="h-5 w-5 text-slate-600" /></div>
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Profile</h2>
            <p className="text-sm text-slate-500">Your name and phone are view-only. You can manage only your own SMS consent here.</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-lg border p-4"><p className="text-xs uppercase text-slate-500">Driver name</p><p className="mt-1 font-medium text-slate-900">{driver.driver_name}</p></div>
          <div className="rounded-lg border p-4"><p className="text-xs uppercase text-slate-500">Phone number</p><p className="mt-1 font-medium text-slate-900">{driver.phone || '—'}</p></div>
        </div>
        <div className="rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label className="text-base">Receive SMS notifications</Label>
              <p className="text-sm text-slate-500">SMS is sent only when your company owner enables SMS for you and you opt in here.</p>
            </div>
            <Switch checked={optedIn} disabled={mutation.isPending} onCheckedChange={(checked) => { setOptedIn(checked); mutation.mutate(checked); }} />
          </div>
          <div className="grid sm:grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg bg-slate-50 p-3 border"><p className="text-slate-500">Owner enabled</p><p className="font-medium text-slate-900">{smsState.ownerEnabled ? 'Yes' : 'No'}</p></div>
            <div className="rounded-lg bg-slate-50 p-3 border"><p className="text-slate-500">You opted in</p><p className="font-medium text-slate-900">{smsState.driverOptedIn ? 'Yes' : 'No'}</p></div>
            <div className="rounded-lg bg-slate-50 p-3 border"><p className="text-slate-500">SMS active</p><p className={`font-medium ${smsState.effective ? 'text-emerald-700' : 'text-slate-900'}`}>{smsState.effective ? 'Yes' : 'No'}</p></div>
          </div>
          {!smsState.ownerEnabled && <p className="text-sm text-amber-700">Your company owner has not enabled SMS for your driver record yet.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function CompanyOwnerProfile({ session }) {
  const queryClient = useQueryClient();
  const { data: companies = [] } = useQuery({
    queryKey: ['owner-profile-company', session?.company_id],
    queryFn: () => base44.entities.Company.filter({ id: session.company_id }, '-created_date', 1),
    enabled: !!session?.company_id,
  });
  const { data: accessCodes = [] } = useQuery({
    queryKey: ['owner-profile-access-code', session?.id],
    queryFn: () => base44.entities.AccessCode.filter({ id: session.id }, '-created_date', 1),
    enabled: !!session?.id,
  });
  const company = companies[0] || null;
  const accessCode = accessCodes[0] || session;
  const [form, setForm] = useState({ name: '', address: '', contact_methods: [{ type: 'Office', value: '' }] });
  const [smsIndex, setSmsIndex] = useState(0);
  const smsState = getCompanyOwnerSmsState({ accessCode, company });
  const hasPendingRequest = company?.pending_profile_change?.status === 'Pending';

  useEffect(() => {
    if (!company) return;
    setForm({
      name: company.name || '',
      address: company.address || '',
      contact_methods: normalizeContactMethods(company),
    });
    setSmsIndex(Number.isInteger(company.sms_contact_method_index) ? company.sms_contact_method_index : 0);
  }, [company]);

  const profileRequestMutation = useMutation({
    mutationFn: async () => {
      const requestPayload = buildCompanyProfileRequestPayload({ form, currentCompany: company });
      const updatedCompany = await base44.entities.Company.update(company.id, {
        pending_profile_change: {
          ...requestPayload,
          requested_by_access_code_id: session.id,
        },
        sms_contact_method_index: smsIndex,
      });
      await syncOwnerAccessCodes(updatedCompany);
      return updatedCompany;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-profile-company', session?.company_id] });
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      queryClient.invalidateQueries({ queryKey: ['access-codes'] });
      toast.success('Profile update request sent for admin approval');
    },
  });

  const smsMutation = useMutation({
    mutationFn: async (nextOptIn) => {
      const updatedAccessCode = await base44.entities.AccessCode.update(accessCode.id, {
        sms_enabled: nextOptIn && Boolean(smsState.target.phone),
        sms_phone: smsState.target.phone || '',
      });
      await sendProfileSmsConfirmation(
        smsState.target.phone,
        nextOptIn
          ? 'CCG Transit: You are now opted in to receive SMS notifications.'
          : 'CCG Transit: You are now opted out of SMS notifications.'
      );
      return updatedAccessCode;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-profile-access-code', session?.id] });
      queryClient.invalidateQueries({ queryKey: ['access-codes'] });
      toast.success('Owner SMS preference updated');
    },
  });

  if (!company) return <div className="text-sm text-slate-500">Company profile not found.</div>;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center"><Building2 className="h-5 w-5 text-slate-600" /></div>
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">Company Profile</h2>
              <p className="text-sm text-slate-500">Company name, address, and contact info submit as requests for admin approval before live data changes.</p>
            </div>
          </div>
          {hasPendingRequest && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              Pending approval: your requested company profile update is awaiting admin review.
            </div>
          )}
          <div className="grid gap-4">
            <div><Label>Company name</Label><Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} /></div>
            <div><Label>Address</Label><Textarea rows={3} value={form.address} onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))} /></div>
            <div>
              <Label>Contact info</Label>
              <p className="text-xs text-slate-500 mb-2">Select which phone contact should be used for company owner SMS.</p>
              <ContactMethodEditor methods={form.contact_methods} setMethods={(updater) => setForm((prev) => ({ ...prev, contact_methods: typeof updater === 'function' ? updater(prev.contact_methods) : updater }))} smsIndex={smsIndex} setSmsIndex={setSmsIndex} />
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => setForm((prev) => ({ ...prev, contact_methods: [...prev.contact_methods, { type: 'Office', value: '' }] }))}>Add Contact</Button>
            </div>
            <div>
              <Label>Truck numbers</Label>
              <div className="mt-2 flex flex-wrap gap-2">{(company.trucks || []).length ? company.trucks.map((truck) => <Badge key={truck} variant="outline" className="font-mono">{truck}</Badge>) : <span className="text-sm text-slate-500">No trucks listed.</span>}</div>
              <p className="text-xs text-slate-500 mt-2">Truck numbers are view-only on the company owner profile.</p>
            </div>
            <Button onClick={() => profileRequestMutation.mutate()} disabled={profileRequestMutation.isPending} className="bg-slate-900 hover:bg-slate-800">{profileRequestMutation.isPending ? 'Submitting...' : 'Submit Changes for Approval'}</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2"><BellRing className="h-4 w-4 text-slate-500" /><h3 className="text-lg font-semibold text-slate-900">Your SMS notifications</h3></div>
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label className="text-base">Receive SMS notifications</Label>
              <p className="text-sm text-slate-500">You receive SMS only when you opt in here and a valid SMS contact is selected below.</p>
            </div>
            <Switch checked={smsState.optedIn} disabled={smsMutation.isPending || !smsState.target.phone} onCheckedChange={(checked) => smsMutation.mutate(checked)} />
          </div>
          <div className="grid sm:grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg bg-slate-50 p-3 border"><p className="text-slate-500">SMS target</p><p className="font-medium text-slate-900">{smsState.target.method ? `${smsState.target.method.type}: ${smsState.target.method.value}` : 'No phone selected'}</p></div>
            <div className="rounded-lg bg-slate-50 p-3 border"><p className="text-slate-500">Opted in</p><p className="font-medium text-slate-900">{smsState.optedIn ? 'Yes' : 'No'}</p></div>
            <div className="rounded-lg bg-slate-50 p-3 border"><p className="text-slate-500">SMS active</p><p className={`font-medium ${smsState.effective ? 'text-emerald-700' : 'text-slate-900'}`}>{smsState.effective ? 'Yes' : 'No'}</p></div>
          </div>
          {!smsState.target.phone && <p className="text-sm text-red-600">Select a valid phone contact for SMS on this profile before opting in.</p>}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Profile() {
  const { session } = useSession();
  const isAdmin = session?.code_type === 'Admin';
  const isOwner = session?.code_type === 'CompanyOwner';
  const isDriver = session?.code_type === 'Driver';

  if (!(isAdmin || isOwner || isDriver)) {
    return <div className="text-sm text-slate-500">Profile is not available for this login type.</div>;
  }

  return (
    <div className="space-y-6">
      {isAdmin && <AdminProfile session={session} />}
      {isOwner && <CompanyOwnerProfile session={session} />}
      {isDriver && <DriverProfile session={session} />}
    </div>
  );
}
