import React, { useEffect, useRef, useMemo } from 'react';
import * as echarts from 'echarts';
import { Card } from 'antd';
import type { OIData } from '../types';
import { identifyOIWalls, getStrongestSupportResistance, formatOI } from '../utils/oiWallCalculator';
import { filterStrikesByPriceRange, estimateAverageIV } from '../utils/priceRangeCalculator';

interface OIWallChartProps {
  data: OIData[];
  maxPain: number;
  currentPrice?: number;
  daysToExpiry?: number;
}

const OIWallChart: React.FC<OIWallChartProps> = ({ 
  data, 
  maxPain, 
  currentPrice,
  daysToExpiry = 30 
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  const averageIV = useMemo(() => {
    return estimateAverageIV(data);
  }, [data]);

  const filteredData = useMemo(() => {
    if (!currentPrice || data.length === 0) return data;
    return filterStrikesByPriceRange(data, currentPrice, averageIV, daysToExpiry);
  }, [data, currentPrice, averageIV, daysToExpiry]);

  const oiWallResults = useMemo(() => {
    if (!currentPrice || filteredData.length === 0) return [];
    return identifyOIWalls(filteredData, currentPrice);
  }, [filteredData, currentPrice]);

  const { strongestSupport, strongestResistance } = useMemo(() => {
    return getStrongestSupportResistance(oiWallResults);
  }, [oiWallResults]);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const strikes = filteredData.map((d) => d.strike);
    const callOIs = filteredData.map((d) => d.callOI);
    const putOIs = filteredData.map((d) => d.putOI);

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

    let maxPainIndex = -1;

    let supportIndex = -1;
    if (strongestSupport && strikes.length > 0) {
      supportIndex = strikes.findIndex(s => parseInt(s.toString()) === strongestSupport.strike);
    }

    let resistanceIndex = -1;
    if (strongestResistance && strikes.length > 0) {
      resistanceIndex = strikes.findIndex(s => parseInt(s.toString()) === strongestResistance.strike);
    }

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
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        borderColor: '#d9d9d9',
        borderWidth: 1,
        padding: [12, 16],
        textStyle: {
          fontSize: 13,
          lineHeight: 1.6,
        },
        formatter: (params: any) => {
          const strike = params[0].axisValue;
          const callOI = params.find((p: any) => p.seriesName === 'Call OI (阻力)')?.value || 0;
          const putOI = params.find((p: any) => p.seriesName === 'Put OI (支撑)')?.value || 0;
          
          const oiResult = oiWallResults.find(r => r.strike === parseInt(strike));
          let wallInfo = '';
          
          if (oiResult) {
            if (oiResult.isCallWall) {
              wallInfo += `<div style="color:#ff4d4f;font-weight:bold;margin-top:8px">★ 强阻力位</div>`;
            }
            if (oiResult.isPutWall) {
              wallInfo += `<div style="color:#52c41a;font-weight:bold;margin-top:8px">★ 强支撑位</div>`;
            }
          }
          
          return `
            <div style="font-weight:bold;font-size:14px;margin-bottom:8px;color:#333">执行价: $${strike}</div>
            <div style="display:flex;justify-content:space-between;gap:16px">
              <div style="color:#ff4d4f">
                <span style="opacity:0.7">Call OI (阻力):</span> 
                <span style="font-weight:bold">${callOI.toLocaleString()}</span>
              </div>
              <div style="color:#52c41a">
                <span style="opacity:0.7">Put OI (支撑):</span> 
                <span style="font-weight:bold">${putOI.toLocaleString()}</span>
              </div>
            </div>
            ${wallInfo}
          `;
        },
      },
      legend: {
        data: ['Call OI (阻力)', 'Put OI (支撑)', '现价', '强支撑', '强阻力'],
        top: 10,
        textStyle: { fontSize: 12 },
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
      grid: {
        left: '3%',
        right: '4%',
        bottom: '10%',
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
          color: '#666',
        },
        axisLine: { 
          lineStyle: { 
            color: '#d9d9d9',
            width: 2,
          } 
        },
        axisTick: { show: false },
        name: 'Strike Price',
        nameLocation: 'middle',
        nameGap: 30,
        nameTextStyle: {
          fontSize: 12,
          color: '#999',
          fontWeight: 500,
        },
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
          color: '#666',
        },
        axisLine: { show: false },
        splitLine: { 
          lineStyle: { 
            color: '#f0f0f0',
            type: 'dashed',
          } 
        },
        name: '持仓量 (OI)',
        nameLocation: 'middle',
        nameGap: 40,
        nameTextStyle: {
          fontSize: 12,
          color: '#999',
          fontWeight: 500,
        },
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
              fontWeight: 'bold',
              backgroundColor: 'rgba(24, 144, 255, 0.1)',
              padding: [2, 6],
              borderRadius: 4,
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
        ...(supportIndex >= 0 && strongestSupport ? [{
          name: '强支撑' as const,
          type: 'line' as const,
          data: [],
          markLine: {
            symbol: ['none', 'none'],
            label: {
              show: true,
              position: 'insideEndTop',
              formatter: `强支撑 $${strongestSupport.strike}`,
              color: '#52c41a',
              fontSize: 11,
              fontWeight: 'bold',
              backgroundColor: 'rgba(82, 196, 26, 0.1)',
              padding: [2, 6],
              borderRadius: 4,
            },
            lineStyle: {
              color: '#52c41a',
              width: 3,
              type: 'dashed' as const,
            },
            data: [
              {
                xAxis: supportIndex,
              },
            ],
          },
        }] : []),
        ...(resistanceIndex >= 0 && strongestResistance ? [{
          name: '强阻力' as const,
          type: 'line' as const,
          data: [],
          markLine: {
            symbol: ['none', 'none'],
            label: {
              show: true,
              position: 'insideEndBottom',
              formatter: `强阻力 $${strongestResistance.strike}`,
              color: '#ff4d4f',
              fontSize: 11,
              fontWeight: 'bold',
              backgroundColor: 'rgba(255, 77, 79, 0.1)',
              padding: [2, 6],
              borderRadius: 4,
            },
            lineStyle: {
              color: '#ff4d4f',
              width: 3,
              type: 'dashed' as const,
            },
            data: [
              {
                xAxis: resistanceIndex,
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
  }, [data, currentPrice, oiWallResults, strongestSupport, strongestResistance]);

  return (
    <Card
      title={
        <div>
          <div>OI Wall - 持仓墙 (支撑/阻力)</div>
          {strongestSupport && strongestResistance && (
            <div style={{ fontSize: '12px', fontWeight: 'normal', marginTop: '4px', color: '#666' }}>
              <span style={{ color: '#52c41a', fontWeight: 500 }}>强支撑: ${strongestSupport.strike} ({formatOI(strongestSupport.putOI)})</span>
              <span style={{ margin: '0 12px' }}>|</span>
              <span style={{ color: '#ff4d4f', fontWeight: 500 }}>强阻力: ${strongestResistance.strike} ({formatOI(strongestResistance.callOI)})</span>
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
