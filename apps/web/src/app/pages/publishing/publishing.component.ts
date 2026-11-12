import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-publishing',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between pb-6 border-b border-[#16403b]">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-white">Publishing Operations</h1>
          <p class="text-sm text-[#8DAEAA] mt-1">Multi-platform channel dispatch for YouTube Shorts & Instagram Reels.</p>
        </div>
      </div>

      <!-- Human Gate Warning -->
      <div class="p-5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-4">
        <span class="text-2xl">⚠️</span>
        <div class="space-y-1">
          <h3 class="text-sm font-bold text-amber-300">Mandatory Human Release Gate</h3>
          <p class="text-xs text-amber-200/80 leading-relaxed">
            By system invariant, autonomous publishing to public social media accounts is strictly locked. Every release requires explicit owner authentication and verification signature.
          </p>
        </div>
      </div>

      <!-- Platforms Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- YouTube Shorts -->
        <div class="glass-panel p-5 rounded-xl border border-[#16403b] space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-sm font-semibold text-white">YouTube Shorts</span>
            <span class="text-xs px-2 py-0.5 rounded font-mono font-bold bg-[#00A878]/20 text-[#00D09C]">API Key Ready</span>
          </div>
          <p class="text-xs text-[#8DAEAA]">Project: <code class="text-white">even-boulder-514217-d5</code> (YouTube Automation)</p>
          <div class="pt-2">
            <button class="px-4 py-2 bg-neutral-800 text-neutral-400 border border-neutral-700 text-xs rounded-lg cursor-not-allowed">
              OAuth 2.0 Upload Channel Not Linked
            </button>
          </div>
        </div>

        <!-- Instagram Reels -->
        <div class="glass-panel p-5 rounded-xl border border-[#16403b] space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-sm font-semibold text-white">Instagram Reels</span>
            <span class="text-xs px-2 py-0.5 rounded font-mono font-bold bg-neutral-800 text-neutral-400">NOT_CONFIGURED</span>
          </div>
          <p class="text-xs text-[#8DAEAA]">Requires Meta Professional Account Graph API linkage.</p>
        </div>
      </div>
    </div>
  `
})
export class PublishingComponent {
  apiService = inject(ApiService);
}
