export interface CallKpis {
  today: CallPeriodStats;
  week: CallPeriodStats;
  month: CallPeriodStats;
  hourlyVolume: HourlyVolume[];
  byRep: RepStats[];
  lastUpdated: string;
}

export interface CallPeriodStats {
  total: number;
  inbound: number;
  outbound: number;
  missed: number;
  avgDurationSec: number;
  answerRate: number; // 0–100
}

export interface HourlyVolume {
  hour: string; // "9 AM", "10 AM", etc.
  calls: number;
}

export interface RepStats {
  name: string;
  extension: string;
  total: number;
  inbound: number;
  outbound: number;
  missed: number;
  avgDurationSec: number;
}
