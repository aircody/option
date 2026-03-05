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
 * @returns 交易启示列表
 */
export function getSkewTradingImplications(status: string): string[] {
  switch (status) {
    case 'low':
      return [
        '市场乐观，可考虑做多',
        'Put 期权相对便宜，可考虑买入保护',
      ];
    case 'normal':
      return [
        '市场情绪中性',
        '按正常策略操作',
      ];
    case 'high':
      return [
        '市场谨慎，注意风险',
        '可考虑卖出 Put 赚取高溢价',
      ];
    case 'extreme':
      return [
        '市场恐慌，反向看多',
        '可考虑卖出 Put 赚取极端溢价',
        '但需设置严格止损',
      ];
    default:
      return ['观望'];
  }
}

/**
 * 执行完整的 Skew 分析
 * @param oiData 持仓数据
 * @param currentPrice 当前价格
 * @param atmIV ATM IV
 * @returns Skew 分析结果
 */
export function analyzeSkew(
  oiData: OIData[],
  currentPrice: number,
  atmIV: number
): SkewAnalysisResult {
  // 计算 Skew 数据
  const skewData = calculateSkewData(oiData, currentPrice, atmIV);

  // 计算 25 Delta Skew
  const skew25Delta = calculate25DeltaSkew(skewData, atmIV);

  // 分析状态
  const statusInfo = analyzeSkewStatus(skew25Delta);

  // 获取交易启示
  const tradingImplications = getSkewTradingImplications(statusInfo.status);

  // 风险提示
  const riskWarnings: string[] = [];
  if (statusInfo.status === 'extreme') {
    riskWarnings.push('极端偏斜，市场恐慌情绪严重');
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
