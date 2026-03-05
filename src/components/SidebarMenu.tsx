import React from 'react';
import { Menu } from 'antd';
import type { MenuProps } from 'antd';
import {
  HomeOutlined,
  WalletOutlined,
  BankOutlined,
  SafetyCertificateOutlined,
  PercentageOutlined,
  WarningOutlined,
  GlobalOutlined,
  SearchOutlined,
  PieChartOutlined,
  DollarOutlined,
  LineChartOutlined,
  FundOutlined,
  BarChartOutlined,
} from '@ant-design/icons';

interface SidebarMenuProps {
  selectedKey: string;
  onSelect: (key: string) => void;
}

type MenuItem = Required<MenuProps>['items'][number];

const SidebarMenu: React.FC<SidebarMenuProps> = ({ selectedKey, onSelect }) => {
  const items: MenuItem[] = [
    {
      key: 'home',
      icon: <HomeOutlined />,
      label: '首页概览',
    },
    {
      key: 'liquidity',
      icon: <WalletOutlined />,
      label: 'Liquidity',
    },
    {
      key: 'funding',
      icon: <BankOutlined />,
      label: 'Funding',
    },
    {
      key: 'treasury',
      icon: <BankOutlined />,
      label: 'Treasury',
    },
    {
      key: 'credit',
      icon: <SafetyCertificateOutlined />,
      label: 'Credit',
    },
    {
      key: 'rate',
      icon: <PercentageOutlined />,
      label: 'Rate',
    },
    {
      key: 'risk',
      icon: <WarningOutlined />,
      label: 'Risk',
    },
    {
      key: 'external',
      icon: <GlobalOutlined />,
      label: 'External',
    },
    {
      type: 'divider',
    },
    {
      key: 'gap-scan',
      icon: <SearchOutlined />,
      label: '财技Gap扫描',
    },
    {
      key: 'sector-rrg',
      icon: <PieChartOutlined />,
      label: '板块RRG',
    },
    {
      key: 'metal-prices',
      icon: <DollarOutlined />,
      label: '金银铜价格',
    },
    {
      key: 'cross-asset',
      icon: <LineChartOutlined />,
      label: '跨资产价格分析',
    },
    {
      key: 'sector-performance',
      icon: <FundOutlined />,
      label: '板块表现',
    },
    {
      key: 'option-analysis',
      icon: <BarChartOutlined />,
      label: '期权分析',
    },
    {
      key: 'chart-backtest',
      icon: <LineChartOutlined />,
      label: '图表回溯分析',
    },
  ];

  return (
    <div style={{ height: '100%', background: '#fff' }}>
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '40px',
            background: '#1890ff',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 'bold',
            fontSize: '16px',
            cursor: 'pointer',
          }}
        >
          <span style={{ marginRight: '8px' }}>↻</span>
          刷新数据
        </div>
      </div>
      <Menu
        mode="inline"
        selectedKeys={[selectedKey]}
        items={items}
        onClick={({ key }) => onSelect(key)}
        style={{ borderRight: 0 }}
      />
    </div>
  );
};

export default SidebarMenu;
