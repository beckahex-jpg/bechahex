import { CheckCircle, AlertCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';

interface NotificationMessageProps {
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  onClose: () => void;
  autoClose?: boolean;
  duration?: number;
}

export default function NotificationMessage({
  type,
  message,
  onClose,
  autoClose = true,
  duration = 5000,
}: NotificationMessageProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 10);

    if (autoClose) {
      const timer = setTimeout(() => {
        handleClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [autoClose, duration]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const styles = {
    success: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      text: 'text-green-800',
      icon: 'text-green-600',
      IconComponent: CheckCircle,
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-800',
      icon: 'text-red-600',
      IconComponent: AlertCircle,
    },
    warning: {
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      text: 'text-orange-800',
      icon: 'text-orange-600',
      IconComponent: AlertCircle,
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      text: 'text-blue-800',
      icon: 'text-blue-600',
      IconComponent: AlertCircle,
    },
  };

  const style = styles[type];
  const Icon = style.IconComponent;

  return (
    <div
      className={`
        ${style.bg} ${style.border} ${style.text}
        border rounded-xl p-4 mb-6 flex items-start gap-3 shadow-sm
        transition-all duration-300 ease-out
        ${isVisible && !isLeaving ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}
      `}
    >
      <Icon className={`w-5 h-5 ${style.icon} flex-shrink-0 mt-0.5`} />
      <p className="flex-1 font-medium text-sm leading-relaxed">{message}</p>
      <button
        onClick={handleClose}
        className={`${style.icon} hover:opacity-70 transition flex-shrink-0`}
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}
