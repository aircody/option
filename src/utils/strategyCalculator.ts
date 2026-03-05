/**
 * 多指标共振交易策略计算器
 * 
 * 基于六大核心指标（GEX、Max Pain、OI Wall、PCR、ATM IV/VRP、SKEW）
 * 综合分析市场环境，生成可落地的交易策略建议
 */

import { calculateGEX, analyzeGEX } from './gexCalculator';
import { calculatePCR, analyzePCR } from './pcrCalculator';
import { calculateIVData, analyzeIV } from './ivCalculator';
import { calculateSkewData, analyzeSkew } from './skewCalculator';
import { calculateMaxPain } from './maxPainCalculator';
import { identifyOIWalls } from './oiWallCalculator';

export interface MarketEnvironment {
  type: 'low_volatility' | 'high_volatility' | 'extreme_low' | 'extreme_high';
  label: string;
  description: string;
  gexThreshold: string;
  ivThreshold: string;
  volatilityFeature: string;
  strategyDirection: string;
}

export interface TradingSignal {
  type: 'bullish' | 'bearish' | 'range';
  label: string;
  strength: 'weak' | 'moderate' | 'strong';
  matchedConditions: number;
  totalConditions: number;
  conditions: {
    name: string;
    status: 'met' | 'partial' | 'not_met';
    description: string;
  }[];
}

export interface StrategyRecommendation {
  environment: MarketEnvironment;
  primarySignal: TradingSignal;
  secondarySignal?: TradingSignal;
  strategy: {
    name: string;
    description: string;
    contractSelection: string;
    strikeSetting: string;
    positionSizing: string;
    entryTiming: string;
    takeProfit: string;
    stopLoss: string;
  };
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  warnings: string[];
}

/**
 * 判定市场环境
 */
export function determineMarketEnvironment(
  gex: number,
  atmIV: number,
  ivPercentile: number
): MarketEnvironment {
  const gexBillions = gex / 1e9;
  
  // 极端低波动市
  if (gexBillions > 20 && ivPercentile < 20) {
    return {
      type: 'extreme_low',
      label: '极端低波动市',
      description: '波动极度收敛，日内振幅<0.5%，价格钉住Max Pain',
      gexThreshold: '极高正GEX (>20亿)',
      ivThreshold: 'ATM IV <20%分位',
      volatilityFeature: '波动极度收敛，日内振幅<0.5%',
      strategyDirection: '仅做窄区间蝶式套利，禁止任何方向性策略',
    };
  }
  
  // 低波动震荡市
  if (gexBillions > 5 && ivPercentile < 40) {
    return {
      type: 'low_volatility',
      label: '低波动震荡市',
      description: '波动被压制，窄幅震荡，价格向Max Pain收敛',
      gexThreshold: '正GEX (>5亿)',
      ivThreshold: 'ATM IV <40%分位',
      volatilityFeature: '波动被压制，难突破OI Wall',
      strategyDirection: '优先区间卖方策略，禁止单边裸买期权',
    };
  }
  
  // 极端高波动市
  if (gexBillions < -20 && ivPercentile > 80) {
    return {
      type: 'extreme_high',
      label: '极端高波动市',
      description: '暴涨暴跌，日内振幅>2%，支撑阻力极易失效',
      gexThreshold: '极端负GEX (<-20亿)',
      ivThreshold: 'ATM IV >80%分位',
      volatilityFeature: '暴涨暴跌，支撑阻力极易失效',
      strategyDirection: '仅做对冲策略，禁止单边投机，优先空仓观望',
    };
  }
  
  // 高波动趋势市
  return {
    type: 'high_volatility',
    label: '高波动趋势市',
    description: '波动放大，趋势性强，突破OI Wall会加速',
    gexThreshold: '负GEX (<-5亿)',
    ivThreshold: 'ATM IV 40%-80%分位',
    volatilityFeature: '波动放大，趋势性强',
    strategyDirection: '优先方向性买方策略，禁止裸卖无保护期权',
  };
}

/**
 * 分析看涨多头共振信号
 */
