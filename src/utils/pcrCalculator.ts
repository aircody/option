/**
 * Put/Call Ratio (PCR) 计算工具
 * 
 * PCR = Put 成交量(OI) / Call 成交量(OI)
 * 
 * 是期权市场的经典情绪指标，通过统计看跌期权与看涨期权的比值，量化市场多空情绪倾向。
 */

export interface PCRData {
  strike: number;
  putOI: number;
  callOI: number;
  putVolume: number;
  callVolume: number;
  pcrOI: number;      // 基于OI的PCR
  pcrVolume: number;  // 基于成交量的PCR
}

export interface PCRAnalysisResult {
  totalPutOI: number;
        totalCallOI: number;
  pcrOI: number;           // 基于未平仓合约的PCR
  pcrVolume: number;       // 基于成交量的PCR
  status: 'extreme_bullish' | 'bullish' | 'neutral' | 'bearish' | 'extreme_bearish';
  statusLabel: string;
  description: string;
  tradingImplications: string[];
  riskWarnings: string[];
}

/**
 * PCR 区间定义
 */
const PCR_ZONES = {
  extreme_bullish: { max: 0.8, label: '极度乐观', color: '#ff4d4f', signal: '反向看空' },
  bullish: { min: 0.8, max: 1.0, label: '乐观', color: '#ff7875', signal: '谨慎看空' },
  neutral: { min: 1.0, max: 1.2, label: '中性', color: '#faad14', signal: '观望/均衡' },
  bearish: { min: 1.2, max: 1.5, label: '偏悲观', color: '#73d13d', signal: '谨慎看多' },
  extreme_bearish: { min: 1.5, label: '极度悲观', color: '#52c41a', signal: '反向强看多' },
};

/**
 * 计算 Put/Call Ratio
 */
export function calculatePCR(
  oiData: { strike: number; callOI: number; putOI: number }[],
  volumeData?: { strike: number; callVolume: number; putVolume: number }[]
): PCRData[] {
  const pcrData: PCRData[] = [];

  for (let i = 0; i < oiData.length; i++) {
    const oi = oiData[i];
    const vol = volumeData?.[i];

    const putOI = oi.putOI;
    const callOI = oi.callOI;
    const putVolume = vol?.putVolume || putOI * 0.3; // 如果没有成交量数据，用OI的30%估算
    const callVolume = vol?.callVolume || callOI * 0.3;

    pcrData.push({
      strike: oi.strike,
      putOI,
      callOI,
      putVolume,
      callVolume,
      pcrOI: callOI > 0 ? putOI / callOI : 0,
      pcrVolume: callVolume > 0 ? putVolume / callVolume : 0,
    });
  }

  return pcrData;
}

/**
 * 分析 PCR 状态
 */
