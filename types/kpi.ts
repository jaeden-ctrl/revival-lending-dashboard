// ─── Inbound Queue KPIs ──────────────────────────────────────────────────────

export interface InboundKpis {
  period: PeriodStats;
  byLO: LOInboundStats[];
  hourlyVolume: HourlyVolume[];  // calls aggregated by hour-of-day (7am–9pm)
  dailyVolume: HourlyVolume[];   // calls by calendar day
  lastUpdated: string;
}

export interface PeriodStats {
  answered: number;
  missed: number;
  total: number;
  avgTalkTimeSec: number;
}

export interface LOInboundStats {
  name: string;
  extensionId: string;
  answered: number;
  missed: number;
  avgTalkTimeSec: number;
  calls: CallDetail[];
}

export interface CallDetail {
  id: string;
  startTime: string;
  durationSec: number;
  result: string; // "Answered" | "Missed" | "Voicemail"
  queue: string;
  from: string;
  recordingId?: string;
}

// ─── Outbound KPIs ───────────────────────────────────────────────────────────

export interface OutboundKpis {
  period: OutboundPeriodStats;
  byLO: LOOutboundStats[];
  hourlyVolume: HourlyVolume[];
  lastUpdated: string;
}

export interface OutboundPeriodStats {
  total: number;
  avgTalkTimeSec: number;
}

export interface LOOutboundStats {
  name: string;
  extensionId: string;
  total: number;
  avgTalkTimeSec: number;
  calls: CallDetail[];
}

// ─── Shared ───────────────────────────────────────────────────────────────────

export interface HourlyVolume {
  hour: string;
  calls: number;
}

// ─── Legacy (kept for /api/ringcentral/calls route) ──────────────────────────

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
  answerRate: number;
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
