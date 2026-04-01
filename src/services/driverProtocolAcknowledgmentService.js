import { base44 } from '@/api/base44Client';
import { DRIVER_PROTOCOL_TITLE, DRIVER_PROTOCOL_VERSION } from '@/constants/driverProtocols';

export const driverProtocolAckQueryKey = (driverId) => ['driver-protocol-acknowledgment', driverId, DRIVER_PROTOCOL_VERSION];

export async function getDriverProtocolAcknowledgment(driverId) {
  if (!driverId) return null;

  const records = await base44.entities.DriverProtocolAcknowledgment.filter(
    {
      driver_id: driverId,
      protocol_version: DRIVER_PROTOCOL_VERSION,
    },
    '-accepted_at',
    1,
  );

  return records?.[0] || null;
}

export async function createDriverProtocolAcknowledgment({ driverId, companyId, acceptedByAccessCodeId }) {
  if (!driverId) {
    throw new Error('Driver is required to acknowledge protocols.');
  }

  const existing = await getDriverProtocolAcknowledgment(driverId);
  if (existing) return existing;

  return base44.entities.DriverProtocolAcknowledgment.create({
    driver_id: driverId,
    company_id: companyId || null,
    accepted_at: new Date().toISOString(),
    protocol_title: DRIVER_PROTOCOL_TITLE,
    protocol_version: DRIVER_PROTOCOL_VERSION,
    accepted_by_access_code_id: acceptedByAccessCodeId || null,
  });
}
