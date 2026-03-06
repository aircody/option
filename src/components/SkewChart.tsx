import React, { useEffect, useRef, useMemo } from 'react';
import * as echarts from 'echarts';
import { Card, Typography, Tag, Space, List, Row, Col, Statistic } from 'antd';
import { getSkewTradingImplications, analyzeSkewStatus } from '../utils/skewCalculator';

const { Text, Title } = Typography;

interface OptionChainItem {
  strike: number;
  callIV?: number;
  putIV?: number;
}

interface IVData {
  skew25Delta?: number;
  put25IV?: number;
  call25IV?: number;
}

interface SkewChartProps {
  currentPrice: number;
  atmIV: number;
  ivData?: IVData;
  optionChain?: OptionChainItem[];
  pcrStatus?: string;
}

const SkewChart: React.FC<SkewChartProps> = ({
  currentPrice,
  atmIV,
  ivData,
  optionChain,
  pcrStatus
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  const skew25Delta = useMemo(() => ivData?.skew25Delta || 0, [ivData]);
  const put25IV = useMemo(() => ivData?.put25IV || 0, [ivData]);
  const call25IV = useMemo(() => ivData?.call25IV || 0, [ivData]);
  const skewPercent = skew25Delta * 100;
  
  const statusInfo = useMemo(() => analyzeSkewStatus(skewPercent), [skewPercent]);
  const status = statusInfo.status;
  const statusLabel = statusInfo.statusLabel;
  const description = statusInfo.description;
  
  const tradingImplications = useMemo(() => {
    return getSkewTradingImplications(status, pcrStatus);
  }, [status, pcrStatus]);
  
  const riskWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (status === 'extreme') {
      warnings.push('极端偏斜，市场恐慌情绪严重');
      warnings.push('若近期出现高影响事件（如美联储决议、财报），SKEW可能快速飙升，偏斜程度加剧，需及时调整对冲策略');
    }
    if (status === 'high' || status === 'extreme') {
      warnings.push('SKEW仅反映期权市场的定价，若出现实质性下行事件（如宏观数据恶化），偏斜可能进一步扩大，需结合基本面综合判断');
    }
    if (status === 'high' || status === 'extreme') {
      warnings.push('负Gamma环境下，期权买卖价差可能扩大，需优先选择流动性高的合约，避免滑点损失');
    }
    return warnings;
  }, [status]);

  const getSkewColor = (skewPercent: number) => {
    if (skewPercent > 10) return '#ff4d4f';
    if (skewPercent > 3) return '#faad14';
    if (skewPercent < -10) return '#1890ff';
    if (skewPercent < -3) return '#52c41a';
    return '#8c8c8c';
  };

  const formatSkew = (skew: number) => {
    const percent = skew * 100;
    return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
  };

  const skewColor = getSkewColor(skewPercent);

  const chartData = useMemo(() => {
    if (!optionChain || optionChain.length === 0) {
      return [];
    }

    return optionChain.map(opt => ({
      strike: opt.strike,
      callIV: opt.callIV || 0,
      putIV: opt.putIV || 0,
      callSkew: opt.callIV && atmIV ? ((opt.callIV - atmIV) / atmIV) * 100 : 0,
      putSkew: opt.putIV && atmIV ? ((opt.putIV - atmIV) / atmIV) * 100 : 0
    })).filter(d => d.callIV > 0 || d.putIV > 0);
  }, [optionChain, atmIV]);

  const currentPriceIndex = useMemo(() => {
    if (chartData.length === 0) return -1;
    return chartData.findIndex(d => d.strike >= currentPrice);
  }, [chartData, currentPrice]);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const strikes = chartData.map(d => d.strike);
    const callSkewValues = chartData.map(d => d.callSkew);
    const putSkewValues = chartData.map(d => d.putSkew);

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '15%',
        containLabel: true,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          crossStyle: {
            color: '#999',
            type: 'dashed'
          }
        },
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#d9d9d9',
        borderWidth: 1,
        textStyle: {
          color: '#333'
        },
        extraCssText: 'box-shadow: 0 2px 8px rgba(0,0,0,0.15); border-radius: 4px; padding: 8px 12px;',
        formatter: (params: echarts.TooltipFormatterParams) => {
          const strike = (params as echarts.TooltipFormatterParamsItem[])[0].axisValue;
          const callSkew = (params as echarts.TooltipFormatterParamsItem[]).find((p) => p.seriesName === 'Call Skew')?.value || 0;
          const putSkew = (params as echarts.TooltipFormatterParamsItem[]).find((p) => p.seriesName === 'Put Skew')?.value || 0;

          return `
            <div style="font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid #f0f0f0; padding-bottom: 4px;">Strike: $${strike}</div>
            <div style="color: #ff4d4f; margin-bottom: 4px;"><b>Call Skew:</b> ${callSkew >= 0 ? '+' : ''}${callSkew.toFixed(2)}%</div>
            <div style="color: #52c41a;"><b>Put Skew:</b> ${putSkew >= 0 ? '+' : ''}${putSkew.toFixed(2)}%</div>
          `;
        },
      },
      legend: {
        data: ['Call Skew', 'Put Skew'],
        top: 10,
        textStyle: {
          fontSize: 11,
        },
        selectedMode: true,
        itemWidth: 12,
        itemHeight: 12,
      },
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: 0,
          start: 0,
          end: 100,
          zoomLock: false,
        },
        {
          type: 'slider',
          xAxisIndex: 0,
          start: 0,
          end: 100,
          height: 20,
          bottom: 10,
          handleSize: '80%',
          showDetail: true,
          borderColor: '#d9d9d9',
          fillerColor: 'rgba(24, 144, 255, 0.2)',
          handleStyle: {
            color: '#fff',
            shadowBlur: 3,
            shadowColor: 'rgba(0, 0, 0, 0.6)',
            shadowOffsetX: 2,
            shadowOffsetY: 2,
          },
        },
      ],
      xAxis: {
        type: 'category',
        data: strikes,
        name: 'Strike Price ($)',
        nameLocation: 'middle',
        nameGap: 30,
        axisLabel: {
          formatter: (value: string) => `$${value}`,
          fontSize: 10,
        },
        axisLine: {
          lineStyle: {
            color: '#d9d9d9',
          },
        },
      },
      yAxis: {
        type: 'value',
        name: 'Skew (%)',
        nameTextStyle: {
          fontSize: 11,
        },
        axisLabel: {
          formatter: (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`,
          fontSize: 10,
        },
        splitLine: {
          lineStyle: {
            color: '#f0f0f0',
            type: 'dashed',
          },
        },
      },
      series: [
        {
          name: 'Call Skew',
          type: 'line',
          data: callSkewValues,
          smooth: true,
          symbol: 'circle',
          symbolSize: 4,
          lineStyle: {
            color: '#ff4d4f',
            width: 2,
          },
          itemStyle: {
            color: '#ff4d4f',
          },
        },
        {
          name: 'Put Skew',
          type: 'line',
          data: putSkewValues,
          smooth: true,
          symbol: 'circle',
          symbolSize: 4,
          lineStyle: {
            color: '#52c41a',
            width: 2,
          },
          itemStyle: {
            color: '#52c41a',
          },
        },
        {
          name: 'Zero Line',
          type: 'line',
          markLine: {
            symbol: 'none',
            lineStyle: {
              color: '#999',
              width: 1,
              type: 'dashed',
            },
            data: [{ yAxis: 0 }],
          },
        },
        ...(currentPriceIndex >= 0 ? [{
          name: 'Current Price' as const,
          type: 'line' as const,
          markLine: {
            symbol: 'none',
            lineStyle: {
              color: '#1890ff',
              width: 2,
              type: 'dashed',
            },
            label: {
              formatter: `现价 $${currentPrice}`,
              position: 'end',
              fontSize: 10,
              color: '#1890ff',
            },
            data: [{ xAxis: currentPriceIndex }],
          },
        }] : []),
      ],
    };

    chartInstance.current.setOption(option);

    const handleResize = () => {
      chartInstance.current?.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [chartData, currentPrice, currentPriceIndex]);

  return (
    <Card
      title={
        <Space direction="vertical" size={0}>
          <Title level={5} style={{ margin: 0 }}>SKEW (25Δ Risk Reversal)</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            波动率偏度 - 尾部风险定价指标
          </Text>
        </Space>
      }
      style={{ height: '100%' }}
    >
      <div style={{ marginBottom: 16, padding: 12, background: '#f6ffed', borderRadius: 8 }}>
        <Row gutter={[16, 8]}>
          <Col span={8}>
            <Statistic
              title={<Text style={{ fontSize: 11 }}>25Δ SKEW</Text>}
              value={formatSkew(skew25Delta)}
              valueStyle={{ fontSize: 18, color: skewColor, fontWeight: 'bold' }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title={<Text style={{ fontSize: 11 }}>25Δ Put IV</Text>}
              value={`${(put25IV * 100).toFixed(2)}%`}
              valueStyle={{ fontSize: 18, color: '#52c41a' }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title={<Text style={{ fontSize: 11 }}>25Δ Call IV</Text>}
              value={`${(call25IV * 100).toFixed(2)}%`}
              valueStyle={{ fontSize: 18, color: '#ff4d4f' }}
            />
          </Col>
        </Row>

        <div style={{ marginTop: 12 }}>
          <Space align="center">
            <Tag color={skewColor} style={{ margin: 0 }}>
              {statusLabel}
            </Tag>
            <Text type="secondary" style={{ fontSize: 11 }}>
              偏斜幅度: {skewPercent.toFixed(2)}%
            </Text>
          </Space>
        </div>

        <Text type="secondary" style={{ fontSize: 11, marginTop: 8, display: 'block' }}>
          {description}
        </Text>
      </div>

      <div style={{ marginBottom: 16, padding: 8, background: '#f5f5f5', borderRadius: 4 }}>
        <Text strong style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 8 }}>
          SKEW (25Δ Risk Reversal) 公式:
        </Text>
        <div style={{ textAlign: 'center', padding: '8px', background: '#fff', borderRadius: 4 }}>
          <Text style={{ fontSize: 12 }}>
            SKEW = 25Δ Put IV - 25Δ Call IV = <span style={{ color: skewColor, fontWeight: 'bold' }}>{formatSkew(skew25Delta)}</span>
          </Text>
        </div>
        <Row gutter={[8, 4]} style={{ marginTop: 8 }}>
          <Col span={12}>
            <div style={{ padding: '4px', background: '#fff', borderRadius: 4, textAlign: 'center' }}>
              <Text style={{ fontSize: 10, color: '#52c41a' }}>SKEW &gt; 0</Text>
              <br />
              <Text style={{ fontSize: 9, color: '#999' }}>Put IV &gt; Call IV</Text>
              <br />
              <Text style={{ fontSize: 9, color: '#666' }}>担忧下行风险</Text>
            </div>
          </Col>
          <Col span={12}>
            <div style={{ padding: '4px', background: '#fff', borderRadius: 4, textAlign: 'center' }}>
              <Text style={{ fontSize: 10, color: '#ff4d4f' }}>SKEW &lt; 0</Text>
              <br />
              <Text style={{ fontSize: 9, color: '#999' }}>Call IV &gt; Put IV</Text>
              <br />
              <Text style={{ fontSize: 9, color: '#666' }}>担忧上行风险</Text>
            </div>
          </Col>
        </Row>
      </div>

      <div ref={chartRef} style={{ height: 300, width: '100%' }} />

      <div style={{ marginTop: 16 }}>
        <Text strong style={{ fontSize: 12, color: '#666' }}>
          交易启示：
        </Text>
        <List
          size="small"
          dataSource={tradingImplications.slice(0, 3)}
          renderItem={(item) => (
            <List.Item style={{ padding: '4px 0', fontSize: 11, color: '#666' }}>
              • {item}
            </List.Item>
          )}
        />
      </div>

      {riskWarnings && riskWarnings.length > 0 && (
        <div style={{ marginTop: 12, padding: 8, background: '#fff2f0', borderRadius: 4 }}>
          <Text strong style={{ fontSize: 11, color: '#ff4d4f' }}>
            ⚠️ 风险提示：
          </Text>
          <List
            size="small"
            dataSource={riskWarnings.slice(0, 2)}
            renderItem={(item) => (
              <List.Item style={{ padding: '2px 0', fontSize: 10, color: '#ff7875' }}>
                • {item}
              </List.Item>
            )}
          />
        </div>
      )}
    </Card>
  );
};

export default SkewChart;
