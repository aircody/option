/**
 * 价格范围计算工具
 * 
 * 根据现价、波动率和到期时间计算合理的价格显示范围
 */

import type { OIData } from '../types';

/**
 * 计算合理的价格显示范围
 * @param currentPrice 现价
 * @param iv 隐含波动率（小数，如 0.25 表示 25%）
 * @param daysToExpiry 距离到期天数
 * @param stdDeviations 标准差倍数（默认 3，覆盖 99.7% 的概率）
 * @returns 价格范围 { minPrice, maxPrice }
 */
export function calculatePriceRange(
  currentPrice: number,
  iv: number = 0.3,
  daysToExpiry: number = 30,
  stdDeviations: number = 3
): { minPrice: number; maxPrice: number } {
  if (!currentPrice || currentPrice <= 0) {
    return { minPrice: 0, maxPrice: 0 };
  }

  // 确保波动率为正数
  const volatility = Math.max(iv, 0.01);

  // 计算年化波动率的时间调整
  const timeInYears = daysToExpiry / 365;
  const volatilityAdjustment = volatility * Math.sqrt(timeInYears);

  // 计算价格范围
  const minPrice = currentPrice * Math.exp(-stdDeviations * volatilityAdjustment);
  const maxPrice = currentPrice * Math.exp(stdDeviations * volatilityAdjustment);

  return {
    minPrice: Math.floor(minPrice),
    maxPrice: Math.ceil(maxPrice)
  };
}

/**
 * 过滤行权价，只保留在合理范围内的
 * @param data 完整的行权价数据
 * @param currentPrice 现价
 * @param iv 隐含波动率
 * @param daysToExpiry 距离到期天数
 * @returns 过滤后的行权价数据
 */
export function filterStrikesByPriceRange(
  data: OIData[],
  currentPrice: number,
  iv: number = 0.3,
  daysToExpiry: number = 30
): OIData[] {
  if (!data || data.length === 0 || !currentPrice) {
    return data;
  }

  const { minPrice, maxPrice } = calculatePriceRange(currentPrice, iv, daysToExpiry);

  console.log('[filterStrikesByPriceRange] 价格范围:', {
    currentPrice,
    minPrice,
    maxPrice,
    iv,
    daysToExpiry
  });

  // 过滤行权价
  const filteredData = data.filter(item => 
    item.strike >= minPrice && item.strike <= maxPrice
  );

  console.log('[filterStrikesByPriceRange] 过滤结果:', {
    originalCount: data.length,
    filteredCount: filteredData.length
  });

  return filteredData;
}


