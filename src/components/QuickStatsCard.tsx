import { LucideIcon } from 'lucide-react';

interface QuickStatsCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  gradient?: string;
  iconColor?: string;
  variant?: 'gradient' | 'flat';
  trend?: {
    value: string;
    positive: boolean;
  };
}

export default function QuickStatsCard({
  icon: Icon,
  label,
  value,
  gradient = '',
  iconColor = '',
  variant = 'gradient',
  trend
}: QuickStatsCardProps) {
  if (variant === 'flat') {
    return (
      <div className="group h-full rounded-2xl border border-gray-200 bg-white p-4 text-left transition duration-200 hover:border-[#07513B]/30 hover:shadow-md sm:p-5">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F2FAE8] text-[#07513B] transition group-hover:bg-[#E4F7C9]">
          <Icon className="h-5 w-5" />
        </div>
        <p className="mt-4 text-sm font-semibold text-gray-600">{label}</p>
        <div className="mt-1 flex items-baseline gap-2">
          <p className="text-2xl font-black tracking-tight text-gray-950 sm:text-3xl">{value}</p>
          {trend && (
            <span className={`text-xs font-bold ${trend.positive ? 'text-[#07513B]' : 'text-red-600'}`}>
              {trend.positive ? 'â†‘' : 'â†“'} {trend.value}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br ${gradient} p-3 sm:p-4 lg:p-6 shadow-lg transition-all duration-300 hover:shadow-xl lg:hover:-translate-y-1 active:scale-95 lg:active:scale-100`}>
      <div className="absolute top-0 right-0 -mt-4 -mr-4 h-16 w-16 sm:h-20 sm:w-20 lg:h-24 lg:w-24 rounded-full bg-white/10 blur-2xl" />
      <div className="relative">
        <div className={`inline-flex items-center justify-center h-10 w-10 rounded-lg sm:rounded-xl bg-white/20 backdrop-blur-sm mb-2 sm:mb-3`}>
          <Icon size={20} className={iconColor} />
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
