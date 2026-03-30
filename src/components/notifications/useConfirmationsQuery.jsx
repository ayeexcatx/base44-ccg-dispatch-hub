import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export const confirmationsQueryKey = ['confirmations'];

export function useConfirmationsQuery(enabled = true) {
  return useQuery({
    queryKey: confirmationsQueryKey,
    queryFn: () => base44.entities.Confirmation.list('-confirmed_at', 500),
    enabled,
    refetchInterval: 30000,
  });
}
