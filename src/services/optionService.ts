import type { OptionAnalysisData, ExpiryDate, OIData, MaxPainData } from '../types';
import { getMockOptionData } from '../mock/optionData';
import { getApiConfig } from './configService';
import { generateExpiryDateData, type ExpiryDateInfo } from '../utils/dateUtils';
import { calculateMaxPain } from '../utils/maxPainCalculator';
import { analyzeGEX, formatGEX } from '../utils/gexCalculator';
import { analyzePCR, formatPCR } from '../utils/pcrCalculator';
import { analyzeIV, formatIV, getIVTradingImplications, analyzeVRPStatus } from '../utils/ivCalculator';

// LongPort API 基础路径
const LONGPORT_API_BASE = '/v1';

/**
 * API 返回的期权数据结构
 */
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

/**
 * 获取期权分析数据
 * @param symbol 股票代码
 * @param expiryDate 到期日（可选）
 */
export const fetchOptionAnalysis = async (
  symbol: string,
  expiryDate?: string
): Promise<OptionAnalysisData> => {
  const config = getApiConfig();
  
  if (config.useMock) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return getMockOptionData(symbol, expiryDate);
  }

  // 使用真实 API
  try {
    // 获取期权链数据（根据到期日）
    const chainResult = await fetchOptionChain(symbol, expiryDate);
    
    // 计算各项指标
    const analysisData = calculateOptionMetrics(
      chainResult.options,
      chainResult.underlying,
      chainResult.summary,
      symbol,
      expiryDate
    );
    
    return analysisData;
  } catch (error) {
    console.error('Failed to fetch option analysis:', error);
    throw new Error('获取期权数据失败: ' + (error as Error).message);
  }
};

