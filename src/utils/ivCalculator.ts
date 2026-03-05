/**
 * Implied Volatility (IV) 计算工具
 * 
 * 根据 LongPort API 返回的期权数据计算 ATM IV、HV、VRP 等指标
 * API 返回字段: strike_price, implied_volatility, direction
 * 
 * 核心指标：
 * - ATM IV: 平值期权的隐含波动率
 * - HV: 历史波动率（使用简化估算）
 * - VRP: 波动率风险溢价 = ATM IV - HV
 */

import type { OIData } from '../types';

/**
 * IV 数据接口
 */
export interface IVData {
  strike: number;           // 行权价
  callIV: number;           // Call隐含波动率
  putIV: number;            // Put隐含波动率
  avgIV: number;            // 平均IV
  distanceFromATM: number;  // 距离ATM的百分比
}

/**
 * IV 分析结果接口
 */
export interface IVAnalysisResult {
  atmIV: number;            // 平值期权隐含波动率
  hv: number;               // 历史波动率（估算）
  vrp: number;              // 波动率风险溢价
  vrpPercent: number;       // VRP百分比
  callSkew: number;         // Call IV偏度
  putSkew: number;          // Put IV偏度
  status: 'low' | 'normal' | 'high' | 'extreme';
  statusLabel: string;      // 状态标签
  description: string;      // 状态描述
  tradingImplications: string[]; // 交易启示
  riskWarnings: string[];   // 风险提示
}

/**
 * 从 API 数据格式提取 IV 信息
 * @param apiOptionData Python后端返回的期权数据格式
 * @param underlyingPrice 标的资产当前价格
 * @returns IV 数据数组
 */
export function extractIVDataFromApiOption(apiOptionData: any[], underlyingPrice: number): IVData[] {
  if (!apiOptionData || !Array.isArray(apiOptionData) || !underlyingPrice) {
    return [];
  }

  const result: IVData[] = [];

  for (const item of apiOptionData) {
    const strike = parseFloat(item.strike || 0);
    const callIV = parseFloat(item.callIV || 0);
    const putIV = parseFloat(item.putIV || 0);
    const avgIV = (callIV + putIV) / 2 || callIV || putIV;
    const distanceFromATM = Math.abs((strike - underlyingPrice) / underlyingPrice);

    result.push({
      strike,
      callIV,
      putIV,
      avgIV,
      distanceFromATM,
    });
  }

  return result.sort((a, b) => a.strike - b.strike);
}

/**
 * 从 API 数据提取 IV 信息
 * @param apiData LongPort API 返回的期权数据
 * @param underlyingPrice 标的资产当前价格
 * @returns IV 数据数组
 */
export function extractIVData(apiData: any[], underlyingPrice: number): IVData[] {
  if (!apiData || !Array.isArray(apiData) || !underlyingPrice) {
    return [];
  }

  // 按行权价分组，提取 Call 和 Put 的 IV
  const strikeMap = new Map<number, { callIV: number; putIV: number }>();

  for (const item of apiData) {
    const strike = parseFloat(item.strike_price || item.strike || 0);
    const iv = parseFloat(item.implied_volatility || item.iv || 0);
    const direction = item.direction || '';

    if (!strikeMap.has(strike)) {
      strikeMap.set(strike, { callIV: 0, putIV: 0 });
    }

    const data = strikeMap.get(strike)!;
    if (direction === 'C' || direction === 'Call') {
      data.callIV = iv;
    } else if (direction === 'P' || direction === 'Put') {
      data.putIV = iv;
    }
  }

  // 转换为数组并计算距离 ATM 的百分比
  const result: IVData[] = [];
  strikeMap.forEach((data, strike) => {
    const avgIV = (data.callIV + data.putIV) / 2 || data.callIV || data.putIV;
    const distanceFromATM = Math.abs((strike - underlyingPrice) / underlyingPrice);

    result.push({
      strike,
      callIV: data.callIV,
      putIV: data.putIV,
      avgIV,
      distanceFromATM,
    });
  });

  return result.sort((a, b) => a.strike - b.strike);
}

