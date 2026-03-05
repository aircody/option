import React, { useEffect, useRef, useMemo } from 'react';
import * as echarts from 'echarts';
import { Card } from 'antd';
import type { OIData } from '../types';
import { identifyOIWalls, getStrongestSupportResistance, formatOI } from '../utils/oiWallCalculator';

interface OIWallChartProps {
  data: OIData[];
  maxPain: number;
  currentPrice?: number;
}

const OIWallChart: React.FC<OIWallChartProps> = ({ data, maxPain, currentPrice }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // 计算 OI Wall
  const oiWallResults = useMemo(() => {
    if (!currentPrice || data.length === 0) return [];
    return identifyOIWalls(data, currentPrice);
  }, [data, currentPrice]);

  // 获取最强支撑和阻力
  const { strongestSupport, strongestResistance } = useMemo(() => {
    return getStrongestSupportResistance(oiWallResults);
  }, [oiWallResults]);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const strikes = data.map((d) => d.strike);
    const callOIs = data.map((d) => d.callOI);
    const putOIs = data.map((d) => d.putOI);

    // 找到最接近现价的执行价索引
    let currentPriceIndex = -1;
    if (currentPrice && strikes.length > 0) {
      let minDiff = Infinity;
      strikes.forEach((strike, index) => {
        const diff = Math.abs(parseFloat(strike.toString()) - currentPrice);
        if (diff < minDiff) {
          minDiff = diff;
          currentPriceIndex = index;
        }
      });
    }

    // 找到 Max Pain 的执行价索引
    let maxPainIndex = -1;
    if (maxPain && strikes.length > 0) {
      strikes.forEach((strike, index) => {
        if (parseInt(strike.toString()) === maxPain) {
          maxPainIndex = index;
        }
      });
    }

    // 标记 OI Wall 的执行价
    const callWallIndices: number[] = [];
    const putWallIndices: number[] = [];
    
    oiWallResults.forEach((result, index) => {
      if (result.isCallWall) callWallIndices.push(index);
      if (result.isPutWall) putWallIndices.push(index);
    });

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const strike = params[0].axisValue;
          const callOI = params.find((p: any) => p.seriesName === 'Call OI (阻力)')?.value || 0;
          const putOI = params.find((p: any) => p.seriesName === 'Put OI (支撑)')?.value || 0;
          
          // 查找该执行价的 OI Wall 信息
          const oiResult = oiWallResults.find(r => r.strike === parseInt(strike));
          let wallInfo = '';
          
          if (oiResult) {
            if (oiResult.isCallWall) {
              wallInfo += `<div style="color:#ff4d4f;font-weight:bold">★ 强阻力位</div>`;
            }
            if (oiResult.isPutWall) {
              wallInfo += `<div style="color:#52c41a;font-weight:bold">★ 强支撑位</div>`;
            }
          }
          
          return `
            <div style="font-weight:bold;margin-bottom:5px">执行价: $${strike}</div>
            <div style="color:#ff4d4f">Call OI (阻力): ${callOI.toLocaleString()}</div>
            <div style="color:#52c41a">Put OI (支撑): ${putOI.toLocaleString()}</div>
            ${wallInfo}
          `;
        },
      },
      legend: {
        data: ['Call OI (阻力)', 'Put OI (支撑)', '现价', 'Max Pain'],
        top: 10,
        textStyle: { fontSize: 12 },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '15%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: strikes,
        axisLabel: {
          fontSize: 11,
          interval: Math.floor(strikes.length / 10),
          formatter: (value: string) => `$${value}`,
        },
        axisLine: { lineStyle: { color: '#d9d9d9' } },
        axisTick: { show: false },
        name: 'Strike',
        nameLocation: 'middle',
        nameGap: 30,
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          fontSize: 11,
          formatter: (value: number) => {
            if (value >= 1000) {
              return `${(value / 1000).toFixed(0)}k`;
            }
            return value.toString();
          },
        },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#f0f0f0' } },
        name: '持仓量 (OI)',
        nameLocation: 'middle',
        nameGap: 40,
      },
      series: [
        {
          name: 'Call OI (阻力)',
          type: 'bar',
          data: callOIs.map((value, index) => ({
            value,
            itemStyle: {
              color: callWallIndices.includes(index) 
                ? 'rgba(255, 77, 79, 0.85)' 
                : 'rgba(255, 77, 79, 0.6)',
              borderRadius: [4, 4, 0, 0],
              borderWidth: callWallIndices.includes(index) ? 2 : 0,
              borderColor: '#fff',
              shadowBlur: callWallIndices.includes(index) ? 10 : 0,
              shadowColor: callWallIndices.includes(index) 
                ? 'rgba(255, 77, 79, 0.5)' 
                : 'transparent',
            },
          })),
          barWidth: '40%',
          barGap: '0%',
        },
        {
          name: 'Put OI (支撑)',
          type: 'bar',
          data: putOIs.map((value, index) => ({
            value,
            itemStyle: {
              color: putWallIndices.includes(index) 
                ? 'rgba(82, 196, 26, 0.85)' 
                : 'rgba(82, 196, 26, 0.6)',
              borderRadius: [4, 4, 0, 0],
              borderWidth: putWallIndices.includes(index) ? 2 : 0,
              borderColor: '#fff',
              shadowBlur: putWallIndices.includes(index) ? 10 : 0,
              shadowColor: putWallIndices.includes(index) 
                ? 'rgba(82, 196, 26, 0.5)' 
                : 'transparent',
            },
          })),
          barWidth: '40%',
          barGap: '0%',
        },
        // 现价垂直虚线
        ...(currentPriceIndex >= 0 ? [{
          name: '现价' as const,
          type: 'line' as const,
          data: [],
          markLine: {
            symbol: ['none', 'none'],
            label: {
              show: true,
              position: 'end',
              formatter: `现价 $${currentPrice}`,
              color: '#1890ff',
              fontSize: 11,
            },
            lineStyle: {
              color: '#1890ff',
              width: 2,
              type: 'dashed' as const,
            },
            data: [
              {
                xAxis: currentPriceIndex,
              },
            ],
          },
        }] : []),
        // Max Pain 垂直虚线
        ...(maxPainIndex >= 0 ? [{
          name: 'Max Pain' as const,
          type: 'line' as const,
          data: [],
          markLine: {
            symbol: ['none', 'none'],
            label: {
              show: true,
              position: 'start',
              formatter: `Max Pain $${maxPain}`,
              color: '#faad14',
              fontSize: 11,
            },
            lineStyle: {
              color: '#faad14',
              width: 2,
              type: 'dashed' as const,
            },
            data: [
              {
                xAxis: maxPainIndex,
              },
            ],
          },
        }] : []),
      ],
    };

    chartInstance.current.setOption(option, true);

    const handleResize = () => {
      chartInstance.current?.resize();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [data, maxPain, currentPrice, oiWallResults, strongestSupport, strongestResistance]);

  return (
    <Card
      title={
        <div>
          <div>OI Wall - 持仓墙 (支撑/阻力)</div>
          {strongestSupport && strongestResistance && (
            <div style={{ fontSize: '12px', fontWeight: 'normal', marginTop: '4px', color: '#666' }}>
              强支撑: ${strongestSupport.strike} ({formatOI(strongestSupport.putOI)}) | 
              强阻力: ${strongestResistance.strike} ({formatOI(strongestResistance.callOI)})
            </div>
          )}
        </div>
      }
      bodyStyle={{ padding: '16px' }}
      style={{
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}
    >
      <div ref={chartRef} style={{ width: '100%', height: '350px' }} />
    </Card>
  );
};

export default OIWallChart;
