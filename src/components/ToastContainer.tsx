import { useEffect, useState } from 'react';
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { useToast, Toast } from '../contexts/ToastContext';

function ToastItem({ toast }: { toast: Toast }) {
  const { removeToast } = useToast();
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 10);

    if (toast.duration && toast.duration > 0) {
      const startTime = Date.now();
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, 100 - (elapsed / toast.duration) * 100);
        setProgress(remaining);

        if (remaining <= 0) {
          clearInterval(interval);
        }
      }, 50);

      return () => clearInterval(interval);
    }
  }, [toast.duration]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => {
      removeToast(toast.id);
    }, 300);
  };

  const styles = {
    success: {
      bg: 'bg-green-50',
      border: 'border-green-500',
      text: 'text-green-800',
      icon: 'text-green-600',
      progress: 'bg-green-500',
      IconComponent: CheckCircle,
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-500',
      text: 'text-red-800',
      icon: 'text-red-600',
      progress: 'bg-red-500',
      IconComponent: AlertCircle,
    },
    warning: {
      bg: 'bg-orange-50',
      border: 'border-orange-500',
      text: 'text-orange-800',
      icon: 'text-orange-600',
      progress: 'bg-orange-500',
      IconComponent: AlertTriangle,
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-500',
      text: 'text-blue-800',
      icon: 'text-blue-600',
      progress: 'bg-blue-500',
      IconComponent: Info,
    },
  };

  const style = styles[toast.type];
  const Icon = style.IconComponent;

  return (
    <div
      className={`
        relative overflow-hidden
        ${style.bg} ${style.text}
        border-l-4 ${style.border}
        rounded-lg shadow-lg
        p-4 mb-3
        flex items-start gap-3
        min-w-[320px] max-w-md
        transition-all duration-300 ease-out
        ${isVisible && !isLeaving ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full'}
      `}
    >
      <Icon className={`w-5 h-5 ${style.icon} flex-shrink-0 mt-0.5`} />
      <p className="flex-1 font-medium text-sm leading-relaxed pr-2">{toast.message}</p>
      <button
        onClick={handleClose}
        className={`${style.icon} hover:opacity-70 transition flex-shrink-0`}
        aria-label="Close notification"
      >
        <X className="w-5 h-5" />
      </button>
      {toast.duration && toast.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/5">
          <div
            className={`h-full ${style.progress} transition-all duration-100 ease-linear`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function ToastContainer() {
  const { toasts } = useToast();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div
      className="fixed top-4 right-4 z-[9999] pointer-events-none"
      style={{ maxHeight: 'calc(100vh - 2rem)' }}
    >
      <div className="pointer-events-auto overflow-y-auto max-h-full">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </div>
    </div>
  );
}
