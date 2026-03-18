import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle2, History, Truck } from 'lucide-react';
import { statusBadgeColors } from './statusConfig';
import DispatchConfirmReceiptLogSection from './DispatchConfirmReceiptLogSection';

export default function DispatchDriverConfirmationSection({
  isOwner,
  isAdmin,
  myTrucks,
  currentConfType,
  isTruckConfirmedForCurrent,
  getTruckCurrentConfirmation,
  getTruckPriorConfirmations,
  handleConfirmTruck,
  formatLogTimestampWithActor,
  getEntryActorLabel,
  dispatch,
  eligibleDrivers,
  selectedDriverByTruck,
  handleDriverSelection,
  assignDriverMutation,
  unassignedDriverValue,
  conflictingDriverAssignmentsById,
  driverAssignmentErrors,
  confirmations,
}) {
  return (
    <>
      {isOwner && myTrucks.length > 0 && (
        <DispatchConfirmReceiptLogSection
          myTrucks={myTrucks}
          currentConfType={currentConfType}
          isTruckConfirmedForCurrent={isTruckConfirmedForCurrent}
          getTruckCurrentConfirmation={getTruckCurrentConfirmation}
          getTruckPriorConfirmations={getTruckPriorConfirmations}
          handleConfirmTruck={handleConfirmTruck}
          formatLogTimestampWithActor={formatLogTimestampWithActor}
          getEntryActorLabel={getEntryActorLabel}
        />
      )}

      {isOwner && (dispatch.trucks_assigned || []).length > 0 && (
        <div data-screenshot-exclude="true" data-tour="dispatch-driver-assignments" className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Driver Assignments</p>
          <p className="text-xs text-slate-500">Please read instructions on Drivers page before assigning drivers.</p>
          {eligibleDrivers.length === 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-2">
              Create and activate a driver access code first.
            </p>
          )}
          {(dispatch.trucks_assigned || []).map((truckNumber) => (
            <div key={`driver-${truckNumber}`} className="grid grid-cols-[70px,1fr] items-start gap-2">
              <span className="text-xs font-mono text-slate-600">{truckNumber}</span>
              {eligibleDrivers.length > 0 ? (
                <div className="space-y-1">
                  <Select
                    value={selectedDriverByTruck[truckNumber] || unassignedDriverValue}
                    onValueChange={(value) => handleDriverSelection(truckNumber, value)}
                    disabled={assignDriverMutation.isPending}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Assign driver" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={unassignedDriverValue}>No driver assigned</SelectItem>
                      {eligibleDrivers.map((driver) => {
                        const isCurrentTruckSelection = selectedDriverByTruck[truckNumber] === driver.id;
                        const hasConflict = Boolean(conflictingDriverAssignmentsById[driver.id]) && !isCurrentTruckSelection;
                        return (
                          <SelectItem key={driver.id} value={driver.id} disabled={hasConflict}>
                            {driver.driver_name}{hasConflict ? ' (Already assigned this shift)' : ''}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  {driverAssignmentErrors[truckNumber] && (
                    <p className="text-xs text-red-600">{driverAssignmentErrors[truckNumber]}</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No eligible drivers available</p>
              )}
            </div>
          ))}
        </div>
      )}

      {isAdmin && (dispatch.trucks_assigned || []).length > 0 && (
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <History className="h-3.5 w-3.5" />Confirmations
          </p>
          <div className="space-y-2">
            {(dispatch.trucks_assigned || []).map((truck) => {
              const truckConfs = confirmations
                .filter((c) => c.truck_number === truck)
                .sort((a, b) => new Date(b.confirmed_at || 0) - new Date(a.confirmed_at || 0));
              return (
                <div key={truck} className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-100">
                    <Truck className="h-3.5 w-3.5 text-slate-400" />
                    <span className="text-sm font-mono font-medium text-slate-800">{truck}</span>
                  </div>
                  {truckConfs.length === 0 ? (
                    <p className="text-xs text-slate-400 italic px-3 py-2">No confirmations yet</p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {truckConfs.map((c, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2 text-xs">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            <Badge className={`${statusBadgeColors[c.confirmation_type]} border text-xs py-0`}>{c.confirmation_type}</Badge>
                          </div>
                          {c.confirmed_at && (
                            <span className="text-slate-400 text-right">{formatLogTimestampWithActor('Confirmed', c.confirmed_at, getEntryActorLabel(c) || 'Unknown')}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