export function analyzeBullishSignal(
  currentPrice: number,
  maxPain: number,
  gex: number,
  pcr: number,
  vrp: number,
  skew: number,
  callWalls: number[],
  putWalls: number[]
): TradingSignal {
  const conditions = [];
  let matchedCount = 0;
  
  // 趋势条件
  const gexBillions = gex / 1e9;
  const priceToMaxPain = ((currentPrice - maxPain) / maxPain) * 100;
  const nearestPutWall = putWalls.length > 0 
    ? putWalls.filter(w => w < currentPrice).sort((a, b) => b - a)[0]
    : null;
  const nearestCallWall = callWalls.length > 0
    ? callWalls.filter(w => w > currentPrice).sort((a, b) => a - b)[0]
    : null;
  
  const trendCondition = gexBillions < -5
    ? (nearestPutWall && Math.abs((currentPrice - nearestPutWall) / currentPrice) < 0.03)
    : (priceToMaxPain < -2 && priceToMaxPain > -5);
  
  conditions.push({
    name: '趋势条件',
    status: trendCondition ? 'met' : 'not_met',
    description: gexBillions < -5
      ? '负GEX环境下价格回踩Put Wall支撑'
      : '正GEX环境下当前价低于Max Pain 2-5%',
  });
  if (trendCondition) matchedCount++;
  
  // 情绪条件
  const sentimentCondition = pcr > 0.9;
  conditions.push({
    name: '情绪条件',
    status: sentimentCondition ? 'met' : pcr > 0.7 ? 'partial' : 'not_met',
    description: `PCR=${pcr.toFixed(2)} ${pcr > 1.2 ? '(极度恐慌)' : pcr > 0.9 ? '(中性偏空)' : '(情绪平稳)'}`,
  });
  if (sentimentCondition) matchedCount++;
  
  // 波动率条件
  const volCondition = vrp < 0;
  conditions.push({
    name: '波动率条件',
    status: volCondition ? 'met' : vrp < 0.05 ? 'partial' : 'not_met',
    description: `VRP=${(vrp * 100).toFixed(2)}% ${vrp < 0 ? '(期权被低估)' : '(期权有溢价)'}`,
  });
  if (volCondition) matchedCount++;
  
  // SKEW条件
  const skewCondition = skew < -0.01;
  conditions.push({
    name: 'SKEW条件',
    status: skewCondition ? 'met' : skew < 0 ? 'partial' : 'not_met',
    description: `SKEW=${(skew * 100).toFixed(2)}% ${skew < -0.01 ? '(市场恐慌定价充分)' : '(尾部风险定价均衡)'}`,
  });
  if (skewCondition) matchedCount++;
  
  // 空间条件
  const spaceCondition = nearestCallWall 
    ? ((nearestCallWall - currentPrice) / currentPrice) > 0.02
    : true;
  conditions.push({
    name: '空间条件',
    status: spaceCondition ? 'met' : 'not_met',
    description: nearestCallWall
      ? `上方Call Wall距离${((nearestCallWall - currentPrice) / currentPrice * 100).toFixed(1)}%`
      : '无明显上方阻力',
  });
  if (spaceCondition) matchedCount++;
  
  const strength = matchedCount >= 4 ? 'strong' : matchedCount >= 3 ? 'moderate' : 'weak';
  
  return {
    type: 'bullish',
    label: '看涨多头共振信号',
    strength,
    matchedConditions: matchedCount,
    totalConditions: conditions.length,
    conditions,
  };
}

/**
 * 分析看跌空头共振信号
 */
