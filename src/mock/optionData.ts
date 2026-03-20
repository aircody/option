import type { OptionAnalysisData, ExpiryDate } from '../types';
import { calculateMaxPain } from '../utils/maxPainCalculator';

export const mockExpiryDates: ExpiryDate[] = [
  { label: '今日ODTE', date: '2026-03-05', daysToExpiry: 0 },
  { label: '明日', date: '2026-03-06', daysToExpiry: 1 },
  { label: '本周五', date: '2026-03-06', daysToExpiry: 1 },
  { label: '下周五', date: '2026-03-13', daysToExpiry: 8 },
  { label: '月度OPEX', date: '2026-03-21', daysToExpiry: 16 },
  { label: '全部≤45D', date: '2026-04-17', daysToExpiry: 43 },
];

export const generateMockOIData = (basePrice: number): { strike: number; callOI: number; putOI: number }[] => {
  const data: { strike: number; callOI: number; putOI: number }[] = [];
  const startStrike = Math.floor(basePrice * 0.85 / 5) * 5;
  const endStrike = Math.floor(basePrice * 1.15 / 5) * 5;

  for (let strike = startStrike; strike <= endStrike; strike += 5) {
    const distanceFromBase = Math.abs(strike - basePrice);
    const maxOIDistance = basePrice * 0.15;
    const oiIntensity = Math.max(0, 1 - distanceFromBase / maxOIDistance);

    // 在ATM附近，Call和Put的OI都较高
    // 在OTM Call区域，Call OI较高
    // 在OTM Put区域，Put OI较高
    const callOI = strike > basePrice
      ? Math.floor(50000 * oiIntensity * (0.5 + Math.random() * 0.5))
      : Math.floor(15000 * oiIntensity * Math.random());

    const putOI = strike < basePrice
      ? Math.floor(50000 * oiIntensity * (0.5 + Math.random() * 0.5))
      : Math.floor(15000 * oiIntensity * Math.random());

    data.push({
      strike,
      callOI: Math.max(1000, callOI),
      putOI: Math.max(1000, putOI),
    });
  }

  return data;
};

/**
 * 使用新的 Max Pain 计算逻辑生成数据
 */
export const generateMockMaxPainData = (_basePrice: number, oiData: { strike: number; callOI: number; putOI: number }[]): { strike: number; totalPain: number }[] => {
  // 使用新的 Max Pain 计算工具
  const { maxPainCurve } = calculateMaxPain(oiData);
  return maxPainCurve;
};

export const mockOptionData: Record<string, OptionAnalysisData> = {
  QQQ: {
    symbol: 'QQQ',
    lastPrice: 610.75,
    priceChange: 5.12,
    priceChangePercent: 0.84,
    maxPain: 606,
    gammaExposure: -42.13,
    putCallRatio: 1.755,
    atmIv: 24.83,
    skew: 3.70,
    hv: 18.80,
    vrp: 6.03,
    oiData: generateMockOIData(610),
    maxPainCurve: [],
    lastUpdated: '2026-03-05 11:58:24',
  },
  SPY: {
    symbol: 'SPY',
    lastPrice: 589.32,
    priceChange: 3.45,
    priceChangePercent: 0.59,
    maxPain: 585,
    gammaExposure: -38.25,
    putCallRatio: 1.423,
    atmIv: 18.56,
    skew: 2.85,
    hv: 15.20,
    vrp: 3.36,
    oiData: generateMockOIData(589),
    maxPainCurve: [],
    lastUpdated: '2026-03-05 11:58:24',
  },
  IWM: {
    symbol: 'IWM',
    lastPrice: 225.18,
    priceChange: 1.23,
    priceChangePercent: 0.55,
    maxPain: 222,
    gammaExposure: -15.67,
    putCallRatio: 1.892,
    atmIv: 22.15,
    skew: 4.12,
    hv: 19.50,
    vrp: 2.65,
    oiData: generateMockOIData(225),
    maxPainCurve: [],
    lastUpdated: '2026-03-05 11:58:24',
  },
};

// 初始化时使用新的 Max Pain 计算
Object.keys(mockOptionData).forEach((symbol) => {
  const data = mockOptionData[symbol];
  const { maxPain, maxPainCurve } = calculateMaxPain(data.oiData);
  data.maxPain = maxPain;
  data.maxPainCurve = maxPainCurve;
});

export const getMockOptionData = (symbol: string, expiryDate?: string): OptionAnalysisData => {
  const upperSymbol = symbol.toUpperCase();
  
  // 根据到期日生成不同的数据（模拟不同到期日的合约数量不同）
  const getExpiryMultiplier = (date?: string): number => {
    if (!date) return 1;
    // 近期到期日合约数量较少，远期较多
    const today = new Date();
    const expiry = new Date(date);
    const daysDiff = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff <= 1) return 0.6; // 0-1 DTE
    if (daysDiff <= 7) return 0.8; // 本周
    if (daysDiff <= 14) return 1.0; // 下周
    if (daysDiff <= 30) return 1.2; // 月度
    return 1.5; // 远期
  };
  
  const multiplier = getExpiryMultiplier(expiryDate);
  
  if (mockOptionData[upperSymbol]) {
    const data = { ...mockOptionData[upperSymbol] };
    // 根据到期日调整合约数量
    const targetLength = Math.floor(data.oiData.length * multiplier);
    // 截取中间部分来模拟不同到期日的不同执行价范围
    const startIdx = Math.floor((data.oiData.length - targetLength) / 2);
    data.oiData = data.oiData.slice(startIdx, startIdx + targetLength);
    
    // 使用新的 Max Pain 计算
    const { maxPain, maxPainCurve } = calculateMaxPain(data.oiData);
    data.maxPain = maxPain;
    data.maxPainCurve = maxPainCurve;
    
    return data;
  }

  const basePrice = 500 + Math.random() * 200;
  const oiData = generateMockOIData(basePrice);
  // 根据到期日调整合约数量
  const targetLength = Math.floor(oiData.length * multiplier);
  const startIdx = Math.floor((oiData.length - targetLength) / 2);
  const adjustedOiData = oiData.slice(startIdx, startIdx + targetLength);
  
  // 使用新的 Max Pain 计算
  const { maxPain, maxPainCurve } = calculateMaxPain(adjustedOiData);
  
  return {
    symbol: upperSymbol,
    lastPrice: basePrice,
    priceChange: (Math.random() - 0.5) * 10,
    priceChangePercent: (Math.random() - 0.5) * 2,
    maxPain,
    gammaExposure: -(20 + Math.random() * 40),
    putCallRatio: 0.8 + Math.random() * 1.5,
    atmIv: 15 + Math.random() * 15,
    skew: 1 + Math.random() * 5,
    hv: 12 + Math.random() * 10,
    vrp: 2 + Math.random() * 5,
    oiData: adjustedOiData,
    maxPainCurve,
    lastUpdated: new Date().toLocaleString('zh-CN'),
  };
};