/**
 * 计算 ATM IV
 * 找到最接近当前价格的行权价的 IV
 * @param ivData IV 数据数组
 * @param underlyingPrice 标的资产当前价格
 * @returns ATM IV 值
 */
export function calculateATMIV(ivData: IVData[], underlyingPrice: number): number {
  if (!ivData || ivData.length === 0) {
    return 0;
  }

  // 找到最接近 ATM 的行权价
  let minDistance = Infinity;
  let atmIV = 0;

  for (const data of ivData) {
    const distance = Math.abs(data.strike - underlyingPrice);
    if (distance < minDistance) {
      minDistance = distance;
      atmIV = data.avgIV;
    }
  }

  return atmIV;
}

/**
 * 估算历史波动率 (HV)
 * 使用简化模型：HV ≈ ATM IV × 0.75（典型比例）
 * @param atmIV ATM IV 值
 * @returns 估算的 HV
 */
export function estimateHV(atmIV: number): number {
  if (!atmIV || atmIV <= 0) {
    return 0.15; // 默认 15%
  }
  // 典型市场中，IV 通常比 HV 高 25-35%，这里使用 0.75 作为估算系数
  return atmIV * 0.75;
}

/**
 * 计算 VRP (Volatility Risk Premium)
 * @param atmIV ATM IV
 * @param hv HV
 * @returns VRP 值
 */
export function calculateVRP(atmIV: number, hv: number): number {
  return atmIV - hv;
}

/**
 * 计算 VRP 百分比
 * @param vrp VRP 值
 * @param hv HV
 * @returns VRP 百分比
 */
export function calculateVRPPercent(vrp: number, hv: number): number {
  if (!hv || hv <= 0) return 0;
  return (vrp / hv) * 100;
}

/**
 * 计算 IV 偏度 (Skew)
 * @param ivData IV 数据数组
 * @param underlyingPrice 标的资产当前价格
 * @returns Call 和 Put 的偏度
 */
export function calculateIVSkew(ivData: IVData[], underlyingPrice: number): {
  callSkew: number;
  putSkew: number;
} {
  if (!ivData || ivData.length === 0) {
    return { callSkew: 0, putSkew: 0 };
  }

  // 分离 OTM Call 和 OTM Put
  const otmCalls = ivData.filter(d => d.strike > underlyingPrice && d.callIV > 0);
  const otmPuts = ivData.filter(d => d.strike < underlyingPrice && d.putIV > 0);

  // 计算平均 IV
  const avgCallIV = otmCalls.reduce((sum, d) => sum + d.callIV, 0) / (otmCalls.length || 1);
  const avgPutIV = otmPuts.reduce((sum, d) => sum + d.putIV, 0) / (otmPuts.length || 1);
  const atmIV = calculateATMIV(ivData, underlyingPrice);

  // 计算偏度（OTM IV 与 ATM IV 的差值）
  const callSkew = atmIV > 0 ? ((avgCallIV - atmIV) / atmIV) * 100 : 0;
  const putSkew = atmIV > 0 ? ((avgPutIV - atmIV) / atmIV) * 100 : 0;

  return { callSkew, putSkew };
}

/**
 * 分析 VRP 状态
 * @param vrpPercent VRP 百分比
 * @returns 状态分析结果
 */
export function analyzeVRPStatus(vrpPercent: number): {
  status: 'low' | 'normal' | 'high' | 'extreme';
  statusLabel: string;
  description: string;
  color: string;
} {
  if (vrpPercent < 5) {
    return {
      status: 'low',
      statusLabel: '低溢价',
      description: '波动率定价合理，预期与实际接近',
      color: '#52c41a',
    };
  } else if (vrpPercent < 15) {
    return {
      status: 'normal',
      statusLabel: '正常溢价',
      description: '市场预期略高于历史波动',
      color: '#73d13d',
    };
  } else if (vrpPercent < 30) {
    return {
      status: 'high',
      statusLabel: '高溢价',
      description: '波动率定价偏贵，存在均值回归动力',
      color: '#faad14',
    };
  } else {
    return {
      status: 'extreme',
      statusLabel: '极端溢价',
      description: '波动率定价极端偏贵，市场情绪恐慌',
      color: '#ff4d4f',
    };
  }
}

