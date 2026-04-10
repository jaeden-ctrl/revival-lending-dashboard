export type Preset = "today" | "yesterday" | "week" | "7days" | "month";

const TZ = "America/Los_Angeles";

export interface DateRange { from: string; to: string; label: string }

function pacificMidnightISO(dateStr: string): string {
  const noonUTC = new Date(`${dateStr}T12:00:00Z`);
  const noonHour = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ, hour: "numeric", hour12: false, hourCycle: "h23",
    }).format(noonUTC)
  );
  const offsetHours = noonHour - 12;
  return `${dateStr}T${String(-offsetHours).padStart(2, "0")}:00:00.000Z`;
}

export function getRange(preset: Preset): DateRange {
  const now = new Date();
  const todayStr = now.toLocaleDateString("en-CA", { timeZone: TZ });

  switch (preset) {
    case "today":
      return { from: pacificMidnightISO(todayStr), to: now.toISOString(), label: "Today" };

    case "yesterday": {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      const yStr = d.toLocaleDateString("en-CA", { timeZone: TZ });
      return { from: pacificMidnightISO(yStr), to: pacificMidnightISO(todayStr), label: "Yesterday" };
    }

    case "week": {
      const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const dow = weekdays.indexOf(
        new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" }).format(now)
      );
      const daysBack = dow === 0 ? 6 : dow - 1;
      const monday = new Date(now);
      monday.setDate(monday.getDate() - daysBack);
      const wStr = monday.toLocaleDateString("en-CA", { timeZone: TZ });
      return { from: pacificMidnightISO(wStr), to: now.toISOString(), label: "This Week" };
    }

    case "7days": {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      const wStr = d.toLocaleDateString("en-CA", { timeZone: TZ });
      return { from: pacificMidnightISO(wStr), to: now.toISOString(), label: "Last 7 Days" };
    }

    case "month": {
      const monthStart = `${todayStr.slice(0, 8)}01`;
      return { from: pacificMidnightISO(monthStart), to: now.toISOString(), label: "This Month" };
    }
  }
}

export const PRESETS: { key: Preset; label: string }[] = [
  { key: "today",     label: "Today"      },
  { key: "yesterday", label: "Yesterday"  },
  { key: "week",      label: "This Week"  },
  { key: "7days",     label: "7 Days"     },
  { key: "month",     label: "Month"      },
];
