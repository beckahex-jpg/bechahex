import { LucideIcon } from 'lucide-react';

interface EmptyStateDisplayProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyStateDisplay({
  icon: Icon,
  title,
  description,
  action
}: EmptyStateDisplayProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-400/20 to-emerald-400/20 rounded-full blur-2xl" />
        <div className="relative bg-gradient-to-br from-teal-50 to-emerald-50 rounded-full p-6">
          <Icon size={48} className="text-teal-600" />
        </div>
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 text-center max-w-md mb-6">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-6 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-xl font-medium hover:from-teal-600 hover:to-emerald-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
