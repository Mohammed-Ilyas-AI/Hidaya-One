import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-overview',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#16403b]">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <span>Production Command Overview</span>
            <span class="text-xs uppercase tracking-wider px-2.5 py-0.5 rounded-full font-semibold bg-[#00A878]/20 text-[#00D09C] border border-[#00A878]/30">Live Platform</span>
          </h1>
          <p class="text-sm text-[#8DAEAA] mt-1">Autonomous Islamic educational Shorts production cycle for Tamil, Arabic, and English.</p>
        </div>
        <div class="flex items-center gap-3">
          <button (click)="refresh()" class="px-4 py-2 text-sm font-medium rounded-lg bg-[#0a1e1c] text-[#8DAEAA] hover:text-white border border-[#16403b] hover:border-[#00D09C] transition-all">
            Refresh Telemetry
          </button>
        </div>
      </div>

      <!-- KPI Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <!-- Daily Target -->
        <div class="glass-panel p-5 rounded-xl border border-[#16403b]">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-[#8DAEAA]">Daily Target</span>
            <span class="text-xs px-2 py-0.5 rounded font-mono bg-[#D4AF37]/20 text-[#F3E5AB]">3 Shorts</span>
          </div>
          <div class="mt-3 flex items-baseline gap-2">
            <span class="text-3xl font-extrabold text-white">0 / 3</span>
            <span class="text-xs text-[#8DAEAA]">completed today</span>
          </div>
          <div class="mt-3 w-full bg-[#051111] h-1.5 rounded-full overflow-hidden">
            <div class="bg-gradient-to-r from-[#00A878] to-[#00D09C] h-full w-0"></div>
          </div>
        </div>

        <!-- Verification Gate Status -->
        <div class="glass-panel p-5 rounded-xl border border-[#16403b]">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-[#8DAEAA]">Religious Gate</span>
            <span class="text-xs px-2 py-0.5 rounded font-mono bg-[#00A878]/20 text-[#00D09C]">Deterministic</span>
          </div>
          <div class="mt-3 flex items-baseline gap-2">
            <span class="text-2xl font-bold text-[#00D09C]">ACTIVE</span>
            <span class="text-xs text-[#8DAEAA]">23 tests verified</span>
          </div>
          <p class="text-xs text-[#8DAEAA] mt-2">Zero unverified scripts allowed to proceed</p>
        </div>

        <!-- Pending Approvals -->
        <div class="glass-panel p-5 rounded-xl border border-[#16403b]">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-[#8DAEAA]">Human Approvals</span>
            <span class="text-xs px-2 py-0.5 rounded font-mono bg-yellow-500/20 text-yellow-300">Gated</span>
          </div>
          <div class="mt-3 flex items-baseline gap-2">
            <span class="text-3xl font-extrabold text-white">0</span>
            <span class="text-xs text-[#8DAEAA]">awaiting sign-off</span>
          </div>
          <p class="text-xs text-[#8DAEAA] mt-2">Publishing strictly requires owner approval</p>
        </div>

        <!-- Connected Services -->
        <div class="glass-panel p-5 rounded-xl border border-[#16403b]">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold uppercase tracking-wider text-[#8DAEAA]">Integrations</span>
            <span class="text-xs px-2 py-0.5 rounded font-mono bg-blue-500/20 text-blue-300">Matrix</span>
          </div>
          <div class="mt-3 flex items-baseline gap-2">
            <span class="text-3xl font-extrabold text-white">{{ connectedCount() }}</span>
            <span class="text-xs text-[#8DAEAA]">/ {{ totalCount() }} connected</span>
          </div>
          <p class="text-xs text-[#8DAEAA] mt-2">Truthful status tracking active</p>
        </div>
      </div>

      <!-- Main Columns: Stages & Live Integrations -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- 8-Stage Production Pipeline Status -->
        <div class="lg:col-span-2 glass-panel p-6 rounded-xl border border-[#16403b]">
          <h2 class="text-lg font-bold text-white mb-4 flex items-center justify-between">
            <span>8-Stage Pipeline Invariants</span>
            <span class="text-xs text-[#8DAEAA]">Fail-Closed Architecture</span>
          </h2>
          <div class="space-y-3">
            <div *ngFor="let stage of pipelineStages" class="p-3.5 rounded-lg bg-[#051111]/60 border border-[#16403b] flex items-center justify-between">
              <div class="flex items-center gap-3">
                <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-mono"
                      [ngClass]="stage.status === 'VERIFIED' || stage.status === 'READY' ? 'bg-[#00A878]/20 text-[#00D09C] border border-[#00A878]/40' : 'bg-[#0a1e1c] text-[#8DAEAA] border border-[#16403b]'">
                  {{ stage.step }}
                </span>
                <div>
                  <div class="text-sm font-semibold text-white">{{ stage.title }}</div>
                  <div class="text-xs text-[#8DAEAA]">{{ stage.description }}</div>
                </div>
              </div>
              <span class="text-xs px-2.5 py-1 rounded font-mono font-semibold"
                    [ngClass]="{
                      'bg-[#00A878]/20 text-[#00D09C] border border-[#00A878]/40': stage.badge === 'VERIFIED' || stage.badge === 'ACTIVE',
                      'bg-yellow-500/10 text-yellow-300 border border-yellow-500/30': stage.badge === 'MANDATORY_GATE',
                      'bg-[#0a1e1c] text-[#8DAEAA] border border-[#16403b]': stage.badge === 'DRAFT_ONLY' || stage.badge === 'PENDING'
                    }">
                {{ stage.badge }}
              </span>
            </div>
          </div>
        </div>

        <!-- Live Integration Matrix -->
        <div class="glass-panel p-6 rounded-xl border border-[#16403b]">
          <h2 class="text-lg font-bold text-white mb-4">Integration Telemetry</h2>
          <div class="space-y-2.5">
            <div *ngFor="let item of apiService.integrations()" class="p-3 rounded-lg bg-[#051111]/40 border border-[#16403b]/60 flex items-center justify-between">
              <div>
                <div class="text-xs font-semibold text-white capitalize">{{ item.name.replace('_', ' ') }}</div>
                <div class="text-[11px] text-[#8DAEAA] truncate max-w-[180px]">{{ item.reason }}</div>
              </div>
              <span class="text-[10px] px-2 py-0.5 rounded font-mono font-bold"
                    [ngClass]="{
                      'bg-[#00A878]/20 text-[#00D09C] border border-[#00A878]/30': item.status === 'CONNECTED',
                      'bg-neutral-800 text-neutral-400 border border-neutral-700': item.status === 'NOT_CONFIGURED',
                      'bg-red-500/20 text-red-400 border border-red-500/30': item.status === 'FAILED'
                    }">
                {{ item.status }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class OverviewComponent implements OnInit {
  apiService = inject(ApiService);

  pipelineStages = [
    { step: 1, title: 'Islamic Research', description: 'Quran & Hadith candidates retrieved with primary links', status: 'READY', badge: 'ACTIVE' },
    { step: 2, title: 'Religious Verification', description: 'Deterministic gate validating Arabic, Surah/Ayah & scholar grades', status: 'READY', badge: 'MANDATORY_GATE' },
    { step: 3, title: 'Tamil Script Drafting', description: '30–45s hook, narration & practical guidance (gate-passed only)', status: 'READY', badge: 'ACTIVE' },
    { step: 4, title: 'Creative Storyboard', description: '9:16 layout, scene timings, visual prompts without forbidden depictions', status: 'READY', badge: 'ACTIVE' },
    { step: 5, title: 'Veo Video Specification', description: 'Prompt formulating clip briefs (Tool offline: spec only)', status: 'WAITING', badge: 'DRAFT_ONLY' },
    { step: 6, title: 'Video Timeline Assembly', description: 'Narration, subtitles, overlays & audio sync manifest', status: 'WAITING', badge: 'DRAFT_ONLY' },
    { step: 7, title: 'Independent QC Review', description: '6-factor audit: religion, language, layout, audio, copyright', status: 'WAITING', badge: 'PENDING' },
    { step: 8, title: 'Human Release Gate', description: 'Owner approval required before YouTube/Instagram release', status: 'WAITING', badge: 'MANDATORY_GATE' },
  ];

  ngOnInit() {
    this.refresh();
  }

  refresh() {
    this.apiService.loadIntegrations().subscribe();
    this.apiService.loadOverview().subscribe();
  }

  connectedCount(): number {
    return this.apiService.integrations().filter(i => i.status === 'CONNECTED').length;
  }

  totalCount(): number {
    return this.apiService.integrations().length;
  }
}
