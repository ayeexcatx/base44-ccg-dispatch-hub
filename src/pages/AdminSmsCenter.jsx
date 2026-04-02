import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { normalizeSmsPhone } from '@/lib/sms';
import { normalizeUsSmsPhone } from '@/lib/smsPhone';
import { getDriverSmsState, getCompanyOwnerSmsState, getAdminSmsProductState } from '@/lib/sms';
import { DEFAULT_SMS_RULES, getSmsRules, getSmsTemplateSettings, listSmsBroadcasts, resolveEffectiveSharedAdminAccessCode, saveSmsBroadcast, saveSmsRules, saveSmsTemplateSettings } from '@/lib/smsConfig';
import { SMS_WELCOME_MESSAGE } from '@/lib/smsIntro';
import { useSession } from '@/components/session/SessionContext';
import { getEffectiveView } from '@/components/session/workspaceUtils';

const SMS_PROVIDER = 'signalwire';

const RULE_META = [
  ['driver_dispatch_assigned', 'Driver dispatch assigned'],
  ['driver_dispatch_updated', 'Driver dispatch updated'],
  ['driver_dispatch_amended', 'Driver dispatch amended'],
  ['driver_dispatch_cancelled', 'Driver dispatch cancelled'],
  ['driver_dispatch_removed', 'Driver dispatch removed'],
  ['owner_dispatch_status_change', 'Company owner dispatch status changes'],
  ['owner_dispatch_info_update', 'Company owner informational updates'],
  ['admin_notifications', 'Admin notifications eligible for SMS'],
  ['welcome_sms', 'Welcome / intro SMS'],
  ['opt_out_confirmation_sms', 'Opt-out confirmation SMS'],
  ['informational_broadcast_sms', 'Informational / broadcast SMS'],
];

function templatePreview(title, body, footer) {
  return { title, body: `${body}${footer ? `\n\n${footer}` : ''}` };
}