/**
 * 获取指定股票的期权到期日列表
 */
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

  // 使用 Python 后端获取到期日
  try {
    const response = await fetch(`http://localhost:5000/v1/option/expiry?symbol=${symbol}`, {
      method: 'GET',
      headers: {
        'X-Api-Key': config.appKey,
        'X-Api-Secret': config.appSecret,
        'Authorization': config.accessToken,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API请求失败: ${response.status}`);
    }

    const data = await response.json();
    const expiryDatesList: string[] = data.expiry_dates || [];

    const expiryDates: ExpiryDate[] = expiryDatesList.map((dateStr: string) => {
      const date = new Date(dateStr);
      const today = new Date();
      const daysToExpiry = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      let label = formatShortDate(date);
      if (daysToExpiry === 0) label = '今日ODTE';
      else if (daysToExpiry === 1) label = '明日';
      else if (isThisFriday(date, today)) label = '本周五';
      else if (isNextFriday(date, today)) label = '下周五';
      else if (isMonthlyOPEX(date)) label = '月度OPEX';

      return {
        label,
        date: dateStr,
        daysToExpiry,
      };
    });

    return expiryDates;
  } catch (error) {
    console.error('Failed to fetch expiry dates:', error);
    throw new Error('获取到期日失败: ' + (error as Error).message);
  }
};

/**
 * 获取期权链数据
 * 使用 Python 后端服务 - 重构版
 */
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

  const uri = expiryDate
    ? `http://localhost:5000/v1/option/chain?symbol=${symbol}&expiry_date=${expiryDate}`
    : `http://localhost:5000/v1/option/chain?symbol=${symbol}`;

  const response = await fetch(uri, {
    method: 'GET',
    headers: {
      'X-Api-Key': config.appKey,
      'X-Api-Secret': config.appSecret,
      'Authorization': config.accessToken,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `API请求失败: ${response.status}`);
  }

  const data: ApiChainResponse = await response.json();
  
  console.log('[fetchOptionChain] API 返回数据:', {
    optionsCount: data.options?.length || 0,
    underlying: data.underlying,
    summary: data.summary,
  });
  
  // 打印前3个期权数据用于调试
  if (data.options && data.options.length > 0) {
    console.log('[fetchOptionChain] 前3个期权数据:', data.options.slice(0, 3));
  }

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

/**
 * 获取详细的到期日信息
 */
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

/**
 * 计算期权指标
 * 根据从 Python 后端返回的期权链数据计算各项指标 - 重构版
 */
function calculateOptionMetrics(
  optionChain: ApiOptionData[],
  underlying: ApiUnderlyingData,
  summary: ApiSummaryData,
  symbol: string,
  expiryDate?: string
): OptionAnalysisData {
  // 如果没有数据，返回 Mock 数据
  if (!optionChain || optionChain.length === 0) {
    console.log('[calculateOptionMetrics] No option chain data, using mock data');
    return getMockOptionData(symbol, expiryDate);
  }

  console.log('[calculateOptionMetrics] Processing', optionChain.length, 'option chain items');

  // 转换期权链数据为 OI 数据格式
  const oiData: OIData[] = optionChain.map(item => ({
    strike: item.strike || 0,
    callOI: item.callOI || 0,
    putOI: item.putOI || 0,
  }));
  
  console.log('[calculateOptionMetrics] OI数据 (前5个):', oiData.slice(0, 5));

  // 计算 Max Pain
  const { maxPain, maxPainCurve } = calculateMaxPain(oiData);
  console.log('[calculateOptionMetrics] Max Pain计算结果:', { maxPain, maxPainCurveCount: maxPainCurve.length });
  if (maxPainCurve.length > 0) {
    console.log('[calculateOptionMetrics] Max Pain曲线 (前5个):', maxPainCurve.slice(0, 5));
  }

  // 获取当前价格 - 优先使用从 API 获取的标的资产现价
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

  // 计算价格涨跌幅
  let priceChange = 0;
  let priceChangePercent = 0;
  if (underlying.last_price && underlying.prev_close && underlying.prev_close > 0) {
    priceChange = underlying.last_price - underlying.prev_close;
    priceChangePercent = (priceChange / underlying.prev_close) * 100;
  }

  // 计算 GEX (Gamma Exposure)
  const gexResult = analyzeGEX(oiData, lastPrice);

  // 计算 PCR (Put/Call Ratio)
  const pcrResult = analyzePCR(oiData);

  // 计算 IV 相关指标 - 使用 API 提供的 IV 和 HV 数据
  const ivResult = analyzeIVWithApiData(optionChain, lastPrice, pcrResult.status, summary.avg_historical_volatility);

  // 生成当前时间（美东时间）
  const now = new Date();
  const lastUpdated = now.toLocaleString('zh-CN', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

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
    oiData,
    maxPainCurve,
    lastUpdated,
    gexData: gexResult,
    pcrData: pcrResult,
    ivData: ivResult,
    optionChain,
  };
}

/**
 * 使用 API 数据计算 IV 相关指标
 */
function analyzeIVWithApiData(
  optionChain: ApiOptionData[],
  lastPrice: number,
  pcrStatus: any,
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
    
    const put25Target = lastPrice * 0.93;
    const put25Distance = Math.abs(strike - put25Target) / lastPrice;
    if (put25Distance < minDistancePut25 && opt.putIV > 0) {
      minDistancePut25 = put25Distance;
      put25IV = opt.putIV;
    }
    
    const call25Target = lastPrice * 1.07;
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
  
  let status: 'low' | 'normal' | 'high' | 'extreme' = 'normal';
  let statusLabel = '正常溢价';
  
  if (vrpPercent < 5) {
    status = 'low';
    statusLabel = '低溢价';
  } else if (vrpPercent < 15) {
    status = 'normal';
    statusLabel = '正常溢价';
  } else if (vrpPercent < 30) {
    status = 'high';
    statusLabel = '高溢价';
  } else {
    status = 'extreme';
    statusLabel = '极端溢价';
  }

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
  if (vrpPercent > 20) {
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

/**
 * 格式化短日期
 */
function formatShortDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${month}/${day}`;
}

/**
 * 判断是否为本周五
 */
function isThisFriday(date: Date, today: Date): boolean {
  const dayOfWeek = date.getDay();
  if (dayOfWeek !== 5) return false;
  
  const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays < 7;
}

/**
 * 判断是否为下周五
 */
function isNextFriday(date: Date, today: Date): boolean {
  const dayOfWeek = date.getDay();
  if (dayOfWeek !== 5) return false;
  
  const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays >= 7 && diffDays < 14;
}

/**
 * 判断是否为月度OPEX
 */
function isMonthlyOPEX(date: Date): boolean {
  const dayOfWeek = date.getDay();
  if (dayOfWeek !== 5) return false;
  
  const weekOfMonth = Math.ceil(date.getDate() / 7);
  return weekOfMonth === 3;
}

/**
 * 获取特殊类型
 */
function getSpecialType(label: string): ExpiryDateInfo['specialType'] {
  switch (label) {
    case '今日ODTE': return 'today';
    case '明日': return 'tomorrow';
    case '本周五': return 'thisFriday';
    case '下周五': return 'nextFriday';
    case '月度OPEX': return 'opex';
    default: return 'weekly';
  }
}

/**
 * 测试 API 连接
 * 使用 Python 后端服务
 */
export const testApiConnection = async (): Promise<boolean> => {
  const config = getApiConfig();

  if (config.useMock) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return true;
  }

  try {
    const response = await fetch('http://localhost:5000/test-connection', {
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

    const data = await response.json();
    console.log('[testApiConnection] Response:', data);

    return data.success === true;
  } catch (error) {
    console.error('API connection test failed:', error);
    return false;
  }
};