export function analyzeBearishSignal(
  currentPrice: number,
  maxPain: number,
  gex: number,
  pcr: number,
  vrp: number,
  skew: number,
  callWalls: number[],
  putWalls: number[]
): TradingSignal {
  const conditions = [];
  let matchedCount = 0;
  
  const gexBillions = gex / 1e9;
  const priceToMaxPain = ((currentPrice - maxPain) / maxPain) * 100;
  const nearestCallWall = callWalls.length > 0
    ? callWalls.filter(w => w > currentPrice).sort((a, b) => a - b)[0]
    : null;
  const nearestPutWall = putWalls.length > 0
    ? putWalls.filter(w => w < currentPrice).sort((a, b) => b - a)[0]
    : null;
  
  // 趋势条件
  const trendCondition = gexBillions < -5
    ? (nearestCallWall && Math.abs((nearestCallWall - currentPrice) / currentPrice) < 0.03)
    : (priceToMaxPain > 2 && priceToMaxPain < 5);
  
  conditions.push({
    name: '趋势条件',
    status: trendCondition ? 'met' : 'not_met',
    description: gexBillions < -5
      ? '负GEX环境下价格触及Call Wall遇阻'
      : '正GEX环境下当前价高于Max Pain 2-5%',
  });
  if (trendCondition) matchedCount++;
  
  // 情绪条件
  const sentimentCondition = pcr < 0.7;
  conditions.push({
    name: '情绪条件',
    status: sentimentCondition ? 'met' : pcr < 0.9 ? 'partial' : 'not_met',
    description: `PCR=${pcr.toFixed(2)} ${pcr < 0.5 ? '(极度贪婪)' : pcr < 0.7 ? '(中性偏多)' : '(情绪平稳)'}`,
  });
  if (sentimentCondition) matchedCount++;
  
  // 波动率条件
  const volCondition = vrp < 0;
  conditions.push({
    name: '波动率条件',
    status: volCondition ? 'met' : vrp < 0.05 ? 'partial' : 'not_met',
    description: `VRP=${(vrp * 100).toFixed(2)}% ${vrp < 0 ? '(期权被低估)' : '(期权有溢价)'}`,
  });
  if (volCondition) matchedCount++;
  
  // SKEW条件
  const skewCondition = skew > 0.01;
  conditions.push({
    name: 'SKEW条件',
    status: skewCondition ? 'met' : skew > 0 ? 'partial' : 'not_met',
    description: `SKEW=${(skew * 100).toFixed(2)}% ${skew > 0.01 ? '(市场乐观定价过度)' : '(尾部风险定价均衡)'}`,
  });
  if (skewCondition) matchedCount++;
  
  // 空间条件
  const spaceCondition = nearestPutWall
    ? ((currentPrice - nearestPutWall) / currentPrice) > 0.02
    : true;
  conditions.push({
    name: '空间条件',
    status: spaceCondition ? 'met' : 'not_met',
    description: nearestPutWall
      ? `下方Put Wall距离${((currentPrice - nearestPutWall) / currentPrice * 100).toFixed(1)}%`
      : '无明显下方支撑',
  });
  if (spaceCondition) matchedCount++;
  
  const strength = matchedCount >= 4 ? 'strong' : matchedCount >= 3 ? 'moderate' : 'weak';
  
  return {
    type: 'bearish',
    label: '看跌空头共振信号',
    strength,
    matchedConditions: matchedCount,
    totalConditions: conditions.length,
    conditions,
  };
}

/**
 * 分析区间震荡共振信号
 */
