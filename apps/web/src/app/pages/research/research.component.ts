import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-research',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between pb-6 border-b border-[#16403b]">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-white">Islamic Topic Research</h1>
          <p class="text-sm text-[#8DAEAA] mt-1">Discovers Quranic guidance and authentic Hadiths with primary source URLs.</p>
        </div>
      </div>

      <!-- Action Card -->
      <div class="glass-panel p-6 rounded-xl border border-[#16403b] space-y-4">
        <label class="block text-sm font-semibold text-white">Query Research Agent</label>
        <div class="flex gap-3">
          <input [(ngModel)]="searchQuery"
                 placeholder="e.g. Patience during trials, Quran 13:28, Tirmidhi 1956..."
                 class="flex-1 bg-[#051111] border border-[#16403b] rounded-lg px-4 py-2.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-[#00D09C]" />
          <button (click)="runResearch()"
                  [disabled]="loading() || !searchQuery"
                  class="px-5 py-2.5 bg-[#00A878] hover:bg-[#00D09C] disabled:opacity-50 text-[#051111] font-semibold text-sm rounded-lg transition-all flex items-center gap-2">
            <span *ngIf="loading()" class="animate-spin text-xs">⟳</span>
            <span>Initiate Research Run</span>
          </button>
        </div>
        <p *ngIf="statusMessage()" class="text-xs text-[#00D09C] font-mono">{{ statusMessage() }}</p>
      </div>

      <!-- Candidate Examples -->
      <div class="space-y-4">
        <h2 class="text-lg font-bold text-white">Verified Benchmark Controls</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Quran 13:28 Card -->
          <div class="glass-panel p-5 rounded-xl border border-[#16403b] space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono font-bold text-[#F3E5AB] bg-[#D4AF37]/20 px-2 py-0.5 rounded">QURAN 13:28</span>
              <span class="text-xs text-[#00D09C] font-semibold">Primary Source Attached</span>
            </div>
            <p class="font-arabic text-xl text-right text-white leading-relaxed dir-rtl" dir="rtl">
              أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ
            </p>
            <p class="text-sm text-[#8DAEAA]">"Verily, in the remembrance of Allah do hearts find rest." (Ar-Ra'd 13:28)</p>
            <div class="text-xs text-neutral-400 font-mono truncate">Source: https://tanzil.net/#13:28</div>
          </div>

          <!-- Tirmidhi 1956 Card -->
          <div class="glass-panel p-5 rounded-xl border border-[#16403b] space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-mono font-bold text-[#00D09C] bg-[#00A878]/20 px-2 py-0.5 rounded">HADITH — Tirmidhi 1956</span>
              <span class="text-xs text-[#00D09C] font-semibold">Graded: Hasan Sahih</span>
            </div>
            <p class="font-arabic text-xl text-right text-white leading-relaxed dir-rtl" dir="rtl">
              الدُّنْيَا سِجْنُ الْمُؤْمِنِ وَجَنَّةُ الْكَافِرِ
            </p>
            <p class="text-sm text-[#8DAEAA]">"The world is a prison for the believer and a paradise for the disbeliever."</p>
            <div class="text-xs text-neutral-400 font-mono truncate">Source: https://sunnah.com/tirmidhi:2324</div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class ResearchComponent {
  apiService = inject(ApiService);
  searchQuery = 'Discover 3 educational Quran & Hadith topics for today';
  loading = signal(false);
  statusMessage = signal('');

  runResearch() {
    this.loading.set(true);
    this.statusMessage.set('Contacting Node.js BFF -> ADK Agent Core...');
    this.apiService.startResearchRun(this.searchQuery).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.statusMessage.set(`Research job accepted: Session ${res.sessionId}`);
      },
      error: (err) => {
        this.loading.set(false);
        this.statusMessage.set(`Relay status: ${err.error?.message || err.message}`);
      }
    });
  }
}
