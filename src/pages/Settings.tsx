import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Switch, Button, Divider, Typography, message, Space, Alert } from 'antd';
import { SaveOutlined, ReloadOutlined, ClearOutlined, ApiOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { ApiConfig } from '../types/settings';
import { defaultApiConfig } from '../types/settings';
import { getApiConfig, saveApiConfig, clearApiConfig } from '../services/configService';
import { testApiConnection } from '../services/optionService';

const { Title, Text, Paragraph } = Typography;

const Settings: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);

  useEffect(() => {
    const config = getApiConfig();
    form.setFieldsValue(config);
  }, [form]);

  const handleSave = async (values: ApiConfig) => {
    setLoading(true);
    try {
      saveApiConfig(values);
      message.success('配置已保存');
      setTestResult(null);
    } catch (error) {
      message.error('保存失败');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    form.setFieldsValue(defaultApiConfig);
    setTestResult(null);
    message.info('已重置为默认配置');
  };

  const handleClear = () => {
    clearApiConfig();
    form.setFieldsValue(defaultApiConfig);
    setTestResult(null);
    message.success('配置已清除');
  };

  const testConnection = async () => {
    const values = form.getFieldsValue();
    
    if (values.useMock) {
      message.info('当前使用Mock数据模式，无需测试连接');
      setTestResult(true);
      return;
    }
    
    if (!values.appKey || !values.appSecret || !values.accessToken) {
      message.warning('请先填写完整的API配置信息');
      return;
    }
    
    setTestLoading(true);
    setTestResult(null);
    
    try {
      // 先保存配置
      saveApiConfig(values);
      
      // 测试连接
      const success = await testApiConnection();
      setTestResult(success);
      
      if (success) {
        message.success('API连接测试成功！');
      } else {
        message.error('API连接测试失败，请检查配置信息');
      }
    } catch (error) {
      console.error('Test connection error:', error);
      setTestResult(false);
      message.error('API连接测试失败: ' + (error as Error).message);
    } finally {
      setTestLoading(false);
    }
  };

  const useMock = Form.useWatch('useMock', form);

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <Title level={4} style={{ marginBottom: '24px' }}>
        <ApiOutlined style={{ marginRight: '8px' }} />
        系统设置
      </Title>

      <Card
        title="API配置"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              重置
            </Button>
            <Button danger icon={<ClearOutlined />} onClick={handleClear}>
              清除
            </Button>
          </Space>
        }
        style={{ marginBottom: '24px' }}
      >
        <Paragraph>
          配置LongPort OpenAPI的接入信息。您可以在
          <a href="https://open.longportapp.cn/zh-CN/docs" target="_blank" rel="noopener noreferrer">
            LongPort开发者平台
          </a>
          获取API密钥。
        </Paragraph>

        {testResult !== null && (
          <Alert
            message={testResult ? 'API连接测试成功' : 'API连接测试失败'}
            type={testResult ? 'success' : 'error'}
            showIcon
            style={{ marginBottom: '16px' }}
          />
        )}

        <Divider />

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={defaultApiConfig}
        >
          <Form.Item
            name="useMock"
            valuePropName="checked"
            label="数据模式"
          >
            <Switch
              checkedChildren="使用Mock数据"
              unCheckedChildren="使用真实API"
            />
          </Form.Item>

          {!useMock && (
            <>
              <Form.Item
                label="API基础地址"
                name="baseUrl"
                rules={[{ required: !useMock, message: '请输入API基础地址' }]}
              >
                <Input placeholder="https://openapi.longportapp.com" />
              </Form.Item>

              <Form.Item
                label="App Key"
                name="appKey"
                rules={[{ required: !useMock, message: '请输入App Key' }]}
              >
                <Input.Password placeholder="请输入您的App Key" />
              </Form.Item>

              <Form.Item
                label="App Secret"
                name="appSecret"
                rules={[{ required: !useMock, message: '请输入App Secret' }]}
              >
                <Input.Password placeholder="请输入您的App Secret" />
              </Form.Item>

              <Form.Item
                label="Access Token"
                name="accessToken"
                rules={[{ required: !useMock, message: '请输入Access Token' }]}
              >
                <Input.Password placeholder="请输入您的Access Token" />
              </Form.Item>
            </>
          )}

          <Divider />

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={loading}
              >
                保存配置
              </Button>
              <Button 
                onClick={testConnection}
                loading={testLoading}
                icon={<CheckCircleOutlined />}
              >
                测试连接
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card title="使用说明">
        <Paragraph>
          <Text strong>如何获取API密钥：</Text>
        </Paragraph>
        <ol style={{ paddingLeft: '20px' }}>
          <li>访问 <a href="https://open.longportapp.cn/zh-CN/docs" target="_blank" rel="noopener noreferrer">LongPort OpenAPI文档</a></li>
          <li>登录LongPort App完成开户</li>
          <li>进入开发者平台，完成开发者认证</li>
          <li>申请OpenAPI权限，获取令牌（App Key、App Secret、Access Token）</li>
        </ol>

        <Divider />

        <Paragraph>
          <Text strong>数据模式说明：</Text>
        </Paragraph>
        <ul style={{ paddingLeft: '20px' }}>
          <li>
            <Text code>Mock数据模式</Text>：使用本地模拟数据进行开发和测试，无需配置API密钥
          </li>
          <li>
            <Text code>真实API模式</Text>：连接LongPort OpenAPI获取实时数据，需要有效的API密钥
          </li>
        </ul>

        <Divider />

        <Paragraph type="warning">
          <Text strong>安全提示：</Text>
          <br />
          API密钥信息将保存在浏览器本地存储中，请勿在公共设备上保存敏感信息。
        </Paragraph>
      </Card>
    </div>
  );
};

export default Settings;
