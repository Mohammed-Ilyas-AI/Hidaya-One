import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-creative',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between pb-6 border-b border-[#16403b]">
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-white">Creative Studio & Storyboard</h1>
          <p class="text-sm text-[#8DAEAA] mt-1">9:16 vertical scene breakdowns, lighting directions, and visual guidelines.</p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="glass-panel p-5 rounded-xl border border-[#16403b] space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-mono text-[#F3E5AB]">Scene 1 (0–6s)</span>
            <span class="text-xs text-[#8DAEAA]">Cinematic 9:16</span>
          </div>
          <div class="w-full aspect-[9/16] bg-[#051111] rounded-lg border border-[#16403b] flex flex-col items-center justify-center p-4 text-center">
            <span class="text-2xl mb-2">🕌</span>
            <span class="text-xs font-semibold text-white">Deep Emerald Archway</span>
            <span class="text-[11px] text-[#8DAEAA] mt-1">Soft volumetric morning light through ornate Islamic arches. No human figures.</span>
          </div>
        </div>

        <div class="glass-panel p-5 rounded-xl border border-[#16403b] space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-mono text-[#F3E5AB]">Scene 2 (6–20s)</span>
            <span class="text-xs text-[#8DAEAA]">Cinematic 9:16</span>
          </div>
          <div class="w-full aspect-[9/16] bg-[#051111] rounded-lg border border-[#16403b] flex flex-col items-center justify-center p-4 text-center">
            <span class="text-2xl mb-2">✨</span>
            <span class="text-xs font-semibold text-white">Holographic Gold Geometry</span>
            <span class="text-[11px] text-[#8DAEAA] mt-1">Subtle floating geometric constellation reflecting tranquility and remembrance.</span>
          </div>
        </div>

        <div class="glass-panel p-5 rounded-xl border border-[#16403b] space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-mono text-[#F3E5AB]">Scene 3 (20–36s)</span>
            <span class="text-xs text-[#8DAEAA]">Cinematic 9:16</span>
          </div>
          <div class="w-full aspect-[9/16] bg-[#051111] rounded-lg border border-[#16403b] flex flex-col items-center justify-center p-4 text-center">
            <span class="text-2xl mb-2">🌿</span>
            <span class="text-xs font-semibold text-white">Olive Grove Silhouette</span>
            <span class="text-[11px] text-[#8DAEAA] mt-1">Gentle breeze, atmospheric mist, elegant Tamil typography overlay.</span>
          </div>
        </div>
      </div>
    </div>
  `
})
export class CreativeComponent {}
