import React from 'react';
import { Space, Typography, Tooltip } from 'antd';
import type { ExpiryDate } from '../types';

const { Text } = Typography;

interface ExpirySelectorProps {
  expiryDates: ExpiryDate[];
  selectedExpiry: string;
  onExpiryChange: (date: string) => void;
  loading?: boolean;
}

const ExpirySelector: React.FC<ExpirySelectorProps> = ({
  expiryDates,
  selectedExpiry,
  onExpiryChange,
  loading = false,
}) => {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${month}/${day}`;
  };

  const handleExpiryClick = (date: string) => {
    if (loading) return;
    onExpiryChange(date);
  };

  // 判断是否为特殊日期（周五或OPEX）
  const isSpecialDate = (label: string): boolean => {
    return label.includes('周五') || label.includes('OPEX');
  };

  // 获取到期日的提示信息
  const getTooltipTitle = (expiry: ExpiryDate): string => {
    const dte = expiry.daysToExpiry;
    let dteText = '';
    
    if (dte === 0) {
      dteText = '今日到期 (0 DTE)';
    } else if (dte === 1) {
      dteText = '明日到期 (1 DTE)';
    } else {
      dteText = `${dte} 天后到期 (${dte} DTE)`;
    }
    
    return `${expiry.label} (${formatDate(expiry.date)})\n${dteText}`;
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <Text type="secondary" style={{ fontSize: '12px', marginRight: '8px' }}>
        到期周期:
      </Text>
      <Space size="small">
        {expiryDates.map((expiry) => {
          const isSelected = selectedExpiry === expiry.date;
          const isSpecial = isSpecialDate(expiry.label);
          const isToday = expiry.label === '今日ODTE';
          const isTomorrow = expiry.label === '明日';

          // 背景色逻辑
          let backgroundColor = '#f5f5f5';
          let borderColor = '#d9d9d9';
          let textColor = '#333';
          let labelColor = '#666';

          if (isSelected) {
            backgroundColor = '#1890ff';
            borderColor = '#1890ff';
            textColor = '#fff';
            labelColor = '#fff';
          } else if (isToday) {
            // 今日ODTE - 红色标记
            backgroundColor = '#fff2f0';
            borderColor = '#ffccc7';
          } else if (isTomorrow) {
            // 明日 - 橙色标记
            backgroundColor = '#fff7e6';
            borderColor = '#ffd591';
          } else if (isSpecial) {
            // 周五/OPEX - 绿色标记
            backgroundColor = '#f6ffed';
            borderColor = '#b7eb8f';
          }

          return (
            <Tooltip 
              key={expiry.date} 
              title={getTooltipTitle(expiry)}
              placement="top"
            >
              <div
                onClick={() => handleExpiryClick(expiry.date)}
                style={{
                  cursor: loading ? 'not-allowed' : 'pointer',
                  padding: '4px 12px',
                  borderRadius: '4px',
                  background: backgroundColor,
                  border: `1px solid ${borderColor}`,
                  textAlign: 'center',
                  minWidth: '60px',
                  opacity: loading ? 0.6 : 1,
                  transition: 'all 0.2s ease',
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    color: isSelected ? labelColor : isToday ? '#ff4d4f' : isTomorrow ? '#fa8c16' : '#666',
                    lineHeight: '1.2',
                    fontWeight: isToday || isTomorrow ? 'bold' : 'normal',
                  }}
                >
                  {expiry.label}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: isSelected ? textColor : '#333',
                    lineHeight: '1.4',
                  }}
                >
                  {formatDate(expiry.date)}
                </div>
                {expiry.daysToExpiry >= 0 && (
                  <div
                    style={{
                      fontSize: '10px',
                      color: isSelected ? 'rgba(255,255,255,0.8)' : '#999',
                      lineHeight: '1.2',
                      marginTop: '2px',
                    }}
                  >
                    {expiry.daysToExpiry === 0 ? '0DTE' : `${expiry.daysToExpiry}D`}
                  </div>
                )}
              </div>
            </Tooltip>
          );
        })}
      </Space>
    </div>
  );
};

export default ExpirySelector;
