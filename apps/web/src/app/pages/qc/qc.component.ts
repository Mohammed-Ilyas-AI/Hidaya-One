import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-qc',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between pb-6 border-b border-[#16403b]">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-white">Quality Control Audit</h1>
          <p class="text-sm text-[#8DAEAA] mt-1">Independent 6-dimensional verification audit before video packaging.</p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div *ngFor="let check of qcDimensions" class="glass-panel p-5 rounded-xl border border-[#16403b] space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-sm font-semibold text-white">{{ check.title }}</span>
            <span class="text-xs px-2 py-0.5 rounded font-mono font-bold bg-[#00A878]/20 text-[#00D09C]">MANDATORY</span>
          </div>
          <p class="text-xs text-[#8DAEAA]">{{ check.desc }}</p>
        </div>
      </div>
    </div>
  `
})
export class QcComponent {
  qcDimensions = [
    { title: '1. Religious Fidelity', desc: 'Exact Quran/Hadith reference, scholar grading validation, and zero doctrinal invention.' },
    { title: '2. Arabic Text Integrity', desc: 'Verbatim Arabic orthography and diacritics checked against primary edition sources.' },
    { title: '3. Language Naturalness', desc: 'Fluid, respectful spoken Tamil with accurate English transliteration and supporting captions.' },
    { title: '4. Visual Guardrails', desc: 'Absolute absence of forbidden prophet depictions, face imagery, or embedded sacred text.' },
    { title: '5. Technical Pacing', desc: 'Precise 30–45s duration, 9:16 vertical margins, high-contrast subtitle legibility.' },
    { title: '6. Rights & Copyright', desc: 'Safe background ambience, verified public-domain or licensed visual assets.' },
  ];
}
