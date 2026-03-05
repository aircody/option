import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { Card } from 'antd';
import type { MaxPainData } from '../types';

interface MaxPainChartProps {
  data: MaxPainData[];
  maxPainStrike: number;
}

const MaxPainChart: React.FC<MaxPainChartProps> = ({ data, maxPainStrike }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const strikes = data.map((d) => d.strike);
    const pains = data.map((d) => d.totalPain);

    const maxPainIndex = data.findIndex((d) => d.strike === maxPainStrike);
    const maxPainValue = maxPainIndex >= 0 ? data[maxPainIndex].totalPain : 0;

    const scatterData = maxPainIndex >= 0
      ? [[maxPainStrike.toString(), maxPainValue]]
      : [];

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const strike = params[0].axisValue;
          const pain = params.find((p: any) => p.seriesName === 'Total Pain')?.value || 0;
          const isMaxPain = parseInt(strike) === maxPainStrike;
          return `
            <div style="font-weight:bold;margin-bottom:5px">执行价: $${strike}</div>
            <div>Total Pain: $${(pain / 1e9).toFixed(2)}B</div>
            ${isMaxPain ? '<div style="color:#faad14;font-weight:bold;margin-top:5px">★ Max Pain</div>' : ''}
          `;
        },
      },
      legend: {
        data: ['Total Pain', 'Max Pain'],
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
          interval: Math.floor(strikes.length / 8),
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
            if (value >= 1e9) {
              return `$${(value / 1e9).toFixed(0)}G`;
            }
            if (value >= 1e6) {
              return `$${(value / 1e6).toFixed(0)}M`;
            }
            return `$${value}`;
          },
        },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#f0f0f0' } },
        name: 'Dollar Pain',
        nameLocation: 'middle',
        nameGap: 50,
        nameRotate: 90,
      },
      series: [
        {
          name: 'Total Pain',
          type: 'line',
          data: pains,
          smooth: true,
          symbol: 'none',
          lineStyle: {
            color: '#722ed1',
            width: 2,
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
        {
          name: 'Max Pain',
          type: 'scatter',
          data: scatterData,
          symbolSize: 12,
          itemStyle: {
            color: '#faad14',
            borderColor: '#fff',
            borderWidth: 2,
          },
          emphasis: {
            scale: 1.5,
          },
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
  }, [data, maxPainStrike]);

  return (
    <Card
      title="Max Pain - 最大痛点曲线"
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

export default MaxPainChart;
