import React from 'react';
import { Tag, Space, Typography } from 'antd';
import type { ExpiryDate } from '../types';

const { Text } = Typography;

interface ExpirySelectorProps {
  expiryDates: ExpiryDate[];
  selectedExpiry: string;
  onExpiryChange: (date: string) => void;
}

const ExpirySelector: React.FC<ExpirySelectorProps> = ({
  expiryDates,
  selectedExpiry,
  onExpiryChange,
}) => {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${month}/${day}`;
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <Text type="secondary" style={{ fontSize: '12px', marginRight: '8px' }}>
        到期周期 (基准: 2026-03-05):
      </Text>
      <Space size="small">
        {expiryDates.map((expiry) => {
          const isSelected = selectedExpiry === expiry.date;
          const isFriday = expiry.label.includes('周五') || expiry.label.includes('OPEX');

          return (
            <div
              key={expiry.label}
              onClick={() => onExpiryChange(expiry.date)}
              style={{
                cursor: 'pointer',
                padding: '4px 12px',
                borderRadius: '4px',
                background: isSelected ? '#1890ff' : isFriday ? '#f6ffed' : '#f5f5f5',
                border: `1px solid ${isSelected ? '#1890ff' : isFriday ? '#b7eb8f' : '#d9d9d9'}`,
                textAlign: 'center',
                minWidth: '60px',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  color: isSelected ? '#fff' : '#666',
                  lineHeight: '1.2',
                }}
              >
                {expiry.label}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: isSelected ? '#fff' : '#333',
                  lineHeight: '1.4',
                }}
              >
                {formatDate(expiry.date)}
              </div>
            </div>
          );
        })}
      </Space>
    </div>
  );
};

export default ExpirySelector;
