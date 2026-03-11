import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Layout, Typography, Spin, Row, Col, Divider, message, Tabs, Result, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import SidebarMenu from '../components/SidebarMenu';
import SymbolSelector from '../components/SymbolSelector';
import ExpirySelector from '../components/ExpirySelector';
import MetricCards from '../components/MetricCards';
import OIWallChart from '../components/OIWallChart';
import MaxPainChart from '../components/MaxPainChart';
import GEXChart from '../components/GEXChart';
import PCRChart from '../components/PCRChart';
import IVChart from '../components/IVChart';
import SkewChart from '../components/SkewChart';
import StrategyGuide from '../components/StrategyGuide';
import Settings from './Settings';
import StrategySubscription from './StrategySubscription';
import { fetchOptionAnalysis, fetchExpiryDates } from '../services/optionService';
import type { OptionAnalysisData, ExpiryDate } from '../types';
import { getCurrentEasternTime } from '../utils/formatters';

const { Content, Sider } = Layout;
const { Title, Text } = Typography;

const OptionAnalysis: React.FC = () => {
  const [selectedMenuKey, setSelectedMenuKey] = useState('option-analysis');
  const [selectedSymbol, setSelectedSymbol] = useState('QQQ');
  const [selectedExpiry, setSelectedExpiry] = useState<string>('');
  const [expiryDates, setExpiryDates] = useState<ExpiryDate[]>([]);
  const [data, setData] = useState<OptionAnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('strategy');
  const [lastFetchTime, setLastFetchTime] = useState<string>('');

  const loadExpiryDates = useCallback(async (symbol: string) => {
    try {
      const dates = await fetchExpiryDates(symbol);
      setExpiryDates(dates);

      if (dates.length > 0 && !selectedExpiry) {
        setSelectedExpiry(dates[0].date);
      }

      return dates;
    } catch (error) {
      const errorMessage = (error as Error).message;
      message.error('加载到期日失败: ' + errorMessage);
      setError(errorMessage);
      return [];
    }
  }, [selectedExpiry]);

  const loadData = useCallback(async (symbol: string, expiryDate?: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchOptionAnalysis(symbol, expiryDate);
      setData(result);
      setLastFetchTime(getCurrentEasternTime());
    } catch (error) {
      const errorMessage = (error as Error).message;
      message.error('加载期权数据失败: ' + errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      try {
        const dates = await loadExpiryDates(selectedSymbol);
        if (dates.length > 0) {
          await loadData(selectedSymbol, dates[0].date);
        } else {
          await loadData(selectedSymbol);
        }
      } catch (error) {
        console.error('Initialization error:', error);
      }
    };
    init();
  }, []);

  const handleSymbolChange = (symbol: string) => {
    setSelectedSymbol(symbol);
    setSelectedExpiry('');
    setData(null);
    setError(null);
  };

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const dates = await loadExpiryDates(selectedSymbol);

      if (dates.length > 0) {
        setSelectedExpiry(dates[0].date);
        await loadData(selectedSymbol, dates[0].date);
      } else {
        await loadData(selectedSymbol);
      }
    } catch (error) {
      console.error('Analyze error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExpiryChange = async (date: string) => {
    setSelectedExpiry(date);
    setLoading(true);
    try {
      await loadData(selectedSymbol, date);
    } catch (error) {
      console.error('Failed to load data for new expiry:', error);
    } finally {
      setLoading(false);
    }
  };

  const getContractCount = useCallback(() => {
    if (!data || !data.oiData) return 0;
    return data.oiData.length * 2;
  }, [data]);

  const formatContractCount = useCallback(() => {
    const count = getContractCount();
    return count > 0 ? `${count} 个合约` : '暂无合约数据';
  }, [getContractCount]);

  const getSelectedExpiryLabel = useCallback(() => {
    const selected = expiryDates.find(d => d.date === selectedExpiry);
    return selected ? selected.label : '';
  }, [expiryDates, selectedExpiry]);

  const getDaysToExpiry = useCallback(() => {
    const selected = expiryDates.find(d => d.date === selectedExpiry);
    return selected ? selected.daysToExpiry : 30;
  }, [expiryDates, selectedExpiry]);

  const pcrStatus = useMemo(() => {
    if (!data) return undefined;
    return data.pcrData?.status;
  }, [data]);

  const renderError = () => (
    <Result
      status="error"
      title="加载失败"
      subTitle={error}
      extra={
        <Button type="primary" icon={<ReloadOutlined />} onClick={handleAnalyze}>
          重试
        </Button>
      }
    />
  );

  const renderContent = () => {
    if (selectedMenuKey === 'settings') {
      return <Settings />;
    }

    if (selectedMenuKey === 'strategy-subscription') {
      return <StrategySubscription />;
    }

    if (error) {
      return renderError();
    }

    return (
      <>
        <Title level={4} style={{ marginBottom: '24px' }}>
          期权分析
        </Title>

        <div
          style={{
            background: '#fff',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          <SymbolSelector
            selectedSymbol={selectedSymbol}
            onSymbolChange={handleSymbolChange}
            onAnalyze={handleAnalyze}
            loading={loading}
          />

          <Divider style={{ margin: '16px 0' }} />

          {expiryDates.length > 0 ? (
            <ExpirySelector
              expiryDates={expiryDates}
              selectedExpiry={selectedExpiry}
              onExpiryChange={handleExpiryChange}
              loading={loading}
            />
          ) : (
            <Text type="secondary">暂无到期日数据</Text>
          )}

          {data && (
            <div style={{ marginTop: '12px' }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {data.symbol} 分析完成 — {getSelectedExpiryLabel()} ({selectedExpiry}) — {formatContractCount()}
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                上次分析: {lastFetchTime || data.lastUpdated} 美东
              </Text>
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Spin size="large" />
          </div>
        ) : data ? (
          <>
            <div style={{ marginBottom: '24px' }}>
              <MetricCards data={data} />
            </div>

            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={[
                {
                  key: 'chart',
                  label: 'Chart',
                  children: (
                    <>
                      <Row gutter={[24, 24]}>
                        <Col xs={24} lg={12}>
                          <OIWallChart
                            data={data.oiData}
                            maxPain={data.maxPain}
                            currentPrice={data.lastPrice}
                            daysToExpiry={getDaysToExpiry()}
                          />
                        </Col>
                        <Col xs={24} lg={12}>
                          <MaxPainChart
                            data={data.maxPainCurve}
                            maxPainStrike={data.maxPain}
                            currentPrice={data.lastPrice}
                            daysToExpiry={getDaysToExpiry()}
                            oiData={data.oiData}
                          />
                        </Col>
                      </Row>

                      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
                        <Col xs={24} lg={12}>
                          <GEXChart
                            oiData={data.oiData}
                            currentPrice={data.lastPrice}
                            gammaExposure={data.gammaExposure}
                          />
                        </Col>
                        <Col xs={24} lg={12}>
                          <PCRChart
                            oiData={data.oiData}
                            currentPrice={data.lastPrice}
                            putCallRatio={data.putCallRatio}
                          />
                        </Col>
                      </Row>

                      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
                        <Col xs={24} lg={12}>
                          <IVChart
                            oiData={data.oiData}
                            currentPrice={data.lastPrice}
                            atmIv={data.atmIv}
                            hv={data.hv}
                            vrp={data.vrp}
                            gammaExposure={data.gammaExposure}
                            pcr={data.putCallRatio}
                            ivData={data.ivData}
                            optionChain={data.optionChain}
                          />
                        </Col>
                        <Col xs={24} lg={12}>
                          <SkewChart
                            oiData={data.oiData}
                            currentPrice={data.lastPrice}
                            atmIV={data.atmIv}
                            pcr={data.putCallRatio}
                            gammaExposure={data.gammaExposure}
                            ivData={data.ivData}
                            optionChain={data.optionChain}
                            pcrStatus={pcrStatus}
                          />
                        </Col>
                      </Row>
                    </>
                  ),
                },
                {
                  key: 'strategy',
                  label: 'Strategy',
                  children: (
                    <StrategyGuide
                      oiData={data.oiData}
                      currentPrice={data.lastPrice}
                      gammaExposure={data.gammaExposure}
                      putCallRatio={data.putCallRatio}
                      atmIv={data.atmIv}
                      hv={data.hv}
                      vrp={data.vrp}
                      skew={data.skew}
                      maxPain={data.maxPain}
                    />
                  ),
                },
              ]}
            />
          </>
        ) : null}
      </>
    );
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={200}
        style={{
          background: '#fff',
          boxShadow: '2px 0 8px rgba(0,0,0,0.06)',
          zIndex: 10,
        }}
      >
        <SidebarMenu
          selectedKey={selectedMenuKey}
          onSelect={setSelectedMenuKey}
        />
      </Sider>

      <Layout style={{ background: '#f5f5f5' }}>
        <Content style={{ padding: '24px', overflow: 'auto' }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            {renderContent()}
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default OptionAnalysis;
