export const STORAGE_KEYS = {
  SAVED_SYMBOLS_OPTION: 'option_analysis_saved_symbols',
  SAVED_SYMBOLS_STRATEGY: 'strategy_subscription_saved_symbols',
  LAST_SYMBOL: 'option_analysis_last_symbol',
} as const;

export const PRESET_SYMBOLS = ['SPY', 'QQQ', 'IWM'] as const;

export const SYMBOL_PATTERN = /^[A-Z]{1,5}$/;

export const DATE_FORMATS = {
  SHORT: 'MM/DD',
  FULL: 'YYYY-MM-DD',
} as const;

export const DTE_LIMIT = 45;

export const CONTRACT_MULTIPLIER = 100;

export const BATCH_SIZE = 50;
