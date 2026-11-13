import React from 'react';

interface StatCardProps {
  label: string;
  value: string;
  subtext?: string;
  trend?: 'positive' | 'negative' | 'neutral' | 'warning';
  icon?: React.ReactNode;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtext,
  trend = 'neutral',
  icon,
}) => {
  const getSubtextColor = () => {
    switch (trend) {
      case 'positive':
        return 'text-[#1F806F]';
      case 'warning':
        return 'text-[#C38754]';
      case 'negative':
        return 'text-[#BF5963]';
      default:
        return 'text-[#69788B]';
    }
  };

  return (
    <div className="bg-white p-5 rounded-lg border border-[#E2E8F0] shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between text-[#69788B] mb-2.5">
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
        {icon && <span className="text-[#69788B]">{icon}</span>}
      </div>
      <div>
        <div className="text-[26px] font-semibold tracking-normal text-[#182539] tabular-nums leading-tight">
          {value}
        </div>
        {subtext && (
          <div className={`text-xs mt-1.5 font-medium ${getSubtextColor()}`}>
            {subtext}
          </div>
        )}
      </div>
    </div>
  );
};
