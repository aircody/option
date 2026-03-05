import React, { useMemo } from 'react';
import {
  Card,
  Typography,
  Tag,
  Space,
  Alert,
  List,
  Row,
  Col,
  Statistic,
  Divider,
  Progress,
  Badge,
} from 'antd';
import {
  generateStrategyRecommendation,
  getRiskLevelColor,
  getSignalStrengthColor,
} from '../utils/strategyCalculator';
import {
  WarningOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

interface StrategyGuideProps {
  oiData: { strike: number; callOI: number; putOI: number }[];
  currentPrice: number;
  ivPercentile?: number;
  gammaExposure?: number;
  putCallRatio?: number;
  atmIv?: number;
  hv?: number;
  vrp?: number;
  skew?: number;
  maxPain?: number;
}

const StrategyGuide: React.FC<StrategyGuideProps> = ({
  oiData,
  currentPrice,
  ivPercentile = 50,
  gammaExposure,
  putCallRatio,
  atmIv,
  hv,
  vrp,
  skew,
  maxPain,
}) => {
  // 生成策略建议
  const recommendation = useMemo(() => {
    return generateStrategyRecommendation(
      oiData, 
      currentPrice, 
      ivPercentile,
      gammaExposure,
      putCallRatio,
      atmIv,
      hv,
      vrp,
      skew,
      maxPain
    );
  }, [oiData, currentPrice, ivPercentile, gammaExposure, putCallRatio, atmIv, hv, vrp, skew, maxPain]);

  const { environment, primarySignal, secondarySignal, strategy, riskLevel, warnings } =
    recommendation;

  const riskColor = getRiskLevelColor(riskLevel);
  const signalColor = getSignalStrengthColor(primarySignal.strength);

  // 获取信号图标
  const getSignalIcon = (type: string) => {
    switch (type) {
      case 'bullish':
        return <ArrowUpOutlined style={{ color: '#52c41a' }} />;
      case 'bearish':
        return <ArrowDownOutlined style={{ color: '#ff4d4f' }} />;
      case 'range':
        return <MinusOutlined style={{ color: '#faad14' }} />;
      default:
        return <InfoCircleOutlined />;
    }
  };

  return (
    <Card
      title={
        <Space>
          <Title level={5} style={{ margin: 0 }}>
            多指标共振交易策略指南
          </Title>
          <Tag color={riskColor}>
            风险等级: {riskLevel === 'extreme' ? '极高' : riskLevel === 'high' ? '高' : riskLevel === 'medium' ? '中' : '低'}
          </Tag>
        </Space>
      }
      style={{ marginTop: 24 }}
    >
      {/* 核心铁律警告 */}
      <Alert
        message="核心铁律"
        description="所有开仓必须满足 ≥3 个核心指标共振，禁止单一信号开仓；策略必须严格匹配市场环境，禁止逆环境操作。"
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
      />

      {/* 市场环境判定 */}
      <Card
        type="inner"
        title="市场环境判定"
        style={{ marginBottom: 16 }}
        headStyle={{ background: '#f0f5ff' }}
      >
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Statistic
              title="当前环境"
              value={environment.label}
              valueStyle={{ color: '#1890ff', fontSize: 18 }}
            />
          </Col>
          <Col span={12}>
            <Statistic
              title="策略方向"
              value={environment.strategyDirection}
              valueStyle={{ fontSize: 14 }}
            />
          </Col>
        </Row>
        <Divider style={{ margin: '12px 0' }} />
        <Row gutter={[16, 8]}>
          <Col span={12}>
            <Text type="secondary">GEX阈值: {environment.gexThreshold}</Text>
          </Col>
          <Col span={12}>
            <Text type="secondary">IV阈值: {environment.ivThreshold}</Text>
          </Col>
          <Col span={24}>
            <Text type="secondary">波动特征: {environment.volatilityFeature}</Text>
          </Col>
        </Row>
      </Card>

      {/* 共振信号分析 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            type="inner"
            title={
              <Space>
                {getSignalIcon(primarySignal.type)}
                <span>主信号: {primarySignal.label}</span>
                <Tag color={signalColor}>
                  {primarySignal.strength === 'strong' ? '强' : primarySignal.strength === 'moderate' ? '中等' : '弱'}
                </Tag>
              </Space>
            }
            style={{ height: '100%' }}
            headStyle={{ background: '#f6ffed' }}
          >
            <div style={{ marginBottom: 12 }}>
              <Progress
                percent={Math.round(
                  (primarySignal.matchedConditions / primarySignal.totalConditions) * 100
                )}
                status={primarySignal.matchedConditions >= 3 ? 'success' : 'exception'}
                format={() => `${primarySignal.matchedConditions}/${primarySignal.totalConditions}`}
              />
            </div>
            <List
              size="small"
              dataSource={primarySignal.conditions}
              renderItem={(condition) => (
                <List.Item>
                  <Space>
                    {condition.status === 'met' ? (
                      <CheckCircleOutlined style={{ color: '#52c41a' }} />
                    ) : condition.status === 'partial' ? (
                      <InfoCircleOutlined style={{ color: '#faad14' }} />
                    ) : (
                      <WarningOutlined style={{ color: '#ff4d4f' }} />
                    )}
                    <Text
                      style={{
                        color:
                          condition.status === 'met'
                            ? '#52c41a'
                            : condition.status === 'partial'
                            ? '#faad14'
                            : '#ff4d4f',
                      }}
                    >
                      {condition.name}: {condition.description}
                    </Text>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        {secondarySignal && secondarySignal.matchedConditions >= 3 && (
          <Col xs={24} lg={12}>
            <Card
              type="inner"
              title={
                <Space>
                  {getSignalIcon(secondarySignal.type)}
                  <span>辅助信号: {secondarySignal.label}</span>
                  <Tag color={getSignalStrengthColor(secondarySignal.strength)}>
                    {secondarySignal.strength === 'strong' ? '强' : secondarySignal.strength === 'moderate' ? '中等' : '弱'}
                  </Tag>
                </Space>
              }
              style={{ height: '100%' }}
              headStyle={{ background: '#fff7e6' }}
            >
              <div style={{ marginBottom: 12 }}>
                <Progress
                  percent={Math.round(
                    (secondarySignal.matchedConditions / secondarySignal.totalConditions) * 100
                  )}
                  status={secondarySignal.matchedConditions >= 3 ? 'success' : 'exception'}
                  format={() =>
                    `${secondarySignal.matchedConditions}/${secondarySignal.totalConditions}`
                  }
                />
              </div>
              <List
                size="small"
                dataSource={secondarySignal.conditions.slice(0, 3)}
                renderItem={(condition) => (
                  <List.Item>
                    <Space>
                      {condition.status === 'met' ? (
                        <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      ) : (
                        <InfoCircleOutlined style={{ color: '#faad14' }} />
                      )}
                      <Text
                        style={{
                          fontSize: 12,
                          color: condition.status === 'met' ? '#52c41a' : '#faad14',
                        }}
                      >
                        {condition.name}: {condition.description}
                      </Text>
                    </Space>
                  </List.Item>
                )}
              />
            </Card>
          </Col>
        )}
      </Row>

      {/* 策略建议 */}
      <Card
        type="inner"
        title={
          <Space>
            <Badge status={riskLevel === 'low' ? 'success' : riskLevel === 'medium' ? 'warning' : 'error'} />
            <span>推荐策略: {strategy.name}</span>
          </Space>
        }
        style={{ marginTop: 16 }}
        headStyle={{ background: '#fff2f0' }}
      >
        <Paragraph>{strategy.description}</Paragraph>

        <Divider style={{ margin: '12px 0' }} />

        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Text strong>合约选择:</Text>
            <Paragraph style={{ marginTop: 4 }}>{strategy.contractSelection}</Paragraph>
          </Col>

          <Col span={24}>
            <Text strong>行权价设置:</Text>
            <Paragraph style={{ marginTop: 4 }}>{strategy.strikeSetting}</Paragraph>
          </Col>

          <Col span={24}>
            <Text strong>仓位控制:</Text>
            <Paragraph style={{ marginTop: 4, color: '#ff4d4f' }}>{strategy.positionSizing}</Paragraph>
          </Col>

          <Col span={24}>
            <Text strong>入场时机:</Text>
            <Paragraph style={{ marginTop: 4 }}>{strategy.entryTiming}</Paragraph>
          </Col>

          <Col xs={24} lg={12}>
            <Text strong style={{ color: '#52c41a' }}>止盈:</Text>
            <Paragraph style={{ marginTop: 4 }}>{strategy.takeProfit}</Paragraph>
          </Col>

          <Col xs={24} lg={12}>
            <Text strong style={{ color: '#ff4d4f' }}>止损:</Text>
            <Paragraph style={{ marginTop: 4 }}>{strategy.stopLoss}</Paragraph>
          </Col>
        </Row>
      </Card>

      {/* 风险提示 */}
      {warnings.length > 0 && (
        <Alert
          message="风险提示"
          description={
            <List
              size="small"
              dataSource={warnings}
              renderItem={(warning) => (
                <List.Item style={{ padding: '4px 0', border: 'none' }}>
                  <WarningOutlined style={{ color: '#ff4d4f', marginRight: 8 }} />
                  {warning}
                </List.Item>
              )}
            />
          }
          type="error"
          showIcon
          style={{ marginTop: 16 }}
        />
      )}

      {/* 适用边界说明 */}
      <Card
        type="inner"
        title="适用边界"
        style={{ marginTop: 16 }}
        headStyle={{ background: '#f5f5f5' }}
      >
        <Row gutter={[16, 8]}>
          <Col span={24}>
            <Text type="secondary">
              <strong>适用标的:</strong> 优先标普500(SPX/SPY)、纳斯达克100(NDX/QQQ)等宽基指数/ETF；
              其次是日均期权成交量&gt;100万张、市值&gt;5000亿美元的大盘蓝筹，禁止用于流动性差的小盘股。
            </Text>
          </Col>
          <Col span={24}>
            <Text type="secondary">
              <strong>时间周期:</strong> 核心适配近月到期合约（到期前1-15个交易日），尤其周度期权（3DTE/5DTE），
              中长线策略仅作辅助参考，0DTE仅限日内窄区间套利。
            </Text>
          </Col>
        </Row>
      </Card>
    </Card>
  );
};

export default StrategyGuide;
