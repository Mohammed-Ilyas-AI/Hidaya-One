import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="flex h-screen overflow-hidden bg-[#051111] text-[#E0EBE8]">
      <!-- Sidebar -->
      <aside class="w-64 flex-shrink-0 bg-[#071917] border-r border-[#16403b] flex flex-col justify-between">
        <div>
          <!-- Brand Header -->
          <div class="p-6 border-b border-[#16403b] flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00A878] via-[#00D09C] to-[#D4AF37] p-0.5 flex items-center justify-center shadow-lg shadow-[#00A878]/10">
              <div class="w-full h-full bg-[#071917] rounded-[10px] flex items-center justify-center">
                <span class="font-arabic text-xl font-bold text-[#F3E5AB]">هـ</span>
              </div>
            </div>
            <div>
              <div class="font-extrabold text-base tracking-wider text-white">HIDAYA ONE</div>
              <div class="text-[10px] tracking-widest uppercase text-[#00D09C] font-semibold">Shorts Engine</div>
            </div>
          </div>

          <!-- Navigation Links -->
          <nav class="p-3 space-y-1">
            <a *ngFor="let link of navLinks"
               [routerLink]="link.path"
               routerLinkActive="bg-[#00A878]/15 text-[#00D09C] border-l-2 border-[#00D09C]"
               class="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold text-[#8DAEAA] hover:text-white hover:bg-[#0d2825] transition-all">
              <span class="text-base">{{ link.icon }}</span>
              <span>{{ link.label }}</span>
            </a>
          </nav>
        </div>

        <!-- Infrastructure Telemetry Footer -->
        <div class="p-4 border-t border-[#16403b] bg-[#051412]">
          <div class="flex items-center justify-between text-[11px] text-[#8DAEAA]">
            <span>Cloud Run Service</span>
            <span class="flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-[#00D09C] animate-pulse"></span>
              <span class="font-mono text-white">asia-south1</span>
            </span>
          </div>
          <div class="text-[10px] font-mono text-[#8DAEAA]/80 mt-1 truncate">
            even-boulder-514217-d5
          </div>
        </div>
      </aside>

      <!-- Main Content Area -->
      <main class="flex-1 overflow-y-auto">
        <div class="max-w-7xl mx-auto p-6 md:p-8">
          <router-outlet></router-outlet>
        </div>
      </main>
    </div>
  `
})
export class AppComponent {
  navLinks = [
    { path: '/overview', label: 'Command Overview', icon: '📊' },
    { path: '/research', label: 'Islamic Research', icon: '🔍' },
    { path: '/verification', label: 'Verification Gate', icon: '🛡️' },
    { path: '/script', label: 'Tamil Script Studio', icon: '✍️' },
    { path: '/creative', label: 'Creative Studio', icon: '🎨' },
    { path: '/production', label: 'Video Production', icon: '🎬' },
    { path: '/qc', label: 'Quality Control', icon: '✅' },
    { path: '/publishing', label: 'Publishing Operations', icon: '🚀' },
    { path: '/analytics', label: 'Analytics & History', icon: '📈' },
    { path: '/settings', label: 'Settings & Cloud', icon: '⚙️' },
  ];
}
