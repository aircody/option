import React, { useMemo } from 'react';
import { Card, Typography, Row, Col } from 'antd';
import type { OptionAnalysisData } from '../types';
import { calculateGEX, analyzeGEX, formatGEX, getGEXStatusLabel } from '../utils/gexCalculator';
import { calculatePCR, analyzePCR, formatPCR, getPCRZoneInfo } from '../utils/pcrCalculator';
import { calculateIVData, analyzeIV, formatIV, formatVRP, getVRPColor } from '../utils/ivCalculator';
import { calculateSkewData, analyzeSkew, formatSkew, getSkewColor } from '../utils/skewCalculator';

const { Text } = Typography;

interface MetricCardsProps {
  data: OptionAnalysisData;
}

const MetricCards: React.FC<MetricCardsProps> = ({ data }) => {
  const formatCurrency = (value: number) => {
    if (Math.abs(value) >= 1e9) {
      return `$${(value / 1e9).toFixed(2)}B`;
    }
    if (Math.abs(value) >= 1e6) {
      return `$${(value / 1e6).toFixed(2)}M`;
    }
    return `$${value.toFixed(2)}`;
  };

  // 使用新的GEX计算工具计算真实的Gamma Exposure
  const gexAnalysis = useMemo(() => {
    const gexData = calculateGEX(data.oiData, data.lastPrice);
    return analyzeGEX(gexData, data.lastPrice);
  }, [data.oiData, data.lastPrice]);

  const gexStatusLabel = getGEXStatusLabel(gexAnalysis.status);

  // 使用新的PCR计算工具计算真实的Put/Call Ratio
  const pcrAnalysis = useMemo(() => {
    const pcrData = calculatePCR(data.oiData);
    return analyzePCR(pcrData);
  }, [data.oiData]);

  const pcrZoneInfo = getPCRZoneInfo(pcrAnalysis.pcrOI);

  // 使用新的IV计算工具计算真实的ATM IV
  const ivAnalysis = useMemo(() => {
    const ivData = calculateIVData(data.oiData, data.lastPrice);
    return analyzeIV(ivData, data.lastPrice, data.gammaExposure, data.putCallRatio);
  }, [data.oiData, data.lastPrice, data.gammaExposure, data.putCallRatio]);

  const vrpColor = getVRPColor(ivAnalysis.vrpPercent);

  // 使用新的SKEW计算工具计算真实的SKEW
  const skewAnalysis = useMemo(() => {
    const skewData = calculateSkewData(data.oiData, data.lastPrice, ivAnalysis.atmIV);
    return analyzeSkew(skewData, ivAnalysis.atmIV, data.putCallRatio, data.gammaExposure);
  }, [data.oiData, data.lastPrice, ivAnalysis.atmIV, data.putCallRatio, data.gammaExposure]);

  const skewColor = getSkewColor(skewAnalysis.skewPercent);

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  // 计算 Max Pain 与现价的偏离
  const calculateMaxPainDeviation = () => {
    const maxPain = data.maxPain;
    const currentPrice = data.lastPrice;
    const deviation = ((currentPrice - maxPain) / maxPain) * 100;
    
    // 偏离判断
    // 正值：现价 > Max Pain，表示偏高（价格可能下跌向Max Pain靠拢）
    // 负值：现价 < Max Pain，表示偏低（价格可能上涨向Max Pain靠拢）
    const isAbove = deviation > 0;
    const threshold = 1.0; // 1%阈值，小于此值视为平
    
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
        color: '#ff4d4f', // 红色 - 偏高，可能下跌
        bgColor: '#fff2f0',
        description: `高于Max Pain ${formatPercent(Math.abs(deviation))}，价格可能下跌靠拢`,
      };
    } else {
      return {
        deviation,
        label: '偏低',
        color: '#52c41a', // 绿色 - 偏低，可能上涨
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
      value: `$${data.maxPain}`,
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
      status: gexStatusLabel.label,
      statusColor: gexStatusLabel.color,
      description: gexAnalysis.description,
      borderColor: '#52c41a',
    },
    {
      key: 'pcRatio',
      label: 'PUT/CALL RATIO',
      value: formatPCR(pcrAnalysis.pcrOI),
      description: pcrAnalysis.description,
      subDescription: `信号: ${pcrZoneInfo.signal}`,
      borderColor: '#faad14',
      valueColor: pcrAnalysis.pcrOI > 1.5 ? '#52c41a' : (pcrAnalysis.pcrOI < 0.8 ? '#ff4d4f' : '#faad14'),
    },
    {
      key: 'atmIv',
      label: 'ATM IV',
      value: formatIV(ivAnalysis.atmIV),
      subValue: `HV: ${formatIV(ivAnalysis.hv)}`,
      change: `VRP: ${formatVRP(ivAnalysis.vrp)}`,
      changeColor: vrpColor,
      description: ivAnalysis.statusLabel,
      borderColor: '#722ed1',
    },
    {
      key: 'skew',
      label: 'SKEW (25Δ RR)',
      value: formatSkew(skewAnalysis.skew25Delta),
      description: skewAnalysis.description,
      borderColor: '#eb2f96',
      valueColor: skewColor,
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
