import React, { useEffect, useRef, useMemo } from 'react';
import * as echarts from 'echarts';
import { Card, Typography, Tag, Space, List, Row, Col, Progress } from 'antd';
import { calculatePCRData, analyzePCR, formatPCR, analyzePCRStatus } from '../utils/pcrCalculator';

const { Text, Title } = Typography;

interface PCRChartProps {
  oiData: { strike: number; callOI: number; putOI: number }[];
  currentPrice: number;
  putCallRatio?: number;
}

interface PCRZoneInfo {
  zone: string;
  color: string;
}

const getPCRZoneInfo = (pcr: number): PCRZoneInfo => {
  const status = analyzePCRStatus(pcr);
  return {
    zone: status.statusLabel,
    color: status.color,
  };
};

const PCRChart: React.FC<PCRChartProps> = ({ oiData, currentPrice, putCallRatio: _putCallRatio }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  const { pcrData, analysis } = useMemo(() => {
    const pcrData = calculatePCRData(oiData);
    const analysis = analyzePCR(oiData);
    return { pcrData, analysis };
  }, [oiData]);

  const oiRatio = useMemo(() => {
    const totalOI = analysis.totalPutOI + analysis.totalCallOI;
    return {
      putPercent: totalOI > 0 ? (analysis.totalPutOI / totalOI) * 100 : 0,
      callPercent: totalOI > 0 ? (analysis.totalCallOI / totalOI) * 100 : 0,
    };
  }, [analysis]);

  const currentPriceIndex = useMemo(() => {
    return pcrData.findIndex(d => d.strike >= currentPrice);
  }, [pcrData, currentPrice]);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const strikes = pcrData.map(d => d.strike);
    const pcrOIValues = pcrData.map(d => d.pcrOI);
    const pcrVolumeValues = pcrData.map(d => d.pcrVolume);

    const updateYAxisRange = (startPercent: number | undefined, endPercent: number | undefined) => {
      const start = startPercent ?? 0;
      const end = endPercent ?? 100;
      const startIndex = Math.floor(start / 100 * (pcrData.length - 1));
      const endIndex = Math.ceil(end / 100 * (pcrData.length - 1));
      const visibleData = pcrData.slice(startIndex, endIndex + 1);
      
      if (visibleData.length === 0) return { min: 0, max: 3 };
      
      const visiblePCR = visibleData.map(d => Math.max(d.pcrOI, d.pcrVolume));
      const maxPCR = Math.max(...visiblePCR);
      return { min: 0, max: Math.max(3, maxPCR * 1.2) };
    };

    const initialRange = updateYAxisRange(0, 100);

    const option: any = {
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
        formatter: (params: unknown) => {
          const p = params as { axisValue: unknown; seriesName: string; value: unknown }[];
          const strike = p[0].axisValue;
          const pcrOI = p.find((item) => item.seriesName === 'PCR (OI)')?.value as number || 0;
          const pcrVol = p.find((item) => item.seriesName === 'PCR (Volume)')?.value as number || 0;
          const zone = getPCRZoneInfo(pcrOI);
          
          return `
            <div style="font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid #f0f0f0; padding-bottom: 4px;">Strike: $${strike}</div>
            <div style="color: #1890ff; margin-bottom: 4px;"><b>PCR (OI):</b> ${pcrOI.toFixed(3)}</div>
            <div style="color: #52c41a; margin-bottom: 4px;"><b>PCR (Volume):</b> ${pcrVol.toFixed(3)}</div>
            <div style="color: ${zone.color};"><b>区间:</b> ${zone.zone}</div>
          `;
        },
      },
      legend: {
        data: ['PCR (OI)', 'PCR (Volume)', '极端悲观线', '中性区间'],
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
        name: 'PCR',
        nameTextStyle: {
          fontSize: 11,
        },
        axisLabel: {
          formatter: (value: number) => value.toFixed(2),
          fontSize: 10,
        },
        splitLine: {
          lineStyle: {
            color: '#f0f0f0',
            type: 'dashed',
          },
        },
        min: initialRange.min,
        max: initialRange.max,
      },
      series: [
        {
          name: 'PCR (OI)',
          type: 'line',
          data: pcrOIValues,
          smooth: true,
          symbol: 'circle',
          symbolSize: 4,
          lineStyle: {
            color: '#1890ff',
            width: 2,
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
                { offset: 0, color: 'rgba(24, 144, 255, 0.3)' },
                { offset: 1, color: 'rgba(24, 144, 255, 0.05)' },
              ],
            },
          },
        },
        {
          name: 'PCR (Volume)',
          type: 'line',
          data: pcrVolumeValues,
          smooth: true,
          symbol: 'circle',
          symbolSize: 4,
          lineStyle: {
            color: '#52c41a',
            width: 2,
            type: 'dashed',
          },
          itemStyle: {
            color: '#52c41a',
          },
        },
        {
          name: '极端悲观线',
          type: 'line',
          markLine: {
            symbol: 'none',
            lineStyle: {
              color: '#52c41a',
              width: 2,
              type: 'dashed',
            },
            label: {
              formatter: '极度悲观 1.5',
              position: 'end',
              fontSize: 10,
              color: '#52c41a',
            },
            data: [{ yAxis: 1.5 }],
          },
        },
        {
          name: '中性区间',
          type: 'line',
          markLine: {
            symbol: 'none',
            lineStyle: {
              color: '#faad14',
              width: 1,
              type: 'dotted',
            },
            label: {
              formatter: '中性上限 1.2',
              position: 'end',
              fontSize: 10,
              color: '#faad14',
            },
            data: [{ yAxis: 1.2 }],
          },
        },
        {
          name: '中性区间',
          type: 'line',
          markLine: {
            symbol: 'none',
            lineStyle: {
              color: '#faad14',
              width: 1,
              type: 'dotted',
            },
            label: {
              formatter: '中性下限 1.0',
              position: 'end',
              fontSize: 10,
              color: '#faad14',
            },
            data: [{ yAxis: 1.0 }],
          },
        },
        {
          name: '极端悲观线',
          type: 'line',
          markLine: {
            symbol: 'none',
            lineStyle: {
              color: '#ff4d4f',
              width: 2,
              type: 'dashed',
            },
            label: {
              formatter: '极度乐观 0.8',
              position: 'end',
              fontSize: 10,
              color: '#ff4d4f',
            },
            data: [{ yAxis: 0.8 }],
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

    chartInstance.current.on('dataZoom', (params: unknown) => {
      const p = params as { batch?: { start: number; end: number }[]; start?: number; end?: number };
      const start = p.batch ? p.batch[0].start : p.start;
      const end = p.batch ? p.batch[0].end : p.end;
      const newRange = updateYAxisRange(start, end);
      chartInstance.current?.setOption({
        yAxis: { min: newRange.min, max: newRange.max }
      });
    });

    const handleResize = () => {
      chartInstance.current?.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [pcrData, currentPrice, currentPriceIndex]);

  return (
    <Card
      title={
        <Space direction="vertical" size={0}>
          <Title level={5} style={{ margin: 0 }}>Put/Call Ratio (PCR)</Title>
          <Text type="secondary" style={{ fontSize: 12 }}>
            看跌/看涨比率 - 市场情绪指标
          </Text>
        </Space>
      }
      style={{ height: '100%' }}
    >
      <div style={{ marginBottom: 16, padding: 12, background: '#f6ffed', borderRadius: 8 }}>
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Row align="middle" justify="space-between">
            <Col>
              <Space align="center">
                <Text strong style={{ fontSize: 20 }}>
                  PCR: {formatPCR(analysis.pcrOI)}
                </Text>
                <Tag color={analysis.status === 'extreme_bearish' || analysis.status === 'bearish' ? '#52c41a' : '#ff4d4f'} style={{ margin: 0 }}>
                  {analysis.statusLabel}
                </Tag>
              </Space>
            </Col>
            <Col>
              <Text type="secondary" style={{ fontSize: 11 }}>
                信号: <span style={{ color: analysis.status === 'extreme_bearish' || analysis.status === 'bearish' ? '#52c41a' : '#ff4d4f', fontWeight: 'bold' }}>{analysis.status === 'extreme_bearish' || analysis.status === 'bearish' ? '看多' : '看空'}</span>
              </Text>
            </Col>
          </Row>
          
          <div style={{ marginTop: 8 }}>
            <Row justify="space-between" style={{ marginBottom: 4 }}>
              <Col>
                <Text style={{ fontSize: 11 }}>
                  Put OI: <span style={{ color: '#52c41a' }}>{(analysis.totalPutOI / 1e6).toFixed(2)}M</span>
                </Text>
              </Col>
              <Col>
                <Text style={{ fontSize: 11 }}>
                  Call OI: <span style={{ color: '#ff4d4f' }}>{(analysis.totalCallOI / 1e6).toFixed(2)}M</span>
                </Text>
              </Col>
            </Row>
            <Progress
              percent={oiRatio.putPercent}
              strokeColor="#52c41a"
              trailColor="#ff4d4f"
              showInfo={false}
              size="small"
            />
            <Row justify="space-between">
              <Col>
                <Text style={{ fontSize: 10, color: '#52c41a' }}>{oiRatio.putPercent.toFixed(1)}% Put</Text>
              </Col>
              <Col>
                <Text style={{ fontSize: 10, color: '#ff4d4f' }}>{oiRatio.callPercent.toFixed(1)}% Call</Text>
              </Col>
            </Row>
          </div>

          <Text type="secondary" style={{ fontSize: 11 }}>
            {analysis.description}
          </Text>
        </Space>
      </div>

      <div style={{ marginBottom: 16, padding: 8, background: '#f5f5f5', borderRadius: 4 }}>
        <Text strong style={{ fontSize: 11, color: '#666', display: 'block', marginBottom: 8 }}>
          PCR 区间参考:
        </Text>
        <Row gutter={[8, 4]}>
          <Col span={8}>
            <div style={{ textAlign: 'center', padding: '4px', background: '#fff2f0', borderRadius: 4 }}>
              <Text style={{ fontSize: 10, color: '#ff4d4f' }}>&lt; 0.8</Text>
              <br />
              <Text style={{ fontSize: 9, color: '#999' }}>极度乐观</Text>
            </div>
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'center', padding: '4px', background: '#fffbe6', borderRadius: 4 }}>
              <Text style={{ fontSize: 10, color: '#faad14' }}>1.0 - 1.2</Text>
              <br />
              <Text style={{ fontSize: 9, color: '#999' }}>中性</Text>
            </div>
          </Col>
          <Col span={8}>
            <div style={{ textAlign: 'center', padding: '4px', background: '#f6ffed', borderRadius: 4 }}>
              <Text style={{ fontSize: 10, color: '#52c41a' }}>&gt; 1.5</Text>
              <br />
              <Text style={{ fontSize: 9, color: '#999' }}>极度悲观</Text>
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
          dataSource={analysis.tradingImplications.slice(0, 3)}
          renderItem={(item) => (
            <List.Item style={{ padding: '4px 0', fontSize: 11, color: '#666' }}>
              • {item}
            </List.Item>
          )}
        />
      </div>

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

export default PCRChart;