export function analyzeRangeSignal(
  currentPrice: number,
  gex: number,
  vrp: number,
  skew: number,
  callWalls: number[],
  putWalls: number[],
  maxPain: number
): TradingSignal {
  const conditions = [];
  let matchedCount = 0;
  
  const gexBillions = gex / 1e9;
  const nearestCallWall = callWalls.length > 0
    ? callWalls.filter(w => w > currentPrice).sort((a, b) => a - b)[0]
    : null;
  const nearestPutWall = putWalls.length > 0
    ? putWalls.filter(w => w < currentPrice).sort((a, b) => b - a)[0]
    : null;
  
  // 波动条件
  const volCondition = gexBillions > 5;
  conditions.push({
    name: '波动条件',
    status: volCondition ? 'met' : 'not_met',
    description: `GEX=$${gexBillions.toFixed(1)}B ${gexBillions > 5 ? '(正GEX环境)' : '(GEX不足)'}`,
  });
  if (volCondition) matchedCount++;
  
  // 边界条件
  const hasCallWall = nearestCallWall !== null;
  const hasPutWall = nearestPutWall !== null;
  const boundaryCondition = hasCallWall && hasPutWall;
  conditions.push({
    name: '边界条件',
    status: boundaryCondition ? 'met' : hasCallWall || hasPutWall ? 'partial' : 'not_met',
    description: boundaryCondition
      ? `上下方均有OI Wall，区间${((nearestCallWall! - nearestPutWall!) / currentPrice * 100).toFixed(1)}%`
      : '边界不完整',
  });
  if (boundaryCondition) matchedCount++;
  
  // 收敛条件
  const convergenceCondition = maxPain > (nearestPutWall || 0) && maxPain < (nearestCallWall || Infinity);
  conditions.push({
    name: '收敛条件',
    status: convergenceCondition ? 'met' : 'not_met',
    description: convergenceCondition
      ? 'Max Pain处于区间内部'
      : 'Max Pain偏离区间',
  });
  if (convergenceCondition) matchedCount++;
  
  // 波动率条件
  const volPricingCondition = vrp > 0.02;
  conditions.push({
    name: '波动率条件',
    status: volPricingCondition ? 'met' : vrp > 0 ? 'partial' : 'not_met',
    description: `VRP=${(vrp * 100).toFixed(2)}% ${vrp > 0.02 ? '(期权有溢价)' : '(定价合理)'}`,
  });
  if (volPricingCondition) matchedCount++;
  
  // SKEW条件
  const skewCondition = Math.abs(skew) < 0.01;
  conditions.push({
    name: 'SKEW条件',
    status: skewCondition ? 'met' : 'not_met',
    description: `SKEW=${(skew * 100).toFixed(2)}% ${skewCondition ? '(无极端尾部风险)' : '(有尾部风险预期)'}`,
  });
  if (skewCondition) matchedCount++;
  
  const strength = matchedCount >= 4 ? 'strong' : matchedCount >= 3 ? 'moderate' : 'weak';
  
  return {
    type: 'range',
    label: '区间震荡共振信号',
    strength,
    matchedConditions: matchedCount,
    totalConditions: conditions.length,
    conditions,
  };
}

/**
 * 生成策略建议
 */
