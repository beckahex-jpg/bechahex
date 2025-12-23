import { LucideIcon } from 'lucide-react';

interface QuickStatsCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  gradient: string;
  iconColor: string;
  trend?: {
    value: string;
    positive: boolean;
  };
}

export default function QuickStatsCard({
  icon: Icon,
  label,
  value,
  gradient,
  iconColor,
  trend
}: QuickStatsCardProps) {
  return (
    <div className={`relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br ${gradient} p-3 sm:p-4 lg:p-6 shadow-lg transition-all duration-300 hover:shadow-xl lg:hover:-translate-y-1 active:scale-95 lg:active:scale-100`}>
      <div className="absolute top-0 right-0 -mt-4 -mr-4 h-16 w-16 sm:h-20 sm:w-20 lg:h-24 lg:w-24 rounded-full bg-white/10 blur-2xl" />
      <div className="relative">
        <div className={`inline-flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 lg:w-12 lg:h-12 rounded-lg sm:rounded-xl bg-white/20 backdrop-blur-sm mb-2 sm:mb-3 lg:mb-4`}>
          <Icon size={18} className={`${iconColor} sm:w-5 sm:h-5 lg:w-6 lg:h-6`} />
        </div>
        <div className="space-y-0.5 sm:space-y-1">
          <p className="text-[11px] sm:text-xs lg:text-sm font-medium text-white/80 leading-tight">{label}</p>
          <div className="flex items-baseline gap-1 sm:gap-2">
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-white leading-none">{value}</p>
            {trend && (
              <span className={`text-[10px] sm:text-xs font-medium ${trend.positive ? 'text-green-200' : 'text-red-200'}`}>
                {trend.positive ? '↑' : '↓'} {trend.value}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
