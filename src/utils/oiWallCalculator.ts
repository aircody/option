/**
 * OI Wall (持仓墙) 计算工具
 * 
 * 核心逻辑：量化期权未平仓合约（OI）在特定行权价的集中程度，
 * 基于期权对冲逻辑判定支撑/阻力
 */

import type { OIData } from '../types';

// 合约乘数：100股/合约
const CONTRACT_MULTIPLIER = 100;

/**
 * OI Wall 识别结果
 */
export interface OIWallResult {
  strike: number;
  callOI: number;
  putOI: number;
  isCallWall: boolean;
  isPutWall: boolean;
  callConcentrationRatio: number;
  putConcentrationRatio: number;
  callIntensity: number;
  putIntensity: number;
}

/**
 * 方法1：相邻行权价对比法
 * 集中度比值(K) = OI(K) / ((OI(K-Δ) + OI(K+Δ)) / 2)
 * 
 * @param currentOI 当前行权价OI
 * @param leftOI 左侧相邻行权价OI
 * @param rightOI 右侧相邻行权价OI
 * @returns 集中度比值
 */
export function calculateConcentrationRatio(
  currentOI: number,
  leftOI: number,
  rightOI: number
): number {
  const neighborAvg = (leftOI + rightOI) / 2;
  if (neighborAvg === 0) return currentOI > 0 ? Infinity : 0;
  return currentOI / neighborAvg;
}

/**
 * 方法2：相对占比法
 * 计算单个行权价 OI 占总 OI 的比例
 * 
 * @param currentOI 当前行权价OI
 * @param totalOI 所有行权价总OI
 * @returns 占比 (0-1)
 */
export function calculateRelativeRatio(
  currentOI: number,
  totalOI: number
): number {
  if (totalOI === 0) return 0;
  return currentOI / totalOI;
}

/**
 * 方法3：绝对阈值法
 * 直接判定是否超过阈值
 * 
 * @param oi 持仓量
 * @param threshold 阈值（默认10000张）
 * @returns 是否超过阈值
 */
export function checkAbsoluteThreshold(
  oi: number,
  threshold: number = 10000
): boolean {
  return oi >= threshold;
}

/**
 * 计算支撑/阻力强度
 * 强度 = OI(K) × 合约乘数 × (1 / |S - K|)
 * 
 * @param oi 持仓量
 * @param strike 行权价
 * @param currentPrice 当前价格
 * @returns 强度值
 */
export function calculateIntensity(
  oi: number,
  strike: number,
  currentPrice: number
): number {
  const distance = Math.abs(currentPrice - strike);
  if (distance === 0) {
    // 如果正好在现价，给一个很高的强度值
    return oi * CONTRACT_MULTIPLIER * 100;
  }
  return oi * CONTRACT_MULTIPLIER * (1 / distance);
}

/**
 * 识别 OI Wall（综合三种方法）
 * 
 * @param oiData 持仓数据
 * @param currentPrice 当前价格
 * @param options 配置选项
 * @returns OI Wall 识别结果
 */