export function generateStrategyRecommendation(
  oiData: { strike: number; callOI: number; putOI: number }[],
  currentPrice: number,
  ivPercentile: number = 50
): StrategyRecommendation {
  // 计算所有指标
  const gexData = calculateGEX(oiData, currentPrice);
  const gexAnalysis = analyzeGEX(gexData, currentPrice);
  
  const pcrData = calculatePCR(oiData);
  const pcrAnalysis = analyzePCR(pcrData);
  
  const ivData = calculateIVData(oiData, currentPrice);
  const ivAnalysis = analyzeIV(ivData, currentPrice);
  
  const skewData = calculateSkewData(oiData, currentPrice, ivAnalysis.atmIV);
  const skewAnalysis = analyzeSkew(skewData, ivAnalysis.atmIV);
  
  const { maxPain } = calculateMaxPain(oiData);
  const oiWalls = identifyOIWalls(oiData, currentPrice);
  const callWalls = oiWalls.filter(w => w.type === 'resistance').map(w => w.strike);
  const putWalls = oiWalls.filter(w => w.type === 'support').map(w => w.strike);
  
  // 判定市场环境
  const environment = determineMarketEnvironment(
    gexAnalysis.totalGEX,
    ivAnalysis.atmIV,
    ivPercentile
  );
  
  // 分析各方向信号
  const bullishSignal = analyzeBullishSignal(
    currentPrice, maxPain, gexAnalysis.totalGEX,
    pcrAnalysis.pcrOI, ivAnalysis.vrp, skewAnalysis.skew25Delta,
    callWalls, putWalls
  );
  
  const bearishSignal = analyzeBearishSignal(
    currentPrice, maxPain, gexAnalysis.totalGEX,
    pcrAnalysis.pcrOI, ivAnalysis.vrp, skewAnalysis.skew25Delta,
    callWalls, putWalls
  );
  
  const rangeSignal = analyzeRangeSignal(
    currentPrice, gexAnalysis.totalGEX, ivAnalysis.vrp,
    skewAnalysis.skew25Delta, callWalls, putWalls, maxPain
  );
  
  // 选择最强信号
  const signals = [bullishSignal, bearishSignal, rangeSignal]
    .filter(s => s.matchedConditions >= 3)
    .sort((a, b) => b.matchedConditions - a.matchedConditions);
  
  const primarySignal = signals[0];
  const secondarySignal = signals[1];
  
  // 生成策略
  let strategy: StrategyRecommendation['strategy'];
  let riskLevel: StrategyRecommendation['riskLevel'];
  let warnings: string[];
  
  if (environment.type === 'extreme_low') {
    strategy = {
      name: '窄区间蝶式套利',
      description: '仅赚到期价格收敛的钱，极致博弈时间衰减',
      contractSelection: '到期前1-3个交易日的合约，最佳为1DTE/0DTE',
      strikeSetting: `以Max Pain($${maxPain.toFixed(2)})为中间行权价，上下各0.5%构建对称蝶式套利`,
      positionSizing: '权利金支出不超过总账户资金的1%',
      entryTiming: '开盘后1小时，价格波动幅度<0.3%，确认进入钉住模式',
      takeProfit: '到期前1小时，价格在区间内则平仓止盈',
      stopLoss: '价格突破区间上下沿超过0.3%，立即止损，最大亏损为全部权利金',
    };
    riskLevel = 'low';
    warnings = ['仅适用于极端低波动市', '禁止任何方向性策略'];
  } else if (environment.type === 'extreme_high') {
    strategy = {
      name: '保护性对冲/空仓观望',
      description: '仅做对冲，禁止单边投机，优先空仓观望',
      contractSelection: '持有股票多头时，买入5delta虚值看跌期权做尾部保护，到期日选择1-3个月',
      strikeSetting: '选择下方较远虚值Put，规避短期高IV损耗',
      positionSizing: '权利金支出不超过总账户资金的1%',
      entryTiming: '确认进入极端高波动市后，立即建立保护',
      takeProfit: '波动率回落后逐步减仓',
      stopLoss: '持续持有至到期或波动率显著回落',
    };
    riskLevel = 'extreme';
    warnings = ['暴涨暴跌，支撑阻力极易失效', '禁止单边投机', '优先空仓观望'];
  } else if (environment.type === 'low_volatility' && primarySignal?.type === 'range') {
    strategy = {
      name: '铁鹰套利/卖出宽跨式',
      description: '赚时间价值与价格收敛的钱',
      contractSelection: '到期前3-7个交易日的周度合约，越临近到期时间价值衰减越快',
      strikeSetting: callWalls.length > 0 && putWalls.length > 0
        ? `卖出Call Wall($${callWalls[0].toFixed(2)})看涨期权、Put Wall($${putWalls[0].toFixed(2)})看跌期权，上下各0.5%买入保护`
        : `以Max Pain($${maxPain.toFixed(2)})上下1%为卖出端，上下0.5%买入保护`,
      positionSizing: '单策略保证金占用不超过总账户资金的5%，极高正GEX环境下不超过10%',
      entryTiming: '价格处于区间中间位置，或接近区间上沿/下沿，偏离Max Pain不超过2%',
      takeProfit: '期权剩余价值不足开仓时的20%，或到期前1天平仓，赚80%利润即离场',
      stopLoss: '价格突破Call Wall/Put Wall超过0.5%且30分钟不收回，立即平仓，最大亏损不超过初始权利金的2倍',
    };
    riskLevel = 'medium';
    warnings = ['禁止无保护裸卖期权', '必须设置止损'];
  } else if (environment.type === 'high_volatility' && primarySignal?.type === 'bullish') {
    strategy = {
      name: '垂直价差/裸买看涨期权',
      description: '赚价格趋势与波动率上升的钱',
      contractSelection: '到期前7-15个交易日的合约，规避0DTE的极端时间损耗',
      strikeSetting: putWalls.length > 0
        ? `保守型选平值看涨期权(delta=0.5)；进取型选25delta虚值看涨期权；稳健型构建牛市价差，买入ATM看涨同时卖出Call Wall($${callWalls[0]?.toFixed(2) || '上方阻力'})看涨`
        : '保守型选平值看涨期权；进取型选25delta虚值看涨期权',
      positionSizing: '单策略权利金支出不超过总账户资金的2%，禁止重仓裸买期权',
      entryTiming: `价格回踩Put Wall($${putWalls[0]?.toFixed(2) || '支撑位'})获得支撑，出现15/30分钟级别企稳信号，PCR处于高位，VRP为负`,
      takeProfit: '价格达到目标位(Max Pain/下一个OI Wall)，或单笔盈利达到100%，分批止盈50%，剩余仓位设置移动止损',
      stopLoss: '价格跌破Put Wall超过0.5%且30分钟不收回，或单笔亏损达到50%，立即止损，绝对不扛单',
    };
    riskLevel = 'high';
    warnings = ['负GEX环境下波动剧烈', '严格控制仓位', '必须设置止损'];
  } else if (environment.type === 'high_volatility' && primarySignal?.type === 'bearish') {
    strategy = {
      name: '垂直价差/裸买看跌期权',
      description: '赚价格趋势与波动率上升的钱',
      contractSelection: '到期前7-15个交易日的合约，规避0DTE的极端时间损耗',
      strikeSetting: callWalls.length > 0
        ? `保守型选平值看跌期权(delta=-0.5)；进取型选25delta虚值看跌期权；稳健型构建熊市价差，买入ATM看跌同时卖出Put Wall($${putWalls[0]?.toFixed(2) || '下方支撑'})看跌`
        : '保守型选平值看跌期权；进取型选25delta虚值看跌期权',
      positionSizing: '单策略权利金支出不超过总账户资金的2%，禁止重仓裸买期权',
      entryTiming: `价格触及Call Wall($${callWalls[0]?.toFixed(2) || '阻力位'})遇阻，出现15/30分钟级别回落信号，PCR处于低位，VRP为负`,
      takeProfit: '价格达到目标位(Max Pain/下一个OI Wall)，或单笔盈利达到100%，分批止盈50%，剩余仓位设置移动止损',
      stopLoss: '价格突破Call Wall超过0.5%且30分钟不收回，或单笔亏损达到50%，立即止损，绝对不扛单',
    };
    riskLevel = 'high';
    warnings = ['负GEX环境下波动剧烈', '严格控制仓位', '必须设置止损'];
  } else {
    strategy = {
      name: '观望/等待信号',
      description: '当前市场信号不明确，建议观望等待更清晰的共振信号',
      contractSelection: '不适用',
      strikeSetting: '不适用',
      positionSizing: '保持空仓或轻仓',
      entryTiming: '等待≥3个核心指标共振',
      takeProfit: '不适用',
      stopLoss: '不适用',
    };
    riskLevel = 'low';
    warnings = ['信号不足，禁止开仓', '等待更明确的市场环境'];
  }
  
  return {
    environment,
    primarySignal: primarySignal || bullishSignal,
    secondarySignal,
    strategy,
    riskLevel,
    warnings,
  };
}

/**
 * 获取风险等级颜色
 */
export function getRiskLevelColor(level: StrategyRecommendation['riskLevel']): string {
  switch (level) {
    case 'low': return '#52c41a';
    case 'medium': return '#faad14';
    case 'high': return '#ff7875';
    case 'extreme': return '#ff4d4f';
    default: return '#999';
  }
}

/**
 * 获取信号强度颜色
 */
export function getSignalStrengthColor(strength: TradingSignal['strength']): string {
  switch (strength) {
    case 'strong': return '#52c41a';
    case 'moderate': return '#faad14';
    case 'weak': return '#ff7875';
    default: return '#999';
  }
}
