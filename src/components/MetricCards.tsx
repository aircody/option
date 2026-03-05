import React from 'react';
import { Card, Typography, Row, Col } from 'antd';
import type { OptionAnalysisData } from '../types';

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

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const metrics = [
    {
      key: 'maxPain',
      label: 'MAX PAIN',
      value: `$${data.maxPain}`,
      subValue: `现价 $${data.lastPrice.toFixed(2)}`,
      change: formatPercent(data.priceChangePercent),
      changeColor: data.priceChangePercent >= 0 ? '#52c41a' : '#ff4d4f',
      description: data.priceChangePercent >= 0 ? '偏高' : '偏低',
      borderColor: '#1890ff',
    },
    {
      key: 'gamma',
      label: 'GAMMA EXPOSURE',
      value: formatCurrency(data.gammaExposure * 1e9),
      status: data.gammaExposure < -30 ? '超波动' : '正常',
      statusColor: data.gammaExposure < -30 ? '#ff4d4f' : '#52c41a',
      description: data.gammaExposure < -30 ? '做市商放大波动' : '波动平稳',
      borderColor: '#52c41a',
    },
    {
      key: 'pcRatio',
      label: 'PUT/CALL RATIO',
      value: data.putCallRatio.toFixed(3),
      description: data.putCallRatio > 1.5 ? '极度悲观 (反向强看多)' : '中性',
      subDescription: `OI: ${(data.putCallRatio * 1.2).toFixed(3)}`,
      borderColor: '#faad14',
      valueColor: '#ff4d4f',
    },
    {
      key: 'atmIv',
      label: 'ATM IV',
      value: `${data.atmIv.toFixed(2)}%`,
      subValue: `HV: ${data.hv.toFixed(2)}%`,
      change: `VRP: ${data.vrp >= 0 ? '+' : ''}${data.vrp.toFixed(2)}%`,
      changeColor: data.vrp >= 0 ? '#ff4d4f' : '#52c41a',
      borderColor: '#722ed1',
    },
    {
      key: 'skew',
      label: 'SKEW (25Δ RR)',
      value: `${data.skew >= 0 ? '+' : ''}${data.skew.toFixed(2)}%`,
      description: data.skew > 3 ? '适度偏斜 - 下行保护高于平均' : '偏度正常',
      borderColor: '#eb2f96',
      valueColor: data.skew >= 0 ? '#52c41a' : '#ff4d4f',
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
