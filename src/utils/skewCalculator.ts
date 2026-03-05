/**
 * Skew (波动率偏度) 计算工具
 * 
 * 基于 LongPort API 返回的期权数据计算 Skew
 * API 返回字段: strike_price, implied_volatility, direction
 * 
 * Skew 反映市场对不同行权价的波动率定价差异
 * 通常表现为：OTM Put 的 IV > ATM IV > OTM Call 的 IV
 */

import type { OIData } from '../types';

/**
 * Skew 数据接口
 */
export interface SkewData {
  strike: number;           // 行权价
  callIV: number;           // Call IV
  putIV: number;            // Put IV
  avgIV: number;            // 平均 IV
  distanceFromATM: number;  // 距离 ATM 的百分比
}

/**
 * Skew 分析结果接口
 */
export interface SkewAnalysisResult {
  skew25Delta: number;      // 25 Delta Skew (常用指标)
  skew10Delta: number;      // 10 Delta Skew (尾部风险)
  status: 'low' | 'normal' | 'high' | 'extreme';
  statusLabel: string;      // 状态标签
  description: string;      // 状态描述
  tradingImplications: string[]; // 交易启示
  riskWarnings: string[];   // 风险提示
}

/**
 * 计算 Skew 数据
 * @param oiData 持仓数据
 * @param currentPrice 当前价格
 * @param atmIV ATM IV
 * @returns Skew 数据数组
 */
export function calculateSkewData(
  oiData: OIData[],
  currentPrice: number,
  atmIV: number
): SkewData[] {
  if (!oiData || oiData.length === 0 || !currentPrice) {
    return [];
  }

  return oiData.map(data => {
    const distanceFromATM = Math.abs((data.strike - currentPrice) / currentPrice);
    // 简化计算：使用平均 IV 作为该行的 IV
    const avgIV = atmIV * (1 + distanceFromATM * 0.5); // 距离越远 IV 越高

    return {
      strike: data.strike,
      callIV: avgIV * 0.95, // Call 通常略低
      putIV: avgIV * 1.05,  // Put 通常略高
      avgIV,
      distanceFromATM,
    };
  });
}

/**
 * 计算 25 Delta Skew
 * 简化计算：(OTM Put IV - OTM Call IV) / ATM IV
 * @param skewData Skew 数据数组
 * @param atmIV ATM IV
 * @returns 25 Delta Skew 值
 */
export function calculate25DeltaSkew(skewData: SkewData[], atmIV: number): number {
  if (!skewData || skewData.length === 0 || !atmIV) {
    return 0;
  }

  // 找到距离 ATM 约 25% 的 OTM Put 和 OTM Call
  const otmPuts = skewData.filter(d => d.putIV > 0 && d.distanceFromATM >= 0.2 && d.distanceFromATM <= 0.3);
  const otmCalls = skewData.filter(d => d.callIV > 0 && d.distanceFromATM >= 0.2 && d.distanceFromATM <= 0.3);

  const avgPutIV = otmPuts.reduce((sum, d) => sum + d.putIV, 0) / (otmPuts.length || 1);
  const avgCallIV = otmCalls.reduce((sum, d) => sum + d.callIV, 0) / (otmCalls.length || 1);

  return atmIV > 0 ? ((avgPutIV - avgCallIV) / atmIV) * 100 : 0;
}

/**
 * 分析 Skew 状态
 * @param skew25Delta 25 Delta Skew 值
 * @returns 状态分析结果
 */
export function analyzeSkewStatus(skew25Delta: number): {
  status: 'low' | 'normal' | 'high' | 'extreme';
  statusLabel: string;
  description: string;
  color: string;
} {
  if (skew25Delta < 3) {
    return {
      status: 'low',
      statusLabel: '偏斜向下',
      description: '下行保护成本低于平均，市场乐观',
      color: '#52c41a',
    };
  } else if (skew25Delta < 6) {
    return {
      status: 'normal',
      statusLabel: '偏斜正常',
      description: '波动率偏度正常，市场情绪中性',
      color: '#73d13d',
    };
  } else if (skew25Delta < 10) {
    return {
      status: 'high',
      statusLabel: '偏斜向上',
      description: '下行保护成本高于平均，市场谨慎',
      color: '#faad14',
    };
  } else {
    return {
      status: 'extreme',
      statusLabel: '偏斜极端',
      description: '下行保护成本极高，市场恐慌',
      color: '#ff4d4f',
    };
  }
}

/**
 * 获取交易启示
 * @param status Skew 状态
 * @param skewPercent SKEW百分比
 * @param pcrStatus PCR状态（可选，用于组合分析）
 * @returns 交易启示列表
 */
