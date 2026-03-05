/**
 * SKEW (25Δ Risk Reversal) 计算工具
 * 
 * SKEW = 25Δ Put IV - 25Δ Call IV
 * 
 * 是衡量期权市场对尾部风险（尤其是下行风险）定价的关键指标，
 * 反映市场对下行和上行尾部风险的定价倾斜。
 */

export interface SkewData {
  strike: number;
  delta: number;        // 期权的Delta值
  callIV: number;
  putIV: number;
  callSkew: number;     // 相对于ATM的Call IV偏度
  putSkew: number;      // 相对于ATM的Put IV偏度
}

export interface SkewAnalysisResult {
  skew25Delta: number;      // 25Δ Risk Reversal值
  skewPercent: number;      // SKEW百分比
  atmIV: number;            // ATM IV
  put25IV: number;          // 25Δ Put IV
  call25IV: number;         // 25Δ Call IV
  status: 'extreme_down' | 'down' | 'normal' | 'up' | 'extreme_up';
  statusLabel: string;
  description: string;
  tradingImplications: string[];
  riskWarnings: string[];
}

/**
 * 估算期权的Delta值
 * 简化模型：ATM期权Delta≈0.5，远离ATM时Delta递减
 */
function estimateDelta(strike: number, underlyingPrice: number, isCall: boolean): number {
  const distance = strike - underlyingPrice;
  const distancePercent = distance / underlyingPrice;
  
  if (isCall) {
    // Call Delta: ATM≈0.5，深度ITM→1，深度OTM→0
    if (distancePercent < -0.15) return 0.10;  // 深度OTM
    if (distancePercent < -0.08) return 0.25;  // 25Δ
    if (distancePercent < -0.03) return 0.40;  // 近OTM
    if (distancePercent <= 0.03) return 0.50;  // ATM
    if (distancePercent <= 0.08) return 0.60;  // 近ITM
    if (distancePercent <= 0.15) return 0.75;  // 25Δ ITM
    return 0.90;  // 深度ITM
  } else {
    // Put Delta: ATM≈-0.5，深度ITM→-1，深度OTM→0
    if (distancePercent > 0.15) return -0.10;  // 深度OTM
    if (distancePercent > 0.08) return -0.25;  // 25Δ
    if (distancePercent > 0.03) return -0.40;  // 近OTM
    if (distancePercent >= -0.03) return -0.50; // ATM
    if (distancePercent >= -0.08) return -0.60; // 近ITM
    if (distancePercent >= -0.15) return -0.75; // 25Δ ITM
    return -0.90;  // 深度ITM
  }
}

/**
 * 计算SKEW数据
 */
export function calculateSkewData(
  oiData: { strike: number; callOI: number; putOI: number }[],
  underlyingPrice: number,
  atmIV: number
): SkewData[] {
  const skewData: SkewData[] = [];
  
  for (const data of oiData) {
    const callDelta = estimateDelta(data.strike, underlyingPrice, true);
    const putDelta = estimateDelta(data.strike, underlyingPrice, false);
    
    // 估算IV（基于距离ATM的远近）
    const distance = Math.abs(data.strike - underlyingPrice);
    const atmDistance = underlyingPrice * 0.1;
    
    let ivAdjustment = 0;
    if (distance < atmDistance * 0.1) {
      ivAdjustment = 0;
    } else if (distance < atmDistance * 0.3) {
      ivAdjustment = 0.02;
    } else if (distance < atmDistance * 0.6) {
      ivAdjustment = 0.04;
    } else {
      ivAdjustment = 0.06;
    }
    
    // Put通常有更高的IV（下行保护需求）
    const callIV = atmIV + ivAdjustment;
    const putIV = atmIV + ivAdjustment + 0.02;
    
    skewData.push({
      strike: data.strike,
      delta: Math.abs(callDelta), // 使用绝对值
      callIV,
      putIV,
      callSkew: callIV - atmIV,
      putSkew: putIV - atmIV,
    });
  }
  
  return skewData;
}

/**
 * 找到最接近25Δ的IV
 */
export function find25DeltaIV(skewData: SkewData[]): { callIV: number; putIV: number } {
  // 找到delta最接近0.25的Call和Put
  const call25 = skewData.reduce((closest, current) => {
    const currentDiff = Math.abs(current.delta - 0.25);
    const closestDiff = Math.abs(closest.delta - 0.25);
    return currentDiff < closestDiff && current.callIV > current.putIV ? current : closest;
  });
  
  const put25 = skewData.reduce((closest, current) => {
    const currentDiff = Math.abs(current.delta - 0.25);
    const closestDiff = Math.abs(closest.delta - 0.25);
    return currentDiff < closestDiff && current.putIV > current.callIV ? current : closest;
  });
  
  return {
    callIV: call25.callIV,
    putIV: put25.putIV,
  };
}

/**
 * 分析SKEW状态
 */
