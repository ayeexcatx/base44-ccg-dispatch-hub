import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useSession } from '@/components/session/SessionContext';
import { useAuth } from '@/lib/AuthContext';
import { resolveDriverIdentity } from '@/services/currentAppIdentityService';
import DriverProtocolContent from '@/components/protocols/DriverProtocolContent';
import {
  createDriverProtocolAcknowledgment,
  driverProtocolAckQueryKey,
  getDriverProtocolAcknowledgment,
} from '@/services/driverProtocolAcknowledgmentService';
import { DRIVER_PROTOCOL_TITLE, DRIVER_PROTOCOL_VERSION } from '@/constants/driverProtocols';

export default function Protocols() {
  const queryClient = useQueryClient();
  const { session } = useSession();
  const { currentAppIdentity } = useAuth();
  const [checked, setChecked] = useState(false);

  const driverId = useMemo(
    () => resolveDriverIdentity({ currentAppIdentity, session }),
    [currentAppIdentity, session],
  );

  const companyId = session?.company_id || currentAppIdentity?.company_id || null;

  const { data: acknowledgment = null, isLoading } = useQuery({
    queryKey: driverProtocolAckQueryKey(driverId),
    queryFn: () => getDriverProtocolAcknowledgment(driverId),
    enabled: !!driverId,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: async () => createDriverProtocolAcknowledgment({
      driverId,
      companyId,
      acceptedByAccessCodeId: session?.id,
    }),
    onSuccess: () => {
      toast.success('Protocols acknowledged. Thank you.');
      queryClient.invalidateQueries({ queryKey: driverProtocolAckQueryKey(driverId) });
      setChecked(false);
    },
    onError: () => {
      toast.error('Unable to record your acknowledgment right now. Please try again.');
    },
  });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Card className="rounded-2xl border border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl text-slate-900">Protocols</CardTitle>
          <p className="text-sm text-slate-600">
            {DRIVER_PROTOCOL_TITLE} • Version {DRIVER_PROTOCOL_VERSION}
          </p>
          {acknowledgment?.accepted_at && (
            <p className="text-xs text-emerald-700">
              You acknowledged this version on {new Date(acknowledgment.accepted_at).toLocaleString()}.
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <DriverProtocolContent />

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div className="flex items-start gap-2">
              <Checkbox
                id="driver-protocol-ack"
                checked={Boolean(acknowledgment) || checked}
                disabled={Boolean(acknowledgment)}
                onCheckedChange={(value) => setChecked(Boolean(value))}
              />
              <Label htmlFor="driver-protocol-ack" className="text-sm text-slate-700 cursor-pointer">
                I have read and understand this in full.
              </Label>
            </div>
            <Button
              onClick={() => acknowledgeMutation.mutate()}
              disabled={Boolean(acknowledgment) || !checked || acknowledgeMutation.isPending || isLoading}
              className="bg-slate-900 hover:bg-slate-800"
            >
              {acknowledgment ? 'Already Acknowledged' : acknowledgeMutation.isPending ? 'Saving...' : 'Acknowledge Protocols'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
