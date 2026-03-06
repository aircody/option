export interface EnvConfig {
  PYTHON_BACKEND_URL: string;
  API_BASE_PATH: string;
  MOCK_DELAY_MS: number;
  TIMEZONE: string;
  IV_PUT_TARGET_FACTOR: number;
  IV_CALL_TARGET_FACTOR: number;
  VRP_LOW_THRESHOLD: number;
  VRP_NORMAL_THRESHOLD: number;
  VRP_HIGH_THRESHOLD: number;
  VRP_WARNING_THRESHOLD: number;
  DEFAULT_SYMBOL: string;
  USE_MOCK: boolean;
}

const getEnv = (key: string, defaultValue: string): string => {
  return import.meta.env[key] ?? defaultValue;
};

const getEnvNumber = (key: string, defaultValue: number): number => {
  const value = import.meta.env[key];
  if (value === undefined) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
};

const getEnvBoolean = (key: string, defaultValue: boolean): boolean => {
  const value = import.meta.env[key];
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === 'true';
};

export const envConfig: EnvConfig = {
  PYTHON_BACKEND_URL: getEnv('VITE_PYTHON_BACKEND_URL', 'http://localhost:5000'),
  API_BASE_PATH: getEnv('VITE_API_BASE_PATH', '/v1'),
  MOCK_DELAY_MS: getEnvNumber('VITE_MOCK_DELAY_MS', 500),
  TIMEZONE: getEnv('VITE_TIMEZONE', 'America/New_York'),
  IV_PUT_TARGET_FACTOR: getEnvNumber('VITE_IV_PUT_TARGET_FACTOR', 0.93),
  IV_CALL_TARGET_FACTOR: getEnvNumber('VITE_IV_CALL_TARGET_FACTOR', 1.07),
  VRP_LOW_THRESHOLD: getEnvNumber('VITE_VRP_LOW_THRESHOLD', 5),
  VRP_NORMAL_THRESHOLD: getEnvNumber('VITE_VRP_NORMAL_THRESHOLD', 15),
  VRP_HIGH_THRESHOLD: getEnvNumber('VITE_VRP_HIGH_THRESHOLD', 30),
  VRP_WARNING_THRESHOLD: getEnvNumber('VITE_VRP_WARNING_THRESHOLD', 20),
  DEFAULT_SYMBOL: getEnv('VITE_DEFAULT_SYMBOL', 'QQQ'),
  USE_MOCK: getEnvBoolean('VITE_USE_MOCK', false),
};
