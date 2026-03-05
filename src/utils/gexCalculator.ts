/**
 * Gamma Exposure (GEX) 计算工具
 * 
 * 根据 LongPort API 返回的期权数据计算 Gamma Exposure
 * API 返回字段: strike_price, open_interest, direction, implied_volatility
 * 
 * 计算逻辑：
 * GEX = Σ(Gamma × OI × 合约乘数 × 标的资产价格)
 * 
 * 由于实际 Gamma 值需要复杂的期权定价模型，本系统使用简化模型估算
 */

import type { OIData } from '../types';

// 美股期权合约乘数：100股/合约
const CONTRACT_MULTIPLIER = 100;

/**
 * GEX 数据接口
 */
export interface GEXData {
  strike: number;        // 行权价
  callGEX: number;       // Call Gamma敞口
  putGEX: number;        // Put Gamma敞口（负值）
  totalGEX: number;      // 总Gamma敞口
}

/**
 * GEX 分析结果接口
 */
export interface GEXAnalysisResult {
  totalGEX: number;       // 总Gamma敞口
  callGEX: number;        // Call Gamma敞口合计
  putGEX: number;         // Put Gamma敞口合计
  zeroGammaLevel: number; // Zero Gamma Level
  flipPoint: number;      // Gamma Flip Point
  status: 'extreme_negative' | 'negative' | 'neutral' | 'positive' | 'extreme_positive';
  statusLabel: string;    // 状态标签
  description: string;    // 状态描述
  tradingImplications: string[]; // 交易启示
}

/**
 * 根据距离 ATM 的位置估算 Gamma 值
 * 
 * 估算模型：
 * | 距离ATM位置 | Gamma估算值 | 说明 |
 * |------------|------------|------|
 * | ATM (±1%) | 0.05 | ATM期权Gamma最高 |
 * | 近ATM (±3%) | 0.03 | 接近平值 |
 * | 中等OTM (±6%) | 0.015 | 中等距离 |
 * | 远OTM (>6%) | 0.005 | 深度虚值 |
 * 
 * @param strike 行权价
 * @param atmPrice 平值价格（当前标的价格）
 * @returns 估算的 Gamma 值
 */
export function estimateGamma(strike: number, atmPrice: number): number {
  if (!atmPrice || atmPrice <= 0) return 0.005;
  
  const distancePercent = Math.abs((strike - atmPrice) / atmPrice);
  
  if (distancePercent <= 0.01) {
    return 0.05; // ATM (±1%)
  } else if (distancePercent <= 0.03) {
    return 0.03; // 近ATM (±3%)
  } else if (distancePercent <= 0.06) {
    return 0.015; // 中等OTM (±6%)
  } else {
    return 0.005; // 远OTM (>6%)
  }
}

/**
 * 计算单个期权的 GEX
 * @param gamma Gamma 值
 * @param oi 未平仓合约数
 * @param underlyingPrice 标的资产价格
 * @param isCall 是否是 Call 期权
 * @returns GEX 值
 */
export function calculateOptionGEX(
  gamma: number,
  oi: number,
  underlyingPrice: number,
  isCall: boolean
): number {
  // GEX = Gamma × OI × 合约乘数 × 标的价格
  // Put GEX 为负值（因为 Put Delta 为负）
  const sign = isCall ? 1 : -1;
  return sign * gamma * oi * CONTRACT_MULTIPLIER * underlyingPrice;
}

/**
 * 计算 GEX 数据
 * @param oiData 持仓数据
 * @param underlyingPrice 标的资产当前价格
 * @returns GEX 数据数组
 */
export function calculateGEX(oiData: OIData[], underlyingPrice: number): GEXData[] {
  if (!oiData || oiData.length === 0 || !underlyingPrice) {
    return [];
  }

  const gexData: GEXData[] = [];

  for (const data of oiData) {
    const strike = data.strike;
    const gamma = estimateGamma(strike, underlyingPrice);
    
    // 计算 Call GEX
    const callGEX = calculateOptionGEX(gamma, data.callOI, underlyingPrice, true);
    
    // 计算 Put GEX（负值）
    const putGEX = calculateOptionGEX(gamma, data.putOI, underlyingPrice, false);
    
    // 总 GEX
    const totalGEX = callGEX + putGEX;

    gexData.push({
      strike,
      callGEX,
      putGEX,
      totalGEX,
    });
  }

  return gexData;
}

/**
 * 分析 GEX 状态
 * @param totalGEX 总 GEX 值
 * @returns 状态分析结果
 */
export function analyzeGEXStatus(totalGEX: number): {
  status: 'extreme_negative' | 'negative' | 'neutral' | 'positive' | 'extreme_positive';
  statusLabel: string;
  description: string;
  color: string;
} {
  // 转换为十亿美元
  const gexBillions = totalGEX / 1e9;

  if (gexBillions < -30) {
    return {
      status: 'extreme_negative',
      statusLabel: '超波动',
      description: '极端负Gamma环境，做市商成为波动放大器，追涨杀跌',
      color: '#ff4d4f',
    };
  } else if (gexBillions < -10) {
    return {
      status: 'negative',
      statusLabel: '高波动',
      description: '负Gamma环境，波动可能放大，谨慎操作',
      color: '#ff7875',
    };
  } else if (gexBillions < 10) {
    return {
      status: 'neutral',
      statusLabel: '平稳',
      description: 'Gamma中性，市场相对稳定',
      color: '#52c41a',
    };
  } else if (gexBillions < 30) {
    return {
      status: 'positive',
      statusLabel: '低波动',
      description: '正Gamma环境，做市商抑制波动，低买高卖',
      color: '#73d13d',
    };
  } else {
    return {
      status: 'extreme_positive',
      statusLabel: '极稳',
      description: '极端正Gamma环境，强烈抑制波动，市场盘整',
      color: '#389e0d',
    };
  }
}

