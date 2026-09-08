export type HealthDbStatus = 'connected' | 'disconnected';
export type HealthOverallStatus = 'ok' | 'degraded';

export interface IHealthResponse {
  status: HealthOverallStatus;
  timestamp: string;
  mongodb: HealthDbStatus;
  uptime: number;
  bunVersion: string;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
}