export function identifyOIWalls(
  oiData: OIData[],
  currentPrice: number,
  options: {
    concentrationThreshold?: number;  // 集中度阈值，默认2.0
    relativeRatioThreshold?: number;  // 相对占比阈值，默认0.03 (3%)
    absoluteThreshold?: number;       // 绝对阈值，默认10000
  } = {}
): OIWallResult[] {
  const {
    concentrationThreshold = 2.0,
    relativeRatioThreshold = 0.03,
    absoluteThreshold = 10000,
  } = options;

  const results: OIWallResult[] = [];
  
  // 计算总OI
  const totalCallOI = oiData.reduce((sum, d) => sum + d.callOI, 0);
  const totalPutOI = oiData.reduce((sum, d) => sum + d.putOI, 0);

  // 遍历每个行权价
  for (let i = 0; i < oiData.length; i++) {
    const data = oiData[i];
    const { strike, callOI, putOI } = data;

    // 获取相邻行权价的OI
    const leftData = i > 0 ? oiData[i - 1] : null;
    const rightData = i < oiData.length - 1 ? oiData[i + 1] : null;

    // 方法1：相邻行权价对比法
    let callConcentrationRatio = 0;
    let putConcentrationRatio = 0;
    
    if (leftData && rightData) {
      callConcentrationRatio = calculateConcentrationRatio(
        callOI,
        leftData.callOI,
        rightData.callOI
      );
      putConcentrationRatio = calculateConcentrationRatio(
        putOI,
        leftData.putOI,
        rightData.putOI
      );
    }

    // 方法2：相对占比法
    const callRelativeRatio = calculateRelativeRatio(callOI, totalCallOI);
    const putRelativeRatio = calculateRelativeRatio(putOI, totalPutOI);

    // 方法3：绝对阈值法
    const isCallAbsoluteWall = checkAbsoluteThreshold(callOI, absoluteThreshold);
    const isPutAbsoluteWall = checkAbsoluteThreshold(putOI, absoluteThreshold);

    // 综合判定是否为 OI Wall
    // 满足任一方法即可判定
    const isCallWall = 
      callConcentrationRatio >= concentrationThreshold ||
      callRelativeRatio >= relativeRatioThreshold ||
      isCallAbsoluteWall;
    
    const isPutWall = 
      putConcentrationRatio >= concentrationThreshold ||
      putRelativeRatio >= relativeRatioThreshold ||
      isPutAbsoluteWall;

    // 计算强度
    const callIntensity = calculateIntensity(callOI, strike, currentPrice);
    const putIntensity = calculateIntensity(putOI, strike, currentPrice);

    results.push({
      strike,
      callOI,
      putOI,
      isCallWall,
      isPutWall,
      callConcentrationRatio,
      putConcentrationRatio,
      callIntensity,
      putIntensity,
    });
  }

  return results;
}

/**
 * 获取最强的支撑和阻力位
 * 
 * @param oiWallResults OI Wall 识别结果
 * @returns 最强支撑和阻力位
 */
export function getStrongestSupportResistance(
  oiWallResults: OIWallResult[]
): {
  strongestSupport: OIWallResult | null;
  strongestResistance: OIWallResult | null;
} {
  let strongestSupport: OIWallResult | null = null;
  let strongestResistance: OIWallResult | null = null;

  for (const result of oiWallResults) {
    // 最强支撑（Put OI Wall 中强度最高的）
    if (result.isPutWall) {
      if (!strongestSupport || result.putIntensity > strongestSupport.putIntensity) {
        strongestSupport = result;
      }
    }

    // 最强阻力（Call OI Wall 中强度最高的）
    if (result.isCallWall) {
      if (!strongestResistance || result.callIntensity > strongestResistance.callIntensity) {
        strongestResistance = result;
      }
    }
  }

  return { strongestSupport, strongestResistance };
}

/**
 * 格式化 OI 显示
 * @param oi 持仓量
 * @returns 格式化后的字符串
 */
export function formatOI(oi: number): string {
  if (oi >= 1000000) {
    return `${(oi / 1000000).toFixed(2)}M`;
  }
  if (oi >= 1000) {
    return `${(oi / 1000).toFixed(1)}k`;
  }
  return oi.toString();
}

/**
 * 获取 OI Wall 描述
 * @param result OI Wall 结果
 * @returns 描述文本
 */
export function getOIWallDescription(result: OIWallResult): string {
  const parts: string[] = [];
  
  if (result.isCallWall) {
    parts.push(`阻力位 $${result.strike} (Call OI: ${formatOI(result.callOI)})`);
  }
  
  if (result.isPutWall) {
    parts.push(`支撑位 $${result.strike} (Put OI: ${formatOI(result.putOI)})`);
  }
  
  return parts.join('，');
}