/**
 * 计算 Zero Gamma Level
 * @param gexData GEX 数据数组
 * @returns Zero Gamma Level（GEX 最接近 0 的行权价）
 */
export function calculateZeroGammaLevel(gexData: GEXData[]): number {
  if (!gexData || gexData.length === 0) {
    return 0;
  }

  let minAbsGEX = Infinity;
  let zeroGammaStrike = 0;

  for (const data of gexData) {
    const absGEX = Math.abs(data.totalGEX);
    if (absGEX < minAbsGEX) {
      minAbsGEX = absGEX;
      zeroGammaStrike = data.strike;
    }
  }

  return zeroGammaStrike;
}

/**
 * 计算 Gamma Flip Point
 * @param gexData GEX 数据数组
 * @returns Gamma Flip Point（正负 GEX 转换点）
 */
export function calculateGammaFlipPoint(gexData: GEXData[]): number {
  if (!gexData || gexData.length === 0) {
    return 0;
  }

  // 找到正负 GEX 转换的行权价
  const sortedData = [...gexData].sort((a, b) => a.strike - b.strike);
  
  for (let i = 0; i < sortedData.length - 1; i++) {
    const current = sortedData[i];
    const next = sortedData[i + 1];
    
    // 如果当前是负，下一个是正，或者反之
    if ((current.totalGEX < 0 && next.totalGEX >= 0) ||
        (current.totalGEX >= 0 && next.totalGEX < 0)) {
      // 返回中间值
      return (current.strike + next.strike) / 2;
    }
  }

  // 如果没有找到转换点，返回 ATM 附近的行权价
  return sortedData[Math.floor(sortedData.length / 2)]?.strike || 0;
}

/**
 * 获取交易启示
 * @param status GEX 状态
 * @returns 交易启示列表
 */
export function getTradingImplications(status: string): string[] {
  switch (status) {
    case 'extreme_negative':
      return [
        '趋势跟踪策略：顺应市场方向，下跌做空、上涨做多，避免逆势',
        '波动率交易：买入波动率（跨式/宽跨式期权），或持有VIX看涨期权',
        '禁止均值回归策略：负Gamma环境下失效，易被趋势碾压',
        '禁止期权卖方策略：波动放大带来指数级亏损，需平仓或对冲',
        '降低杠杆至平时的50%以下',
        '加宽止损至近期波动幅度的1.5-2倍',
        '关注到期日：临近到期（尤其是0DTE），Gamma非线性飙升，波动放大效应最强',
        '结合OI Wall与Max Pain：若负Gamma与关键位置重合，突破/跌破会引发极致波动',
      ];
    case 'negative':
      return [
        '趋势跟踪策略：顺应市场方向，谨慎操作',
        '波动率交易：适度买入波动率',
        '降低仓位，控制杠杆',
        '关注到期日效应',
        '谨慎进行方向性交易',
      ];
    case 'neutral':
      return [
        '均衡策略：多空平衡',
        '区间交易策略',
        '正常仓位管理',
        '等待更明确的信号',
      ];
    case 'positive':
      return [
        '均值回归策略：低买高卖',
        '期权卖方策略：卖出期权赚取时间价值',
        '备兑开仓策略',
        '正常或适度增加仓位',
        '价格向Max Pain收敛概率>80%',
      ];
    case 'extreme_positive':
      return [
        '区间卖方策略：优先区间卖方策略，禁止单边裸买期权',
        '铁鹰套利/卖出宽跨式：赚时间价值与价格收敛的钱',
        '价格钉住Max Pain，难突破OI Wall',
        '极高正GEX环境下仓位不超过10%',
        '仅做窄区间套利，禁止任何方向性策略',
      ];
    default:
      return ['观望'];
  }
}

/**
 * 执行完整的 GEX 分析
 * @param oiData 持仓数据
 * @param underlyingPrice 标的资产当前价格
 * @returns GEX 分析结果
 */
export function analyzeGEX(oiData: OIData[], underlyingPrice: number): GEXAnalysisResult {
  // 计算 GEX 数据
  const gexData = calculateGEX(oiData, underlyingPrice);
  
  // 计算总 GEX
  const totalGEX = gexData.reduce((sum, data) => sum + data.totalGEX, 0);
  const callGEX = gexData.reduce((sum, data) => sum + data.callGEX, 0);
  const putGEX = gexData.reduce((sum, data) => sum + data.putGEX, 0);
  
  // 分析状态
  const statusInfo = analyzeGEXStatus(totalGEX);
  
  // 计算 Zero Gamma Level 和 Flip Point
  const zeroGammaLevel = calculateZeroGammaLevel(gexData);
  const flipPoint = calculateGammaFlipPoint(gexData);
  
  // 获取交易启示
  const tradingImplications = getTradingImplications(statusInfo.status);

  return {
    totalGEX,
    callGEX,
    putGEX,
    zeroGammaLevel,
    flipPoint,
    status: statusInfo.status,
    statusLabel: statusInfo.statusLabel,
    description: statusInfo.description,
    tradingImplications,
  };
}

/**
 * 格式化 GEX 显示
 * @param value GEX 值
 * @returns 格式化后的字符串
 */
export function formatGEX(value: number): string {
  const billions = value / 1e9;
  if (Math.abs(billions) >= 1) {
    return `$${billions.toFixed(2)}B`;
  }
  const millions = value / 1e6;
  if (Math.abs(millions) >= 1) {
    return `$${millions.toFixed(2)}M`;
  }
  const thousands = value / 1e3;
  return `$${thousands.toFixed(2)}K`;
}
