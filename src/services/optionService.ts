import type { OptionAnalysisData, ExpiryDate } from '../types';
import { getMockOptionData, mockExpiryDates } from '../mock/optionData';

const USE_MOCK = true;

export const fetchOptionAnalysis = async (symbol: string): Promise<OptionAnalysisData> => {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return getMockOptionData(symbol);
  }

  throw new Error('Real API not implemented yet');
};

export const fetchExpiryDates = async (): Promise<ExpiryDate[]> => {
  if (USE_MOCK) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    return mockExpiryDates;
  }

  throw new Error('Real API not implemented yet');
};
