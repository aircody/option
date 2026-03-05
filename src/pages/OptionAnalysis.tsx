import React, { useState, useEffect } from 'react';
import { Layout, Typography, Tabs, Spin, Row, Col, Divider } from 'antd';
import SidebarMenu from '../components/SidebarMenu';
import SymbolSelector from '../components/SymbolSelector';
import ExpirySelector from '../components/ExpirySelector';
import MetricCards from '../components/MetricCards';
import OIWallChart from '../components/OIWallChart';
import MaxPainChart from '../components/MaxPainChart';
import { fetchOptionAnalysis, fetchExpiryDates } from '../services/optionService';
import type { OptionAnalysisData, ExpiryDate } from '../types';

const { Content, Sider } = Layout;
const { Title, Text } = Typography;

const OptionAnalysis: React.FC = () => {
  const [selectedMenuKey, setSelectedMenuKey] = useState('option-analysis');
  const [selectedSymbol, setSelectedSymbol] = useState('QQQ');
  const [selectedExpiry, setSelectedExpiry] = useState('2026-03-06');
  const [expiryDates, setExpiryDates] = useState<ExpiryDate[]>([]);
  const [data, setData] = useState<OptionAnalysisData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('structure');

  useEffect(() => {
    loadExpiryDates();
    loadData(selectedSymbol);
  }, []);

  const loadExpiryDates = async () => {
    try {
      const dates = await fetchExpiryDates();
      setExpiryDates(dates);
      if (dates.length > 0) {
        setSelectedExpiry(dates[0].date);
      }
    } catch (error) {
      console.error('Failed to load expiry dates:', error);
    }
  };

  const loadData = async (symbol: string) => {
    setLoading(true);
    try {
      const result = await fetchOptionAnalysis(symbol);
      setData(result);
    } catch (error) {
      console.error('Failed to load option data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnalyze = () => {
    loadData(selectedSymbol);
  };

  const tabItems = [
    { key: 'structure', label: 'Structure' },
    { key: 'volatility', label: 'Volatility' },
    { key: 'trend', label: 'Trend' },
  ];

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
                onSymbolChange={setSelectedSymbol}
                onAnalyze={handleAnalyze}
              />

              <Divider style={{ margin: '16px 0' }} />

              <ExpirySelector
                expiryDates={expiryDates}
                selectedExpiry={selectedExpiry}
                onExpiryChange={setSelectedExpiry}
              />

              {data && (
                <div style={{ marginTop: '12px' }}>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {data.symbol} 分析完成 — {new Date().toISOString().split('T')[0]} — {data.oiData.length * 2} 个合约
                  </Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    上次分析: {data.lastUpdated} 美东{' '}
                    <a href="#" style={{ color: '#1890ff' }}>
                      刷新
                    </a>
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
                <Tabs
                  activeKey={activeTab}
                  onChange={setActiveTab}
                  items={tabItems}
                  style={{ marginBottom: '16px' }}
                />

                <div style={{ marginBottom: '24px' }}>
                  <MetricCards data={data} />
                </div>

                <Row gutter={[24, 24]}>
                  <Col xs={24} lg={12}>
                    <OIWallChart data={data.oiData} maxPain={data.maxPain} />
                  </Col>
                  <Col xs={24} lg={12}>
                    <MaxPainChart
                      data={data.maxPainCurve}
                      maxPainStrike={data.maxPain}
                    />
                  </Col>
                </Row>
              </>
            ) : null}

            <div style={{ textAlign: 'right', marginTop: '16px' }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                使用: {new Date().toLocaleString('zh-CN')}
              </Text>
            </div>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default OptionAnalysis;
