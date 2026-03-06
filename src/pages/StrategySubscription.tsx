import React, { useState, useCallback, useEffect } from 'react';
import {
  Typography,
  Card,
  Row,
  Col,
  Tag,
  Button,
  Input,
  Select,
  Slider,
  Table,
  Space,
  message,
  Empty,
  Spin,
  Divider,
  Alert,
  Progress,
  Statistic,
} from 'antd';
import {
  SearchOutlined,
  PlusOutlined,
  FilterOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  StockOutlined,
  ThunderboltOutlined,
  SafetyOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import { fetchOptionAnalysis, fetchExpiryDates } from '../services/optionService';
import { generateStrategyRecommendation } from '../utils/strategyCalculator';
import type { ExpiryDate } from '../types';

const { Title, Text } = Typography;
const { Option } = Select;

interface StrategyScanResult {
  symbol: string;
  expiryDate: string;
  expiryLabel: string;
  daysToExpiry: number;
  strategyName: string;
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  description: string;
  timestamp: string;
}

interface SavedSymbol {
  symbol: string;
  isPreset: boolean;
}

const PRESET_SYMBOLS = ['SPY', 'QQQ', 'IWM'];

const StrategySubscription: React.FC = () => {
  const [symbols, setSymbols] = useState<SavedSymbol[]>(
    PRESET_SYMBOLS.map((s) => ({ symbol: s, isPreset: true }))
  );
  const [customSymbolInput, setCustomSymbolInput] = useState('');
  const [dteRange, setDteRange] = useState<[number, number]>([7, 15]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<StrategyScanResult[]>([]);
  const [filterStrategy, setFilterStrategy] = useState<string>('');
  const [filterSymbol, setFilterSymbol] = useState<string>('');
  const [scanProgress, setScanProgress] = useState(0);
  const [allExpiryDates, setAllExpiryDates] = useState<ExpiryDate[]>([]);

  const loadAllExpiryDates = useCallback(async () => {
    if (symbols.length === 0) {
      setAllExpiryDates([]);
      return;
    }

    try {
      const allDates: ExpiryDate[] = [];
      for (const { symbol } of symbols) {
        try {
          const dates = await fetchExpiryDates(symbol);
          dates.forEach((date) => {
            if (!allDates.find((d) => d.date === date.date)) {
              allDates.push(date);
            }
          });
        } catch {
          // ignore errors for individual symbols
        }
      }
      allDates.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setAllExpiryDates(allDates);
    } catch (error) {
      console.error('Failed to load expiry dates:', error);
    }
  }, [symbols]);

  useEffect(() => {
    loadAllExpiryDates();
  }, [loadAllExpiryDates]);

  const filteredExpiryDates = allExpiryDates.filter(
    (d) => d.daysToExpiry >= dteRange[0] && d.daysToExpiry <= dteRange[1]
  );

  const addSymbol = () => {
    const symbol = customSymbolInput.toUpperCase().trim();
    if (!symbol) {
      message.warning('请输入股票代码');
      return;
    }
    if (!/^[A-Z]{1,5}$/.test(symbol)) {
      message.warning('股票代码格式不正确');
      return;
    }
    if (symbols.some((s) => s.symbol === symbol)) {
      message.warning('该股票已添加');
      return;
    }
    setSymbols([...symbols, { symbol, isPreset: false }]);
    setCustomSymbolInput('');
    message.success(`已添加 ${symbol}`);
  };

  const removeSymbol = (symbol: string) => {
    setSymbols(symbols.filter((s) => s.symbol !== symbol));
    message.success(`已移除 ${symbol}`);
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'low':
        return 'success';
      case 'medium':
        return 'warning';
      case 'high':
        return 'error';
      case 'extreme':
        return 'volcano';
      default:
        return 'default';
    }
  };

  const getRiskLevelText = (level: string) => {
    switch (level) {
      case 'low':
        return '低风险';
      case 'medium':
        return '中风险';
      case 'high':
        return '高风险';
      case 'extreme':
        return '极高风险';
      default:
        return '未知';
    }
  };

  const getStrategyIcon = (strategyName: string) => {
    if (strategyName.includes('看涨') || strategyName.includes('牛')) {
      return <RiseOutlined style={{ color: '#52c41a' }} />;
    }
    if (strategyName.includes('看跌') || strategyName.includes('熊')) {
      return <RiseOutlined style={{ color: '#ff4d4f', transform: 'rotate(180deg)' }} />;
    }
    if (strategyName.includes('套利') || strategyName.includes('铁鹰') || strategyName.includes('蝶式')) {
      return <SafetyOutlined style={{ color: '#1890ff' }} />;
    }
    if (strategyName.includes('对冲') || strategyName.includes('观望')) {
      return <ClockCircleOutlined style={{ color: '#faad14' }} />;
    }
    return <ThunderboltOutlined style={{ color: '#722ed1' }} />;
  };

  const scanStrategies = async () => {
    if (symbols.length === 0) {
      message.warning('请至少添加一个股票代码');
      return;
    }

    setLoading(true);
    setResults([]);
    setScanProgress(0);

    try {
      const newResults: StrategyScanResult[] = [];
      let total = 0;
      let completed = 0;

      for (const { symbol } of symbols) {
        try {
          const expiryDates = await fetchExpiryDates(symbol);
          const filteredExpiries = expiryDates.filter(
            (d) => d.daysToExpiry >= dteRange[0] && d.daysToExpiry <= dteRange[1]
          );
          total += filteredExpiries.length;
        } catch {
          // ignore
        }
      }

      for (const { symbol } of symbols) {
        try {
          const expiryDates = await fetchExpiryDates(symbol);
          const filteredExpiries = expiryDates.filter(
            (d) => d.daysToExpiry >= dteRange[0] && d.daysToExpiry <= dteRange[1]
          );

          for (const expiry of filteredExpiries) {
            try {
              const data = await fetchOptionAnalysis(symbol, expiry.date);

              if (data && data.oiData && data.oiData.length > 0) {
                const recommendation = generateStrategyRecommendation(
                  data.oiData,
                  data.lastPrice || 0,
                  data.ivPercentile || 50,
                  data.gammaExposure,
                  data.putCallRatio,
                  data.atmIv,
                  data.hv,
                  data.vrp,
                  data.skew,
                  data.maxPain
                );

                if (symbol === 'IWM' && expiry.date === '2026-03-13') {
                  console.log('===== IWM 2026-03-13 详细分析 =====');
                  console.log('策略名称:', recommendation.strategy.name);
                  console.log('环境类型:', recommendation.environment.type);
                  console.log('主信号类型:', recommendation.primarySignal.type);
                  console.log('主信号匹配条件数:', recommendation.primarySignal.matchedConditions, '/', recommendation.primarySignal.totalConditions);
                  console.log('主信号强度:', recommendation.primarySignal.strength);
                  console.log('风险等级:', recommendation.riskLevel);
                  console.log('辅助信号:', recommendation.secondarySignal ? recommendation.secondarySignal.type : '无');
                  console.log('--- 主信号详细条件 ---');
                  recommendation.primarySignal.conditions.forEach((cond, idx) => {
                    console.log(`  ${idx + 1}. ${cond.name}:`, cond.status, '-', cond.description);
                  });
                  console.log('==============================');
                }

                if (recommendation.strategy.name !== '观望/等待信号') {
                  newResults.push({
                    symbol,
                    expiryDate: expiry.date,
                    expiryLabel: expiry.label,
                    daysToExpiry: expiry.daysToExpiry,
                    strategyName: recommendation.strategy.name,
                    riskLevel: recommendation.riskLevel,
                    description: recommendation.strategy.description,
                    timestamp: new Date().toLocaleString('zh-CN'),
                  });
                }
              }
            } catch (err) {
              console.error(`Error scanning ${symbol} ${expiry.date}:`, err);
            }
            completed++;
            setScanProgress(Math.round((completed / total) * 100));
          }
        } catch (err) {
          console.error(`Error fetching expiries for ${symbol}:`, err);
        }
      }

      setResults(newResults);
      message.success(
        newResults.length > 0
          ? `扫描完成，发现 ${newResults.length} 个策略`
          : '扫描完成，未发现符合条件的策略'
      );
    } catch (error) {
      console.error('Scan error:', error);
      message.error('扫描失败');
    } finally {
      setLoading(false);
      setScanProgress(0);
    }
  };

  const filteredResults = results.filter((r) => {
    if (filterStrategy && r.strategyName !== filterStrategy) return false;
    if (filterSymbol && r.symbol !== filterSymbol) return false;
    return true;
  });

  const uniqueStrategies = Array.from(new Set(results.map((r) => r.strategyName)));
  const uniqueSymbols = Array.from(new Set(results.map((r) => r.symbol)));

  const columns = [
    {
      title: '股票代码',
      dataIndex: 'symbol',
      key: 'symbol',
      width: 120,
      render: (text: string) => (
        <Tag color="blue" icon={<StockOutlined />}>
          {text}
        </Tag>
      ),
    },
    {
      title: '到期日',
      dataIndex: 'expiryLabel',
      key: 'expiryLabel',
      width: 180,
      render: (text: string, record: StrategyScanResult) => (
        <Space>
          <Text strong>{text}</Text>
          <Tag color="default" style={{ fontSize: '11px' }}>
            {record.daysToExpiry} DTE
          </Tag>
        </Space>
      ),
    },
    {
      title: '推荐策略',
      dataIndex: 'strategyName',
      key: 'strategyName',
      width: 220,
      render: (text: string, record: StrategyScanResult) => (
        <Space wrap size="small">
          <Tag color="purple" icon={getStrategyIcon(text)} style={{ fontSize: '13px' }}>
            {text}
          </Tag>
          <Tag color={getRiskLevelColor(record.riskLevel)} style={{ fontSize: '11px' }}>
            {getRiskLevelText(record.riskLevel)}
          </Tag>
        </Space>
      ),
    },
    {
      title: '策略描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: { showTitle: true },
      render: (text: string) => <Text type="secondary" style={{ fontSize: '12px' }}>{text}</Text>,
    },
    {
      title: '扫描时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 160,
      render: (text: string) => (
        <Space size="small">
          <ClockCircleOutlined style={{ fontSize: '12px', color: '#8c8c8c' }} />
          <Text type="secondary" style={{ fontSize: '12px' }}>{text}</Text>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={4} style={{ marginBottom: '24px' }}>
        期权策略扫描
      </Title>

      {loading && (
        <Alert
          message="正在扫描策略..."
          description={
            <div>
              <Progress percent={scanProgress} status="active" style={{ marginBottom: '8px' }} />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                扫描进度 {scanProgress}%
              </Text>
            </div>
          }
          type="info"
          showIcon
          icon={<ThunderboltOutlined spin />}
          style={{ marginBottom: '16px' }}
        />
      )}

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card
            title={
              <Space>
                <StockOutlined style={{ color: '#1890ff' }} />
                <span>扫描配置</span>
              </Space>
            }
            style={{ marginBottom: '16px' }}
            headStyle={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff' }}
            extra={
              <Button
                type="primary"
                size="large"
                icon={<SearchOutlined />}
                onClick={scanStrategies}
                loading={loading}
                disabled={symbols.length === 0}
                style={{
                  background: loading ? '#d9d9d9' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  boxShadow: loading ? 'none' : '0 4px 12px rgba(102, 126, 234, 0.4)',
                }}
              >
                {loading ? '扫描中...' : '开始扫描'}
              </Button>
            }
          >
            <div style={{ marginBottom: '24px' }}>
              <Text strong style={{ display: 'block', marginBottom: '12px', fontSize: '14px' }}>
                股票代码
              </Text>
              <Space wrap style={{ marginBottom: '16px' }}>
                {symbols.map(({ symbol, isPreset }) => (
                  <Tag
                    key={symbol}
                    color={isPreset ? 'blue' : 'cyan'}
                    closable
                    onClose={() => removeSymbol(symbol)}
                    style={{
                      fontSize: '14px',
                      padding: '6px 16px',
                      borderRadius: '20px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.08)',
                    }}
                  >
                    {symbol}
                  </Tag>
                ))}
              </Space>
              <Space>
                <Input
                  placeholder="输入股票代码（如：AAPL）"
                  value={customSymbolInput}
                  onChange={(e) => setCustomSymbolInput(e.target.value)}
                  onPressEnter={addSymbol}
                  style={{ width: '180px', borderRadius: '8px' }}
                  maxLength={5}
                  allowClear
                />
                <Button
                  type="default"
                  icon={<PlusOutlined />}
                  onClick={addSymbol}
                  style={{ borderRadius: '8px' }}
                >
                  添加
                </Button>
              </Space>
            </div>

            <Divider style={{ margin: '20px 0' }} dashed />

            <div style={{ marginBottom: '8px' }}>
              <Text strong style={{ display: 'block', marginBottom: '12px', fontSize: '14px' }}>
                到期日范围 (DTE)
              </Text>
              <div style={{ padding: '0 24px' }}>
                <Slider
                  range
                  min={0}
                  max={45}
                  value={dteRange}
                  onChange={setDteRange}
                  marks={{
                    0: '0',
                    7: '7',
                    15: '15',
                    30: '30',
                    45: '45',
                  }}
                  trackStyle={[{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }]}
                  handleStyle={[
                    { borderColor: '#764ba2', boxShadow: '0 2px 8px rgba(118, 75, 162, 0.4)' },
                    { borderColor: '#764ba2', boxShadow: '0 2px 8px rgba(118, 75, 162, 0.4)' },
                  ]}
                />
                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                  <Space size="middle">
                    <Statistic
                      title="最小 DTE"
                      value={dteRange[0]}
                      valueStyle={{ color: '#667eea', fontSize: '20px' }}
                    />
                    <span style={{ fontSize: '24px', color: '#d9d9d9' }}>—</span>
                    <Statistic
                      title="最大 DTE"
                      value={dteRange[1]}
                      valueStyle={{ color: '#764ba2', fontSize: '20px' }}
                    />
                  </Space>
                </div>
              </div>
              {filteredExpiryDates.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <Text strong style={{ fontSize: '12px', color: '#8c8c8c', display: 'block', marginBottom: '8px' }}>
                    符合条件的到期日 ({filteredExpiryDates.length} 个):
                  </Text>
                  <Space wrap size={[6, 6]}>
                    {filteredExpiryDates.map((expiry) => (
                      <Tag
                        key={expiry.date}
                        color="blue"
                        style={{
                          fontSize: '12px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                        }}
                      >
                        {expiry.label} <Text type="secondary" style={{ fontSize: '11px' }}>({expiry.daysToExpiry} DTE)</Text>
                      </Tag>
                    ))}
                  </Space>
                </div>
              )}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <FilterOutlined style={{ color: '#52c41a' }} />
                <span>扫描说明</span>
              </Space>
            }
            style={{ height: '100%' }}
            headStyle={{ background: '#f6ffed', color: '#52c41a' }}
          >
            <Alert
              message="扫描逻辑"
              description="对每个股票+到期日组合进行策略分析"
              type="info"
              showIcon
              style={{ marginBottom: '16px' }}
            />
            <div style={{ marginBottom: '16px' }}>
              <Text strong style={{ fontSize: '13px' }}>扫描范围：</Text>
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                所选股票 + {dteRange[0]}-{dteRange[1]} 日到期日的所有组合
              </Text>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <Text strong style={{ fontSize: '13px' }}>触发条件：</Text>
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                推荐策略不为"观望/等待信号"
              </Text>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <Text strong style={{ fontSize: '13px' }}>判断依据：</Text>
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                基于 GEX、Max Pain、OI Wall、PCR、ATM IV/VRP、SKEW 六大核心指标共振分析
              </Text>
            </div>
            <Divider style={{ margin: '16px 0' }} dashed />
            <Alert
              message="提示"
              description="扫描可能需要较长时间，请耐心等待。扫描过程中请勿关闭页面。"
              type="warning"
              showIcon
              style={{ fontSize: '12px' }}
            />
          </Card>
        </Col>
      </Row>

      {results.length > 0 && (
        <Card
          title={
            <Space>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              <span>扫描结果</span>
              <Tag color="green" style={{ fontSize: '12px' }}>
                {filteredResults.length} 个策略
              </Tag>
            </Space>
          }
          style={{ marginTop: '16px' }}
          headStyle={{ background: '#f6ffed' }}
          extra={
            <Space>
              <Select
                placeholder="筛选策略"
                style={{ width: '220px' }}
                value={filterStrategy}
                onChange={setFilterStrategy}
                allowClear
                size="middle"
              >
                {uniqueStrategies.map((s) => (
                  <Option key={s} value={s}>
                    {s}
                  </Option>
                ))}
              </Select>
              <Select
                placeholder="筛选股票"
                style={{ width: '140px' }}
                value={filterSymbol}
                onChange={setFilterSymbol}
                allowClear
                size="middle"
              >
                {uniqueSymbols.map((s) => (
                  <Option key={s} value={s}>
                    {s}
                  </Option>
                ))}
              </Select>
              <Button
                onClick={() => {
                  setFilterStrategy('');
                  setFilterSymbol('');
                }}
                size="middle"
              >
                重置
              </Button>
            </Space>
          }
        >
          <Spin spinning={loading}>
            {filteredResults.length === 0 ? (
              <Empty
                description="没有符合筛选条件的结果"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <Table
                columns={columns}
                dataSource={filteredResults}
                rowKey={(r) => `${r.symbol}-${r.expiryDate}`}
                pagination={{
                  pageSize: 10,
                  showSizeChanger: true,
                  showTotal: (total) => `共 ${total} 条`,
                }}
                size="middle"
              />
            )}
          </Spin>
        </Card>
      )}
    </div>
  );
};

export default StrategySubscription;
