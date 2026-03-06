import type { OptionAnalysisData, ExpiryDate, OIData } from '../types';
import { getMockOptionData } from '../mock/optionData';
import { getApiConfig } from './configService';
import { generateExpiryDateData, type ExpiryDateInfo } from '../utils/dateUtils';
import { calculateMaxPain } from '../utils/maxPainCalculator';
import { analyzeGEX } from '../utils/gexCalculator';
import { analyzePCR } from '../utils/pcrCalculator';
import { getIVTradingImplications, analyzeVRPStatus } from '../utils/ivCalculator';
import { envConfig } from '../config/env';

interface ApiOptionData {
  strike: number;
  callOI: number;
  putOI: number;
  callVolume: number;
  putVolume: number;
  callIV: number;
  putIV: number;
  callLastPrice: number;
  putLastPrice: number;
  historicalVolatility: number;
}

interface ApiUnderlyingData {
  last_price: number;
  prev_close: number;
}

interface ApiSummaryData {
  total_call_oi: number;
  total_put_oi: number;
  total_call_volume: number;
  total_put_volume: number;
  avg_historical_volatility: number;
}

interface ApiChainResponse {
  success: boolean;
  symbol: string;
  expiry_date: string;
  underlying: ApiUnderlyingData;
  summary: ApiSummaryData;
  options: ApiOptionData[];
}

