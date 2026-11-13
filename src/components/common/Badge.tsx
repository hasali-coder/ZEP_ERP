import React from 'react';

export type BadgeVariant =
  | 'paid'
  | 'partially_paid'
  | 'overdue'
  | 'sent'
  | 'draft'
  | 'cancelled'
  | 'accepted'
  | 'declined'
  | 'converted'
  | 'neutral';

interface BadgeProps {
  status: string;
  variant?: BadgeVariant;
  className?: string;
}

export const StatusBadge: React.FC<BadgeProps> = ({ status, variant, className = '' }) => {
  const norm = (variant || status || 'neutral').toLowerCase().replace(/\s+/g, '_');

  let style = 'bg-[#F1F5F9] text-[#69788B] border-[#E2E8F0]';
  let label = status;

  switch (norm) {
    case 'paid':
      style = 'bg-[#EFF8F6] text-[#1F806F] border-[#CDEAE3]';
      label = 'Paid';
      break;
    case 'partially_paid':
      style = 'bg-[#FDF7F2] text-[#C38754] border-[#F4DEC9]';
      label = 'Partially Paid';
      break;
    case 'overdue':
      style = 'bg-[#FDF2F3] text-[#BF5963] border-[#F7D3D7]';
      label = 'Overdue';
      break;
    case 'sent':
      style = 'bg-[#F0F5FA] text-[#244A73] border-[#D1E0F0]';
      label = 'Sent';
      break;
    case 'draft':
      style = 'bg-[#F8FAFC] text-[#69788B] border-[#E2E8F0]';
      label = 'Draft';
      break;
    case 'cancelled':
      style = 'bg-[#F1F5F9] text-[#69788B] border-[#E2E8F0]';
      label = 'Cancelled';
      break;
    case 'accepted':
      style = 'bg-[#EFF8F6] text-[#1F806F] border-[#CDEAE3]';
      label = 'Accepted';
      break;
    case 'declined':
      style = 'bg-[#FDF2F3] text-[#BF5963] border-[#F7D3D7]';
      label = 'Declined';
      break;
    case 'converted':
      style = 'bg-[#F0F5FA] text-[#244A73] border-[#D1E0F0]';
      label = 'Converted to Invoice';
      break;
    default:
      label = status;
      break;
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${style} ${className} whitespace-nowrap`}
    >
      {label}
    </span>
  );
};