export function analyzePCR(pcrData: PCRData[]): PCRAnalysisResult {
  const totalPutOI = pcrData.reduce((sum, d) => sum + d.putOI, 0);
  const totalCallOI = pcrData.reduce((sum, d) => sum + d.callOI, 0);
  const totalPutVolume = pcrData.reduce((sum, d) => sum + d.putVolume, 0);
  const totalCallVolume = pcrData.reduce((sum, d) => sum + d.callVolume, 0);

  const pcrOI = totalCallOI > 0 ? totalPutOI / totalCallOI : 0;
  const pcrVolume = totalCallVolume > 0 ? totalPutVolume / totalCallVolume : 0;

  // 确定状态（主要基于OI的PCR）
  let status: PCRAnalysisResult['status'];
  let statusLabel: string;
  let description: string;
  let tradingImplications: string[];
  let riskWarnings: string[];

  if (pcrOI < 0.8) {
    status = 'extreme_bullish';
    statusLabel = '极度乐观';
    description = '市场看涨情绪达到极致过热状态，需警惕高位回调风险';
    tradingImplications = [
      '反向看空信号：极端乐观往往是情绪超调，并非真实基本面改善',
      '当看涨情绪达到极致，市场通常处于顶部区域',
      '考虑配置看跌期权或做空指数ETF进行对冲',
      '回避追高行为，等待回调后再入场',
    ];
    riskWarnings = [
      '情绪可能持续发酵，短期仍有上涨空间',
      '需结合VIX、Gamma Exposure等指标综合判断',
      '严格设置止损，避免情绪持续乐观导致的踏空',
    ];
  } else if (pcrOI < 1.0) {
    status = 'bullish';
    statusLabel = '乐观';
    description = '市场看涨情绪较强，但尚未达到极端水平';
    tradingImplications = [
      '谨慎看多，但需警惕情绪转向',
      '可继续持有现有仓位',
      '关注PCR是否向中性区间移动',
    ];
    riskWarnings = [
      '情绪可能快速转向',
      '关注关键阻力位的突破情况',
    ];
  } else if (pcrOI < 1.2) {
    status = 'neutral';
    statusLabel = '中性';
    description = '市场多空情绪均衡，方向不明朗';
    tradingImplications = [
      '观望或采用均衡策略',
      '等待明确的突破信号',
      '可采用区间交易策略',
    ];
    riskWarnings = [
      '市场可能随时选择方向',
      '控制仓位，避免方向性押注',
    ];
  } else if (pcrOI < 1.5) {
    status = 'bearish';
    statusLabel = '偏悲观';
    description = '市场看跌情绪较强，但尚未达到极端水平';
    tradingImplications = [
      '谨慎看多，寻找底部机会',
      '关注支撑位的有效性',
      '可小仓位试探性做多',
    ];
    riskWarnings = [
      '情绪可能继续恶化',
      '严格止损，避免深套',
    ];
  } else {
    status = 'extreme_bearish';
    statusLabel = '极度悲观';
    description = '市场看跌情绪达到极致过热状态，是典型的"情绪见底"信号';
    tradingImplications = [
      '反向强看多信号：极端看跌往往是情绪超调，并非真实基本面恶化',
      '当看跌情绪达到极致，市场通常处于底部区域',
      '配置宽基指数看涨期权（SPY、QQQ）或做多指数ETF',
      '回避基本面无问题的超跌标的，禁止盲目做空',
      '此时反向操作的胜率极高',
    ];
    riskWarnings = [
      '情绪可能持续恶化，短期仍有下跌空间',
      '需结合VIX、Gamma Exposure等指标综合判断',
      '负Gamma环境下波动剧烈，需控制仓位（建议50%以下）',
      '设定严格止损，避免极端情绪持续恶化导致的短期回撤',
    ];
  }

  return {
    totalPutOI,
    totalCallOI,
    pcrOI,
    pcrVolume,
    status,
    statusLabel,
    description,
    tradingImplications,
    riskWarnings,
  };
}

/**
 * 获取 PCR 区间信息
 */
export function getPCRZoneInfo(pcr: number): {
  zone: string;
  color: string;
  signal: string;
} {
  if (pcr < 0.8) {
    return { zone: '极度乐观', color: '#ff4d4f', signal: '反向看空' };
  } else if (pcr < 1.0) {
    return { zone: '乐观', color: '#ff7875', signal: '谨慎看空' };
  } else if (pcr < 1.2) {
    return { zone: '中性', color: '#faad14', signal: '观望/均衡' };
  } else if (pcr < 1.5) {
    return { zone: '偏悲观', color: '#73d13d', signal: '谨慎看多' };
  } else {
    return { zone: '极度悲观', color: '#52c41a', signal: '反向强看多' };
  }
}

/**
 * 格式化PCR显示
 */
export function formatPCR(value: number): string {
  return value.toFixed(3);
}

/**
 * 计算加权PCR（按OI加权）
 */
export function calculateWeightedPCR(pcrData: PCRData[]): number {
  let totalWeight = 0;
  let weightedSum = 0;

  for (const data of pcrData) {
    const weight = data.putOI + data.callOI;
    totalWeight += weight;
    weightedSum += data.pcrOI * weight;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}
