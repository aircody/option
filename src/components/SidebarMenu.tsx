import React from 'react';
import { Menu } from 'antd';
import type { MenuProps } from 'antd';
import { BarChartOutlined, SettingOutlined } from '@ant-design/icons';

interface SidebarMenuProps {
  selectedKey: string;
  onSelect: (key: string) => void;
}

type MenuItem = Required<MenuProps>['items'][number];

const SidebarMenu: React.FC<SidebarMenuProps> = ({ selectedKey, onSelect }) => {
  const items: MenuItem[] = [
    {
      key: 'option-analysis',
      icon: <BarChartOutlined />,
      label: '期权分析',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '设置',
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