/**
 * 获取交易启示
 * @param vrpStatus VRP 状态
 * @param pcrStatus PCR 状态（可选，用于组合分析）
 * @returns 交易启示列表
 */
export function getIVTradingImplications(
  vrpStatus: string,
  pcrStatus?: string
): string[] {
  const implications: string[] = [];

  // 根据 VRP 状态添加启示
  switch (vrpStatus) {
    case 'low':
      implications.push('波动率定价合理，可进行方向性交易');
      break;
    case 'normal':
      implications.push('适度正VRP，可考虑轻度波动率卖方策略');
      break;
    case 'high':
      implications.push('波动率卖方策略：卖出跨式/宽跨式期权，赚取波动率溢价');
      implications.push('严格控制仓位（单策略仓位≤10%）');
      break;
    case 'extreme':
      implications.push('极端高溢价，强烈建议波动率卖方策略');
      implications.push('但必须设置严格止损，防范波动率进一步上行');
      break;
  }

  // 组合分析
  if (pcrStatus === 'extreme_bearish' && (vrpStatus === 'high' || vrpStatus === 'extreme')) {
    implications.push('高PCR + 正VRP组合：市场情绪恐慌性定价，反向看多胜率提升');
    implications.push('建议买入虚值看涨期权（Call），规避负Gamma带来的短期暴跌风险');
  }

  return implications;
}

/**
 * 执行完整的 IV 分析
 * @param apiData LongPort API 返回的期权数据
 * @param underlyingPrice 标的资产当前价格
 * @param pcrStatus PCR 状态（可选，用于组合分析）
 * @returns IV 分析结果
 */
export function analyzeIV(
  apiData: any[],
  underlyingPrice: number,
  pcrStatus?: string
): IVAnalysisResult {
  // 提取 IV 数据
  const ivData = extractIVData(apiData, underlyingPrice);

  // 计算 ATM IV
  const atmIV = calculateATMIV(ivData, underlyingPrice);

  // 估算 HV
  const hv = estimateHV(atmIV);

  // 计算 VRP
  const vrp = calculateVRP(atmIV, hv);
  const vrpPercent = calculateVRPPercent(vrp, hv);

  // 计算 IV 偏度
  const { callSkew, putSkew } = calculateIVSkew(ivData, underlyingPrice);

  // 分析 VRP 状态
  const statusInfo = analyzeVRPStatus(vrpPercent);

  // 获取交易启示
  const tradingImplications = getIVTradingImplications(statusInfo.status, pcrStatus);

  // 风险提示
  const riskWarnings: string[] = [];
  if (statusInfo.status === 'extreme') {
    riskWarnings.push('极端高溢价，波动率可能进一步上行');
  }
  if (vrpPercent > 20) {
    riskWarnings.push('VRP过高，注意波动率回归风险');
  }

  return {
    atmIV,
    hv,
    vrp,
    vrpPercent,
    callSkew,
    putSkew,
    status: statusInfo.status,
    statusLabel: statusInfo.statusLabel,
    description: statusInfo.description,
    tradingImplications,
    riskWarnings,
  };
}

/**
 * 格式化 IV 显示
 * @param value IV 值（小数形式，如 0.2483）
 * @returns 格式化后的字符串（如 "24.83%"）
 */
export function formatIV(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

/**
 * 格式化 VRP 显示
 * @param vrp VRP 值
 * @param vrpPercent VRP 百分比
 * @returns 格式化后的字符串
 */
export function formatVRP(vrp: number | undefined, vrpPercent: number | undefined): string {
  const safeVrp = vrp ?? 0;
  const safeVrpPercent = vrpPercent ?? 0;
  return `+${(safeVrp * 100).toFixed(2)}% (${safeVrpPercent.toFixed(0)}%)`;
}
