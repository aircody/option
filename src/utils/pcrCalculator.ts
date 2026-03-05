/**
 * Put/Call Ratio (PCR) 计算工具
 * 
 * 根据 LongPort API 返回的期权数据计算 PCR
 * API 返回字段: strike_price, open_interest, direction, volume
 * 
 * 计算逻辑：
 * PCR = Put 成交量(OI) / Call 成交量(OI)
 * 
 * 反向投资逻辑：期权市场中，散户/机构的极端看跌行为往往是情绪超调，
 * 当看跌情绪达到极致，市场通常处于底部区域，此时反向操作（看多）的胜率极高。
 */

import type { OIData } from '../types';

/**
 * PCR 数据接口
 */
export interface PCRData {
  strike: number;        // 行权价
  putOI: number;         // Put未平仓合约
  callOI: number;        // Call未平仓合约
  putVolume: number;     // Put成交量
  callVolume: number;    // Call成交量
  pcrOI: number;         // 基于OI的PCR
  pcrVolume: number;     // 基于成交量的PCR
}

/**
 * PCR 分析结果接口
 */
export interface PCRAnalysisResult {
  totalPutOI: number;     // Put总OI
  totalCallOI: number;    // Call总OI
  totalPutVolume: number; // Put总成交量
  totalCallVolume: number;// Call总成交量
  pcrOI: number;          // 基于OI的PCR
  pcrVolume: number;      // 基于成交量的PCR
  status: 'extreme_bullish' | 'bullish' | 'neutral' | 'bearish' | 'extreme_bearish';
  statusLabel: string;    // 状态标签
  description: string;    // 状态描述
  tradingImplications: string[]; // 交易启示
  riskWarnings: string[]; // 风险提示
}

/**
 * 计算单个行权价的 PCR
 * @param putOI Put 未平仓量
 * @param callOI Call 未平仓量
 * @returns PCR 值
 */
export function calculatePCR(putOI: number, callOI: number): number {
  if (!callOI || callOI === 0) return 0;
  return putOI / callOI;
}

/**
 * 计算 PCR 数据
 * @param oiData 持仓数据
 * @returns PCR 数据数组
 */
export function calculatePCRData(oiData: OIData[]): PCRData[] {
  if (!oiData || oiData.length === 0) {
    return [];
  }

  return oiData.map(data => {
    const pcrOI = calculatePCR(data.putOI, data.callOI);
    // 如果没有成交量数据，使用 OI 作为估算
    const pcrVolume = pcrOI;

    return {
      strike: data.strike,
      putOI: data.putOI,
      callOI: data.callOI,
      putVolume: data.putOI, // 使用 OI 作为成交量估算
      callVolume: data.callOI,
      pcrOI,
      pcrVolume,
    };
  });
}

/**
 * 分析 PCR 状态
 * @param pcr PCR 值
 * @returns 状态分析结果
 */
export function analyzePCRStatus(pcr: number): {
  status: 'extreme_bullish' | 'bullish' | 'neutral' | 'bearish' | 'extreme_bearish';
  statusLabel: string;
  description: string;
  color: string;
} {
  if (pcr < 0.8) {
    return {
      status: 'extreme_bullish',
      statusLabel: '极度乐观',
      description: '市场极度乐观，警惕高位回调，反向看空',
      color: '#ff4d4f',
    };
  } else if (pcr < 1.0) {
    return {
      status: 'bullish',
      statusLabel: '乐观',
      description: '市场乐观，谨慎看空',
      color: '#ff7875',
    };
  } else if (pcr < 1.2) {
    return {
      status: 'neutral',
      statusLabel: '中性',
      description: '市场情绪中性，观望或均衡策略',
      color: '#faad14',
    };
  } else if (pcr < 1.5) {
    return {
      status: 'bearish',
      statusLabel: '偏悲观',
      description: '市场偏悲观，谨慎看多',
      color: '#73d13d',
    };
  } else {
    return {
      status: 'extreme_bearish',
      statusLabel: '极度悲观',
      description: '市场极度悲观，反向强看多（核心信号）',
      color: '#52c41a',
    };
  }
}

/**
 * 获取交易启示
 * @param status PCR 状态
 * @returns 交易启示列表
 */
