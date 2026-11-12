import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-script',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between pb-6 border-b border-[#16403b]">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-white">Script Studio — Tamil First</h1>
          <p class="text-sm text-[#8DAEAA] mt-1">Authors 30–45s spoken Tamil scripts strictly bound to gate-verified Quran & Hadith citations.</p>
        </div>
      </div>

      <div class="glass-panel p-6 rounded-xl border border-[#16403b] space-y-4">
        <div class="flex items-center justify-between">
          <span class="text-xs font-mono font-bold text-[#00D09C] bg-[#00A878]/20 px-2.5 py-1 rounded">SCRIPT PACKAGE #01</span>
          <span class="text-xs text-[#8DAEAA]">Est. Duration: 36 seconds (9:16)</span>
        </div>
        <div class="p-4 rounded-lg bg-[#051111] border border-[#16403b] space-y-3">
          <div class="text-xs text-[#F3E5AB] font-semibold uppercase tracking-wider">Opening Hook (0:00 – 0:03)</div>
          <p class="text-sm text-white font-medium">"மனதில் அமைதி இல்லையா? இந்தக் குர்ஆன் வசனத்தைக் கேளுங்கள்..."</p>
        </div>
        <div class="p-4 rounded-lg bg-[#051111] border border-[#16403b] space-y-3">
          <div class="text-xs text-[#00D09C] font-semibold uppercase tracking-wider">Exact Quran Recitation Excerpt (Ar-Ra'd 13:28)</div>
          <p class="font-arabic text-xl text-right text-white" dir="rtl">أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ</p>
        </div>
        <div class="p-4 rounded-lg bg-[#051111] border border-[#16403b] space-y-3">
          <div class="text-xs text-[#8DAEAA] font-semibold uppercase tracking-wider">Spoken Tamil Narration (0:08 – 0:32)</div>
          <p class="text-sm text-neutral-200 leading-relaxed">
            அல்லாஹ்வை நினைவுகூர்வதன் மூலமே உள்ளங்கள் உண்மையான அமைதியைப் பெறுகின்றன. எவ்வளவு சோதனைகள் வந்தாலும், திக்ரில் நிலைத்திருங்கள்.
          </p>
        </div>
      </div>
    </div>
  `
})
export class ScriptComponent {}
