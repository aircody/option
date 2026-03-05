import React, { useState } from 'react';
import { Button, Input, Tag, Space } from 'antd';
import { SearchOutlined } from '@ant-design/icons';

interface SymbolSelectorProps {
  selectedSymbol: string;
  onSymbolChange: (symbol: string) => void;
  onAnalyze: () => void;
}

const PRESET_SYMBOLS = ['SPY', 'QQQ', 'IWM'];

const SymbolSelector: React.FC<SymbolSelectorProps> = ({
  selectedSymbol,
  onSymbolChange,
  onAnalyze,
}) => {
  const [customSymbol, setCustomSymbol] = useState('');

  const handleCustomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomSymbol(e.target.value.toUpperCase());
  };

  const handleCustomInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && customSymbol) {
      onSymbolChange(customSymbol);
      onAnalyze();
    }
  };

  const handleTagClick = (symbol: string) => {
    onSymbolChange(symbol);
    onAnalyze();
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
      <Space size="small">
        {PRESET_SYMBOLS.map((symbol) => (
          <Tag
            key={symbol}
            color={selectedSymbol === symbol ? 'blue' : 'default'}
            style={{
              cursor: 'pointer',
              fontSize: '14px',
              padding: '4px 12px',
              borderRadius: '4px',
            }}
            onClick={() => handleTagClick(symbol)}
          >
            {symbol}
          </Tag>
        ))}
      </Space>

      <Input
        placeholder="自定义标的..."
        value={customSymbol}
        onChange={handleCustomInputChange}
        onKeyDown={handleCustomInputKeyDown}
        style={{ width: '120px' }}
        prefix={<SearchOutlined />}
      />

      <Tag
        color="success"
        style={{
          cursor: 'pointer',
          fontSize: '12px',
          padding: '2px 8px',
        }}
      >
        已保存
      </Tag>

      <Button
        type="primary"
        icon={<SearchOutlined />}
        onClick={onAnalyze}
        style={{
          background: '#1890ff',
          borderRadius: '6px',
        }}
      >
        Analyze
      </Button>
    </div>
  );
};

export default SymbolSelector;
