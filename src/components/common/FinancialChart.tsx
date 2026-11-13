import React, { useState } from 'react';
import { formatMoney } from '../../utils/money';
import { CurrencyCode } from '../../types';

interface ChartDataPoint {
  label: string; // e.g. "Jun", "Jul", "Aug", "Sep", "Oct"
  inflowCents: number;
  outflowCents: number;
}

interface FinancialChartProps {
  data: ChartDataPoint[];
  currency: CurrencyCode;
}

export const FinancialChart: React.FC<FinancialChartProps> = ({ data, currency }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-[#69788B] border border-[#E2E8F0] rounded-lg bg-white">
        No transaction trend data available for this range
      </div>
    );
  }

  const maxVal = Math.max(
    ...data.map((d) => Math.max(d.inflowCents, d.outflowCents)),
    100000 // At least 1,000.00
  );

  const height = 200;
  const paddingBottom = 28;
  const paddingTop = 20;
  const chartHeight = height - paddingBottom - paddingTop;

  return (
    <div className="bg-white p-5 rounded-lg border border-[#E2E8F0] shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#E2E8F0] gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[#182539]">Cash Inflow vs Outflow</h3>
          <p className="text-xs text-[#69788B] mt-0.5">Actual cash movements over recent operating periods</p>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium text-[#69788B]">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#244A73]" />
            <span>Cash Inflow</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-xs bg-[#C38754]" />
            <span>Cash Outflow</span>
          </div>
        </div>
      </div>

      {/* Chart container */}
      <div className="relative pt-6">
        {hoveredIndex !== null && data[hoveredIndex] && (
          <div
            className="absolute z-20 pointer-events-none bg-[#182539] text-white text-xs p-2.5 rounded shadow-lg -top-2 transform -translate-x-1/2 border border-white/10"
            style={{
              left: `${((hoveredIndex + 0.5) / data.length) * 100}%`,
            }}
          >
            <div className="font-semibold border-b border-white/20 pb-1 mb-1 text-center">
              {data[hoveredIndex].label}
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[#93B4D7]">Inflow:</span>
              <span className="tabular-nums font-medium">
                {formatMoney(data[hoveredIndex].inflowCents, currency)}
              </span>
            </div>
            <div className="flex justify-between gap-4 mt-0.5">
              <span className="text-[#E9C3A0]">Outflow:</span>
              <span className="tabular-nums font-medium">
                {formatMoney(data[hoveredIndex].outflowCents, currency)}
              </span>
            </div>
            <div className="flex justify-between gap-4 mt-1 pt-1 border-t border-white/20">
              <span className="text-white/80">Net:</span>
              <span className="tabular-nums font-semibold">
                {formatMoney(
                  data[hoveredIndex].inflowCents - data[hoveredIndex].outflowCents,
                  currency
                )}
              </span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-5 gap-2 sm:gap-4 h-48 items-end border-b border-[#E2E8F0] pb-2">
          {data.map((item, idx) => {
            const inflowHeight = (item.inflowCents / maxVal) * chartHeight;
            const outflowHeight = (item.outflowCents / maxVal) * chartHeight;

            return (
              <div
                key={idx}
                className="flex flex-col items-center h-full justify-end cursor-pointer group"
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <div className="w-full flex items-end justify-center gap-1 sm:gap-2 h-full">
                  {/* Inflow Bar */}
                  <div
                    className="w-1/2 max-w-[28px] bg-[#244A73] rounded-t-xs transition-all duration-200 group-hover:bg-[#1B3959]"
                    style={{ height: `${Math.max(4, inflowHeight)}px` }}
                  />
                  {/* Outflow Bar */}
                  <div
                    className="w-1/2 max-w-[28px] bg-[#C38754] rounded-t-xs transition-all duration-200 group-hover:bg-[#A86F3E]"
                    style={{ height: `${Math.max(4, outflowHeight)}px` }}
                  />
                </div>
                <span className="text-xs font-medium text-[#69788B] mt-2 group-hover:text-[#182539] transition-colors">
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
