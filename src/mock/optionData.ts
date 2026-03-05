import type { OptionAnalysisData, ExpiryDate } from '../types';

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

export const generateMockMaxPainData = (basePrice: number, oiData: { strike: number; callOI: number; putOI: number }[]): { strike: number; totalPain: number }[] => {
  return oiData.map(({ strike, callOI, putOI }) => {
    let totalPain = 0;
    oiData.forEach(({ strike: s, callOI: c, putOI: p }) => {
      if (s < strike) {
        totalPain += c * (strike - s);
      } else if (s > strike) {
        totalPain += p * (s - strike);
      }
    });
    return { strike, totalPain };
  });
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

Object.keys(mockOptionData).forEach((symbol) => {
  const data = mockOptionData[symbol];
  data.maxPainCurve = generateMockMaxPainData(data.lastPrice, data.oiData);
});

export const getMockOptionData = (symbol: string): OptionAnalysisData => {
  const upperSymbol = symbol.toUpperCase();
  if (mockOptionData[upperSymbol]) {
    return mockOptionData[upperSymbol];
  }

  const basePrice = 500 + Math.random() * 200;
  const oiData = generateMockOIData(basePrice);
  return {
    symbol: upperSymbol,
    lastPrice: basePrice,
    priceChange: (Math.random() - 0.5) * 10,
    priceChangePercent: (Math.random() - 0.5) * 2,
    maxPain: Math.floor(basePrice / 5) * 5,
    gammaExposure: -(20 + Math.random() * 40),
    putCallRatio: 0.8 + Math.random() * 1.5,
    atmIv: 15 + Math.random() * 15,
    skew: 1 + Math.random() * 5,
    hv: 12 + Math.random() * 10,
    vrp: 2 + Math.random() * 5,
    oiData,
    maxPainCurve: generateMockMaxPainData(basePrice, oiData),
    lastUpdated: new Date().toLocaleString('zh-CN'),
  };
};
