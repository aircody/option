import React, { useEffect, useRef, useMemo } from 'react';
import * as echarts from 'echarts';
import { Card, Typography, Tag, Space, Divider, List, Row, Col, Statistic } from 'antd';
import { calculateSkewData, analyzeSkew, formatSkew, getSkewColor } from '../utils/skewCalculator';
import type { SkewData } from '../utils/skewCalculator';

const { Text, Title } = Typography;

interface SkewChartProps {
  oiData: { strike: number; callOI: number; putOI: number }[];
  currentPrice: number;
  atmIV: number;
  pcr?: number;
  gammaExposure?: number;
}

const SkewChart: React.FC<SkewChartProps> = ({
  oiData,
  currentPrice,
  atmIV,
  pcr,
  gammaExposure
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // 计算SKEW数据
  const { skewData, analysis } = useMemo(() => {
    const skewData = calculateSkewData(oiData, currentPrice, atmIV);
    const analysis = analyzeSkew(skewData, atmIV, pcr, gammaExposure);
    return { skewData, analysis };
  }, [oiData, currentPrice, atmIV, pcr, gammaExposure]);

  // 获取SKEW颜色
  const skewColor = getSkewColor(analysis.skewPercent);

  // 找到当前价格对应的索引
  const currentPriceIndex = useMemo(() => {
    return skewData.findIndex(d => {
      const strike = d.strike;
      return strike >= currentPrice;
    });
  }, [skewData, currentPrice]);

  useEffect(() => {
    if (!chartRef.current) return;

    // 初始化图表
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const strikes = skewData.map(d => d.strike);
    const callSkewValues = skewData.map(d => d.callSkew * 100);
    const putSkewValues = skewData.map(d => d.putSkew * 100);

    const option: echarts.EChartsOption = {
      backgroundColor: 'transparent',
      grid: {
        left: '3%',
        right: '4%',
        bottom: '10%',
        top: '15%',
        containLabel: true,
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
        },
        formatter: (params: any) => {
          const strike = params[0].axisValue;
          const callSkew = params.find((p: any) => p.seriesName === 'Call Skew')?.value || 0;
          const putSkew = params.find((p: any) => p.seriesName === 'Put Skew')?.value || 0;

          return `
            <div style="font-weight: bold; margin-bottom: 8px;">Strike: $${strike}</div>
            <div style="color: #ff4d4f;">Call Skew: ${callSkew >= 0 ? '+' : ''}${callSkew.toFixed(2)}%</div>
            <div style="color: #52c41a;">Put Skew: ${putSkew >= 0 ? '+' : ''}${putSkew.toFixed(2)}%</div>
          `;
        },
      },
      legend: {
        data: ['Call Skew', 'Put Skew'],
        top: 10,
        textStyle: {
          fontSize: 11,
        },
      },
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
        // 零线
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
        // 现价垂直虚线
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
              formatter: '现价 $${c}',
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

    // 响应式
    const handleResize = () => {
      chartInstance.current?.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [skewData, currentPrice, currentPriceIndex]);

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
      {/* SKEW 总览 */}
      <div style={{ marginBottom: 16, padding: 12, background: '#f6ffed', borderRadius: 8 }}>
        <Row gutter={[16, 8]}>
          <Col span={8}>
            <Statistic
              title={<Text style={{ fontSize: 11 }}>25Δ SKEW</Text>}
              value={formatSkew(analysis.skew25Delta)}
              valueStyle={{ fontSize: 18, color: skewColor, fontWeight: 'bold' }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title={<Text style={{ fontSize: 11 }}>25Δ Put IV</Text>}
              value={`${(analysis.put25IV * 100).toFixed(2)}%`}
              valueStyle={{ fontSize: 18, color: '#52c41a' }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title={<Text style={{ fontSize: 11 }}>25Δ Call IV</Text>}
              value={`${(analysis.call25IV * 100).toFixed(2)}%`}
              valueStyle={{ fontSize: 18, color: '#ff4d4f' }}
            />
          </Col>
        </Row>

        <div style={{ marginTop: 12 }}>
          <Space align="center">
            <Tag color={skewColor} style={{ margin: 0 }}>
              {analysis.statusLabel}
            </Tag>
            <Text type="secondary" style={{ fontSize: 11 }}>
              偏斜幅度: {analysis.skewPercent.toFixed(2)}%
            </Text>
          </Space>
        </div>

        <Text type="secondary" style={{ fontSize: 11, marginTop: 8, display: 'block' }}>
          {analysis.description}
        </Text>
      </div>

      {/* SKEW 解释 */}
      <div style={{ marginBottom: 16, padding: 8, background: '#f5f5f5', borderRadius: 4 }}>
        <Text strong style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 8 }}>
          SKEW (25Δ Risk Reversal) 公式:
        </Text>
        <div style={{ textAlign: 'center', padding: '8px', background: '#fff', borderRadius: 4 }}>
          <Text style={{ fontSize: 12 }}>
            SKEW = 25Δ Put IV - 25Δ Call IV = <span style={{ color: skewColor, fontWeight: 'bold' }}>{formatSkew(analysis.skew25Delta)}</span>
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

      {/* 图表 */}
      <div ref={chartRef} style={{ height: 300, width: '100%' }} />

      {/* 交易启示 */}
      <div style={{ marginTop: 16 }}>
        <Text strong style={{ fontSize: 12, color: '#666' }}>
          交易启示：
        </Text>
        <List
          size="small"
          dataSource={analysis.tradingImplications.slice(0, 3)}
          renderItem={(item) => (
            <List.Item style={{ padding: '4px 0', fontSize: 11, color: '#666' }}>
              • {item}
            </List.Item>
          )}
        />
      </div>

      {/* 风险提示 */}
      {analysis.riskWarnings.length > 0 && (
        <div style={{ marginTop: 12, padding: 8, background: '#fff2f0', borderRadius: 4 }}>
          <Text strong style={{ fontSize: 11, color: '#ff4d4f' }}>
            ⚠️ 风险提示：
          </Text>
          <List
            size="small"
            dataSource={analysis.riskWarnings.slice(0, 2)}
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