export default function AdminSmsCenter() {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const effectiveView = getEffectiveView(session);
  const isAdmin = effectiveView === 'Admin';
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [broadcastForm, setBroadcastForm] = useState({
    message: '',
    send_mode: 'now',
    scheduled_at: '',
    include_drivers: true,
    include_owners: true,
    include_admins: false,
  });

  const { data: smsRules = DEFAULT_SMS_RULES } = useQuery({ queryKey: ['sms-rules'], queryFn: getSmsRules, enabled: isAdmin });
  const { data: templateSettings = { support_footer: '' } } = useQuery({ queryKey: ['sms-template-settings'], queryFn: getSmsTemplateSettings, enabled: isAdmin });
  const { data: logs = [] } = useQuery({
    queryKey: ['sms-general-logs'],
    queryFn: () => base44.entities.General.filter({ record_type: 'sms_log' }, '-created_date', 500),
    enabled: isAdmin,
  });
  const { data: inbound = [] } = useQuery({
    queryKey: ['sms-inbound-logs'],
    queryFn: () => base44.entities.General.filter({ record_type: 'sms_inbound_log' }, '-created_date', 500),
    enabled: isAdmin,
  });
  const { data: broadcasts = [] } = useQuery({ queryKey: ['sms-broadcasts'], queryFn: listSmsBroadcasts, enabled: isAdmin });
  const { data: accessCodes = [] } = useQuery({ queryKey: ['sms-center-access-codes'], queryFn: () => base44.entities.AccessCode.list('-created_date', 500), enabled: isAdmin });
  const { data: drivers = [] } = useQuery({ queryKey: ['sms-center-drivers'], queryFn: () => base44.entities.Driver.list('-created_date', 500), enabled: isAdmin });
  const { data: companies = [] } = useQuery({ queryKey: ['sms-center-companies'], queryFn: () => base44.entities.Company.list('-created_date', 500), enabled: isAdmin });

  const rulesMutation = useMutation({
    mutationFn: saveSmsRules,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sms-rules'] });
      toast.success('SMS rules saved');
    },
    onError: (error) => toast.error(error?.message || 'Unable to save SMS rules'),
  });

  const templateMutation = useMutation({
    mutationFn: saveSmsTemplateSettings,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['sms-template-settings'] });
      toast.success('Template footer saved');
    },
    onError: (error) => toast.error(error?.message || 'Unable to save template settings'),
  });

  const filteredLogs = useMemo(() => {
    return logs.filter((entry) => {
      const statusOk = statusFilter === 'all' || String(entry.status || '').toLowerCase() === statusFilter;
      const roleOk = roleFilter === 'all' || String(entry.recipient_type || '').toLowerCase() === roleFilter;
      const text = `${entry.phone || ''} ${entry.recipient_name || ''} ${entry.dispatch_id || ''}`.toLowerCase();
      const searchOk = !search || text.includes(search.toLowerCase());
      const ts = new Date(entry.sent_at || entry.created_date || entry.created_at || 0).getTime();
      const startOk = !startDate || ts >= new Date(`${startDate}T00:00:00`).getTime();
      const endOk = !endDate || ts <= new Date(`${endDate}T23:59:59`).getTime();
      return statusOk && roleOk && searchOk && startOk && endOk;
    });
  }, [logs, statusFilter, roleFilter, search, startDate, endDate]);

  const previews = useMemo(() => {
    const footer = templateSettings.support_footer ? ` ${templateSettings.support_footer}` : '';
    return [
      templatePreview('Welcome SMS', SMS_WELCOME_MESSAGE, ''),
      templatePreview('Opt-out confirmation SMS', 'CCG Transit: You are now opted out of SMS notifications.', ''),
      templatePreview('Driver dispatch SMS', 'CCG Transit: Dispatch Assigned.\nApr 1, 2026 at 5:00 AM\n\nPlease open the app to view and confirm.', footer),
      templatePreview('Company owner dispatch SMS', 'CCG Transit: Dispatch Updated.\nApr 1, 2026 at 5:00 AM\n\nPlease open the app to view and confirm.', footer),
      templatePreview('Company owner informational update SMS', 'CCG Transit: Dispatch info updated. Please open the app for details.', footer),
      templatePreview('Admin SMS', 'CCG Transit: Operations update available. Please open the app.', footer),
      templatePreview('Broadcast / informational SMS', 'CCG Transit: Service update for today. Please review in app.', footer),
    ];
  }, [templateSettings.support_footer]);

  const broadcastMutation = useMutation({
    mutationFn: async () => {
      const trimmedMessage = broadcastForm.message.trim();
      if (!trimmedMessage) throw new Error('Broadcast message is required.');
      const recipients = new Set();
      const sharedAdminAccessCode = broadcastForm.include_admins
        ? await resolveEffectiveSharedAdminAccessCode()
        : null;

      for (const code of accessCodes) {
        if (code.code_type === 'Driver' && !broadcastForm.include_drivers) continue;
        if (code.code_type === 'CompanyOwner' && !broadcastForm.include_owners) continue;
        if (code.code_type === 'Admin') continue;
        recipients.add(code.id);
      }

      if (broadcastForm.include_admins) {
        if (sharedAdminAccessCode?.id) {
          recipients.add(sharedAdminAccessCode.id);
        } else {
          await base44.entities.General.create({
            record_type: 'sms_log',
            status: 'skipped',
            recipient_access_code_id: null,
            recipient_type: 'Admin',
            recipient_name: 'Shared Admin',
            phone: null,
            message: trimmedMessage,
            skip_reason: 'shared_admin_config_not_found',
            provider: SMS_PROVIDER,
          });
        }
      }

      const broadcastId = `b_${Date.now()}`;
      const payload = {
        broadcast_id: broadcastId,
        message: trimmedMessage,
        include_drivers: broadcastForm.include_drivers,
        include_owners: broadcastForm.include_owners,
        include_admins: broadcastForm.include_admins,
        send_mode: broadcastForm.send_mode,
        scheduled_at: broadcastForm.send_mode === 'scheduled' ? broadcastForm.scheduled_at || null : null,
        status: broadcastForm.send_mode === 'scheduled' ? 'scheduled_pending_backend' : 'sending',
        recipient_count: recipients.size,
        created_at: new Date().toISOString(),
      };

      await saveSmsBroadcast(payload);

      if (broadcastForm.send_mode === 'scheduled') {
        return { scheduled: true };
      }

      const driversById = new Map(drivers.map((driver) => [driver.id, driver]));
      const companyById = new Map(companies.map((company) => [company.id, company]));

      for (const code of accessCodes) {
        if (!recipients.has(code.id)) continue;

        let smsPhone = '';
        let smsEnabled = false;
        let skipReason = null;

        if (code.code_type === 'Driver') {
          const driver = driversById.get(code.driver_id);
          const state = getDriverSmsState(driver);
          smsPhone = state.normalizedPhone;
          smsEnabled = state.effective;
          skipReason = !state.ownerEnabled ? 'owner_sms_disabled' : !state.driverOptedIn ? 'driver_not_opted_in' : !state.hasValidPhone ? 'missing_sms_phone' : null;
        } else if (code.code_type === 'CompanyOwner') {
          const company = companyById.get(code.company_id);
          const state = getCompanyOwnerSmsState({ accessCode: code, company });
          smsPhone = state.normalizedPhone;
          smsEnabled = state.effective;
          skipReason = state.optedOut ? 'sms_opted_out' : !state.optedIn ? 'owner_not_opted_in' : !state.hasValidPhone ? 'missing_sms_phone' : null;
        } else if (code.code_type === 'Admin') {
          const state = getAdminSmsProductState(code);
          smsPhone = normalizeUsSmsPhone(code.sms_phone);
          smsEnabled = state.optedIn && !state.optedOut && state.hasValidPhone;
          skipReason = state.optedOut ? 'sms_opted_out' : !state.optedIn ? 'sms_disabled' : !state.hasValidPhone ? 'missing_sms_phone' : null;
        }

        if (!smsEnabled || !smsPhone) {
          await base44.entities.General.create({
            record_type: 'sms_log',
            status: 'skipped',
            recipient_access_code_id: code.id,
            recipient_type: code.code_type,
            recipient_name: code.label || code.code,
            phone: smsPhone || null,
            message: trimmedMessage,
            skip_reason: skipReason || 'sms_disabled',
            provider: SMS_PROVIDER,
          });
          continue;
        }

        try {
          const response = await base44.functions.invoke('sendNotificationSms/entry', { phone: smsPhone, message: `CCG Transit: ${trimmedMessage}` });
          const responseData = response?.data || response || {};
          await base44.entities.General.create({
            record_type: 'sms_log',
            status: responseData?.ok ? 'sent' : 'failed',
            recipient_access_code_id: code.id,
            recipient_type: code.code_type,
            recipient_name: code.label || code.code,
            phone: smsPhone,
            message: `CCG Transit: ${trimmedMessage}`,
            error_message: responseData?.ok ? null : responseData?.error || 'Broadcast send failed',
            provider: responseData?.provider || SMS_PROVIDER,
            provider_message_id: responseData?.providerMessageId || null,
            sent_at: responseData?.sentAt || null,
            skip_reason: null,
          });
        } catch (error) {
          await base44.entities.General.create({
            record_type: 'sms_log',
            status: 'failed',
            recipient_access_code_id: code.id,
            recipient_type: code.code_type,
            recipient_name: code.label || code.code,
            phone: smsPhone,
            message: `CCG Transit: ${trimmedMessage}`,
            provider: SMS_PROVIDER,
            error_message: error?.message || String(error),
          });
        }
      }

      return { scheduled: false };
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['sms-broadcasts'] });
      await queryClient.invalidateQueries({ queryKey: ['sms-general-logs'] });
      setBroadcastForm({ message: '', send_mode: 'now', scheduled_at: '', include_drivers: true, include_owners: true, include_admins: false });
      toast.success(result?.scheduled ? 'Broadcast saved as scheduled pending backend processing.' : 'Broadcast send completed.');
    },
    onError: (error) => toast.error(error?.message || 'Unable to process broadcast'),
  });

  if (!isAdmin) return <div className="text-sm text-slate-500">Admin access required.</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold text-slate-900">SMS Center</h2>
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-6 h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rules">Notification Rules</TabsTrigger>
          <TabsTrigger value="templates">Templates / Previews</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="inbound">Inbound / Replies</TabsTrigger>
          <TabsTrigger value="broadcasts">Broadcasts / Scheduled</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card><CardContent className="p-4 text-sm text-slate-600 space-y-2">
            <p>Shared admin SMS is active product-wide and controlled by app settings + shared admin profile toggle/phone.</p>
            <p>Dispatch SMS remains short format: brand prefix, short title, dispatch date/time, app-open CTA.</p>
            <p>This center surfaces logs from General records and stores configuration in AppConfig keys.</p>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="rules">
          <Card><CardHeader><CardTitle className="text-base">SMS Notification Rules</CardTitle></CardHeader><CardContent className="space-y-3">
            {RULE_META.map(([key, label]) => (
              <div key={key} className="flex items-center justify-between rounded border p-3">
                <Label>{label}</Label>
                <Switch checked={smsRules[key] !== false} onCheckedChange={(checked) => rulesMutation.mutate({ ...smsRules, [key]: checked })} />
              </div>
            ))}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="templates">
          <Card><CardHeader><CardTitle className="text-base">Templates / Previews</CardTitle></CardHeader><CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Editable support footer (safe static text only)</Label>
              <Input value={templateSettings.support_footer || ''} onChange={(e) => templateMutation.mutate({ ...templateSettings, support_footer: e.target.value })} placeholder="Support: alex@ccgnj.com" />
              <p className="text-xs text-slate-500">Core dynamic sections are locked (brand prefix, title/category, dispatch datetime, CTA).</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {previews.map((preview) => (
                <div key={preview.title} className="rounded border p-3 bg-slate-50">
                  <p className="font-medium text-sm">{preview.title}</p>
                  <pre className="whitespace-pre-wrap text-xs mt-2 text-slate-700">{preview.body}</pre>
                </div>
              ))}
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card><CardHeader><CardTitle className="text-base">SMS Logs</CardTitle></CardHeader><CardContent className="space-y-3">
            <div className="grid md:grid-cols-6 gap-2">
              <Input placeholder="Search phone / recipient / dispatch" value={search} onChange={(e) => setSearch(e.target.value)} className="md:col-span-2" />
              <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="sent">Sent</SelectItem><SelectItem value="failed">Failed</SelectItem><SelectItem value="skipped">Skipped</SelectItem></SelectContent></Select>
              <Select value={roleFilter} onValueChange={setRoleFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All roles</SelectItem><SelectItem value="driver">Driver</SelectItem><SelectItem value="companyowner">Company Owner</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent></Select>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              {filteredLogs.length === 0 ? <p className="text-sm text-slate-500">No SMS logs found for current filters.</p> : filteredLogs.map((entry) => (
                <div key={entry.id} className="rounded border p-3 text-xs">
                  <div className="flex flex-wrap gap-3"><span className="font-semibold uppercase">{entry.status}</span><span>{format(new Date(entry.sent_at || entry.created_date || entry.created_at || Date.now()), 'PPp')}</span><span>{entry.recipient_type || '—'}</span><span>{entry.recipient_name || '—'}</span></div>
                  <div className="mt-1 text-slate-700">Phone: {normalizeSmsPhone(entry.phone) || entry.phone || '—'} • Dispatch: {entry.dispatch_id || '—'} • Provider: {entry.provider || '—'} • Provider ID: {entry.provider_message_id || '—'}</div>
                  <div className="mt-1 text-slate-600">{entry.message || 'No message body logged.'}</div>
                  {entry.skip_reason && <div className="mt-1 text-amber-700">Skip: {entry.skip_reason}</div>}
                  {entry.error_message && <div className="mt-1 text-red-700">Error: {entry.error_message}</div>}
                </div>
              ))}
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="inbound">
          <Card><CardHeader><CardTitle className="text-base">Inbound / Replies / Opt-Outs</CardTitle></CardHeader><CardContent>
            {inbound.length === 0 ? (
              <p className="text-sm text-slate-500">No inbound SMS records yet. When provider callbacks/webhooks are wired, replies (STOP/HELP/etc.), opt-outs, and payload statuses will appear here.</p>
            ) : (
              <div className="space-y-2">{inbound.map((entry) => (
                <div key={entry.id} className="rounded border p-3 text-xs">
                  <p className="font-medium">{entry.phone || 'Unknown sender'} • {entry.inbound_keyword || 'No keyword'}</p>
                  <p className="text-slate-700">{entry.message || 'No message body'}</p>
                  <p className="text-slate-500">Provider payload: {entry.provider_status_payload || '—'}</p>
                </div>
              ))}</div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="broadcasts">
          <Card><CardHeader><CardTitle className="text-base">Broadcasts / Scheduled Messages</CardTitle></CardHeader><CardContent className="space-y-4">
            <Textarea rows={4} placeholder="General informational SMS message" value={broadcastForm.message} onChange={(e) => setBroadcastForm((prev) => ({ ...prev, message: e.target.value }))} />
            <div className="grid md:grid-cols-3 gap-3">
              <label className="flex items-center justify-between rounded border p-3 text-sm">Drivers <Switch checked={broadcastForm.include_drivers} onCheckedChange={(checked) => setBroadcastForm((prev) => ({ ...prev, include_drivers: checked }))} /></label>
              <label className="flex items-center justify-between rounded border p-3 text-sm">Company Owners <Switch checked={broadcastForm.include_owners} onCheckedChange={(checked) => setBroadcastForm((prev) => ({ ...prev, include_owners: checked }))} /></label>
              <label className="flex items-center justify-between rounded border p-3 text-sm">Admins <Switch checked={broadcastForm.include_admins} onCheckedChange={(checked) => setBroadcastForm((prev) => ({ ...prev, include_admins: checked }))} /></label>
            </div>
            <div className="grid md:grid-cols-3 gap-3 items-end">
              <div><Label>Send mode</Label><Select value={broadcastForm.send_mode} onValueChange={(value) => setBroadcastForm((prev) => ({ ...prev, send_mode: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="now">Send now</SelectItem><SelectItem value="scheduled">Schedule</SelectItem></SelectContent></Select></div>
              <div><Label>Scheduled date/time</Label><Input type="datetime-local" value={broadcastForm.scheduled_at} disabled={broadcastForm.send_mode !== 'scheduled'} onChange={(e) => setBroadcastForm((prev) => ({ ...prev, scheduled_at: e.target.value }))} /></div>
              <Button onClick={() => broadcastMutation.mutate()} disabled={broadcastMutation.isPending}>{broadcastMutation.isPending ? 'Processing...' : (broadcastForm.send_mode === 'scheduled' ? 'Save Scheduled' : 'Send Broadcast')}</Button>
            </div>
            <p className="text-xs text-slate-500">Scheduled items are persisted with scheduled status; background execution still requires backend scheduler wiring.</p>
            <div className="space-y-2">
              {broadcasts.length === 0 ? <p className="text-sm text-slate-500">No broadcasts created yet.</p> : broadcasts.map((b) => (
                <div key={b.key} className="rounded border p-3 text-xs">
                  <p className="font-medium">{b.status || 'unknown'} • recipients: {b.recipient_count || 0}</p>
                  <p>{b.message}</p>
                  <p className="text-slate-500">Mode: {b.send_mode} {b.scheduled_at ? `• scheduled: ${b.scheduled_at}` : ''}</p>
                </div>
              ))}
            </div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