export function getTradingImplications(status: string): string[] {
  switch (status) {
    case 'extreme_bullish':
      return [
        '反向看空：市场极度乐观，警惕高位回调（反向信号）',
        '考虑买入看跌期权或卖出看涨期权',
        '降低多头仓位',
        '设置严格止损',
        '需结合VIX、Gamma Exposure等多指标综合判断',
        '价格创新高但PCR同步走高是强见顶信号',
      ];
    case 'bullish':
      return [
        '谨慎看空：市场乐观但不过度',
        '维持正常仓位',
        '关注关键阻力位',
      ];
    case 'neutral':
      return [
        '均衡策略：多空平衡',
        '观望或均衡策略',
        '等待明确信号',
      ];
    case 'bearish':
      return [
        '谨慎看多：市场偏悲观',
        '逢低布局',
        '分批建仓',
      ];
    case 'extreme_bearish':
      return [
        '反向强看多：市场极度悲观，情绪见底信号（核心信号）',
        '指数层面：配置标普500 (SPY)、纳斯达克 (QQQ) 等宽基指数的看涨期权，或做多指数ETF',
        '个股层面：回避基本面无问题的超跌标的，禁止盲目做空，避免在底部踏空',
        '仓位控制：负Gamma环境下市场波动被剧烈放大，建议仓位控制在常规的50%以下',
        '严格止损：设定严格止损，避免极端情绪持续恶化导致的短期回撤',
        '综合验证：该信号需与OI Wall、Max Pain交叉验证，若极端看跌情绪与关键支撑位（OI Wall）、最大痛点重合，底部信号的有效性会进一步提升',
      ];
    default:
      return ['观望'];
  }
}

/**
 * 获取风险提示
 * @param status PCR 状态
 * @returns 风险提示列表
 */
export function getRiskWarnings(status: string): string[] {
  const warnings: string[] = [
    'PCR需结合VIX、Gamma Exposure等多指标综合判断',
    '单一指标易受短期交易噪音影响',
  ];

  if (status === 'extreme_bearish' || status === 'extreme_bullish') {
    warnings.push('极端情绪可能持续，需设置严格止损');
    warnings.push('负Gamma环境下市场波动被剧烈放大');
  }

  return warnings;
}

/**
 * 执行完整的 PCR 分析
 * @param oiData 持仓数据
 * @returns PCR 分析结果
 */
export function analyzePCR(oiData: OIData[]): PCRAnalysisResult {
  // 计算 PCR 数据
  const pcrData = calculatePCRData(oiData);
  
  // 计算总 OI 和成交量
  const totalPutOI = oiData.reduce((sum, data) => sum + data.putOI, 0);
  const totalCallOI = oiData.reduce((sum, data) => sum + data.callOI, 0);
  const totalPutVolume = totalPutOI; // 使用 OI 作为成交量估算
  const totalCallVolume = totalCallOI;
  
  // 计算总体 PCR
  const pcrOI = calculatePCR(totalPutOI, totalCallOI);
  const pcrVolume = pcrOI;
  
  // 分析状态
  const statusInfo = analyzePCRStatus(pcrOI);
  
  // 获取交易启示和风险提示
  const tradingImplications = getTradingImplications(statusInfo.status);
  const riskWarnings = getRiskWarnings(statusInfo.status);

  return {
    totalPutOI,
    totalCallOI,
    totalPutVolume,
    totalCallVolume,
    pcrOI,
    pcrVolume,
    status: statusInfo.status,
    statusLabel: statusInfo.statusLabel,
    description: statusInfo.description,
    tradingImplications,
    riskWarnings,
  };
}

/**
 * 格式化 PCR 显示
 * @param value PCR 值
 * @returns 格式化后的字符串
 */
export function formatPCR(value: number): string {
  return value.toFixed(3);
}

/**
 * 格式化 OI 显示
 * @param value OI 值
 * @returns 格式化后的字符串
 */
export function formatOI(value: number): string {
  if (value >= 1e6) {
    return `${(value / 1e6).toFixed(3)}M`;
  }
  if (value >= 1e3) {
    return `${(value / 1e3).toFixed(1)}K`;
  }
  return value.toString();
}
