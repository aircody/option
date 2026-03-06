import React, { useEffect, useRef, useMemo } from 'react';
import * as echarts from 'echarts';
import { Card, Typography, Tag, Space, Divider, List } from 'antd';
import { calculateGEX, analyzeGEX, formatGEX } from '../utils/gexCalculator';

const { Text, Title } = Typography;

interface GEXChartProps {
  oiData: { strike: number; callOI: number; putOI: number }[];
  currentPrice: number;
}

const GEXChart: React.FC<GEXChartProps> = ({ oiData, currentPrice }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // 计算GEX数据
  const { gexData, analysis } = useMemo(() => {
    const gexData = calculateGEX(oiData, currentPrice);
    const analysis = analyzeGEX(oiData, currentPrice);
    return { gexData, analysis };
  }, [oiData, currentPrice]);

  // 状态标签已经在 analysis.statusLabel 中

  // 找到当前价格对应的GEX索引
  const currentPriceIndex = useMemo(() => {
    return gexData.findIndex(d => d.strike >= currentPrice);
  }, [gexData, currentPrice]);

  useEffect(() => {
    if (!chartRef.current) return;

    // 初始化图表
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const strikes = gexData.map(d => d.strike);
    const callGEXValues = gexData.map(d => d.callGEX / 1e9); // 转换为十亿
    const putGEXValues = gexData.map(d => d.putGEX / 1e9);
    const totalGEXValues = gexData.map(d => d.totalGEX / 1e9);

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
          const totalGEX = (params as echarts.TooltipFormatterParamsItem[]).find((p) => p.seriesName === 'Total GEX')?.value || 0;
          const callGEX = (params as echarts.TooltipFormatterParamsItem[]).find((p) => p.seriesName === 'Call GEX')?.value || 0;
          const putGEX = (params as echarts.TooltipFormatterParamsItem[]).find((p) => p.seriesName === 'Put GEX')?.value || 0;
          
          return `
            <div style="font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid #f0f0f0; padding-bottom: 4px;">Strike: $${strike}</div>
            <div style="color: #722ed1; margin-bottom: 4px;"><b>Total GEX:</b> ${totalGEX >= 0 ? '+' : ''}${totalGEX.toFixed(2)}B</div>
            <div style="color: #ff4d4f; margin-bottom: 4px;"><b>Call GEX:</b> +${callGEX.toFixed(2)}B</div>
            <div style="color: #52c41a;"><b>Put GEX:</b> ${putGEX.toFixed(2)}B</div>
          `;
        },
      },
      legend: {
        data: ['Call GEX', 'Put GEX', 'Total GEX'],
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
        name: 'GEX ($B)',
        nameTextStyle: {
          fontSize: 11,
        },
        axisLabel: {
          formatter: (value: number) => `${value >= 0 ? '+' : ''}${value}B`,
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
          name: 'Call GEX',
          type: 'bar',
          data: callGEXValues,
          itemStyle: {
            color: 'rgba(255, 77, 79, 0.6)',
            borderRadius: [4, 4, 0, 0],
          },
          barWidth: '35%',
          barGap: '0%',
        },
        {
          name: 'Put GEX',
          type: 'bar',
          data: putGEXValues,
          itemStyle: {
            color: 'rgba(82, 196, 26, 0.6)',
            borderRadius: [0, 0, 4, 4],
          },
          barWidth: '35%',
        },
        {
          name: 'Total GEX',
          type: 'line',
          data: totalGEXValues,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: {
            color: '#722ed1',
            width: 2,
          },
          itemStyle: {
            color: '#722ed1',
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(114, 46, 209, 0.3)' },
                { offset: 1, color: 'rgba(114, 46, 209, 0.05)' },
              ],
            },
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
              formatter: `现价 $${currentPrice}`,
              position: 'end',
              fontSize: 10,
              color: '#1890ff',
            },
            data: [{ xAxis: currentPriceIndex }],
          },
        }] : []),
        // Zero Gamma Level 线
        {
          name: 'Zero Gamma' as const,
          type: 'line' as const,
          markLine: {
            symbol: 'none',
            lineStyle: {
              color: '#faad14',
              width: 2,
              type: 'dotted',
            },
            label: {
              formatter: 'Zero Gamma',
              position: 'start',
              fontSize: 10,
              color: '#faad14',
            },
            data: [{ yAxis: 0 }],
          },
        },
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
  }, [gexData, currentPrice, currentPriceIndex]);

  return (
    <Card
      title={
        <Space direction="vertical" size={0}>
          <Title level={5} style={{ margin: 0 }}>Gamma Exposure (GEX)</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Gamma敞口分布与Zero Gamma Level
          </Text>
        </Space>
      }
      style={{ height: '100%' }}
    >
      {/* GEX 总览 */}
      <div style={{ marginBottom: 16, padding: 12, background: '#f6ffed', borderRadius: 8 }}>
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Space align="center">
            <Text strong style={{ fontSize: 16 }}>
              Total GEX: {formatGEX(analysis.totalGEX)}
            </Text>
            <Tag color={analysis.status === 'extreme_negative' || analysis.status === 'negative' ? '#ff4d4f' : '#52c41a'} style={{ margin: 0 }}>
              {analysis.statusLabel}
            </Tag>
          </Space>
          
          <Space split={<Divider type="vertical" />}>
            <Text style={{ fontSize: 12 }}>
              Call GEX: <span style={{ color: '#ff4d4f' }}>+{formatGEX(analysis.callGEX)}</span>
            </Text>
            <Text style={{ fontSize: 12 }}>
              Put GEX: <span style={{ color: '#52c41a' }}>{formatGEX(analysis.putGEX)}</span>
            </Text>
            <Text style={{ fontSize: 12 }}>
              Zero Gamma: <span style={{ color: '#faad14' }}>${analysis.zeroGammaLevel.toFixed(2)}</span>
            </Text>
          </Space>

          <Text type="secondary" style={{ fontSize: 11 }}>
            {analysis.description}
          </Text>
        </Space>
      </div>

      {/* 图表 */}
      <div ref={chartRef} style={{ height: 350, width: '100%' }} />

      {/* 交易启示 */}
      <div style={{ marginTop: 16 }}>
        <Text strong style={{ fontSize: 12, color: '#666' }}>
          交易启示：
        </Text>
        <List
          size="small"
          dataSource={analysis.tradingImplications.slice(0, 4)}
          renderItem={(item) => (
            <List.Item style={{ padding: '4px 0', fontSize: 11, color: '#666' }}>
              • {item}
            </List.Item>
          )}
        />
      </div>
    </Card>
  );
};

export default GEXChart;