const buildApiUrl = (path: string, params: Record<string, string> = {}) => {
  const url = new URL(`${envConfig.PYTHON_BACKEND_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return url.toString();
};

const getAuthHeaders = () => {
  const config = getApiConfig();
  return {
    'X-Api-Key': config.appKey,
    'X-Api-Secret': config.appSecret,
    'Authorization': config.accessToken,
  };
};

const handleApiResponse = async (response: Response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `API请求失败: ${response.status}`);
  }
  return response.json();
};

const formatShortDate = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}/${day}`;
};



const isMonthlyOPEX = (date: Date): boolean => {
  const dayOfWeek = date.getDay();
  if (dayOfWeek !== 5) return false;
  
  const weekOfMonth = Math.ceil(date.getDate() / 7);
  return weekOfMonth === 3;
};

const getSpecialType = (label: string): ExpiryDateInfo['specialType'] => {
  switch (label) {
    case '今日ODTE': return 'today';
    case '明日': return 'tomorrow';
    case '本周五': return 'thisFriday';
    case '下周五': return 'nextFriday';
    case '月度OPEX': return 'opex';
    default: return 'weekly';
  }
};

const getExpiryLabel = (date: Date, daysToExpiry: number): string => {
  const dayOfWeek = date.getDay();
  const isFriday = dayOfWeek === 5;
  
  if (daysToExpiry === 0) return '今日ODTE';
  if (daysToExpiry === 1) return '明日';
  if (isMonthlyOPEX(date)) return '月度OPEX';
  
  if (isFriday) {
    if (daysToExpiry >= 2 && daysToExpiry < 7) return '本周五';
    if (daysToExpiry >= 7 && daysToExpiry < 14) return '下周五';
    return formatShortDate(date);
  }
  
  return formatShortDate(date);
};

const getCurrentEasternTime = (): string => {
  const now = new Date();
  return now.toLocaleString('zh-CN', {
    timeZone: envConfig.TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const fetchOptionAnalysis = async (
  symbol: string,
  expiryDate?: string
): Promise<OptionAnalysisData> => {
  const config = getApiConfig();
  
  if (config.useMock) {
    await new Promise((resolve) => setTimeout(resolve, envConfig.MOCK_DELAY_MS));
    return getMockOptionData(symbol, expiryDate);
  }

  try {
    const chainResult = await fetchOptionChain(symbol, expiryDate);
    return calculateOptionMetrics(
      chainResult.options,
      chainResult.underlying,
      chainResult.summary,
      symbol,
      expiryDate
    );
  } catch (error) {
    console.error('Failed to fetch option analysis:', error);
    throw new Error('获取期权数据失败: ' + (error as Error).message);
  }
};

export const fetchExpiryDates = async (symbol: string): Promise<ExpiryDate[]> => {
  const config = getApiConfig();
  
  if (config.useMock) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const expiryDateData = generateExpiryDateData(symbol, new Date(), 45);
    return expiryDateData.map(item => ({
      label: item.label,
      date: item.date,
      daysToExpiry: item.daysToExpiry,
    }));
  }

  try {
    const response = await fetch(buildApiUrl('/v1/option/expiry', { symbol }), {
      method: 'GET',
      headers: getAuthHeaders(),
    });

    const data = await handleApiResponse(response);
    const expiryDatesList: string[] = data.expiry_dates || [];
    const today = new Date();

    return expiryDatesList.map((dateStr: string) => {
      const date = new Date(dateStr);
      const daysToExpiry = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      const label = getExpiryLabel(date, daysToExpiry);

      return {
        label,
        date: dateStr,
        daysToExpiry,
      };
    });
  } catch (error) {
    console.error('Failed to fetch expiry dates:', error);
    throw new Error('获取到期日失败: ' + (error as Error).message);
  }
};

export const fetchOptionChain = async (
  symbol: string,
  expiryDate?: string
): Promise<{
  options: ApiOptionData[];
  underlying: ApiUnderlyingData;
  summary: ApiSummaryData;
}> => {
  const config = getApiConfig();

  if (config.useMock) {
    return {
      options: [],
      underlying: { last_price: 500, prev_close: 500 },
      summary: {
        total_call_oi: 0,
        total_put_oi: 0,
        total_call_volume: 0,
        total_put_volume: 0,
        avg_historical_volatility: 0,
      }
    };
  }

  const params: Record<string, string> = { symbol };
  if (expiryDate) params.expiry_date = expiryDate;

  const response = await fetch(buildApiUrl('/v1/option/chain', params), {
    method: 'GET',
    headers: getAuthHeaders(),
  });

  const data: ApiChainResponse = await handleApiResponse(response);
  
  console.log('[fetchOptionChain] API 返回数据:', {
    optionsCount: data.options?.length || 0,
    underlying: data.underlying,
    summary: data.summary,
  });

  return {
    options: data.options || [],
    underlying: data.underlying || { last_price: 0, prev_close: 0 },
    summary: data.summary || {
      total_call_oi: 0,
      total_put_oi: 0,
      total_call_volume: 0,
      total_put_volume: 0,
      avg_historical_volatility: 0,
    }
  };
};

export const fetchExpiryDatesWithInfo = async (symbol: string): Promise<ExpiryDateInfo[]> => {
  const config = getApiConfig();
  
  if (config.useMock) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return generateExpiryDateData(symbol, new Date(), 45);
  }

  const dates = await fetchExpiryDates(symbol);
  
  return dates.map(date => ({
    label: date.label,
    date: date.date,
    daysToExpiry: date.daysToExpiry,
    isSpecial: ['今日ODTE', '明日', '本周五', '下周五', '月度OPEX'].includes(date.label),
    specialType: getSpecialType(date.label),
  }));
};

function calculateOptionMetrics(
  optionChain: ApiOptionData[],
  underlying: ApiUnderlyingData,
  summary: ApiSummaryData,
  symbol: string,
  expiryDate?: string
): OptionAnalysisData {
  if (!optionChain || optionChain.length === 0) {
    console.log('[calculateOptionMetrics] No option chain data, using mock data');
    return getMockOptionData(symbol, expiryDate);
  }

  console.log('[calculateOptionMetrics] Processing', optionChain.length, 'option chain items');

  const oiData: OIData[] = optionChain.map(item => ({
    strike: item.strike || 0,
    callOI: item.callOI || 0,
    putOI: item.putOI || 0,
  }));
  
  const { maxPain, maxPainCurve } = calculateMaxPain(oiData);
  console.log('[calculateOptionMetrics] Max Pain计算结果:', { maxPain, maxPainCurveCount: maxPainCurve.length });

  let lastPrice = underlying.last_price;
  if (!lastPrice || lastPrice <= 0) {
    lastPrice = maxPain || 500;
    if (optionChain.length > 0) {
      const sortedStrikes = [...optionChain].sort((a, b) => (a.strike || 0) - (b.strike || 0));
      const middleIndex = Math.floor(sortedStrikes.length / 2);
      lastPrice = sortedStrikes[middleIndex].strike || lastPrice;
    }
    console.log('[calculateOptionMetrics] 使用计算得到的现价:', lastPrice);
  } else {
    console.log('[calculateOptionMetrics] 使用从 API 获取的标的资产现价:', lastPrice);
  }

  let priceChange = 0;
  let priceChangePercent = 0;
  if (underlying.last_price && underlying.prev_close && underlying.prev_close > 0) {
    priceChange = underlying.last_price - underlying.prev_close;
    priceChangePercent = (priceChange / underlying.prev_close) * 100;
  }

  const gexResult = analyzeGEX(oiData, lastPrice);
  const pcrResult = analyzePCR(oiData);
  const ivResult = analyzeIVWithApiData(optionChain, lastPrice, pcrResult.status, summary.avg_historical_volatility);
  const lastUpdated = getCurrentEasternTime();

  return {
    symbol: symbol.toUpperCase(),
    lastPrice,
    priceChange,
    priceChangePercent,
    maxPain,
    gammaExposure: gexResult.totalGEX,
    putCallRatio: pcrResult.pcrOI,
    atmIv: ivResult.atmIV,
    skew: ivResult.putSkew,
    hv: ivResult.hv,
    vrp: ivResult.vrpPercent,
    ivPercentile: 50,
    oiData,
    maxPainCurve,
    lastUpdated,
    gexData: gexResult,
    pcrData: pcrResult,
    ivData: ivResult,
    optionChain,
  };
}

function analyzeIVWithApiData(
  optionChain: ApiOptionData[],
  lastPrice: number,
  pcrStatus: 'extreme_bearish' | 'bearish' | 'neutral' | 'bullish' | 'extreme_bullish' | undefined,
  avgHV: number
) {
  console.log('[analyzeIVWithApiData] 开始分析', {
    optionChainCount: optionChain.length,
    lastPrice,
    avgHV,
  });

  if (optionChain.length === 0) {
    console.log('[analyzeIVWithApiData] 无期权链数据');
    return {
      atmIV: 0,
      hv: avgHV,
      vrp: 0,
      vrpPercent: 0,
      callSkew: 0,
      putSkew: 0,
      skew25Delta: 0,
      put25IV: 0,
      call25IV: 0,
      status: 'normal' as const,
      statusLabel: '正常溢价',
      description: '暂无数据',
      tradingImplications: [],
      riskWarnings: [],
    };
  }

  let atmIV = 0;
  let put25IV = 0;
  let call25IV = 0;
  let minDistanceATM = Infinity;
  let minDistancePut25 = Infinity;
  let minDistanceCall25 = Infinity;

  for (const opt of optionChain) {
    const strike = opt.strike;
    
    if (!lastPrice || lastPrice <= 0) {
      const avgIV = (opt.callIV + opt.putIV) / 2;
      if (avgIV > 0) {
        atmIV = Math.max(atmIV, avgIV);
      }
      if (opt.putIV > 0) put25IV = Math.max(put25IV, opt.putIV);
      if (opt.callIV > 0) call25IV = Math.max(call25IV, opt.callIV);
      continue;
    }

    const distance = Math.abs(strike - lastPrice) / lastPrice;
    
    if (distance < minDistanceATM) {
      minDistanceATM = distance;
      const avgIV = (opt.callIV + opt.putIV) / 2;
      if (avgIV > 0) {
        atmIV = avgIV;
      } else if (opt.callIV > 0) {
        atmIV = opt.callIV;
      } else if (opt.putIV > 0) {
        atmIV = opt.putIV;
      }
    }
    
    const put25Target = lastPrice * envConfig.IV_PUT_TARGET_FACTOR;
    const put25Distance = Math.abs(strike - put25Target) / lastPrice;
    if (put25Distance < minDistancePut25 && opt.putIV > 0) {
      minDistancePut25 = put25Distance;
      put25IV = opt.putIV;
    }
    
    const call25Target = lastPrice * envConfig.IV_CALL_TARGET_FACTOR;
    const call25Distance = Math.abs(strike - call25Target) / lastPrice;
    if (call25Distance < minDistanceCall25 && opt.callIV > 0) {
      minDistanceCall25 = call25Distance;
      call25IV = opt.callIV;
    }
  }

  if (atmIV === 0) {
    const validIVs = optionChain
      .flatMap(opt => [opt.callIV, opt.putIV])
      .filter(iv => iv > 0);
    if (validIVs.length > 0) {
      atmIV = validIVs.reduce((a, b) => a + b, 0) / validIVs.length;
      console.log('[analyzeIVWithApiData] 使用平均IV作为ATM IV:', atmIV);
    }
  }

  if (put25IV === 0) {
    const validPutIVs = optionChain.map(opt => opt.putIV).filter(iv => iv > 0);
    if (validPutIVs.length > 0) {
      put25IV = validPutIVs[Math.floor(validPutIVs.length / 2)] || validPutIVs[0];
    }
  }

  if (call25IV === 0) {
    const validCallIVs = optionChain.map(opt => opt.callIV).filter(iv => iv > 0);
    if (validCallIVs.length > 0) {
      call25IV = validCallIVs[Math.floor(validCallIVs.length / 2)] || validCallIVs[0];
    }
  }

  const hv = avgHV > 0 ? avgHV : (atmIV > 0 ? atmIV * 0.75 : 0.15);
  const vrp = atmIV - hv;
  const vrpPercent = hv > 0 ? (vrp / hv) * 100 : 0;
  const skew25Delta = put25IV > 0 && call25IV > 0 ? put25IV - call25IV : 0;

  console.log('[analyzeIVWithApiData] 分析结果:', {
    atmIV,
    put25IV,
    call25IV,
    hv,
    vrp,
    vrpPercent,
    skew25Delta,
  });

  const vrpStatusInfo = analyzeVRPStatus(vrpPercent);
  const tradingImplications = getIVTradingImplications(vrpStatusInfo.status, pcrStatus);
  const riskWarnings: string[] = [];
  
  if (vrpStatusInfo.status === 'extreme') {
    riskWarnings.push('极端高溢价，波动率可能进一步上行');
  }
  if (vrpPercent > envConfig.VRP_WARNING_THRESHOLD) {
    riskWarnings.push('VRP过高，注意波动率回归风险');
  }

  return {
    atmIV,
    hv,
    vrp,
    vrpPercent,
    callSkew: call25IV > 0 && atmIV > 0 ? (call25IV - atmIV) / atmIV * 100 : 0,
    putSkew: skew25Delta,
    skew25Delta,
    put25IV,
    call25IV,
    status: vrpStatusInfo.status,
    statusLabel: vrpStatusInfo.statusLabel,
    description: vrpStatusInfo.description,
    tradingImplications,
    riskWarnings,
  };
}

export const testApiConnection = async (): Promise<boolean> => {
  const config = getApiConfig();

  if (config.useMock) {
    await new Promise((resolve) => setTimeout(resolve, envConfig.MOCK_DELAY_MS));
    return true;
  }

  try {
    const response = await fetch(buildApiUrl('/test-connection'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        appKey: config.appKey,
        appSecret: config.appSecret,
        accessToken: config.accessToken,
      }),
    });

    const data = await handleApiResponse(response);
    console.log('[testApiConnection] Response:', data);

    return data.success === true;
  } catch (error) {
    console.error('API connection test failed:', error);
    return false;
  }
};
