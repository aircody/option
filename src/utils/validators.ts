import { SYMBOL_PATTERN } from './constants';

export const validators = {
  symbol: (symbol: string): boolean => {
    return SYMBOL_PATTERN.test(symbol);
  },

  expiryDate: (dateStr: string): boolean => {
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  },

  apiConfig: (config: {
    baseUrl?: string;
    appKey?: string;
    appSecret?: string;
    accessToken?: string;
  }): boolean => {
    return !!(
      config.baseUrl?.trim() &&
      config.appKey?.trim() &&
      config.appSecret?.trim() &&
      config.accessToken?.trim()
    );
  },

  dteRange: (min: number, max: number): boolean => {
    return min >= 0 && max >= min && max <= 365;
  }
};
