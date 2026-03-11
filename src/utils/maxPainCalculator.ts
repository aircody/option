import type { OIData, MaxPainData } from '../types';
import { CONTRACT_MULTIPLIER } from './constants';

export function calculateCallLoss(
  currentStrike: number,
  optionStrike: number,
  callOI: number
): number {
  return Math.max(currentStrike - optionStrike, 0) * CONTRACT_MULTIPLIER * callOI;
}

export function calculatePutLoss(
  currentStrike: number,
  optionStrike: number,
  putOI: number
): number {
  return Math.max(optionStrike - currentStrike, 0) * CONTRACT_MULTIPLIER * putOI;
}

export function calculateTotalPain(
  currentStrike: number,
  oiData: OIData[]
): number {
  let totalPain = 0;
  for (const data of oiData) {
    totalPain += calculateCallLoss(currentStrike, data.strike, data.callOI);
    totalPain += calculatePutLoss(currentStrike, data.strike, data.putOI);
  }
  return totalPain;
}

export function calculateMaxPain(oiData: OIData[]): {
  maxPain: number;
  maxPainCurve: MaxPainData[];
} {
  if (!oiData || oiData.length === 0) {
    return { maxPain: 0, maxPainCurve: [] };
  }

  const maxPainCurve: MaxPainData[] = [];
  let minPain = Infinity;
  let maxPainStrike = 0;

  for (const data of oiData) {
    const strike = data.strike;
    const totalPain = calculateTotalPain(strike, oiData);

    maxPainCurve.push({ strike, totalPain });

    if (totalPain < minPain) {
      minPain = totalPain;
      maxPainStrike = strike;
    }
  }

  return { maxPain: maxPainStrike, maxPainCurve };
}

/**
 * 从 LongPort API 返回的原始数据转换为 OI 数据格式
 * @param apiData LongPort API 返回的期权数据
 * @returns 转换后的 OIData 数组
 */
interface ApiDataItem {
  strike_price?: number;
  strike?: number;
  open_interest?: number;
  oi?: number;
  direction?: string;
}

export function convertApiDataToOIData(apiData: ApiDataItem[]): OIData[] {
  if (!apiData || !Array.isArray(apiData)) {
    return [];
  }

  // 按行权价分组，合并 Call 和 Put 的 OI
  const strikeMap = new Map<number, { callOI: number; putOI: number }>();

  for (const item of apiData) {
    const strike = parseFloat(item.strike_price || item.strike || 0);
    const oi = parseInt(item.open_interest || item.oi || 0, 10);
    const direction = item.direction || '';

    if (!strikeMap.has(strike)) {
      strikeMap.set(strike, { callOI: 0, putOI: 0 });
    }

    const data = strikeMap.get(strike)!;
    if (direction === 'C' || direction === 'Call') {
      data.callOI += oi;
    } else if (direction === 'P' || direction === 'Put') {
      data.putOI += oi;
    }
  }

  // 转换为数组并排序
  const result: OIData[] = [];
  strikeMap.forEach((data, strike) => {
    result.push({
      strike,
      callOI: data.callOI,
      putOI: data.putOI,
    });
  });

  return result.sort((a, b) => a.strike - b.strike);
}

/**
 * 格式化金额显示
 * @param value 金额
 * @returns 格式化后的字符串
 */
export function formatDollarAmount(value: number): string {
  if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`;
  }
  if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(2)}M`;
  }
  if (value >= 1e3) {
    return `$${(value / 1e3).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
}

/**
 * 获取 Max Pain 距离现价的百分比
 * @param maxPain Max Pain 价格
 * @param currentPrice 当前价格
 * @returns 百分比
 */
export function getMaxPainDistancePercent(maxPain: number, currentPrice: number): number {
  if (!currentPrice || !maxPain) return 0;
  return ((currentPrice - maxPain) / maxPain) * 100;
}

/**
 * 获取 Max Pain 状态标签
 * @param maxPain Max Pain 价格
 * @param currentPrice 当前价格
 * @returns 状态标签
 */
export function getMaxPainStatusLabel(maxPain: number, currentPrice: number): string {
  const distance = getMaxPainDistancePercent(maxPain, currentPrice);
  const absDistance = Math.abs(distance);
  
  if (absDistance <= 1) {
    return '平';
  } else if (absDistance <= 3) {
    return distance > 0 ? '略高' : '略低';
  } else {
    return distance > 0 ? '高' : '低';
  }
}

/**
 * 获取 Max Pain 状态颜色
 * @param maxPain Max Pain 价格
 * @param currentPrice 当前价格
 * @returns 颜色代码
 */
export function getMaxPainStatusColor(maxPain: number, currentPrice: number): string {
  const distance = getMaxPainDistancePercent(maxPain, currentPrice);
  const absDistance = Math.abs(distance);
  
  if (absDistance <= 1) {
    return '#1890ff'; // 蓝色 - 平
  } else if (absDistance <= 3) {
    return '#faad14'; // 橙色 - 略高/略低
  } else {
    return '#ff4d4f'; // 红色 - 高/低
  }
}

/**
 * 计算示例（用于测试和文档）
 */
export function getCalculationExample(): string {
  return `
Max Pain 计算示例：

假设有以下期权数据：
| 行权价 | Call OI | Put OI |
|--------|---------|--------|
| $215   | 1000    | 500    |
| $220   | 800     | 800    |
| $225   | 500     | 1200   |

计算 S = $220 时的 Total Pain：

Call 损失：
- @ $215: (220-215) × 100 × 1000 = $500,000
- @ $220: max(220-220,0) × 100 × 800 = $0
- @ $225: max(220-225,0) × 100 × 500 = $0

Put 损失：
- @ $215: max(215-220,0) × 100 × 500 = $0
- @ $220: max(220-220,0) × 100 × 800 = $0
- @ $225: (225-220) × 100 × 1200 = $600,000

Total Pain($220) = $500,000 + $600,000 = $1,100,000

遍历所有行权价后，Total Pain 最小的那个即为 Max Pain。
  `.trim();
}
