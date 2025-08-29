# Token价格同步服务说明

## 概述

Token价格同步服务是一个自动化系统，用于从Binance API获取主流加密货币的实时价格信息，并提供RESTful API接口供前端调用。

## 核心特性

### 🚀 自动化价格同步
- **实时更新**: 每分钟从Binance API获取最新价格
- **智能同步**: 自动识别并同步新Token到行情表
- **批量处理**: 支持一次请求获取多个Token价格

### 📊 支持Token类型
- **主流币种**: BTC, ETH, BNB, ADA, XRP, SOL, DOT等
- **DeFi代币**: UNI, AAVE, COMP, SNX, SUSHI等
- **稳定币**: USDT, USDC, DAI等
- **自动扩展**: 根据操作记录自动添加新Token

### 🔌 API接口
- **单个查询**: `GET /api/token-price/:token`
- **批量查询**: `POST /api/token-price/batch`
- **全部查询**: `GET /api/token-price/`
- **服务状态**: `GET /api/token-price/status/health`

## 数据库设计

### Token行情表 (token_market)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INT | 主键ID |
| token | VARCHAR(20) | Token符号 |
| price_usdt | DECIMAL(20,8) | USDT价格（8位小数） |
| price_change_24h | DECIMAL(10,4) | 24小时涨跌幅（%） |
| price_change_24h_usdt | DECIMAL(20,8) | 24小时价格变化（USDT） |
| volume_24h | DECIMAL(20,2) | 24小时交易量 |
| market_cap | DECIMAL(20,2) | 市值（USDT） |
| last_updated | TIMESTAMP | 最后更新时间 |
| created_at | TIMESTAMP | 创建时间 |

## 服务架构

### 核心组件

1. **TokenPriceService**: 价格同步服务核心类
2. **Binance API集成**: 获取实时价格数据
3. **数据库同步**: 自动更新价格信息
4. **Token发现**: 自动识别新Token

### 工作流程

```
启动服务 → 初始化数据库 → 同步现有Token → 启动定时器
    ↓
每分钟执行 → 获取Binance价格 → 更新数据库 → 同步新Token
    ↓
API请求 → 查询数据库 → 返回价格数据
```

## 使用方法

### 1. 启动服务

#### 方式一：集成到主服务器
```bash
npm start
# 服务会自动启动Token价格同步
```

#### 方式二：独立运行
```bash
npm run token-service
# 只运行Token价格服务
```

### 2. API调用示例

#### 获取单个Token价格
```javascript
const response = await fetch('/api/token-price/ETH');
const data = await response.json();
console.log(data.data.price_usdt); // ETH的USDT价格
```

#### 批量获取Token价格
```javascript
const response = await fetch('/api/token-price/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tokens: ['BTC', 'ETH', 'USDC'] })
});
const data = await response.json();
console.log(data.data); // 包含所有Token价格
```

#### 获取所有Token价格
```javascript
const response = await fetch('/api/token-price/');
const data = await response.json();
console.log(data.data); // 所有Token的价格列表
```

### 3. 前端集成

#### DEFI汇总表格
```javascript
// 自动获取实时价格计算USDT价值
const usdtValue = await calculateUSDTValue(token, quantity);
```

#### 批量价格更新
```javascript
// 一次性获取多个Token价格
const prices = await getBatchTokenPrices(['ETH', 'BTC', 'USDC']);
```

## 配置说明

### 环境变量

```bash
# 数据库配置
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=hackathon

# 服务配置
PORT=3000
```

### 定时器配置

```javascript
// 价格更新频率（毫秒）
this.updateInterval = setInterval(async () => {
    await this.updatePrices();
}, 60000); // 60秒 = 1分钟
```

## 监控和维护

### 服务状态检查
```bash
curl http://localhost:3000/api/token-price/status/health
```

### 手动触发更新
```bash
curl -X POST http://localhost:3000/api/token-price/update
```

### 日志监控
- ✅ 成功更新价格
- ❌ 价格获取失败
- 🆕 新增Token
- 🔄 开始更新流程

## 错误处理

### 网络错误
- Binance API不可用时，使用默认价格
- 自动重试机制
- 降级到本地缓存

### 数据库错误
- 连接失败时自动重连
- 事务回滚保护
- 错误日志记录

### 服务异常
- 优雅关闭处理
- 进程信号处理
- 资源清理

## 性能优化

### 批量处理
- 一次API请求获取多个Token价格
- 分批处理大量Token（每批100个）
- 避免请求过于频繁

### 缓存策略
- 数据库缓存最新价格
- 减少重复API调用
- 智能Token发现

### 并发控制
- 连接池管理
- 异步处理
- 超时控制

## 扩展性

### 支持更多交易所
- 可以添加其他交易所API
- 价格聚合和加权平均
- 多数据源备份

### 支持更多Token
- 自动发现新Token
- 动态价格更新
- 自定义Token配置

### 高级功能
- 价格历史记录
- 价格预警通知
- 价格趋势分析
- 移动端推送

## 安全考虑

### API限制
- 请求频率限制
- 批量请求大小限制
- 超时控制

### 数据验证
- 价格数据验证
- 输入参数检查
- SQL注入防护

### 访问控制
- 管理员接口保护
- 日志审计
- 错误信息脱敏

## 故障排除

### 常见问题

1. **服务启动失败**
   - 检查数据库连接
   - 验证环境变量
   - 查看错误日志

2. **价格更新失败**
   - 检查网络连接
   - 验证Binance API状态
   - 查看API响应

3. **Token同步失败**
   - 检查数据库权限
   - 验证表结构
   - 查看SQL错误

### 调试命令

```bash
# 检查服务状态
npm run token-service

# 查看数据库
mysql -u root -p hackathon -e "SELECT * FROM token_market LIMIT 5;"

# 测试API
curl http://localhost:3000/api/token-price/ETH
```

## 更新日志

### v1.0.0 (当前版本)
- ✅ 基础价格同步功能
- ✅ Binance API集成
- ✅ 自动Token发现
- ✅ RESTful API接口
- ✅ 定时更新机制
- ✅ 错误处理和降级

### 计划功能
- 🔄 多交易所支持
- 🔄 价格历史记录
- 🔄 价格预警系统
- 🔄 移动端推送
- 🔄 价格趋势分析

---

## 技术支持

如有问题或建议，请查看：
1. 服务日志输出
2. 数据库连接状态
3. API接口响应
4. 网络连接状态
