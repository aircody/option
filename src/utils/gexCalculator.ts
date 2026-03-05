/**
 * Gamma Exposure (GEX) 计算工具
 * 
 * GEX = Σ(Gamma × OI × 合约乘数 × 标的资产价格)
 * 
 * 其中：
 * - Gamma: 期权的Gamma值（Delta的变化率）
 * - OI: 未平仓合约数
 * - 合约乘数: 美股期权通常为100
 * - 标的资产价格: 当前股票价格
 */

export interface GEXData {
  strike: number;
  callGEX: number;
  putGEX: number;
  totalGEX: number;
}

export interface GEXAnalysisResult {
  totalGEX: number;           // 总Gamma敞口
  callGEX: number;            // Call Gamma敞口
  putGEX: number;             // Put Gamma敞口
  zeroGammaLevel: number;     // Zero Gamma Level (GEX=0的行权价)
  flipPoint: number;          // Gamma Flip Point
  status: 'extreme_negative' | 'negative' | 'neutral' | 'positive' | 'extreme_positive';
  description: string;
  tradingImplications: string[];
}

/**
 * 估算期权的Gamma值
 * 使用简化模型：ATM期权Gamma最高，远离ATM时Gamma递减
 */
function estimateGamma(strike: number, underlyingPrice: number, isCall: boolean): number {
  const distance = Math.abs(strike - underlyingPrice);
  const atmDistance = underlyingPrice * 0.1; // ATM附近10%范围
  
  // ATM Gamma最高，随着远离ATM而递减
  if (distance < atmDistance * 0.1) {
    return 0.05; // ATM
  } else if (distance < atmDistance * 0.3) {
    return 0.03; // 近ATM
  } else if (distance < atmDistance * 0.6) {
    return 0.015; // 中等距离
  } else {
    return 0.005; // 远OTM
  }
}

/**
 * 计算单个期权的Gamma Exposure
 * GEX = Gamma × OI × 合约乘数 × 标的资产价格
 */
function calculateSingleGEX(
  gamma: number,
  oi: number,
  underlyingPrice: number,
  contractMultiplier: number = 100
): number {
  return gamma * oi * contractMultiplier * underlyingPrice;
}

/**
 * 计算全市场的Gamma Exposure
 */
export function calculateGEX(
  oiData: { strike: number; callOI: number; putOI: number }[],
  underlyingPrice: number
): GEXData[] {
  const gexData: GEXData[] = [];

  for (const data of oiData) {
    const callGamma = estimateGamma(data.strike, underlyingPrice, true);
    const putGamma = estimateGamma(data.strike, underlyingPrice, false);

    // Put Gamma为负值（因为Put Delta为负，Gamma为正，但GEX计算中Put贡献负值）
    const callGEX = calculateSingleGEX(callGamma, data.callOI, underlyingPrice);
    const putGEX = -calculateSingleGEX(putGamma, data.putOI, underlyingPrice);
    const totalGEX = callGEX + putGEX;

    gexData.push({
      strike: data.strike,
      callGEX,
      putGEX,
      totalGEX,
    });
  }

  return gexData;
}

/**
 * 分析Gamma Exposure状态
 */
