import { Check, X } from 'lucide-react';

interface PasswordStrengthMeterProps {
  password: string;
}

export default function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const checks = {
    length: password.length >= 8,
    lowercase: /[a-z]/.test(password),
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  };

  const passedChecks = Object.values(checks).filter(Boolean).length;

  let strength = 0;
  let strengthLabel = '';
  let strengthColor = '';
  let barColor = '';

  if (passedChecks === 0) {
    strength = 0;
    strengthLabel = '';
    strengthColor = '';
  } else if (passedChecks <= 2) {
    strength = 25;
    strengthLabel = 'Weak';
    strengthColor = 'text-red-600';
    barColor = 'bg-red-500';
  } else if (passedChecks === 3) {
    strength = 50;
    strengthLabel = 'Fair';
    strengthColor = 'text-orange-600';
    barColor = 'bg-orange-500';
  } else if (passedChecks === 4) {
    strength = 75;
    strengthLabel = 'Good';
    strengthColor = 'text-yellow-600';
    barColor = 'bg-yellow-500';
  } else {
    strength = 100;
    strengthLabel = 'Strong';
    strengthColor = 'text-green-600';
    barColor = 'bg-green-500';
  }

  const requirements = [
    { label: 'At least 8 characters', met: checks.length },
    { label: 'Contains lowercase letter', met: checks.lowercase },
    { label: 'Contains uppercase letter', met: checks.uppercase },
    { label: 'Contains number', met: checks.number },
    { label: 'Contains special character', met: checks.special },
  ];

  if (!password) return null;

  return (
    <div className="space-y-3 mt-3">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Password Strength</span>
          {strengthLabel && (
            <span className={`text-sm font-bold ${strengthColor}`}>{strengthLabel}</span>
          )}
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${barColor} transition-all duration-300 ease-out`}
            style={{ width: `${strength}%` }}
          ></div>
        </div>
      </div>

      <div className="space-y-1.5">
        {requirements.map((req, index) => (
          <div
            key={index}
            className={`flex items-center gap-2 text-xs transition-colors duration-200 ${
              req.met ? 'text-green-700' : 'text-gray-500'
            }`}
          >
            {req.met ? (
              <Check className="w-3.5 h-3.5 text-green-600" />
            ) : (
              <X className="w-3.5 h-3.5 text-gray-400" />
            )}
            <span>{req.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
