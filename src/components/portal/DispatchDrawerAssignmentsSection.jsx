import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock, FileText } from 'lucide-react';

const tollColors = {
  Authorized: 'bg-green-50 text-green-700',
  Unauthorized: 'bg-red-50 text-red-700',
  'Included in Rate': 'bg-purple-50 text-purple-700',
};

function AssignmentDetailBlock({ assignment, iconSize = 'h-4 w-4', textColor = 'text-slate-700' }) {
  return (
    <>
      {assignment.job_number && (
        <div className="rounded-md border border-slate-200 bg-white/80 px-2.5 py-2">
          <div className={`flex items-center gap-2 text-sm ${textColor}`}>
            <FileText className={`${iconSize} text-slate-400 shrink-0`} />
            <span className="font-bold">Job #</span>
            <Badge className="bg-black px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-black">
              {assignment.job_number}
            </Badge>
          </div>
        </div>
      )}
      {assignment.start_time && (
        <div className={`flex items-center gap-2 ${textColor}`}>
          <Clock className={`${iconSize} text-slate-400 shrink-0`} />
          <span>{assignment.formatTimeToAmPm(assignment.start_time)}</span>
        </div>
      )}
      {assignment.start_location && (
        <div>
          <p className="text-xs font-semibold text-slate-400 mb-0.5">Start Location:</p>
          <p className={`text-sm ${assignment.contentTextClass || 'text-slate-600'} whitespace-pre-wrap ${assignment.contentExtraClass || ''}`}>{assignment.start_location}</p>
        </div>
      )}
      {assignment.instructions && (
        <div>
          <p className="text-xs font-semibold text-slate-400 mb-0.5">Instructions:</p>
          <p className={`text-sm ${assignment.contentTextClass || 'text-slate-600'} whitespace-pre-wrap ${assignment.contentExtraClass || ''}`}>{assignment.instructions}</p>
        </div>
      )}
      {assignment.notes && (
        <div>
          <p className="text-xs font-semibold text-slate-400 mb-0.5">Notes</p>
          <p className={`text-sm ${assignment.contentTextClass || 'text-slate-600'} whitespace-pre-wrap ${assignment.contentExtraClass || ''}`}>{assignment.notes}</p>
        </div>
      )}
      {assignment.toll_status && (
        <Badge className={`${tollColors[assignment.toll_status]} text-xs font-medium`}>
          Toll: {assignment.toll_status}
        </Badge>
      )}
    </>
  );
}

export default function DispatchDrawerAssignmentsSection({ dispatch, hasAdditional, formatTimeToAmPm }) {
  if (!(hasAdditional || dispatch.instructions || dispatch.notes || dispatch.toll_status || dispatch.start_time || dispatch.start_location)) {
    return null;
  }

  const primary = { ...dispatch, formatTimeToAmPm, contentTextClass: 'text-slate-700', contentExtraClass: 'leading-relaxed' };

  return (
    <section className="space-y-3.5">
      <div data-tour="dispatch-assignment-details" className="rounded-xl border border-slate-200 bg-slate-50/90 p-3.5 sm:p-4 space-y-3 shadow-sm">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.14em]">
          {(dispatch.additional_assignments || []).length > 0 ? 'Assignment 1' : 'Assignment'}
        </p>
        <div className="space-y-2.5">
          <AssignmentDetailBlock assignment={primary} />
        </div>
      </div>

      {(dispatch.additional_assignments || []).length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold text-slate-500 uppercase tracking-[0.14em]">Additional Assignments</p>
          <div className="space-y-3">
            {dispatch.additional_assignments.map((assignment, i) => {
              const entry = { ...assignment, formatTimeToAmPm, contentTextClass: 'text-slate-600', contentExtraClass: '' };
              return (
                <div key={i} className={`rounded-xl border border-slate-200 p-3.5 text-sm shadow-sm ${i % 2 === 0 ? 'bg-slate-50/90' : 'bg-blue-50/50'}`}>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Assignment {i + 2}</p>
                  <div className="space-y-2">
                    <AssignmentDetailBlock assignment={entry} iconSize="h-3.5 w-3.5" textColor="text-slate-700" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
