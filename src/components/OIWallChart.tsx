import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { Card } from 'antd';
import type { OIData } from '../types';

interface OIWallChartProps {
  data: OIData[];
  maxPain: number;
}

const OIWallChart: React.FC<OIWallChartProps> = ({ data, maxPain }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const strikes = data.map((d) => d.strike);
    const callOIs = data.map((d) => d.callOI);
    const putOIs = data.map((d) => -d.putOI);

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const strike = params[0].axisValue;
          const callOI = params.find((p: any) => p.seriesName === 'Call OI')?.value || 0;
          const putOI = params.find((p: any) => p.seriesName === 'Put OI')?.value || 0;
          return `
            <div style="font-weight:bold;margin-bottom:5px">执行价: $${strike}</div>
            <div style="color:#ff4d4f">Call OI (阻力): ${Math.abs(callOI).toLocaleString()}</div>
            <div style="color:#52c41a">Put OI (支撑): ${Math.abs(putOI).toLocaleString()}</div>
          `;
        },
      },
      legend: {
        data: ['Call OI (阻力)', 'Put OI (支撑)'],
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
            const absValue = Math.abs(value);
            if (absValue >= 1000) {
              return `${(absValue / 1000).toFixed(0)}k`;
            }
            return absValue.toString();
          },
        },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#f0f0f0' } },
      },
      series: [
        {
          name: 'Call OI (阻力)',
          type: 'bar',
          stack: 'total',
          data: callOIs,
          itemStyle: { color: '#ff4d4f' },
          barWidth: '60%',
        },
        {
          name: 'Put OI (支撑)',
          type: 'bar',
          stack: 'total',
          data: putOIs,
          itemStyle: { color: '#52c41a' },
          barWidth: '60%',
        },
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
  }, [data, maxPain]);

  return (
    <Card
      title="OI Wall - 持仓墙 (支撑/阻力)"
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
