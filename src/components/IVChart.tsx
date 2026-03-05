import React, { useEffect, useRef, useMemo } from 'react';
import * as echarts from 'echarts';
import { Card, Typography, Tag, Space, Divider, List, Row, Col, Statistic } from 'antd';
import { extractIVDataFromApiOption, analyzeVRPStatus, formatIV, formatVRP } from '../utils/ivCalculator';
import type { IVData } from '../utils/ivCalculator';

const { Text, Title } = Typography;

interface IVChartProps {
  oiData: { strike: number; callOI: number; putOI: number }[];
  currentPrice: number;
  atmIv?: number;
  hv?: number;
  vrp?: number;
  gammaExposure?: number;
  pcr?: number;
  ivData?: any;
  optionChain?: any[];
}

const IVChart: React.FC<IVChartProps> = ({ 
  oiData, 
  currentPrice, 
  atmIv, 
  hv, 
  vrp,
  gammaExposure,
  pcr,
  ivData,
  optionChain
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // 辅助函数：获取VRP颜色
  const getVRPColor = (vrpPercent: number): string => {
    const status = analyzeVRPStatus(vrpPercent);
    return status.color;
  };

  // 提取IV数据用于图表
  const ivDataArray = useMemo(() => {
    if (optionChain) {
      return extractIVDataFromApiOption(optionChain, currentPrice);
    }
    return [];
  }, [optionChain, currentPrice]);

  // 获取VRP颜色 - 直接使用传入的vrp值
  const vrpColor = getVRPColor(vrp || 0);

  // 找到当前价格对应的IV索引
  const currentPriceIndex = useMemo(() => {
    return ivDataArray.findIndex(d => d.strike >= currentPrice);
  }, [ivDataArray, currentPrice]);

  useEffect(() => {
    if (!chartRef.current) return;

    // 初始化图表
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const strikes = ivDataArray.map(d => d.strike);
    const callIVValues = ivDataArray.map(d => d.callIV * 100);
    const putIVValues = ivDataArray.map(d => d.putIV * 100);
    const atmIVValues = ivDataArray.map(d => d.avgIV * 100);

    // 安全检查：如果没有数据，使用默认值
    const hasData = strikes.length > 0;
    const minIV = hasData ? Math.min(...atmIVValues) * 0.8 : 10;
    const maxIV = hasData ? Math.max(...callIVValues, ...putIVValues) * 1.1 : 50;

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
        formatter: (params: any) => {
          const strike = params[0].axisValue;
          const callIV = params.find((p: any) => p.seriesName === 'Call IV')?.value || 0;
          const putIV = params.find((p: any) => p.seriesName === 'Put IV')?.value || 0;
          const atmIV = params.find((p: any) => p.seriesName === 'ATM IV')?.value || 0;
          
          return `
            <div style="font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid #f0f0f0; padding-bottom: 4px;">Strike: $${strike}</div>
            <div style="color: #ff4d4f; margin-bottom: 4px;"><b>Call IV:</b> ${callIV.toFixed(2)}%</div>
            <div style="color: #52c41a; margin-bottom: 4px;"><b>Put IV:</b> ${putIV.toFixed(2)}%</div>
            <div style="color: #1890ff;"><b>ATM IV:</b> ${atmIV.toFixed(2)}%</div>
          `;
        },
      },
      legend: {
        data: ['Call IV', 'Put IV', 'ATM IV'],
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
        name: 'IV (%)',
        nameTextStyle: {
          fontSize: 11,
        },
        axisLabel: {
          formatter: (value: number) => `${value.toFixed(1)}%`,
          fontSize: 10,
        },
        splitLine: {
          lineStyle: {
            color: '#f0f0f0',
            type: 'dashed',
          },
        },
        min: minIV,
        max: maxIV,
      },
      series: [
        {
          name: 'Call IV',
          type: 'line',
          data: callIVValues,
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
          name: 'Put IV',
          type: 'line',
          data: putIVValues,
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
          name: 'ATM IV',
          type: 'line',
          data: atmIVValues,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: {
            color: '#1890ff',
            width: 3,
          },
          itemStyle: {
            color: '#1890ff',
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(24, 144, 255, 0.2)' },
                { offset: 1, color: 'rgba(24, 144, 255, 0.02)' },
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
  }, [ivDataArray, currentPrice, currentPriceIndex]);

  return (
    <Card
      title={
        <Space direction="vertical" size={0}>
          <Title level={5} style={{ margin: 0 }}>ATM IV (隐含波动率)</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            波动率微笑与VRP分析
          </Text>
        </Space>
      }
      style={{ height: '100%' }}
    >
      {/* IV 总览 */}
      <div style={{ marginBottom: 16, padding: 12, background: '#f6ffed', borderRadius: 8 }}>
        <Row gutter={[16, 8]}>
          <Col span={8}>
            <Statistic
              title={<Text style={{ fontSize: 11 }}>ATM IV</Text>}
              value={formatIV(atmIv || 0)}
              valueStyle={{ fontSize: 18, color: '#1890ff', fontWeight: 'bold' }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title={<Text style={{ fontSize: 11 }}>HV (历史波动率)</Text>}
              value={formatIV(hv || 0)}
              valueStyle={{ fontSize: 18, color: '#666' }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title={<Text style={{ fontSize: 11 }}>VRP (波动率溢价)</Text>}
              value={formatVRP((vrp || 0) / 100, vrp || 0)}
              valueStyle={{ fontSize: 18, color: vrpColor, fontWeight: 'bold' }}
            />
          </Col>
        </Row>
        
        <div style={{ marginTop: 12 }}>
          <Space align="center">
            <Tag color={vrpColor} style={{ margin: 0 }}>
              {analyzeVRPStatus(vrp || 0).statusLabel}
            </Tag>
            <Text type="secondary" style={{ fontSize: 11 }}>
              溢价幅度: {(vrp || 0).toFixed(1)}%
            </Text>
          </Space>
        </div>

        <Text type="secondary" style={{ fontSize: 11, marginTop: 8, display: 'block' }}>
          {analyzeVRPStatus(vrp || 0).description}
        </Text>
      </div>

      {/* VRP 解释 */}
      <div style={{ marginBottom: 16, padding: 8, background: '#f5f5f5', borderRadius: 4 }}>
        <Text strong style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 8 }}>
          VRP (波动率风险溢价) 解读:
        </Text>
        <Row gutter={[8, 4]}>
          <Col span={12}>
            <div style={{ padding: '4px', background: '#fff', borderRadius: 4 }}>
              <Text style={{ fontSize: 10, color: '#1890ff' }}>ATM IV = {formatIV(atmIv || 0)}</Text>
              <br />
              <Text style={{ fontSize: 9, color: '#999' }}>市场预期未来波动</Text>
            </div>
          </Col>
          <Col span={12}>
            <div style={{ padding: '4px', background: '#fff', borderRadius: 4 }}>
              <Text style={{ fontSize: 10, color: '#666' }}>HV = {formatIV(hv || 0)}</Text>
              <br />
              <Text style={{ fontSize: 9, color: '#999' }}>历史实际波动</Text>
            </div>
          </Col>
        </Row>
        <div style={{ marginTop: 8, textAlign: 'center' }}>
          <Text style={{ fontSize: 11 }}>
            VRP = ATM IV - HV = <span style={{ color: vrpColor, fontWeight: 'bold' }}>{formatVRP((vrp || 0) / 100, vrp || 0)}</span>
          </Text>
        </div>
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
          dataSource={(ivData?.tradingImplications || []).slice(0, 3)}
          renderItem={(item) => (
            <List.Item style={{ padding: '4px 0', fontSize: 11, color: '#666' }}>
              • {item}
            </List.Item>
          )}
        />
      </div>

      {/* 风险提示 */}
      {ivData?.riskWarnings && ivData.riskWarnings.length > 0 && (
        <div style={{ marginTop: 12, padding: 8, background: '#fff2f0', borderRadius: 4 }}>
          <Text strong style={{ fontSize: 11, color: '#ff4d4f' }}>
            ⚠️ 风险提示：
          </Text>
          <List
            size="small"
            dataSource={ivData.riskWarnings.slice(0, 2)}
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

export default IVChart;
