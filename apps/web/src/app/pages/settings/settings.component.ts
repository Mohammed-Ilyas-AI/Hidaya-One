import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between pb-6 border-b border-[#16403b]">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-white">System Settings & Integrations</h1>
          <p class="text-sm text-[#8DAEAA] mt-1">Cloud Run configuration, API credentials, and runtime parameters.</p>
        </div>
      </div>

      <div class="glass-panel p-6 rounded-xl border border-[#16403b] space-y-4">
        <h2 class="text-base font-bold text-white">Cloud Configuration Specs</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div class="p-3 bg-[#051111] rounded-lg border border-[#16403b]">
            <span class="text-[#8DAEAA]">GCP Project ID:</span>
            <div class="text-white font-bold mt-0.5">even-boulder-514217-d5</div>
          </div>
          <div class="p-3 bg-[#051111] rounded-lg border border-[#16403b]">
            <span class="text-[#8DAEAA]">Project Number:</span>
            <div class="text-white font-bold mt-0.5">440186659444</div>
          </div>
          <div class="p-3 bg-[#051111] rounded-lg border border-[#16403b]">
            <span class="text-[#8DAEAA]">Compute Region:</span>
            <div class="text-white font-bold mt-0.5">asia-south1</div>
          </div>
          <div class="p-3 bg-[#051111] rounded-lg border border-[#16403b]">
            <span class="text-[#8DAEAA]">Primary Model:</span>
            <div class="text-[#00D09C] font-bold mt-0.5">gemini-3.8-flash</div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class SettingsComponent {
  apiService = inject(ApiService);
}
