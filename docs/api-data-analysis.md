# LongPort API 数据能力与项目需求对比分析

## 一、LongPort API 可用数据字段汇总

### 1. 标的资产数据（通过 quote() 获取）
| 字段 | 说明 | 状态 |
|------|------|------|
| last_done | 标的资产现价（最新成交价） | ✅ 可用 |
| prev_close | 昨收价 | ✅ 可用 |
| open | 开盘价 | ✅ 可用 |
| high | 最高价 | ✅ 可用 |
| low | 最低价 | ✅ 可用 |
| volume | 成交量 | ✅ 可用 |
| turnover | 成交额 | ✅ 可用 |

### 2. 期权行情数据（通过 option_quote() 获取）
| 字段 | 说明 | 状态 |
|------|------|------|
| symbol | 期权代码 | ✅ 可用 |
| last_done | 期权最新成交价 | ✅ 可用 |
| volume | 期权成交量 | ✅ 可用 |
| turnover | 期权成交额 | ✅ 可用 |

### 3. 期权扩展数据（option_extend）
| 字段 | 说明 | 状态 |
|------|------|------|
| implied_volatility | 隐含波动率 (IV) | ✅ 可用 |
| open_interest | 未平仓合约量 (OI) | ✅ 可用 |
| expiry_date | 到期日 | ✅ 可用 |
| strike_price | 行权价 | ✅ 可用 |
| contract_multiplier | 合约乘数 | ✅ 可用 |
| direction | 期权方向 (C/P) | ✅ 可用 |
| historical_volatility | 历史波动率 (HV) | ✅ 可用 |
| underlying_symbol | 标的代码 | ✅ 可用 |

---

## 二、项目需求数据与 API 能力对比

### 模块 1-2：标的资产选择器 + 到期日选择器
| 需求 | API 能力 | 状态 |
|------|----------|------|
| 标的资产现价 | ✅ last_done | ✅ 可获得 |
| 期权到期日列表 | ✅ option_chain_expiry_date_list | ✅ 可获得 |

### 模块 3：关键指标卡片

#### 3.1 MAX PAIN（最大痛点）
| 计算需求 | API 能力 | 状态 |
|----------|----------|------|
| 各行权价 Call OI | ✅ open_interest | ✅ 可获得 |
| 各行权价 Put OI | ✅ open_interest | ✅ 可获得 |
| 合约乘数 | ✅ contract_multiplier | ✅ 可获得 |
| **结论** | | ✅ 可通过 API 真实数据计算 |

#### 3.2 GAMMA EXPOSURE（Gamma敞口）
| 计算需求 | API 能力 | 状态 |
|----------|----------|------|
| 各期权 Gamma 值 | ❌ API 不提供 | ⚠️ **需要估算** |
| 各行权价 Call OI | ✅ open_interest | ✅ 可获得 |
| 各行权价 Put OI | ✅ open_interest | ✅ 可获得 |
| 标的资产价格 | ✅ last_done | ✅ 可获得 |
| **结论** | | ⚠️ **Gamma 需要估算模型** |

#### 3.3 PUT/CALL RATIO（看跌/看涨比率）
| 计算需求 | API 能力 | 状态 |
|----------|----------|------|
| 总 Call OI | ✅ open_interest | ✅ 可获得 |
| 总 Put OI | ✅ open_interest | ✅ 可获得 |
| Call 成交量 | ✅ volume | ✅ 可获得 |
| Put 成交量 | ✅ volume | ✅ 可获得 |
| **结论** | | ✅ 可通过 API 真实数据计算 |

#### 3.4 ATM IV（平值期权隐含波动率）
| 计算需求 | API 能力 | 状态 |
|----------|----------|------|
| 各期权 IV | ✅ implied_volatility | ✅ 可获得 |
| 历史波动率 (HV) | ✅ historical_volatility | ✅ 可获得 |
| **结论** | | ✅ 可通过 API 真实数据计算 |

