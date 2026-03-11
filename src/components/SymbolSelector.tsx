import React, { useState, useEffect } from 'react';
import { Button, Input, Tag, Space, Tooltip, message, Popover, List, Empty, Badge } from 'antd';
import { SearchOutlined, StarOutlined, StarFilled, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { PRESET_SYMBOLS, STORAGE_KEYS, SYMBOL_PATTERN } from '../utils/constants';

interface SymbolSelectorProps {
  selectedSymbol: string;
  onSymbolChange: (symbol: string) => void;
  onAnalyze: () => void;
  loading?: boolean;
}

const SymbolSelector: React.FC<SymbolSelectorProps> = ({
  selectedSymbol,
  onSymbolChange,
  onAnalyze,
  loading = false,
}) => {
  const [customSymbol, setCustomSymbol] = useState('');
  const [savedSymbols, setSavedSymbols] = useLocalStorage<string[]>(STORAGE_KEYS.SAVED_SYMBOLS_OPTION, []);
  const [popoverOpen, setPopoverOpen] = useState(false);

  useEffect(() => {
    try {
      const lastSymbol = localStorage.getItem(STORAGE_KEYS.LAST_SYMBOL);
      if (lastSymbol && !selectedSymbol) {
        onSymbolChange(lastSymbol);
      }
    } catch (error) {
      console.error('Failed to restore last symbol:', error);
    }
  }, [selectedSymbol, onSymbolChange]);

  const validateAndAnalyze = (symbol: string) => {
    const trimmedSymbol = symbol.trim().toUpperCase();

    if (!trimmedSymbol) {
      message.warning('请输入股票代码');
      return;
    }

    if (!SYMBOL_PATTERN.test(trimmedSymbol)) {
      message.warning('股票代码格式不正确，请输入 1-5 个字母');
      return;
    }

    onSymbolChange(trimmedSymbol);
    onAnalyze();
    setCustomSymbol('');

    try {
      localStorage.setItem(STORAGE_KEYS.LAST_SYMBOL, trimmedSymbol);
    } catch (error) {
      console.error('Failed to save last symbol:', error);
    }
  };

  const handleTagClick = (symbol: string) => {
    onSymbolChange(symbol);

    try {
      localStorage.setItem(STORAGE_KEYS.LAST_SYMBOL, symbol);
    } catch (error) {
      console.error('Failed to save last symbol:', error);
    }
  };

  const handleAnalyzeClick = () => {
    if (customSymbol) {
      validateAndAnalyze(customSymbol);
    } else {
      onAnalyze();
    }
  };

  const toggleSaveSymbol = (symbol: string, e?: React.MouseEvent) => {
    e?.stopPropagation();

    if (savedSymbols.includes(symbol)) {
      setSavedSymbols(prev => prev.filter(s => s !== symbol));
      message.success(`已取消保存 ${symbol}`);
    } else {
      setSavedSymbols(prev => [...prev, symbol]);
      message.success(`已保存 ${symbol}`);
    }
  };

  const removeSavedSymbol = (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedSymbols(prev => prev.filter(s => s !== symbol));
    message.success(`已删除 ${symbol}`);
  };

  const savedSymbolsContent = (
    <div style={{ width: '250px', maxHeight: '400px', overflowY: 'auto' }}>
      {savedSymbols.length > 0 ? (
        <List
          size="small"
          dataSource={savedSymbols}
          renderItem={(symbol) => (
            <List.Item
              style={{
                cursor: 'pointer',
                padding: '12px 16px',
                background: selectedSymbol === symbol ? '#e6f7ff' : 'transparent',
                borderBottom: '1px solid #f0f0f0',
                transition: 'background 0.2s',
              }}
              onClick={() => {
                validateAndAnalyze(symbol);
                setPopoverOpen(false);
              }}
              actions={[
                <Tooltip key="delete" title="删除">
                  <DeleteOutlined
                    style={{ color: '#ff4d4f', fontSize: '16px' }}
                    onClick={(e) => removeSavedSymbol(symbol, e)}
                  />
                </Tooltip>
              ]}
            >
              <List.Item.Meta
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: '15px' }}>{symbol}</span>
                    {selectedSymbol === symbol && (
                      <Badge color="blue" text="当前" style={{ fontSize: '12px' }} />
                    )}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      ) : (
        <Empty
          description="暂无保存的股票"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ padding: '30px 0' }}
        />
      )}
    </div>
  );

  const isPresetSymbol = PRESET_SYMBOLS.includes(selectedSymbol as any);
  const showSelectedCustomSymbol = !isPresetSymbol && selectedSymbol;
  const isSaved = savedSymbols.includes(selectedSymbol);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
      <Space size="small" wrap>
        {PRESET_SYMBOLS.map((symbol) => (
          <Tooltip key={symbol} title={`查看 ${symbol} 期权数据`}>
            <Tag
              color={selectedSymbol === symbol ? 'blue' : ''}
              style={{
                cursor: 'pointer',
                fontSize: '14px',
                padding: '6px 16px',
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: selectedSymbol === symbol ? 'bold' : 'normal',
                boxShadow: 'rgba(0, 0, 0, 0.08) 0px 2px 4px',
                transition: 'all 0.2s',
              }}
              onClick={() => handleTagClick(symbol)}
            >
              {symbol}
            </Tag>
          </Tooltip>
        ))}

        {savedSymbols.map((symbol) => (
          <Tooltip key={symbol} title={`查看 ${symbol} 期权数据`}>
            <Tag
              color={selectedSymbol === symbol ? 'cyan' : ''}
              style={{
                cursor: 'pointer',
                fontSize: '14px',
                padding: '6px 16px',
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: selectedSymbol === symbol ? 'bold' : 'normal',
                boxShadow: 'rgba(0, 0, 0, 0.08) 0px 2px 4px',
                border: selectedSymbol === symbol ? '2px solid #1890ff' : '2px solid transparent',
                transition: 'all 0.2s',
              }}
              onClick={() => handleTagClick(symbol)}
              onClose={(e) => {
                e?.stopPropagation();
                removeSavedSymbol(symbol, e as any);
              }}
              closable
            >
              {symbol}
            </Tag>
          </Tooltip>
        ))}

        {showSelectedCustomSymbol && !isSaved && (
          <Tooltip title={`查看 ${selectedSymbol} 期权数据 (点击星标保存)`}>
            <Tag
              color="blue"
              style={{
                cursor: 'pointer',
                fontSize: '14px',
                padding: '6px 16px',
                borderRadius: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 'bold',
                boxShadow: 'rgba(0, 0, 0, 0.08) 0px 2px 4px',
              }}
              onClick={() => handleTagClick(selectedSymbol)}
            >
              {selectedSymbol}
              <StarOutlined
                style={{ color: '#faad14', fontSize: '14px' }}
                onClick={(e) => toggleSaveSymbol(selectedSymbol, e)}
              />
            </Tag>
          </Tooltip>
        )}
      </Space>

      <Input
        placeholder="输入股票代码（如：AAPL）"
        value={customSymbol}
        onChange={(e) => {
          const value = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
          setCustomSymbol(value);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && customSymbol) {
            validateAndAnalyze(customSymbol);
          }
        }}
        style={{
          width: '180px',
          borderRadius: '8px',
        }}
        prefix={<SearchOutlined />}
        maxLength={5}
        disabled={loading}
        allowClear
      />

      <Tooltip title="添加自定义股票">
        <Button
          type="default"
          icon={<PlusOutlined />}
          onClick={() => {
            if (customSymbol) {
              validateAndAnalyze(customSymbol);
            } else {
              message.info('请先输入股票代码');
            }
          }}
          loading={loading}
          style={{
            borderRadius: '8px',
          }}
        >
          添加
        </Button>
      </Tooltip>

      <Popover
        content={savedSymbolsContent}
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 600 }}>已保存的股票</span>
            {savedSymbols.length > 0 && (
              <Button
                type="link"
                size="small"
                danger
                onClick={() => {
                  setSavedSymbols([]);
                  message.success('已清空所有保存的股票');
                }}
              >
                清空全部
              </Button>
            )}
          </div>
        }
        trigger="click"
        open={popoverOpen}
        onOpenChange={setPopoverOpen}
        placement="bottomLeft"
      >
        <Badge count={savedSymbols.length} size="small" showZero={false}>
          <Tag
            color="success"
            style={{
              cursor: 'pointer',
              fontSize: '13px',
              padding: '4px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: '20px',
            }}
          >
            <StarFilled />
            已保存
          </Tag>
        </Badge>
      </Popover>

      <Button
        type="primary"
        icon={<SearchOutlined />}
        onClick={handleAnalyzeClick}
        loading={loading}
        style={{
          background: '#1890ff',
          borderRadius: '8px',
          padding: '4px 20px',
        }}
      >
        分析
      </Button>
    </div>
  );
};

export default SymbolSelector;
