import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between pb-6 border-b border-[#16403b]">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-white">Channel Analytics & Telemetry</h1>
          <p class="text-sm text-[#8DAEAA] mt-1">Real-time performance metrics and publishing history.</p>
        </div>
      </div>

      <div class="glass-panel p-6 rounded-xl border border-[#16403b] space-y-4">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold uppercase tracking-wider text-[#8DAEAA]">Telemetry Engine</span>
          <span class="text-xs px-2.5 py-1 rounded font-mono font-bold bg-neutral-800 text-neutral-400">
            AWAITING_ACTIVE_CHANNEL
          </span>
        </div>
        <p class="text-sm text-neutral-300">
          Analytics ingestion triggers upon the first verified production Short upload.
        </p>
      </div>
    </div>
  `
})
export class AnalyticsComponent {}
