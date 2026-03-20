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
  Tooltip,
  Popover,
  List,
  Badge,
  Tabs,
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
  StarFilled,
  DeleteOutlined,
  HistoryOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { fetchOptionAnalysis, fetchExpiryDates } from '../services/optionService';
import { generateStrategyRecommendation } from '../utils/strategyCalculator';
import type { ExpiryDate } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { PRESET_SYMBOLS, STORAGE_KEYS, SYMBOL_PATTERN } from '../utils/constants';

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

interface ScanHistoryRecord {
  id: string;
  scanTime: string;
  dteRange: [number, number];
  symbols: string[];
  results: StrategyScanResult[];
}

const MAX_HISTORY_COUNT = 10;

const StrategySubscription: React.FC = () => {
  const [savedSymbols, setSavedSymbols] = useLocalStorage<string[]>(STORAGE_KEYS.SAVED_SYMBOLS_STRATEGY, []);
  const [customSymbolInput, setCustomSymbolInput] = useState('');
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [dteRange, setDteRange] = useState<[number, number]>([7, 15]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<StrategyScanResult[]>([]);
  const [filterStrategy, setFilterStrategy] = useState<string>('');
  const [filterSymbol, setFilterSymbol] = useState<string>('');
  const [scanProgress, setScanProgress] = useState(0);
  const [allExpiryDates, setAllExpiryDates] = useState<ExpiryDate[]>([]);
  const [scanHistory, setScanHistory] = useLocalStorage<ScanHistoryRecord[]>(STORAGE_KEYS.STRATEGY_SCAN_HISTORY, []);
  const [activeTab, setActiveTab] = useState<string>('current');
  const [selectedHistoryRecord, setSelectedHistoryRecord] = useState<ScanHistoryRecord | null>(null);

  const addSymbol = (symbol: string) => {
    const trimmedSymbol = symbol.trim().toUpperCase();
    if (!trimmedSymbol) {
      message.warning('请输入股票代码');
      return;
    }
    if (!SYMBOL_PATTERN.test(trimmedSymbol)) {
      message.warning('股票代码格式不正确');
      return;
    }
    if (savedSymbols.includes(trimmedSymbol)) {
      message.warning('该股票已添加');
      return;
    }
    const newSymbols = [...savedSymbols, trimmedSymbol];
    setSavedSymbols(newSymbols);
    message.success(`已添加 ${trimmedSymbol}`);
  };

  const saveScanToHistory = (scanResults: StrategyScanResult[]) => {
    const newRecord: ScanHistoryRecord = {
      id: Date.now().toString(),
      scanTime: new Date().toLocaleString('zh-CN'),
      dteRange: [...dteRange],
      symbols: [...savedSymbols],
      results: scanResults,
    };

    const updatedHistory = [newRecord, ...scanHistory].slice(0, MAX_HISTORY_COUNT);
    setScanHistory(updatedHistory);
    message.success(`扫描结果已保存 (历史记录: ${updatedHistory.length}/${MAX_HISTORY_COUNT})`);
  };

  const removeSymbol = (symbol: string) => {
    const newSymbols = savedSymbols.filter(s => s !== symbol);
    setSavedSymbols(newSymbols);
    message.success(`已删除 ${symbol}`);
  };

  const loadAllExpiryDates = useCallback(async () => {
    if (savedSymbols.length === 0) {
      setAllExpiryDates([]);
      return;
    }

    try {
      const allDates: ExpiryDate[] = [];
      for (const symbol of savedSymbols) {
        try {
          const dates = await fetchExpiryDates(symbol);
          dates.forEach((date) => {
            if (!allDates.find((d) => d.date === date.date)) {
              allDates.push(date);
            }
          });
        } catch (error) {
          console.error(`Failed to fetch expiry dates for ${symbol}:`, error);
        }
      }
      allDates.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setAllExpiryDates(allDates);
    } catch (error) {
      console.error('Failed to load expiry dates:', error);
    }
  }, [savedSymbols]);

  useEffect(() => {
    loadAllExpiryDates();
  }, [loadAllExpiryDates]);

  const filteredExpiryDates = allExpiryDates.filter(
    (d) => d.daysToExpiry >= dteRange[0] && d.daysToExpiry <= dteRange[1]
  );

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
    if (savedSymbols.length === 0) {
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

      for (const symbol of savedSymbols) {
        try {
          const expiryDates = await fetchExpiryDates(symbol);
          const filteredExpiries = expiryDates.filter(
            (d) => d.daysToExpiry >= dteRange[0] && d.daysToExpiry <= dteRange[1]
          );
          total += filteredExpiries.length;
        } catch (error) {
          console.error(`Failed to fetch expiry dates for ${symbol}:`, error);
        }
      }

      for (const symbol of savedSymbols) {
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
      saveScanToHistory(newResults);
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

  const savedSymbolsContent = (
    <div style={{ width: '250px', maxHeight: '400px', overflowY: 'auto' }}>
      {savedSymbols.length > 0 ? (
        <List
          size="small"
          dataSource={savedSymbols}
          renderItem={(symbol) => (
            <List.Item
              actions={[
                <Tooltip key="delete" title="删除">
                  <DeleteOutlined
                    style={{ color: '#ff4d4f', fontSize: '16px' }}
                    onClick={() => removeSymbol(symbol)}
                  />
                </Tooltip>
              ]}
            >
              <List.Item.Meta
                title={<span style={{ fontWeight: 600, fontSize: '15px' }}>{symbol}</span>}
              />
            </List.Item>
          )}
        />
      ) : (
        <Empty
          description="暂无保存的股票"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ padding: '30px 0' }}
        />
      )}
    </div>
  );

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
                disabled={savedSymbols.length === 0}
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
              <Space wrap size="small" style={{ marginBottom: '16px' }}>
                {PRESET_SYMBOLS.map((symbol) => (
                  <Tooltip key={symbol} title={`扫描 ${symbol} 期权策略`}>
                    <Tag
                      color=""
                      style={{
                        cursor: 'pointer',
                        fontSize: '14px',
                        padding: '6px 16px',
                        borderRadius: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontWeight: 'normal',
                        boxShadow: 'rgba(0, 0, 0, 0.08) 0px 2px 4px',
                        transition: 'all 0.2s',
                      }}
                      onClick={() => addSymbol(symbol)}
                    >
                      {symbol}
                    </Tag>
                  </Tooltip>
                ))}

                {savedSymbols.map((symbol) => (
                  <Tooltip key={symbol} title={`查看 ${symbol} 期权数据 (点击删除)`}>
                    <Tag
                      color="cyan"
                      style={{
                        cursor: 'pointer',
                        fontSize: '14px',
                        padding: '6px 16px',
                        borderRadius: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontWeight: 'normal',
                        boxShadow: 'rgba(0, 0, 0, 0.08) 0px 2px 4px',
                        border: '2px solid transparent',
                        transition: 'all 0.2s',
                      }}
                      onClose={() => removeSymbol(symbol)}
                      closable
                    >
                      {symbol}
                    </Tag>
                  </Tooltip>
                ))}
              </Space>

              <Space>
                <Input
                  placeholder="输入股票代码（如：AAPL）"
                  value={customSymbolInput}
                  onChange={(e) => setCustomSymbolInput(e.target.value.toUpperCase().replace(/[^a-zA-Z0-9]/g, ''))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customSymbolInput) {
                      addSymbol(customSymbolInput);
                      setCustomSymbolInput('');
                    }
                  }}
                  style={{
                    width: '180px',
                    borderRadius: '8px',
                  }}
                  prefix={<SearchOutlined />}
                  maxLength={5}
                  disabled={loading}
                  allowClear
                />
                <Tooltip title="添加自定义股票">
                  <Button
                    type="default"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      if (customSymbolInput) {
                        addSymbol(customSymbolInput);
                        setCustomSymbolInput('');
                      } else {
                        message.info('请先输入股票代码');
                      }
                    }}
                    loading={loading}
                    style={{
                      borderRadius: '8px',
                    }}
                  >
                    添加
                  </Button>
                </Tooltip>
                <Popover
                  content={savedSymbolsContent}
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 600 }}>已保存的股票</span>
                      {savedSymbols.length > 0 && (
                        <Button
                          type="link"
                          size="small"
                          danger
                          onClick={() => {
                            setSavedSymbols([]);
                            message.success('已清空所有保存的股票');
                          }}
                        >
                          清空全部
                        </Button>
                      )}
                    </div>
                  }
                  trigger="click"
                  open={popoverOpen}
                  onOpenChange={setPopoverOpen}
                  placement="bottomLeft"
                >
                  <Badge count={savedSymbols.length} size="small" showZero={false}>
                    <Tag
                      color="success"
                      style={{
                        cursor: 'pointer',
                        fontSize: '13px',
                        padding: '4px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        borderRadius: '20px',
                      }}
                    >
                      <StarFilled />
                      已保存
                    </Tag>
                  </Badge>
                </Popover>
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
                  onChange={(value) => setDteRange(value as [number, number])}
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

      <Card style={{ marginTop: '16px' }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'current',
              label: (
                <Space>
                  <CheckCircleOutlined />
                  <span>当前结果</span>
                  {results.length > 0 && (
                    <Tag color="green" style={{ fontSize: '11px' }}>
                      {results.length}
                    </Tag>
                  )}
                </Space>
              ),
            },
            {
              key: 'history',
              label: (
                <Space>
                  <HistoryOutlined />
                  <span>历史记录</span>
                  {scanHistory.length > 0 && (
                    <Tag color="blue" style={{ fontSize: '11px' }}>
                      {scanHistory.length}/{MAX_HISTORY_COUNT}
                    </Tag>
                  )}
                </Space>
              ),
            },
          ]}
        />

        {activeTab === 'current' && (
          <div>
            {results.length === 0 ? (
              <Empty
                description='暂无扫描结果，请点击"开始扫描"'
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                style={{ padding: '40px 0' }}
              />
            ) : (
              <div>
                <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
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
                </div>
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
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            {scanHistory.length === 0 ? (
              <Empty
                description="暂无历史记录，扫描后将自动保存"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                style={{ padding: '40px 0' }}
              />
            ) : (
              <div>
                {selectedHistoryRecord ? (
                  <div>
                    <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Button
                        type="link"
                        icon={<HistoryOutlined />}
                        onClick={() => setSelectedHistoryRecord(null)}
                      >
                        返回历史记录列表
                      </Button>
                      <div>
                        <Space>
                          <Tag color="blue">
                            <ClockCircleOutlined /> {selectedHistoryRecord.scanTime}
                          </Tag>
                          <Tag color="cyan">
                            {selectedHistoryRecord.dteRange[0]}-{selectedHistoryRecord.dteRange[1]} DTE
                          </Tag>
                          <Tag color="purple">
                            {selectedHistoryRecord.symbols.join(', ')}
                          </Tag>
                        </Space>
                      </div>
                    </div>
                    <Table
                      columns={columns}
                      dataSource={selectedHistoryRecord.results}
                      rowKey={(r) => `${r.symbol}-${r.expiryDate}`}
                      pagination={{
                        pageSize: 10,
                        showSizeChanger: true,
                        showTotal: (total) => `共 ${total} 条`,
                      }}
                      size="middle"
                    />
                  </div>
                ) : (
                  <List
                    dataSource={scanHistory}
                    renderItem={(record) => (
                      <List.Item
                        actions={[
                          <Button
                            type="link"
                            icon={<EyeOutlined />}
                            onClick={() => setSelectedHistoryRecord(record)}
                          >
                            查看
                          </Button>,
                        ]}
                      >
                        <List.Item.Meta
                          avatar={<HistoryOutlined style={{ fontSize: '24px', color: '#1890ff' }} />}
                          title={
                            <Space>
                              <Text strong>{record.scanTime}</Text>
                              <Tag color="green" style={{ fontSize: '11px' }}>
                                {record.results.length} 个策略
                              </Tag>
                            </Space>
                          }
                          description={
                            <Space>
                              <Text type="secondary" style={{ fontSize: '12px' }}>
                                DTE: {record.dteRange[0]}-{record.dteRange[1]}
                              </Text>
                              <Text type="secondary" style={{ fontSize: '12px' }}>
                                股票: {record.symbols.join(', ')}
                              </Text>
                            </Space>
                          }
                        />
                      </List.Item>
                    )}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

export default StrategySubscription;
