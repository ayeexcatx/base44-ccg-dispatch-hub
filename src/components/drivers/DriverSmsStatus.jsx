import React from 'react';
import { getDriverSmsState } from '@/lib/sms';

export default function DriverSmsStatus({ driver, desktop = false }) {
  const smsState = getDriverSmsState(driver);
  const items = [
    { label: 'Owner enabled', value: smsState.ownerEnabled ? 'Yes' : 'No' },
    { label: 'Driver opted in', value: smsState.driverOptedIn ? 'Yes' : 'No', muted: true },
    {
      label: 'Overall SMS',
      value: smsState.effective ? 'Enabled' : 'Not enabled',
      valueClassName: smsState.effective ? 'text-emerald-700' : 'text-slate-900',
    },
  ];

  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.label}
          className={desktop
            ? `rounded-lg border bg-slate-50 px-3 py-2 text-xs ${item.muted ? 'opacity-80' : ''}`
            : `rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs shadow-sm shadow-slate-200/50 ${item.muted ? 'opacity-80' : ''} ${item.label === 'Overall SMS' ? 'col-span-2' : ''}`}
        >
          <p className={desktop ? 'text-slate-500' : 'text-[11px] font-medium uppercase tracking-wide text-slate-500'}>{item.label}</p>
          <p className={`${desktop ? 'font-medium text-slate-900' : `mt-1 text-sm font-semibold ${item.valueClassName || 'text-slate-900'}`}`}>{item.value}</p>
        </div>
      ))}
    </div>
  );
}
