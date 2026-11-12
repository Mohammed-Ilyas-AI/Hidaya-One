import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'overview',
    pathMatch: 'full',
  },
  {
    path: 'overview',
    loadComponent: () => import('./pages/overview/overview.component').then(m => m.OverviewComponent),
  },
  {
    path: 'research',
    loadComponent: () => import('./pages/research/research.component').then(m => m.ResearchComponent),
  },
  {
    path: 'verification',
    loadComponent: () => import('./pages/verification/verification.component').then(m => m.VerificationComponent),
  },
  {
    path: 'script',
    loadComponent: () => import('./pages/script/script.component').then(m => m.ScriptComponent),
  },
  {
    path: 'creative',
    loadComponent: () => import('./pages/creative/creative.component').then(m => m.CreativeComponent),
  },
  {
    path: 'production',
    loadComponent: () => import('./pages/production/production.component').then(m => m.ProductionComponent),
  },
  {
    path: 'qc',
    loadComponent: () => import('./pages/qc/qc.component').then(m => m.QcComponent),
  },
  {
    path: 'publishing',
    loadComponent: () => import('./pages/publishing/publishing.component').then(m => m.PublishingComponent),
  },
  {
    path: 'analytics',
    loadComponent: () => import('./pages/analytics/analytics.component').then(m => m.AnalyticsComponent),
  },
  {
    path: 'settings',
    loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent),
  },
  {
    path: '**',
    redirectTo: 'overview',
  },
];
