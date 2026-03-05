/**
 * ATM IV (At-The-Money Implied Volatility) 计算工具
 * 
 * ATM IV: 平值期权的隐含波动率，代表市场对未来波动的预期
 * HV: 历史波动率，代表市场实际发生的波动水平
 * VRP: 波动率风险溢价 (Volatility Risk Premium) = ATM IV - HV
 */

export interface IVData {
  strike: number;
  callIV: number;
  putIV: number;
  atmIV: number;  // 该strike的ATM IV (Call和Put的平均)
  distanceFromATM: number; // 距离ATM的百分比
}

export interface IVAnalysisResult {
  atmIV: number;           // 平值期权隐含波动率
  hv: number;              // 历史波动率
  vrp: number;             // 波动率风险溢价 (ATM IV - HV)
  vrpPercent: number;      // VRP百分比 (VRP / HV * 100)
  callSkew: number;        // Call IV偏度
  putSkew: number;         // Put IV偏度
  status: 'low' | 'normal' | 'high' | 'extreme';
  statusLabel: string;
  description: string;
  tradingImplications: string[];
  riskWarnings: string[];
}

/**
 * 估算期权的隐含波动率
 * 使用简化模型：ATM期权IV最低，远离ATM时IV递增（波动率微笑）
 */
function estimateIV(strike: number, underlyingPrice: number, isCall: boolean): number {
  const distance = Math.abs(strike - underlyingPrice);
  const atmDistance = underlyingPrice * 0.1;
  
  // 基础IV水平（根据市场环境调整）
  const baseIV = 0.20; // 20%
  
  // 距离ATM越远，IV越高（波动率微笑）
  let skewFactor = 0;
  if (distance < atmDistance * 0.1) {
    skewFactor = 0; // ATM
  } else if (distance < atmDistance * 0.3) {
    skewFactor = 0.02; // 近ATM
  } else if (distance < atmDistance * 0.6) {
    skewFactor = 0.05; // 中等OTM
  } else {
    skewFactor = 0.08; // 远OTM
  }
  
  // Put通常有更高的IV（下行保护需求）
  const putPremium = isCall ? 0 : 0.02;
  
  return baseIV + skewFactor + putPremium;
}

/**
 * 计算各strike的IV数据
 */
export function calculateIVData(
  oiData: { strike: number; callOI: number; putOI: number }[],
  underlyingPrice: number
): IVData[] {
  const ivData: IVData[] = [];
  
  for (const data of oiData) {
    const callIV = estimateIV(data.strike, underlyingPrice, true);
    const putIV = estimateIV(data.strike, underlyingPrice, false);
    const atmIV = (callIV + putIV) / 2;
    const distanceFromATM = Math.abs(data.strike - underlyingPrice) / underlyingPrice;
    
    ivData.push({
      strike: data.strike,
      callIV,
      putIV,
      atmIV,
      distanceFromATM,
    });
  }
  
  return ivData;
}

/**
 * 找到最接近ATM的IV（真正的ATM IV）
 */
export function findATMIV(ivData: IVData[]): number {
  // 找到distanceFromATM最小的数据点
  const atmData = ivData.reduce((min, current) => 
    current.distanceFromATM < min.distanceFromATM ? current : min
  );
  return atmData.atmIV;
}

/**
 * 估算历史波动率（简化模型）
 * 实际应用中应该从历史价格数据计算
 */
export function estimateHV(atmIV: number): number {
  // 简化模型：HV通常低于IV，VRP通常在2-8%之间
  // 根据ATM IV估算HV，保持VRP在合理范围
  const vrp = 0.02 + Math.random() * 0.04; // 2-6%的VRP
  return Math.max(0.10, atmIV - vrp);
}

/**
 * 分析IV状态
 */
