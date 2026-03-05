/**
 * Max Pain (最大痛点) 计算工具
 * 
 * 计算逻辑：
 * 对于每个候选行权价 K，假设到期时标的资产价格为 S = K：
 * 
 * Call Loss(K) = max(S - K, 0) × 合约乘数 × Call OI(K)
 * Put Loss(K) = max(K - S, 0) × 合约乘数 × Put OI(K)
 * 
 * Total Pain(K) = Σ Call Loss(K) + Σ Put Loss(K)
 * 
 * Max Pain = 使 Total Pain(K) 最小的那个 K
 */

import type { OIData, MaxPainData } from '../types';

// 美股期权合约乘数：100股/合约
const CONTRACT_MULTIPLIER = 100;

/**
 * 计算单个行权价下的 Call 损失
 * @param currentStrike 当前测试的行权价 S
 * @param optionStrike 期权的行权价 K
 * @param callOI Call 未平仓合约数
 * @returns Call 损失金额
 */
export function calculateCallLoss(
  currentStrike: number,
  optionStrike: number,
  callOI: number
): number {
  // Call Loss = max(S - K, 0) × 合约乘数 × Call OI
  const loss = Math.max(currentStrike - optionStrike, 0) * CONTRACT_MULTIPLIER * callOI;
  return loss;
}

/**
 * 计算单个行权价下的 Put 损失
 * @param currentStrike 当前测试的行权价 S
 * @param optionStrike 期权的行权价 K
 * @param putOI Put 未平仓合约数
 * @returns Put 损失金额
 */
export function calculatePutLoss(
  currentStrike: number,
  optionStrike: number,
  putOI: number
): number {
  // Put Loss = max(K - S, 0) × 合约乘数 × Put OI
  const loss = Math.max(optionStrike - currentStrike, 0) * CONTRACT_MULTIPLIER * putOI;
  return loss;
}

/**
 * 计算特定行权价下的总损失（Total Pain）
 * @param currentStrike 当前测试的行权价 S
 * @param oiData 所有行权价的持仓数据
 * @returns 总损失金额
 */
export function calculateTotalPain(
  currentStrike: number,
  oiData: OIData[]
): number {
  let totalPain = 0;

  // 遍历所有行权价，计算在当前 S 下的损失
  for (const data of oiData) {
    // 计算该行的 Call 损失（如果当前 S > 该行权价）
    totalPain += calculateCallLoss(currentStrike, data.strike, data.callOI);
    
    // 计算该行的 Put 损失（如果当前 S < 该行权价）
    totalPain += calculatePutLoss(currentStrike, data.strike, data.putOI);
  }

  return totalPain;
}

/**
 * 计算 Max Pain 和最大痛点曲线数据
 * @param oiData 持仓数据
 * @returns Max Pain 价格和曲线数据
 */
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

  // 遍历每个行权价作为候选的 S
  for (const data of oiData) {
    const strike = data.strike;
    const totalPain = calculateTotalPain(strike, oiData);

    maxPainCurve.push({
      strike,
      totalPain,
    });

    // 找到 Total Pain 最小的行权价
    if (totalPain < minPain) {
      minPain = totalPain;
      maxPainStrike = strike;
    }
  }

  return {
    maxPain: maxPainStrike,
    maxPainCurve,
  };
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