export function analyzeSkew(
  skewData: SkewData[],
  atmIV: number,
  pcr?: number,
  gammaExposure?: number
): SkewAnalysisResult {
  const { callIV: call25IV, putIV: put25IV } = find25DeltaIV(skewData);
  const skew25Delta = put25IV - call25IV;
  const skewPercent = (skew25Delta / atmIV) * 100;
  
  // 确定状态
  let status: SkewAnalysisResult['status'];
  let statusLabel: string;
  let description: string;
  let tradingImplications: string[];
  let riskWarnings: string[];
  
  if (skewPercent > 10) {
    status = 'extreme_down';
    statusLabel = '极端下行偏斜';
    description = 'SKEW极度偏斜，市场对下行风险的担忧达到极端水平，Put IV显著溢价';
    tradingImplications = [
      '极端下行偏斜通常预示市场处于恐慌状态',
      '可能是反向看多的机会，但需承受高波动',
      '考虑卖出25Δ Put，买入25Δ Call进行风险逆转套利',
    ];
    riskWarnings = [
      '极端偏斜可能持续，若发生实质性下行事件，偏斜可能进一步扩大',
      '严格控制仓位，单策略仓位≤10%',
      '设置止损，如标的跌破关键支撑位时平仓',
    ];
  } else if (skewPercent > 3) {
    status = 'down';
    statusLabel = '适度下行偏斜';
    description = `SKEW为+${skewPercent.toFixed(2)}%，25Δ Put IV比25Δ Call IV高${(skew25Delta * 100).toFixed(2)}个百分点，市场对下行风险的担忧是理性的`;
    tradingImplications = [
      '适度下行偏斜说明市场对下行风险有合理担忧',
      '与PCR、ATM IV形成共振，验证市场对下行的担忧',
      '可利用Put IV溢价降低看多成本',
      '卖出虚值Put收取权利金，或买入虚值Call',
    ];
    riskWarnings = [
      '负Gamma环境下，做市商对冲会强化下行趋势',
      '若下行风险被触发，Put IV可能进一步飙升',
      '优先选择流动性高的合约（买卖价差≤0.5%）',
    ];
  } else if (skewPercent >= -3) {
    status = 'normal';
    statusLabel = '偏度正常';
    description = 'SKEW处于正常区间，市场对上行和下行风险的定价相对均衡';
    tradingImplications = [
      '市场定价相对均衡，可采用常规策略',
      '关注SKEW变化方向',
      '结合其他指标判断趋势',
    ];
    riskWarnings = [
      'SKEW可能快速变化',
      '关注事件驱动影响',
    ];
  } else if (skewPercent >= -10) {
    status = 'up';
    statusLabel = '适度上行偏斜';
    description = 'SKEW为负，Call IV相对Put IV溢价，市场对上行风险更担忧';
    tradingImplications = [
      '市场对上行风险定价更高',
      '可能是市场乐观情绪过度',
      '考虑反向看空或对冲',
    ];
    riskWarnings = [
      '上行偏斜较少见，需警惕反转',
      '关注是否出现逼空行情',
    ];
  } else {
    status = 'extreme_up';
    statusLabel = '极端上行偏斜';
    description = 'SKEW极度偏向上行，Call IV显著溢价，市场处于极度乐观状态';
    tradingImplications = [
      '极端上行偏斜通常预示市场顶部',
      '强烈的反向看空信号',
      '考虑卖出Call或买入Put对冲',
    ];
    riskWarnings = [
      '极端乐观情绪可能持续',
      '严格设置止损',
    ];
  }
  
  // 结合PCR和Gamma调整建议
  if (pcr && pcr > 1.5 && gammaExposure && gammaExposure < -30 && skewPercent > 3) {
    // 高PCR + 负Gamma + 正SKEW的特殊情况
    description += '；高PCR、负Gamma与正SKEW形成共振，市场对下行风险的担忧已部分反映在定价中';
    tradingImplications.push(
      '高PCR+负Gamma+正SKEW组合：市场对下行的定价已部分反映，反向看多胜率提升',
      '波动率溢价主要由下行Put驱动，买入虚值Call成本相对较低',
      '卖出25Δ Put，买入25Δ Call，收取Put IV溢价并锁定上行收益'
    );
    riskWarnings.push(
      '负Gamma环境下，若下行风险被触发，波动会被剧烈放大',
      '需承受短期高波动'
    );
  }
  
  return {
    skew25Delta,
    skewPercent,
    atmIV,
    put25IV,
    call25IV,
    status,
    statusLabel,
    description,
    tradingImplications,
    riskWarnings,
  };
}

/**
 * 格式化SKEW显示
 */
export function formatSkew(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(2)}%`;
}

/**
 * 获取SKEW状态颜色
 */
export function getSkewColor(skewPercent: number): string {
  if (skewPercent > 10) return '#ff4d4f';      // 红色 - 极端下行
  if (skewPercent > 3) return '#ff7875';       // 浅红 - 适度下行
  if (skewPercent >= -3) return '#52c41a';     // 绿色 - 正常
  if (skewPercent >= -10) return '#73d13d';    // 浅绿 - 适度上行
  return '#389e0d';                            // 深绿 - 极端上行
}
