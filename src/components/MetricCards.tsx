import React, { useMemo } from 'react';
import { Card, Typography, Row, Col } from 'antd';
import type { OptionAnalysisData } from '../types';
import { calculateGEX, analyzeGEX, formatGEX } from '../utils/gexCalculator';
import { calculatePCRData, analyzePCR, formatPCR } from '../utils/pcrCalculator';

const { Text } = Typography;

interface MetricCardsProps {
  data: OptionAnalysisData;
}

const MetricCards: React.FC<MetricCardsProps> = ({ data }) => {
  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const formatIV = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  const formatVRP = (vrp: number, vrpPercent: number) => {
    const sign = vrpPercent >= 0 ? '+' : '';
    return `${sign}${vrpPercent.toFixed(2)}% (${vrp >= 0 ? '+' : ''}${(vrp * 100).toFixed(2)}%)`;
  };

  const gexAnalysis = useMemo(() => {
    if (data.gexData) {
      return data.gexData;
    }
    return analyzeGEX(data.oiData, data.lastPrice);
  }, [data.gexData, data.oiData, data.lastPrice]);

  const pcrAnalysis = useMemo(() => {
    if (data.pcrData) {
      return data.pcrData;
    }
    return analyzePCR(data.oiData);
  }, [data.pcrData, data.oiData]);

  const ivData = useMemo(() => {
    if (data.ivData) {
      return data.ivData;
    }
    return {
      atmIV: data.atmIv || 0,
      hv: data.hv || 0,
      vrp: data.vrp ? data.vrp / 100 : 0,
      vrpPercent: data.vrp || 0,
      putSkew: data.skew || 0,
      skew25Delta: data.skew || 0,
      status: 'normal' as const,
      statusLabel: '正常溢价',
    };
  }, [data.ivData, data.atmIv, data.hv, data.vrp, data.skew]);

  const getVRPColor = (vrpPercent: number): string => {
    if (vrpPercent < 5) return '#52c41a';
    if (vrpPercent < 15) return '#73d13d';
    if (vrpPercent < 30) return '#faad14';
    return '#ff4d4f';
  };

  const vrpColor = getVRPColor(ivData.vrpPercent);

  const calculateMaxPainDeviation = () => {
    const maxPain = data.maxPain;
    const currentPrice = data.lastPrice;
    const deviation = ((currentPrice - maxPain) / maxPain) * 100;
    
    const isAbove = deviation > 0;
    const threshold = 1.0;
    
    if (Math.abs(deviation) < threshold) {
      return {
        deviation,
        label: '平',
        color: '#999',
        bgColor: '#f5f5f5',
        description: '现价接近Max Pain',
      };
    }
    
    if (isAbove) {
      return {
        deviation,
        label: '偏高',
        color: '#ff4d4f',
        bgColor: '#fff2f0',
        description: `高于Max Pain ${formatPercent(Math.abs(deviation))}，价格可能下跌靠拢`,
      };
    } else {
      return {
        deviation,
        label: '偏低',
        color: '#52c41a',
        bgColor: '#f6ffed',
        description: `低于Max Pain ${formatPercent(Math.abs(deviation))}，价格可能上涨靠拢`,
      };
    }
  };

  const maxPainDeviation = calculateMaxPainDeviation();

  const metrics = [
    {
      key: 'maxPain',
      label: 'MAX PAIN',
      value: `$${data.maxPain.toFixed(2)}`,
      subValue: `现价 $${data.lastPrice.toFixed(2)}`,
      change: formatPercent(maxPainDeviation.deviation),
      changeColor: maxPainDeviation.color,
      description: maxPainDeviation.description,
      status: maxPainDeviation.label,
      statusColor: maxPainDeviation.color,
      borderColor: '#1890ff',
    },
    {
      key: 'gamma',
      label: 'GAMMA EXPOSURE',
      value: formatGEX(gexAnalysis.totalGEX),
      status: gexAnalysis.statusLabel,
      statusColor: gexAnalysis.status === 'extreme_negative' || gexAnalysis.status === 'negative' ? '#ff4d4f' : '#52c41a',
      description: gexAnalysis.description,
      borderColor: '#52c41a',
    },
    {
      key: 'pcRatio',
      label: 'PUT/CALL RATIO',
      value: formatPCR(pcrAnalysis.pcrOI),
      description: pcrAnalysis.description,
      subDescription: `OI: ${(pcrAnalysis.totalPutOI / 1000000).toFixed(2)}M / ${(pcrAnalysis.totalCallOI / 1000000).toFixed(2)}M`,
      borderColor: '#faad14',
      valueColor: pcrAnalysis.pcrOI > 1.5 ? '#52c41a' : (pcrAnalysis.pcrOI < 0.8 ? '#ff4d4f' : '#faad14'),
    },
    {
      key: 'atmIv',
      label: 'ATM IV',
      value: formatIV(ivData.atmIV),
      subValue: `HV: ${formatIV(ivData.hv)}`,
      change: `VRP: ${formatVRP(ivData.vrp, ivData.vrpPercent)}`,
      changeColor: vrpColor,
      description: ivData.statusLabel,
      borderColor: '#722ed1',
    },
    {
      key: 'skew',
      label: 'SKEW (25Δ RR)',
      value: formatPercent(ivData.skew25Delta * 100),
      description: (ivData.skew25Delta * 100) > 3 ? '下行保护成本高于平均' : ((ivData.skew25Delta * 100) < -3 ? '偏斜向下' : '波动率偏度正常'),
      borderColor: '#eb2f96',
      valueColor: (ivData.skew25Delta * 100) > 3 ? '#faad14' : '#333',
    },
  ];

  return (
    <Row gutter={[16, 16]}>
      {metrics.map((metric) => (
        <Col xs={24} sm={12} md={8} lg={4} key={metric.key}>
          <Card
            bodyStyle={{ padding: '16px' }}
            style={{
              borderTop: `3px solid ${metric.borderColor}`,
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}
          >
            <div>
              <Text
                style={{
                  fontSize: '11px',
                  color: '#999',
                  fontWeight: 500,
                  letterSpacing: '0.5px',
                }}
              >
                {metric.label}
              </Text>
            </div>
            <div style={{ marginTop: '8px' }}>
              <Text
                style={{
                  fontSize: '24px',
                  fontWeight: 'bold',
                  color: metric.valueColor || '#333',
                }}
              >
                {metric.value}
              </Text>
            </div>
            {(metric.subValue || metric.change) && (
              <div style={{ marginTop: '4px' }}>
                {metric.subValue && (
                  <Text style={{ fontSize: '12px', color: '#666' }}>
                    {metric.subValue}
                  </Text>
                )}
                {metric.change && (
                  <Text
                    style={{
                      fontSize: '12px',
                      color: metric.changeColor,
                      marginLeft: metric.subValue ? '8px' : '0',
                    }}
                  >
                    {metric.change}
                  </Text>
                )}
              </div>
            )}
            {metric.status && (
              <div style={{ marginTop: '4px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    color: metric.statusColor,
                    background: `${metric.statusColor}15`,
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                >
                  {metric.status}
                </span>
              </div>
            )}
            {(metric.description || metric.subDescription) && (
              <div style={{ marginTop: '6px' }}>
                <Text style={{ fontSize: '11px', color: '#999' }}>
                  {metric.description}
                </Text>
                {metric.subDescription && (
                  <Text style={{ fontSize: '11px', color: '#999', marginLeft: '4px' }}>
                    {metric.subDescription}
                  </Text>
                )}
              </div>
            )}
          </Card>
        </Col>
      ))}
    </Row>
  );
};

export default MetricCards;
