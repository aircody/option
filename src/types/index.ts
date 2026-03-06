export interface OptionMetric {
  label: string;
  value: string;
  subValue?: string;
  change?: string;
  status?: 'positive' | 'negative' | 'neutral';
  description?: string;
}

export interface OIData {
  strike: number;
  callOI: number;
  putOI: number;
}

export interface MaxPainData {
  strike: number;
  totalPain: number;
}

export interface OptionChain {
  symbol: string;
  expiryDate: string;
  strikePrice: number;
  callOI: number;
  putOI: number;
  callVolume: number;
  putVolume: number;
  iv: number;
}

export interface ApiOptionData {
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

export interface ApiUnderlyingData {
  last_price: number;
  prev_close: number;
}

export interface ApiSummaryData {
  total_call_oi: number;
  total_put_oi: number;
  total_call_volume: number;
  total_put_volume: number;
  avg_historical_volatility: number;
}

export interface VRPStatusInfo {
  status: 'low' | 'normal' | 'high' | 'extreme';
  statusLabel: string;
  description: string;
}

export interface IVAnalysisResult {
  atmIV: number;
  hv: number;
  vrp: number;
  vrpPercent: number;
  callSkew: number;
  putSkew: number;
  skew25Delta: number;
  put25IV: number;
  call25IV: number;
  status: 'low' | 'normal' | 'high' | 'extreme';
  statusLabel: string;
  description: string;
  tradingImplications: string[];
  riskWarnings: string[];
}

export interface PCRAnalysisResult {
  pcrOI: number;
  pcrVolume: number;
  status: 'extreme_bearish' | 'bearish' | 'neutral' | 'bullish' | 'extreme_bullish';
  statusLabel: string;
  description: string;
  tradingImplications: string[];
}

export interface GEXAnalysisResult {
  totalGEX: number;
  callGEX: number;
  putGEX: number;
  zeroGammaLevel: number;
  status: 'extreme_negative' | 'negative' | 'neutral' | 'positive' | 'extreme_positive';
  statusLabel: string;
  description: string;
  tradingImplications: string[];
}

export interface GEXDataPoint {
  strike: number;
  callGEX: number;
  putGEX: number;
  totalGEX: number;
}

export interface OptionAnalysisData {
  symbol: string;
  lastPrice: number;
  priceChange: number;
  priceChangePercent: number;
  maxPain: number;
  gammaExposure: number;
  putCallRatio: number;
  atmIv: number;
  skew: number;
  hv: number;
  vrp: number;
  ivPercentile?: number;
  oiData: OIData[];
  maxPainCurve: MaxPainData[];
  lastUpdated: string;
  gexData?: GEXAnalysisResult;
  pcrData?: PCRAnalysisResult;
  ivData?: IVAnalysisResult;
  optionChain?: ApiOptionData[];
}

export interface ExpiryDate {
  label: string;
  date: string;
  daysToExpiry: number;
}

export interface NavItem {
  key: string;
  label: string;
  icon?: string;
  children?: NavItem[];
}
