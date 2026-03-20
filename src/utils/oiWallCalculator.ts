/**
 * OI Wall (持仓量墙) 识别工具
 * 
 * 识别 Call Wall（阻力位）和 Put Wall（支撑位）
 * 基于期权持仓量数据，识别市场关键价位
 */

import type { OIData } from '../types';

/**
 * OI Wall 数据接口
 */
export interface OIWall {
  strike: number;           // 行权价
  type: 'support' | 'resistance'; // 类型：支撑/阻力
  strength: number;         // 强度（相对于平均OI的倍数）
  callOI: number;           // Call 持仓量
  putOI: number;            // Put 持仓量
  totalOI: number;          // 总持仓量
  isCallWall: boolean;      // 是否是 Call Wall (阻力位)
  isPutWall: boolean;       // 是否是 Put Wall (支撑位)
}

/**
 * 最强支撑阻力接口
 */
export interface StrongestSupportResistance {
  strongestSupport: OIWall | null;    // 最强支撑
  strongestResistance: OIWall | null; // 最强阻力
}

/**
 * 识别 OI Walls
 * @param data 持仓数据
 * @param currentPrice 当前价格
 * @param threshold 阈值倍数，默认为 1.3
 * @returns OI Wall 数组
 */
export function identifyOIWalls(data: OIData[], currentPrice: number, threshold: number = 1.3): OIWall[] {
  if (!data || data.length === 0 || !currentPrice) {
    return [];
  }

  const walls: OIWall[] = [];

  // 计算平均 OI
  const avgCallOI = data.reduce((sum, d) => sum + d.callOI, 0) / data.length;
  const avgPutOI = data.reduce((sum, d) => sum + d.putOI, 0) / data.length;

  // 识别 Call Wall（阻力位）：Call OI 显著高于平均且行权价 > 现价
  data
    .filter(d => d.strike > currentPrice && d.callOI > avgCallOI * threshold)
    .forEach(d => {
      walls.push({
        strike: d.strike,
        type: 'resistance',
        strength: d.callOI / avgCallOI,
        callOI: d.callOI,
        putOI: d.putOI,
        totalOI: d.callOI + d.putOI,
        isCallWall: true,
        isPutWall: false,
      });
    });

  // 识别 Put Wall（支撑位）：Put OI 显著高于平均且行权价 < 现价
  data
    .filter(d => d.strike < currentPrice && d.putOI > avgPutOI * threshold)
    .forEach(d => {
      walls.push({
        strike: d.strike,
        type: 'support',
        strength: d.putOI / avgPutOI,
        callOI: d.callOI,
        putOI: d.putOI,
        totalOI: d.callOI + d.putOI,
        isCallWall: false,
        isPutWall: true,
      });
    });

  // 按强度排序
  return walls.sort((a, b) => b.strength - a.strength);
}

/**
 * 获取最强支撑和阻力
 * @param walls OI Wall 数组
 * @returns 最强支撑和阻力
 */
export function getStrongestSupportResistance(walls: OIWall[]): StrongestSupportResistance {
  const supports = walls.filter(w => w.type === 'support');
  const resistances = walls.filter(w => w.type === 'resistance');

  return {
    strongestSupport: supports.length > 0 ? supports[0] : null,
    strongestResistance: resistances.length > 0 ? resistances[0] : null,
  };
}

/**
 * 格式化 OI 显示
 * @param value OI 值
 * @returns 格式化后的字符串
 */
export function formatOI(value: number): string {
  if (value >= 1e6) {
    return `${(value / 1e6).toFixed(2)}M`;
  }
  if (value >= 1e3) {
    return `${(value / 1e3).toFixed(1)}K`;
  }
  return value.toString();
}

/**
 * 获取 OI Wall 状态标签
 * @param wall OI Wall
 * @returns 状态标签
 */
export function getOIWallStatusLabel(wall: OIWall): string {
  if (wall.strength >= 3) {
    return '极强';
  } else if (wall.strength >= 2) {
    return '强';
  } else if (wall.strength >= 1.5) {
    return '中等';
  }
  return '弱';
}

/**
 * 获取 OI Wall 颜色
 * @param type Wall 类型
 * @returns 颜色代码
 */
export function getOIWallColor(type: 'support' | 'resistance'): string {
  return type === 'support' ? '#52c41a' : '#ff4d4f';
}

/**
 * 计算价格到最近 OI Wall 的距离
 * @param currentPrice 当前价格
 * @param walls OI Wall 数组
 * @returns 距离百分比
 */
export function calculateDistanceToOIWall(
  currentPrice: number,
  walls: OIWall[]
): { nearestWall: OIWall | null; distancePercent: number } {
  if (!walls || walls.length === 0) {
    return { nearestWall: null, distancePercent: 0 };
  }

  let minDistance = Infinity;
  let nearestWall: OIWall | null = null;

  for (const wall of walls) {
    const distance = Math.abs(wall.strike - currentPrice);
    if (distance < minDistance) {
      minDistance = distance;
      nearestWall = wall;
    }
  }

  const distancePercent = nearestWall ? (minDistance / currentPrice) * 100 : 0;

  return { nearestWall, distancePercent };
}
