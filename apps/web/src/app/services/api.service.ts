import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface Integration {
  name: string;
  status: 'CONNECTED' | 'NOT_CONFIGURED' | 'DISABLED' | 'DEGRADED' | 'FAILED';
  reason: string;
}

export interface DashboardOverview {
  dailyTarget: number;
  activeJobs: string;
  pendingApprovals: string;
  integrationsSummary: {
    connected: number;
    total: number;
    details: Integration[];
  };
  note: string;
}

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private http = inject(HttpClient);
  private baseUrl = '/api/v1';

  // Signals for reactive state
  readonly integrations = signal<Integration[]>([]);
  readonly overview = signal<DashboardOverview | null>(null);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  loadIntegrations(): Observable<{ integrations: Integration[] }> {
    this.loading.set(true);
    return this.http.get<{ integrations: Integration[] }>(`${this.baseUrl}/integrations`).pipe(
      tap({
        next: (res) => {
          this.integrations.set(res.integrations);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err.message || 'Failed to load integrations');
          this.loading.set(false);
        },
      })
    );
  }

  loadOverview(): Observable<DashboardOverview> {
    this.loading.set(true);
    return this.http.get<DashboardOverview>(`${this.baseUrl}/dashboard/overview`).pipe(
      tap({
        next: (res) => {
          this.overview.set(res);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set(err.message || 'Failed to load overview');
          this.loading.set(false);
        },
      })
    );
  }

  startResearchRun(query: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/research/runs`, { query });
  }

  approveVideo(id: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/videos/${id}/approve`, {});
  }

  approvePublishing(id: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/publishing/${id}/approve`, {});
  }
}
