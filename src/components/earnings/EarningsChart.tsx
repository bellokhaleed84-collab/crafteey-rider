"use client";

import { formatChartDate, formatNaira } from "@/lib/format";

interface DailyPoint {
  date: string; // "YYYY-MM-DD"
  hubEarningKobo: number;
  directRideCashKobo: number;
}

const CHART_HEIGHT = 120;

export default function EarningsChart({ data }: { data: DailyPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-xs text-steel">
        No earnings recorded for this period yet.
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.hubEarningKobo + d.directRideCashKobo), 1);
  const barWidth = data.length > 14 ? 22 : data.length > 7 ? 32 : 44;

  return (
    <div>
      <div className="flex items-center gap-4 text-[11px] text-steel">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Hub earnings
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> Direct-ride cash
        </span>
      </div>

      <div className="mt-3 flex items-end gap-2 overflow-x-auto pb-2">
        {data.map((d) => {
          const total = d.hubEarningKobo + d.directRideCashKobo;
          const hubHeight = d.hubEarningKobo > 0 ? Math.max((d.hubEarningKobo / max) * CHART_HEIGHT, 3) : 0;
          const directHeight =
            d.directRideCashKobo > 0 ? Math.max((d.directRideCashKobo / max) * CHART_HEIGHT, 3) : 0;

          return (
            <div key={d.date} className="flex shrink-0 flex-col items-center" style={{ width: barWidth }}>
              <div
                className="flex w-full flex-col justify-end"
                style={{ height: CHART_HEIGHT }}
                title={`${formatChartDate(d.date)} — Hub: ${formatNaira(d.hubEarningKobo)}, Direct: ${formatNaira(
                  d.directRideCashKobo
                )}`}
              >
                {directHeight > 0 && <div className="w-full bg-amber-400" style={{ height: directHeight }} />}
                {hubHeight > 0 && (
                  <div
                    className={`w-full bg-emerald-500 ${directHeight === 0 ? "rounded-t-sm" : ""}`}
                    style={{ height: hubHeight }}
                  />
                )}
              </div>
              <p className="mt-1.5 whitespace-nowrap text-[10px] text-steel">{formatChartDate(d.date)}</p>
              {total === 0 && <span className="text-[9px] text-slate-300">—</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}