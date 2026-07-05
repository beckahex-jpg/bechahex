import { useEffect, useMemo, useState } from 'react';

interface AuctionCountdownProps {
  startsAt: string;
  endsAt: string;
  status: string;
  compact?: boolean;
  palette?: 'default' | 'brand';
}

function splitDuration(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

export default function AuctionCountdown({ startsAt, endsAt, status, compact = false, palette = 'default' }: AuctionCountdownProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const start = useMemo(() => new Date(startsAt).getTime(), [startsAt]);
  const end = useMemo(() => new Date(endsAt).getTime(), [endsAt]);
  const waiting = now < start;
  const finished = now >= end || !['active', 'scheduled'].includes(status);
  const parts = splitDuration((waiting ? start : end) - now);

  if (finished) {
    return <span className="font-semibold text-gray-500">Auction ended</span>;
  }

  const label = waiting ? 'Starts in' : 'Ends in';
  if (compact) {
    return (
      <span className={palette === 'brand' ? 'font-bold text-[#07513B]' : waiting ? 'font-semibold text-blue-700' : 'font-semibold text-red-700'}>
        {label}: {parts.days > 0 ? `${parts.days}d ` : ''}
        {String(parts.hours).padStart(2, '0')}:{String(parts.minutes).padStart(2, '0')}:{String(parts.seconds).padStart(2, '0')}
      </span>
    );
  }

  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <div className="grid grid-cols-4 gap-2">
        {[
          ['Days', parts.days],
          ['Hours', parts.hours],
          ['Minutes', parts.minutes],
          ['Seconds', parts.seconds],
        ].map(([unit, value]) => (
          <div key={String(unit)} className="rounded-xl border border-emerald-100 bg-emerald-50 px-1 py-2 text-center">
            <div className="text-lg font-bold tabular-nums text-emerald-700">{String(value).padStart(2, '0')}</div>
            <div className="text-[9px] font-semibold uppercase text-gray-500 sm:text-[10px]">{unit}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