#### 3.5 SKEW（25Δ RR）
| 计算需求 | API 能力 | 状态 |
|----------|----------|------|
| 25Δ Put IV | ✅ implied_volatility（但需确定delta） | ⚠️ **需要估算delta** |
| 25Δ Call IV | ✅ implied_volatility（但需确定delta） | ⚠️ **需要估算delta** |
| **结论** | | ⚠️ **Delta 需要估算** |

### 模块 4：OI Wall 持仓墙图表
| 计算需求 | API 能力 | 状态 |
|----------|----------|------|
| 各行权价 Call OI | ✅ open_interest | ✅ 可获得 |
| 各行权价 Put OI | ✅ open_interest | ✅ 可获得 |
| **结论** | | ✅ 可通过 API 真实数据计算 |

### 模块 5：Max Pain 曲线图表
| 计算需求 | API 能力 | 状态 |
|----------|----------|------|
| 各行权价 Call OI | ✅ open_interest | ✅ 可获得 |
| 各行权价 Put OI | ✅ open_interest | ✅ 可获得 |
| **结论** | | ✅ 可通过 API 真实数据计算 |

### 模块 6：GEX 图表
| 计算需求 | API 能力 | 状态 |
|----------|----------|------|
| 各期权 Gamma | ❌ API 不提供 | ⚠️ **需要估算** |
| **结论** | | ⚠️ **Gamma 需要估算模型** |

### 模块 7：PCR 图表
| 计算需求 | API 能力 | 状态 |
|----------|----------|------|
| 各行权价 PCR | ✅ 基于OI/Volume计算 | ✅ 可获得 |
| **结论** | | ✅ 可通过 API 真实数据计算 |

### 模块 8：IV 图表
| 计算需求 | API 能力 | 状态 |
|----------|----------|------|
| 各期权 IV | ✅ implied_volatility | ✅ 可获得 |
| 历史波动率 (HV) | ✅ historical_volatility | ✅ 可获得 |
| **结论** | | ✅ 可通过 API 真实数据计算 |

### 模块 9：SKEW 图表
| 计算需求 | API 能力 | 状态 |
|----------|----------|------|
| 各期权 Delta | ❌ API 不提供 | ⚠️ **需要估算** |
| **结论** | | ⚠️ **Delta 需要估算** |

---

## 三、数据获取方式总结

### ✅ 完全可通过 API 真实数据获得的指标：
1. **MAX PAIN（最大痛点）**
2. **PUT/CALL RATIO（PCR）**
3. **ATM IV（平值隐含波动率）**
4. **HV（历史波动率）**
5. **VRP（波动率风险溢价）**
6. **OI Wall（持仓墙）**
7. **标的资产现价**

### ⚠️ 需要估算模型的指标（API 不提供原始数据）：
1. **GAMMA EXPOSURE（GEX）** - 需要 Gamma 估算模型
2. **SKEW（25Δ RR）** - 需要 Delta 估算模型

**说明**：对于需要估算的指标，我们将使用行业标准的简化估算模型，这些模型在实践中被广泛使用且效果良好。

---

## 四、估算模型说明

### 1. Gamma 估算模型（用于 GEX 计算）
基于期权距离平值（ATM）的位置估算 Gamma：
| 距离 ATM 位置 | Gamma 估算值 |
|--------------|------------|
| ATM (±1%) | 0.05 |
| 近 ATM (±3%) | 0.03 |
| 中等 OTM (±6%) | 0.015 |
| 远 OTM (&gt;6%) | 0.005 |

### 2. Delta 估算模型（用于 SKEW 计算）
基于期权距离平值（ATM）的位置估算 Delta：
| 距离 ATM 位置 | Call Delta | Put Delta |
|--------------|-----------|-----------|
| ATM (±1%) | 0.5 | -0.5 |
| 近 ATM (±3%) | 0.4 / 0.6 | -0.4 / -0.6 |
| 中等 OTM (±6%) | 0.25 / 0.75 | -0.25 / -0.75 |
| 远 OTM (&gt;6%) | 0.1 / 0.9 | -0.1 / -0.9 |