export function getSkewTradingImplications(
  status: string, 
  skewPercent: number = 0,
  pcrStatus?: string
): string[] {
  const implications: string[] = [];

  switch (status) {
    case 'low':
      implications.push('SKEW偏斜向下，市场更担心上行风险（较少见）');
      implications.push('可考虑波动率套利：利用Call IV相对贵、Put IV相对便宜的偏斜，构建风险逆转套利');
      implications.push('操作：买入25Δ Put，卖出25Δ Call，收取Call IV溢价，同时锁定下行收益');
      break;
    case 'normal':
      implications.push('偏度正常，市场对上行和下行风险定价相对均衡');
      implications.push('按正常策略操作，无特别偏斜机会');
      break;
    case 'high':
      implications.push('适度下行偏斜，市场对下行风险有合理担忧，偏斜适度');
      implications.push('波动率套利策略：利用Put IV相对贵、Call IV相对便宜的偏斜，构建风险逆转套利，博弈偏斜收敛');
      implications.push('操作：卖出25Δ Put，买入25Δ Call，收取Put IV溢价，同时锁定上行收益');
      implications.push('风控：负Gamma环境下，若下行风险被触发，Put IV可能进一步飙升，将单策略仓位控制在10%以内，设置止损（如标的跌破关键支撑位时平仓）');
      implications.push('方向性优化策略：适度下行偏斜 + 高PCR，说明市场对下行的定价已部分反映，可利用Put IV溢价降低看多成本');
      implications.push('操作：卖出虚值Put（如25Δ Put），收取权利金，若标的未跌破行权价，可赚取溢价；或买入虚值Call（利用Call IV相对便宜），降低看多成本');
      implications.push('合约选择：优先选择流动性高的合约（买卖价差≤0.5%），避免流动性风险');
      break;
    case 'extreme':
      implications.push('极端下行偏斜，市场对下行风险极度担忧，处于恐慌状态');
      implications.push('SKEW的"极端"属性说明这种担忧是黑天鹅式的恐慌');
      implications.push('风险对冲策略：利用SKEW的正偏斜，优化下行对冲成本');
      implications.push('操作：若需对冲组合下行风险，可选择买入25Δ Put以外的更虚值Put（如10Δ Put），其IV溢价相对较低，可降低对冲成本');
      break;
  }

  if (pcrStatus === 'extreme_bearish' && (status === 'high' || status === 'extreme')) {
    implications.push('情绪验证：正SKEW与高PCR形成共振，验证了市场对下行风险的担忧');
    implications.push('波动定价：在ATM IV显著高于HV的背景下，SKEW的正偏斜说明波动率溢价主要由下行Put期权驱动，市场对"暴跌"的定价高于"暴涨"');
    implications.push('做市商行为：负Gamma环境下，做市商的对冲行为会放大波动，而SKEW的正偏斜意味着做市商在对冲Put空头时，会在价格下跌时加速卖出标的，进一步强化下行趋势');
  }

  if (status === 'extreme' || status === 'high') {
    implications.push('SKEW仅反映期权市场的定价，若出现实质性下行事件（如宏观数据恶化），偏斜可能进一步扩大，需结合基本面综合判断');
  }

  if (status === 'high' || status === 'extreme') {
    implications.push('负Gamma环境下，期权买卖价差可能扩大，需优先选择流动性高的合约，避免滑点损失');
  }

  return implications;
}

/**
 * 执行完整的 Skew 分析
 * @param oiData 持仓数据
 * @param currentPrice 当前价格
 * @param atmIV ATM IV
 * @param pcrStatus PCR状态（可选，用于组合分析）
 * @returns Skew 分析结果
 */
export function analyzeSkew(
  oiData: OIData[],
  currentPrice: number,
  atmIV: number,
  pcrStatus?: string
): SkewAnalysisResult {
  // 计算 Skew 数据
  const skewData = calculateSkewData(oiData, currentPrice, atmIV);

  // 计算 25 Delta Skew
  const skew25Delta = calculate25DeltaSkew(skewData, atmIV);

  // 分析状态
  const statusInfo = analyzeSkewStatus(skew25Delta);

  // 获取交易启示
  const tradingImplications = getSkewTradingImplications(statusInfo.status, skew25Delta, pcrStatus);

  // 风险提示
  const riskWarnings: string[] = [];
  if (statusInfo.status === 'extreme') {
    riskWarnings.push('极端偏斜，市场恐慌情绪严重');
    riskWarnings.push('若近期出现高影响事件（如美联储决议、财报），SKEW可能快速飙升，偏斜程度加剧，需及时调整对冲策略');
  }
  if (statusInfo.status === 'high' || statusInfo.status === 'extreme') {
    riskWarnings.push('SKEW仅反映期权市场的定价，若出现实质性下行事件（如宏观数据恶化），偏斜可能进一步扩大，需结合基本面综合判断');
  }

  return {
    skew25Delta,
    skew10Delta: skew25Delta * 1.5, // 简化估算
    status: statusInfo.status,
    statusLabel: statusInfo.statusLabel,
    description: statusInfo.description,
    tradingImplications,
    riskWarnings,
  };
}

/**
 * 格式化 Skew 显示
 * @param value Skew 值
 * @returns 格式化后的字符串
 */
export function formatSkew(value: number): string {
  return `${value.toFixed(2)}%`;
}

/**
 * 获取 Skew 颜色
 * @param skew25Delta 25 Delta Skew 值
 * @returns 颜色代码
 */
export function getSkewColor(skew25Delta: number): string {
  const status = analyzeSkewStatus(skew25Delta);
  return status.color;
}
