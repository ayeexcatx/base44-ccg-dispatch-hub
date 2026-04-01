import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export const confirmationsQueryKey = ['confirmations'];

export function useConfirmationsQuery(enabled = true, companyId = null) {
  return useQuery({
    queryKey: [...confirmationsQueryKey, companyId || null],
    queryFn: async () => {
      const confirmations = await base44.entities.Confirmation.list('-confirmed_at', 500);
      if (!companyId) return confirmations || [];

      const companyDispatches = await base44.entities.Dispatch.filter({ company_id: companyId }, '-date', 500);
      const companyDispatchIds = new Set((companyDispatches || []).map((dispatch) => String(dispatch.id || '')));
      return (confirmations || []).filter((confirmation) => companyDispatchIds.has(String(confirmation.dispatch_id || '')));
    },
    enabled,
    refetchInterval: 30000,
  });
}
