import type { OptionAnalysisData, ExpiryDate } from '../types';
import { getMockOptionData } from '../mock/optionData';
import { getApiConfig } from './configService';
import { generateExpiryDateData, type ExpiryDateInfo } from '../utils/dateUtils';
import { longportRequest } from '../utils/longportAuth';

// LongPort API 基础路径
const LONGPORT_API_BASE = '/v1';

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
    // 如果指定了到期日，可以在这里根据到期日生成不同的Mock数据
    return getMockOptionData(symbol, expiryDate);
  }

  // 使用真实 API
  try {
    // 获取期权链数据（根据到期日）
    const optionChain = await fetchOptionChain(symbol, expiryDate);
    
    // 计算各项指标
    const analysisData = calculateOptionMetrics(optionChain, symbol, expiryDate);
    
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
    
    // 使用动态生成的到期日数据
    const expiryDateData = generateExpiryDateData(symbol, new Date(), 45);
    
    // 转换为组件需要的格式
    return expiryDateData.map(item => ({
      label: item.label,
      date: item.date,
      daysToExpiry: item.daysToExpiry,
    }));
  }

  // 使用真实 API
  try {
    const response = await longportRequest<{
      expiry_dates: string[];
    }>(
      config.baseUrl,
      config.appKey,
      config.appSecret,
      config.accessToken,
      'GET',
      `${LONGPORT_API_BASE}/option/expiry?symbol=${symbol}`
    );
    
    // 转换 API 返回的数据
    const expiryDates: ExpiryDate[] = response.expiry_dates.map((dateStr: string) => {
      const date = new Date(dateStr);
      const today = new Date();
      const daysToExpiry = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      // 生成标签
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
 */
export const fetchOptionChain = async (
  symbol: string, 
  expiryDate?: string
): Promise<any[]> => {
  const config = getApiConfig();
  
  if (config.useMock) {
    // Mock 数据返回
    return [];
  }
  
  const uri = expiryDate 
    ? `${LONGPORT_API_BASE}/option/chain?symbol=${symbol}&expiry_date=${expiryDate}`
    : `${LONGPORT_API_BASE}/option/chain?symbol=${symbol}`;
  
  const response = await longportRequest<{
    options: any[];
  }>(
    config.baseUrl,
    config.appKey,
    config.appSecret,
    config.accessToken,
    'GET',
    uri
  );
  
  return response.options || [];
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
  
  // 转换为 ExpiryDateInfo 格式
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
 */
function calculateOptionMetrics(
  optionChain: any[],
  symbol: string,
  expiryDate?: string
): OptionAnalysisData {
  // TODO: 根据真实期权链数据计算各项指标
  // 这里使用 Mock 数据作为示例
  return getMockOptionData(symbol, expiryDate);
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
 */
export const testApiConnection = async (): Promise<boolean> => {
  const config = getApiConfig();
  
  if (config.useMock) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return true;
  }
  
  try {
    // 尝试获取账户信息来测试连接
    await longportRequest(
      config.baseUrl,
      config.appKey,
      config.appSecret,
      config.accessToken,
      'GET',
      `${LONGPORT_API_BASE}/account/info`
    );
    return true;
  } catch (error) {
    console.error('API connection test failed:', error);
    return false;
  }
};
