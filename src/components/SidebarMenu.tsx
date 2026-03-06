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