export function analyzeIV(
  ivData: IVData[],
  underlyingPrice: number,
  gammaExposure?: number,
  pcr?: number
): IVAnalysisResult {
  const atmIV = findATMIV(ivData);
  const hv = estimateHV(atmIV);
  const vrp = atmIV - hv;
  const vrpPercent = (vrp / hv) * 100;
  
  // 计算偏度
  const otmCalls = ivData.filter(d => d.strike > underlyingPrice);
  const otmPuts = ivData.filter(d => d.strike < underlyingPrice);
  
  const callSkew = otmCalls.length > 0 
    ? otmCalls.reduce((sum, d) => sum + d.callIV, 0) / otmCalls.length - atmIV
    : 0;
  const putSkew = otmPuts.length > 0
    ? otmPuts.reduce((sum, d) => sum + d.putIV, 0) / otmPuts.length - atmIV
    : 0;
  
  // 确定状态
  let status: IVAnalysisResult['status'];
  let statusLabel: string;
  let description: string;
  let tradingImplications: string[];
  let riskWarnings: string[];
  
  // 根据VRP判断状态
  if (vrpPercent < 5) {
    status = 'low';
    statusLabel = '低溢价';
    description = 'VRP较低，波动率定价相对合理，市场预期与实际波动接近';
    tradingImplications = [
      '波动率定价合理，可采用常规策略',
      '买入期权成本相对较低',
      '适合方向性交易',
    ];
    riskWarnings = [
      '低VRP可能预示即将到来的波动放大',
      '关注是否出现事件驱动导致IV跳升',
    ];
  } else if (vrpPercent < 15) {
    status = 'normal';
    statusLabel = '正常溢价';
    description = 'VRP处于正常区间，市场预期略高于历史波动';
    tradingImplications = [
      '波动率定价适中',
      '可采用平衡策略',
      '关注VRP变化方向',
    ];
    riskWarnings = [
      'VRP可能向任一方向移动',
      '结合其他指标判断趋势',
    ];
  } else if (vrpPercent < 30) {
    status = 'high';
    statusLabel = '高溢价';
    description = `VRP达${vrpPercent.toFixed(1)}%，波动率定价偏贵，市场预期显著高于历史波动`;
    tradingImplications = [
      '波动率定价偏贵，存在均值回归动力',
      '考虑卖出波动率策略（Short Straddle/Strangle）',
      '买入期权成本较高，谨慎选择',
    ];
    riskWarnings = [
      '高VRP可能持续，若发生风险事件IV可能进一步上行',
      '负Gamma环境下波动剧烈，严格控制仓位',
      '设置止损，如突破关键支撑/阻力位时平仓',
    ];
  } else {
    status = 'extreme';
    statusLabel = '极端溢价';
    description = `VRP高达${vrpPercent.toFixed(1)}%，波动率定价极端偏贵，市场情绪恐慌`;
    tradingImplications = [
      '波动率定价极端偏贵，强烈预期均值回归',
      '卖出波动率策略潜在收益高，但风险也大',
      '买入方向性期权成本极高，建议等待IV回落',
    ];
    riskWarnings = [
      '极端VRP通常伴随重大事件，需谨慎评估',
      '负Gamma+高PCR环境下，波动可能进一步放大',
      '严格控制仓位（单策略≤10%）',
      '临近期权到期，ATM IV会非线性波动',
    ];
  }
  
  // 结合Gamma和PCR调整建议
  if (gammaExposure && gammaExposure < -30 && pcr && pcr > 1.5) {
    // 负Gamma + 高PCR + 正VRP的特殊情况
    description += '；叠加负Gamma和高PCR环境，短期波动将持续处于高位，易出现暴涨暴跌';
    tradingImplications.push(
      '负Gamma+高PCR+正VRP组合：市场情绪恐慌性定价，反向看多胜率提升但需承受高波动',
      '买入虚值看涨期权（Call）而非现货，规避短期暴跌风险',
      '选择到期日1-2周的虚值Call，利用IV回落降低时间价值损耗'
    );
    riskWarnings.push(
      '负Gamma环境下波动被剧烈放大，仓位控制在50%以下',
      '选择流动性高的合约（买卖价差≤0.5%）'
    );
  }
  
  return {
    atmIV,
    hv,
    vrp,
    vrpPercent,
    callSkew,
    putSkew,
    status,
    statusLabel,
    description,
    tradingImplications,
    riskWarnings,
  };
}

/**
 * 格式化IV显示
 */
export function formatIV(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

/**
 * 格式化VRP显示
 */
export function formatVRP(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(2)}%`;
}

/**
 * 获取VRP状态颜色
 */
export function getVRPColor(vrpPercent: number): string {
  if (vrpPercent < 5) return '#52c41a';      // 绿色 - 低溢价
  if (vrpPercent < 15) return '#73d13d';     // 浅绿 - 正常
  if (vrpPercent < 30) return '#faad14';     // 黄色 - 高溢价
  return '#ff4d4f';                          // 红色 - 极端溢价
}
