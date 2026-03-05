export interface ApiConfig {
  appKey: string;
  appSecret: string;
  accessToken: string;
  baseUrl: string;
  useMock: boolean;
}

export const defaultApiConfig: ApiConfig = {
  appKey: '',
  appSecret: '',
  accessToken: '',
  baseUrl: 'https://openapi.longportapp.com',
  useMock: true,
};
