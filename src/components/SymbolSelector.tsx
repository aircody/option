import React, { useState, useEffect } from 'react';
import { Button, Input, Tag, Space, Tooltip, message, Popover, List, Empty } from 'antd';
import { SearchOutlined, StarOutlined, StarFilled, DeleteOutlined } from '@ant-design/icons';

interface SymbolSelectorProps {
  selectedSymbol: string;
  onSymbolChange: (symbol: string) => void;
  onAnalyze: () => void;
  loading?: boolean;
}

const PRESET_SYMBOLS = ['SPY', 'QQQ', 'IWM'];
const SAVED_SYMBOLS_KEY = 'option_analysis_saved_symbols';

const SymbolSelector: React.FC<SymbolSelectorProps> = ({
  selectedSymbol,
  onSymbolChange,
  onAnalyze,
  loading = false,
}) => {
  const [customSymbol, setCustomSymbol] = useState('');
  const [savedSymbols, setSavedSymbols] = useState<string[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);

  // 从localStorage加载已保存的股票
  useEffect(() => {
    try {
      const stored = localStorage.getItem(SAVED_SYMBOLS_KEY);
      if (stored) {
        setSavedSymbols(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load saved symbols:', error);
    }
  }, []);

  // 保存到localStorage
  const saveSymbolsToStorage = (symbols: string[]) => {
    try {
      localStorage.setItem(SAVED_SYMBOLS_KEY, JSON.stringify(symbols));
    } catch (error) {
      console.error('Failed to save symbols:', error);
    }
  };

  const handleCustomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 只允许输入字母和数字
    const value = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    setCustomSymbol(value);
  };

  const handleCustomInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && customSymbol) {
      handleAnalyze(customSymbol);
    }
  };

  const handleAnalyze = (symbol: string) => {
    if (!symbol || symbol.trim() === '') {
      message.warning('请输入股票代码');
      return;
    }
    
    // 验证股票代码格式（美股通常是1-5个字母）
    if (!/^[A-Z]{1,5}$/.test(symbol)) {
      message.warning('股票代码格式不正确，请输入1-5个字母');
      return;
    }

    onSymbolChange(symbol);
    onAnalyze();
    setCustomSymbol('');
  };

  const handleTagClick = (symbol: string) => {
    handleAnalyze(symbol);
  };

  const handleAnalyzeClick = () => {
    if (customSymbol) {
      handleAnalyze(customSymbol);
    } else {
      // 如果没有输入，刷新当前选中的股票
      onAnalyze();
    }
  };

  // 保存/取消保存股票
  const toggleSaveSymbol = (symbol: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    
    let newSavedSymbols: string[];
    if (savedSymbols.includes(symbol)) {
      newSavedSymbols = savedSymbols.filter(s => s !== symbol);
      message.success(`已取消保存 ${symbol}`);
    } else {
      newSavedSymbols = [...savedSymbols, symbol];
      message.success(`已保存 ${symbol}`);
    }
    
    setSavedSymbols(newSavedSymbols);
    saveSymbolsToStorage(newSavedSymbols);
  };

  // 删除已保存的股票
  const removeSavedSymbol = (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSavedSymbols = savedSymbols.filter(s => s !== symbol);
    setSavedSymbols(newSavedSymbols);
    saveSymbolsToStorage(newSavedSymbols);
    message.success(`已删除 ${symbol}`);
  };

  // 已保存股票列表内容
  const savedSymbolsContent = (
    <div style={{ width: '200px' }}>
      {savedSymbols.length > 0 ? (
        <List
          size="small"
          dataSource={savedSymbols}
          renderItem={(symbol) => (
            <List.Item
              style={{ 
                cursor: 'pointer',
                padding: '8px 12px',
                background: selectedSymbol === symbol ? '#e6f7ff' : 'transparent'
              }}
              onClick={() => {
                handleAnalyze(symbol);
                setPopoverOpen(false);
              }}
              actions={[
                <DeleteOutlined 
                  key="delete"
                  style={{ color: '#ff4d4f' }}
                  onClick={(e) => removeSavedSymbol(symbol, e)}
                />
              ]}
            >
              <span style={{ fontWeight: 500 }}>{symbol}</span>
            </List.Item>
          )}
        />
      ) : (
        <Empty 
          description="暂无保存的股票" 
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ padding: '20px 0' }}
        />
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
      {/* 预设股票标签 */}
      <Space size="small">
        {PRESET_SYMBOLS.map((symbol) => (
          <Tooltip key={symbol} title={`查看 ${symbol} 期权数据`}>
            <Tag
              color={selectedSymbol === symbol ? 'blue' : 'default'}
              style={{
                cursor: 'pointer',
                fontSize: '14px',
                padding: '4px 12px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
              onClick={() => handleTagClick(symbol)}
            >
              {symbol}
              {savedSymbols.includes(symbol) ? (
                <StarFilled 
                  style={{ color: '#faad14', fontSize: '12px' }}
                  onClick={(e) => toggleSaveSymbol(symbol, e)}
                />
              ) : (
                <StarOutlined 
                  style={{ color: '#bfbfbf', fontSize: '12px' }}
                  onClick={(e) => toggleSaveSymbol(symbol, e)}
                />
              )}
            </Tag>
          </Tooltip>
        ))}
      </Space>

      {/* 自定义输入框 */}
      <Input
        placeholder="输入股票代码..."
        value={customSymbol}
        onChange={handleCustomInputChange}
        onKeyDown={handleCustomInputKeyDown}
        style={{ width: '140px' }}
        prefix={<SearchOutlined />}
        maxLength={5}
        disabled={loading}
      />

      {/* 已保存标签 - 点击展开列表 */}
      <Popover
        content={savedSymbolsContent}
        title="已保存的股票"
        trigger="click"
        open={popoverOpen}
        onOpenChange={setPopoverOpen}
        placement="bottomLeft"
      >
        <Tag
          color="success"
          style={{
            cursor: 'pointer',
            fontSize: '12px',
            padding: '2px 8px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <StarFilled />
          已保存 ({savedSymbols.length})
        </Tag>
      </Popover>

      {/* Analyze 按钮 */}
      <Button
        type="primary"
        icon={<SearchOutlined />}
        onClick={handleAnalyzeClick}
        loading={loading}
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
