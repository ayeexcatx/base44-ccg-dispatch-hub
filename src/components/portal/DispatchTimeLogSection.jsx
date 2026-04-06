import React from 'react';
import { Button } from '@/components/ui/button';
import { Clock3, Save } from 'lucide-react';

export default function DispatchTimeLogSection({
  isOwner,
  isDriverUser,
  isAdmin,
  showOwnerAssignmentsAndTimeLogs,
  dispatchStatus,
  myTrucks,
  visibleTrucks,
  assignedTrucks,
  timeLogSectionRef,
  draftTimeEntries,
  timeEntries,
  dispatch,
  onChangeDraft,
  onCopyToAll,
  onSaveAll,
  isEditingTimeLogs,
  onEditTimeLogs,
  hasUnsavedChanges,
  isSavingAll,
  entriesToSave,
  TruckTimeRow,
}) {
  const editableTrucks = isOwner
    ? myTrucks
    : isDriverUser
      ? visibleTrucks
      : isAdmin
        ? assignedTrucks
        : [];
  const canShowTimeLog = editableTrucks.length > 0 && dispatchStatus !== 'Cancelled' && (isOwner ? showOwnerAssignmentsAndTimeLogs : true);

  return (
    <>
      {canShowTimeLog && (
        <section
          id="time-log-section"
          ref={timeLogSectionRef}
          data-tour="dispatch-time-log"
          className="rounded-xl border border-slate-200 bg-white p-3 sm:p-3.5"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5 text-slate-400" />
              Time Log
            </p>
          </div>
          <p className="mb-3 text-xs text-slate-500">
            Enter or review check-in/check-out times for each truck. Times are shown in Eastern Time.
          </p>
          <div className="space-y-2.5">
            {editableTrucks.map((truck) => (
              <TruckTimeRow
                key={truck}
                truck={truck}
                dispatch={dispatch}
                timeEntries={timeEntries}
                readOnly={false}
                draft={draftTimeEntries[truck]}
                onChangeDraft={onChangeDraft}
                onCopyToAll={onCopyToAll}
                isFirstRow={truck === editableTrucks[0]}
                isEditing={isEditingTimeLogs}
                showActor={!isEditingTimeLogs}
                onEdit={onEditTimeLogs}
              />
            ))}
          </div>
          {isEditingTimeLogs && (
            <div className="mt-3 border-t border-slate-200/80 pt-3">
              <Button
                type="button"
                onClick={onSaveAll}
                disabled={!hasUnsavedChanges || isSavingAll || entriesToSave.length === 0}
                className="h-9 w-full bg-slate-900 text-sm font-medium hover:bg-slate-800"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSavingAll ? 'Saving…' : 'Save All Time Logs'}
              </Button>
            </div>
          )}
        </section>
      )}
    </>
  );
}
