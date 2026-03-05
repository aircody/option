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
  oiData: OIData[];
  maxPainCurve: MaxPainData[];
  lastUpdated: string;
  gexData?: any;
  pcrData?: any;
  ivData?: any;
  optionChain?: any[];
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
