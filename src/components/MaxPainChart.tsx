import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { Card } from 'antd';
import type { MaxPainData } from '../types';
import { formatDollarAmount } from '../utils/maxPainCalculator';

interface MaxPainChartProps {
  data: MaxPainData[];
  maxPainStrike: number;
  currentPrice?: number; // 现价/最新价
}

const MaxPainChart: React.FC<MaxPainChartProps> = ({ 
  data, 
  maxPainStrike,
  currentPrice 
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const strikes = data.map((d) => d.strike);
    const pains = data.map((d) => d.totalPain);

    // 找到 Max Pain 点
    const maxPainIndex = data.findIndex((d) => d.strike === maxPainStrike);
    const maxPainValue = maxPainIndex >= 0 ? data[maxPainIndex].totalPain : 0;

    // 散点数据 - 只显示 Max Pain 点
    const scatterData = maxPainIndex >= 0
      ? [[maxPainStrike.toString(), maxPainValue]]
      : [];

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

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const strike = params[0].axisValue;
          const pain = params.find((p: any) => p.seriesName === 'Total Pain')?.value || 0;
          const isMaxPain = parseInt(strike) === maxPainStrike;
          const isCurrentPrice = currentPriceIndex >= 0 && 
            Math.abs(parseFloat(strike) - (currentPrice || 0)) < 2.5; // 5美元间隔的一半
          
          let html = `
            <div style="font-weight:bold;margin-bottom:5px">执行价: $${strike}</div>
            <div>Total Pain: ${formatDollarAmount(pain)}</div>
          `;
          
          if (isMaxPain) {
            html += '<div style="color:#faad14;font-weight:bold;margin-top:5px">★ Max Pain</div>';
          }
          
          if (isCurrentPrice) {
            html += `<div style="color:#1890ff;font-weight:bold;margin-top:5px">◆ 现价 $${currentPrice}</div>`;
          }
          
          return html;
        },
      },
      legend: {
        data: ['Total Pain', 'Max Pain', '现价'],
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
              return `$${(value / 1e9).toFixed(1)}G`;
            }
            if (value >= 1e6) {
              return `$${(value / 1e6).toFixed(1)}M`;
            }
            if (value >= 1e3) {
              return `$${(value / 1e3).toFixed(1)}K`;
            }
            return `$${value}`;
          },
        },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#f0f0f0' } },
        name: 'Total Pain (卖方总损失)',
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
          symbolSize: 14,
          itemStyle: {
            color: '#faad14',
            borderColor: '#fff',
            borderWidth: 2,
            shadowBlur: 10,
            shadowColor: 'rgba(250, 173, 20, 0.5)',
          },
          emphasis: {
            scale: 1.5,
          },
          label: {
            show: true,
            position: 'top',
            formatter: `Max Pain\n$${maxPainStrike}`,
            fontSize: 11,
            color: '#faad14',
            fontWeight: 'bold',
          },
        },
        // 现价垂直虚线
        ...(currentPriceIndex >= 0 ? [{
          name: '现价',
          type: 'line' as const,
          data: strikes.map((_, index) => index === currentPriceIndex ? Math.max(...pains) : '-'),
          symbol: 'none',
          lineStyle: {
            color: '#1890ff',
            width: 2,
            type: 'dashed' as const,
          },
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
                label: {
                  show: true,
                  position: 'end',
                  formatter: `现价 $${currentPrice}`,
                  color: '#1890ff',
                  fontSize: 11,
                },
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
  }, [data, maxPainStrike, currentPrice]);

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
