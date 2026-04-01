import React from 'react';
import { DRIVER_PROTOCOL_CONTENT } from '@/constants/driverProtocols';

export default function DriverProtocolContent() {
  return (
    <div className="space-y-6">
      {DRIVER_PROTOCOL_CONTENT.map((section) => (
        <section key={section.heading} className="space-y-2">
          <h3 className="text-base font-semibold text-slate-900">{section.heading}</h3>
          <ul className="space-y-1.5 list-disc pl-5 text-sm text-slate-700">
            {section.body.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
