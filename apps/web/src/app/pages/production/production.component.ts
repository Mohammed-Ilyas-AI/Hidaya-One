import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-production',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between pb-6 border-b border-[#16403b]">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-white">Video Production & Assembly</h1>
          <p class="text-sm text-[#8DAEAA] mt-1">Multi-track timeline coordination, audio synthesis, and MP4 rendering.</p>
        </div>
      </div>

      <div class="glass-panel p-6 rounded-xl border border-[#16403b] space-y-4">
        <div class="flex items-center justify-between">
          <span class="text-xs font-semibold uppercase tracking-wider text-[#8DAEAA]">Render Engine Status</span>
          <span class="text-xs px-2.5 py-1 rounded font-mono font-bold bg-neutral-800 text-neutral-400 border border-neutral-700">
            RENDERER_NOT_CONNECTED
          </span>
        </div>
        <p class="text-sm text-neutral-300">
          In strict accordance with fail-closed safety guidelines, final video assembly is retained in <code class="text-[#00D09C]">DRAFT_ONLY</code> mode until the production Cloud Run rendering container is linked.
        </p>
      </div>
    </div>
  `
})
export class ProductionComponent {}
