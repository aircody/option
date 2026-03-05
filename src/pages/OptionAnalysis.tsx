import React, { useState, useEffect, useCallback } from 'react';
import { Layout, Typography, Spin, Row, Col, Divider, message, Tabs } from 'antd';
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
import { fetchOptionAnalysis, fetchExpiryDates } from '../services/optionService';
import type { OptionAnalysisData, ExpiryDate } from '../types';

const { Content, Sider } = Layout;
const { Title, Text } = Typography;

const OptionAnalysis: React.FC = () => {
  const [selectedMenuKey, setSelectedMenuKey] = useState('option-analysis');
  const [selectedSymbol, setSelectedSymbol] = useState('QQQ');
  const [selectedExpiry, setSelectedExpiry] = useState<string>('');
  const [expiryDates, setExpiryDates] = useState<ExpiryDate[]>([]);
  const [data, setData] = useState<OptionAnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('strategy');
  // 记录数据获取时间
  const [lastFetchTime, setLastFetchTime] = useState<string>('');

  // 加载到期日列表
  const loadExpiryDates = useCallback(async (symbol: string) => {
    console.log('[Debug] Loading expiry dates for symbol:', symbol);
    try {
      const dates = await fetchExpiryDates(symbol);
      console.log('[Debug] Loaded expiry dates:', dates);
      setExpiryDates(dates);
      
      // 默认选中第一个到期日
      if (dates.length > 0 && !selectedExpiry) {
        setSelectedExpiry(dates[0].date);
      }
      
      return dates;
    } catch (error) {
      console.error('[Debug] Failed to load expiry dates:', error);
      message.error('加载到期日失败: ' + (error as Error).message);
      return [];
    }
  }, [selectedExpiry]);

  // 加载期权数据
  const loadData = useCallback(async (symbol: string, expiryDate?: string) => {
    console.log('[Debug] Loading option data for symbol:', symbol, 'expiry:', expiryDate);
    setLoading(true);
    try {
      // 如果指定了到期日，可以传递给API获取特定到期日的数据
      const result = await fetchOptionAnalysis(symbol, expiryDate);
      console.log('[Debug] Loaded option data:', result);
      setData(result);
      // 更新数据获取时间（美东时间）
      const now = new Date();
      const easternTime = now.toLocaleString('zh-CN', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setLastFetchTime(easternTime);
    } catch (error) {
      console.error('[Debug] Failed to load option data:', error);
      message.error('加载期权数据失败: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始化加载
  useEffect(() => {
    console.log('[Debug] Initializing with symbol:', selectedSymbol);
    const init = async () => {
      try {
        const dates = await loadExpiryDates(selectedSymbol);
        // 使用第一个到期日加载数据
        if (dates.length > 0) {
          await loadData(selectedSymbol, dates[0].date);
        } else {
          await loadData(selectedSymbol);
        }
      } catch (error) {
        console.error('[Debug] Initialization error:', error);
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 处理股票代码变更
  const handleSymbolChange = (symbol: string) => {
    console.log('[Debug] Symbol changed to:', symbol);
    setSelectedSymbol(symbol);
    setSelectedExpiry(''); // 清空选中的到期日
    setData(null);
  };

  // 处理分析/刷新
  const handleAnalyze = async () => {
    console.log('[Debug] Analyze button clicked for symbol:', selectedSymbol);
    setLoading(true);
    try {
      // 先加载到期日
      const dates = await loadExpiryDates(selectedSymbol);
      
      // 如果有到期日，选中第一个
      if (dates.length > 0) {
        setSelectedExpiry(dates[0].date);
        // 使用选中的到期日加载数据
        await loadData(selectedSymbol, dates[0].date);
      } else {
        await loadData(selectedSymbol);
      }
    } catch (error) {
      console.error('[Debug] Analyze error:', error);
    } finally {
      setLoading(false);
    }
  };

  // 处理到期日变更
  const handleExpiryChange = async (date: string) => {
    console.log('[Debug] Expiry changed to:', date);
    setSelectedExpiry(date);
    
    // 到期日变更时，重新加载该到期日的数据
    setLoading(true);
    try {
      await loadData(selectedSymbol, date);
    } catch (error) {
      console.error('[Debug] Failed to load data for new expiry:', error);
    } finally {
      setLoading(false);
    }
  };

  // 计算合约数量 - 根据当前选中的到期日
  const getContractCount = () => {
    if (!data || !data.oiData) return 0;
    // 每个执行价有 Call 和 Put 两个合约
    return data.oiData.length * 2;
  };

  // 格式化合约数量显示
  const formatContractCount = () => {
    const count = getContractCount();
    return count > 0 ? `${count} 个合约` : '暂无合约数据';
  };

  // 获取选中的到期日标签
  const getSelectedExpiryLabel = () => {
    const selected = expiryDates.find(d => d.date === selectedExpiry);
    return selected ? selected.label : '';
  };

  // 计算距离到期天数
  const getDaysToExpiry = () => {
    const selected = expiryDates.find(d => d.date === selectedExpiry);
    return selected ? selected.daysToExpiry : 30;
  };

  const renderContent = () => {
    if (selectedMenuKey === 'settings') {
      return <Settings />;
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
