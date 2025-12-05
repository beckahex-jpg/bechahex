import { Package, Clock, CheckCircle, XCircle, Truck } from 'lucide-react';

interface OrderStatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function OrderStatusBadge({ status, size = 'md' }: OrderStatusBadgeProps) {
  const getStatusConfig = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return {
          icon: Clock,
          label: 'Pending',
          bgColor: 'bg-gradient-to-r from-yellow-50 to-amber-50',
          textColor: 'text-yellow-700',
          borderColor: 'border-yellow-200',
          iconColor: 'text-yellow-500'
        };
      case 'processing':
        return {
          icon: Package,
          label: 'Processing',
          bgColor: 'bg-gradient-to-r from-blue-50 to-indigo-50',
          textColor: 'text-blue-700',
          borderColor: 'border-blue-200',
          iconColor: 'text-blue-500'
        };
      case 'shipped':
        return {
          icon: Truck,
          label: 'Shipped',
          bgColor: 'bg-gradient-to-r from-purple-50 to-pink-50',
          textColor: 'text-purple-700',
          borderColor: 'border-purple-200',
          iconColor: 'text-purple-500'
        };
      case 'delivered':
        return {
          icon: CheckCircle,
          label: 'Delivered',
          bgColor: 'bg-gradient-to-r from-green-50 to-emerald-50',
          textColor: 'text-green-700',
          borderColor: 'border-green-200',
          iconColor: 'text-green-500'
        };
      case 'cancelled':
        return {
          icon: XCircle,
          label: 'Cancelled',
          bgColor: 'bg-gradient-to-r from-red-50 to-rose-50',
          textColor: 'text-red-700',
          borderColor: 'border-red-200',
          iconColor: 'text-red-500'
        };
      default:
        return {
          icon: Package,
          label: status,
          bgColor: 'bg-gradient-to-r from-gray-50 to-slate-50',
          textColor: 'text-gray-700',
          borderColor: 'border-gray-200',
          iconColor: 'text-gray-500'
        };
    }
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2'
  };

  const iconSizes = {
    sm: 12,
    md: 16,
    lg: 18
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${config.bgColor} ${config.textColor} ${config.borderColor} ${sizeClasses[size]} font-medium transition-all duration-200 hover:shadow-sm`}
    >
      <Icon size={iconSizes[size]} className={config.iconColor} />
      {config.label}
    </span>
  );
}
