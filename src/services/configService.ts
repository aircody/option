import type { ApiConfig } from '../types/settings';
import { defaultApiConfig } from '../types/settings';

const CONFIG_KEY = 'option_analysis_config';

export const getApiConfig = (): ApiConfig => {
  try {
    const stored = localStorage.getItem(CONFIG_KEY);
    if (stored) {
      return { ...defaultApiConfig, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Failed to load config:', error);
  }
  return defaultApiConfig;
};

export const saveApiConfig = (config: ApiConfig): void => {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Failed to save config:', error);
  }
};

export const clearApiConfig = (): void => {
  try {
    localStorage.removeItem(CONFIG_KEY);
  } catch (error) {
    console.error('Failed to clear config:', error);
  }
};