export function analyzeGEX(
  gexData: GEXData[],
  underlyingPrice: number
): GEXAnalysisResult {
  const totalGEX = gexData.reduce((sum, d) => sum + d.totalGEX, 0);
  const callGEX = gexData.reduce((sum, d) => sum + d.callGEX, 0);
  const putGEX = gexData.reduce((sum, d) => sum + d.putGEX, 0);

  // 计算Zero Gamma Level（通过线性插值找到GEX=0的位置）
  let zeroGammaLevel = underlyingPrice;
  for (let i = 0; i < gexData.length - 1; i++) {
    const curr = gexData[i];
    const next = gexData[i + 1];
    
    // 寻找GEX变号的区间
    if ((curr.totalGEX > 0 && next.totalGEX < 0) || 
        (curr.totalGEX < 0 && next.totalGEX > 0)) {
      // 线性插值
      const ratio = Math.abs(curr.totalGEX) / (Math.abs(curr.totalGEX) + Math.abs(next.totalGEX));
      zeroGammaLevel = curr.strike + (next.strike - curr.strike) * ratio;
      break;
    }
  }

  // 确定状态
  const gexInBillions = totalGEX / 1e9;
  let status: GEXAnalysisResult['status'];
  let description: string;
  let tradingImplications: string[];

  if (gexInBillions < -30) {
    status = 'extreme_negative';
    description = '极端负Gamma状态，做市商持有大量净负Gamma头寸';
    tradingImplications = [
      '做市商对冲行为成为波动放大器，形成正反馈循环',
      '价格上涨时做市商被迫买入，进一步推高价格（助涨）',
      '价格下跌时做市商被迫卖出，进一步加剧下跌（助跌）',
      '建议采用趋势跟踪策略，顺势交易',
      '买入波动率（跨式/宽跨式期权）或持有VIX看涨期权',
      '避免均值回归策略，负Gamma环境下易失效',
      '降低杠杆至平时的50%以下',
      '加宽止损至近期波动幅度的1.5-2倍',
    ];
  } else if (gexInBillions < -10) {
    status = 'negative';
    description = '负Gamma状态，做市商对冲行为倾向于放大波动';
    tradingImplications = [
      '市场波动可能放大，建议谨慎操作',
      '关注关键支撑阻力位，突破可能引发连锁反应',
      '适当降低仓位，控制风险暴露',
    ];
  } else if (gexInBillions < 10) {
    status = 'neutral';
    description = 'Gamma中性状态，做市商对冲行为对市场影响有限';
    tradingImplications = [
      '市场处于相对稳定状态',
      '可采用常规交易策略',
      '关注其他技术指标辅助判断',
    ];
  } else if (gexInBillions < 30) {
    status = 'positive';
    description = '正Gamma状态，做市商对冲行为倾向于抑制波动';
    tradingImplications = [
      '做市商成为市场稳定器，波动可能被抑制',
      '价格偏离时做市商进行反向对冲（低买高卖）',
      '适合均值回归策略',
    ];
  } else {
    status = 'extreme_positive';
    description = '极端正Gamma状态，做市商持有大量净正Gamma头寸';
    tradingImplications = [
      '做市商强烈抑制波动，市场可能进入盘整',
      '价格难以形成趋势，适合区间交易',
      '卖出波动率策略可能获利',
    ];
  }

  return {
    totalGEX,
    callGEX,
    putGEX,
    zeroGammaLevel,
    flipPoint: zeroGammaLevel, // Gamma Flip Point 通常与 Zero Gamma Level 相近
    status,
    description,
    tradingImplications,
  };
}

/**
 * 格式化GEX显示
 */
export function formatGEX(value: number): string {
  const billions = value / 1e9;
  const sign = billions >= 0 ? '+' : '';
  return `${sign}${billions.toFixed(2)}B`;
}

/**
 * 获取GEX状态标签
 */
export function getGEXStatusLabel(status: GEXAnalysisResult['status']): {
  label: string;
  color: string;
  bgColor: string;
} {
  switch (status) {
    case 'extreme_negative':
      return { label: '超波动', color: '#ff4d4f', bgColor: 'rgba(255, 77, 79, 0.15)' };
    case 'negative':
      return { label: '高波动', color: '#ff7875', bgColor: 'rgba(255, 120, 117, 0.15)' };
    case 'neutral':
      return { label: '平稳', color: '#52c41a', bgColor: 'rgba(82, 196, 26, 0.15)' };
    case 'positive':
      return { label: '低波动', color: '#73d13d', bgColor: 'rgba(115, 209, 61, 0.15)' };
    case 'extreme_positive':
      return { label: '极稳', color: '#389e0d', bgColor: 'rgba(56, 158, 13, 0.15)' };
    default:
      return { label: '未知', color: '#999', bgColor: 'rgba(153, 153, 153, 0.15)' };
  }
}
