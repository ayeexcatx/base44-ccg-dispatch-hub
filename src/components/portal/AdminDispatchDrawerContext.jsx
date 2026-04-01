import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import DispatchDetailDrawer from '@/components/portal/DispatchDetailDrawer';
import { createPageUrl } from '@/utils';

const AdminDispatchDrawerContext = createContext({
  openAdminDispatchDrawer: () => {},
  closeAdminDispatchDrawer: () => {},
});

export function AdminDispatchDrawerProvider({ children, session, isAdmin }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [drawerState, setDrawerState] = useState({
    open: false,
    dispatchId: '',
    notificationId: '',
  });

  const { data: dispatches = [] } = useQuery({
    queryKey: ['dispatches-admin'],
    queryFn: () => base44.entities.Dispatch.list('-date', 500),
    enabled: !!isAdmin,
  });

  const { data: targetDispatch = null } = useQuery({
    queryKey: ['dispatch-admin-overlay-target', drawerState.dispatchId],
    queryFn: async () => {
      if (!drawerState.dispatchId) return null;
      const results = await base44.entities.Dispatch.filter({ id: drawerState.dispatchId }, '-created_date', 1);
      return results?.[0] || null;
    },
    enabled: !!isAdmin && !!drawerState.dispatchId,
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => base44.entities.Company.list(),
    enabled: !!isAdmin,
  });

  const { data: templateNotes = [] } = useQuery({
    queryKey: ['template-notes'],
    queryFn: () => base44.entities.DispatchTemplateNotes.filter({ active_flag: true }, 'priority', 50),
    enabled: !!isAdmin,
  });

  const { data: drawerConfirmations = [] } = useQuery({
    queryKey: ['admin-overlay-confirmations', drawerState.dispatchId],
    queryFn: () => base44.entities.Confirmation.filter({ dispatch_id: drawerState.dispatchId }, '-confirmed_at', 100),
    enabled: !!isAdmin && !!drawerState.dispatchId,
  });

  const { data: drawerTimeEntries = [] } = useQuery({
    queryKey: ['admin-overlay-time-entries', drawerState.dispatchId],
    queryFn: () => base44.entities.TimeEntry.filter({ dispatch_id: drawerState.dispatchId }, '-created_date', 100),
    enabled: !!isAdmin && !!drawerState.dispatchId,
  });

  const previewDispatch = useMemo(
    () => {
      if (!drawerState.dispatchId) return null;
      return targetDispatch
        || dispatches.find((dispatch) => String(dispatch.id) === String(drawerState.dispatchId))
        || null;
    },
    [dispatches, drawerState.dispatchId, targetDispatch],
  );

  const companyMap = useMemo(
    () => Object.fromEntries(companies.map((company) => [company.id, company.name])),
    [companies],
  );

  const openAdminDispatchDrawer = useCallback(async ({ dispatchId, notificationId = '' } = {}) => {
    if (!isAdmin || !dispatchId) return;

    const normalizedDispatchId = String(dispatchId);

    queryClient.invalidateQueries({ queryKey: ['dispatches-admin'] });
    queryClient.invalidateQueries({ queryKey: ['dispatch-admin-overlay-target', normalizedDispatchId] });

    setDrawerState({ open: true, dispatchId: normalizedDispatchId, notificationId: notificationId ? String(notificationId) : '' });

    if (notificationId) {
      try {
        await base44.entities.Notification.update(notificationId, { read_flag: true });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      } catch {
        // no-op: drawer still opens even if notification read update fails
      }
    }
  }, [isAdmin, queryClient]);

  const closeAdminDispatchDrawer = useCallback(() => {
    setDrawerState({ open: false, dispatchId: '', notificationId: '' });
  }, []);

  const handleAdminDrawerEdit = useCallback((dispatchToEdit) => {
    if (!dispatchToEdit?.id) return;
    closeAdminDispatchDrawer();
    navigate(createPageUrl('AdminDispatches'), {
      state: {
        editDispatchId: dispatchToEdit.id,
      },
    });
  }, [closeAdminDispatchDrawer, navigate]);

  const value = useMemo(() => ({
    openAdminDispatchDrawer,
    closeAdminDispatchDrawer,
  }), [openAdminDispatchDrawer, closeAdminDispatchDrawer]);

  return (
    <AdminDispatchDrawerContext.Provider value={value}>
      {children}
      {isAdmin && (
        <DispatchDetailDrawer
          open={drawerState.open && !!previewDispatch}
          onClose={closeAdminDispatchDrawer}
          dispatch={previewDispatch}
          session={session || { code_type: 'Admin' }}
          confirmations={drawerConfirmations}
          timeEntries={drawerTimeEntries}
          templateNotes={templateNotes}
          onConfirm={() => {}}
          onTimeEntry={() => {}}
          onAdminEditDispatch={handleAdminDrawerEdit}
          companyName={previewDispatch ? companyMap[previewDispatch.company_id] : ''}
        />
      )}
    </AdminDispatchDrawerContext.Provider>
  );
}

export function useAdminDispatchDrawer() {
  return useContext(AdminDispatchDrawerContext);
}
