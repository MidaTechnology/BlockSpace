-- 区块链操作日志记录本数据库结构
-- 最新版本 v1.1.0 - 包含DEFI饼状图和排序功能

-- 创建数据库
CREATE DATABASE IF NOT EXISTS hackathon;
USE hackathon;

-- 1. 仓位操作记录表
CREATE TABLE IF NOT EXISTS position_operations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    operation_type ENUM('买入', '卖出', '初始仓位') NOT NULL,
    token_symbol VARCHAR(20) NOT NULL,
    token_name VARCHAR(100) NOT NULL,
    quantity DECIMAL(20,8) NOT NULL,
    price DECIMAL(20,2) NOT NULL,
    total_amount DECIMAL(20,2) NOT NULL,
    reason TEXT,
    operation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    score INT DEFAULT NULL COMMENT '操作评分 0-100',
    review TEXT COMMENT '复盘感受和经验总结',
    review_date TIMESTAMP NULL COMMENT '复盘时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. 当前价格表
CREATE TABLE IF NOT EXISTS current_prices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    token_symbol VARCHAR(20) NOT NULL UNIQUE,
    current_price DECIMAL(20,2) NOT NULL,
    price_change_24h DECIMAL(8,4),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3. DEFI操作记录表
CREATE TABLE IF NOT EXISTS defi_operations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project VARCHAR(100) NOT NULL COMMENT '项目名称',
    project_url VARCHAR(500) COMMENT '项目链接',
    operation_type ENUM('质押', '赎回', '添加LP', '撤出LP', '借款', '还款') NOT NULL COMMENT '操作类型',
    token VARCHAR(20) NOT NULL COMMENT 'Token',
    quantity DECIMAL(20,2) NOT NULL COMMENT '数量（2位小数）',
    apy DECIMAL(8,4) COMMENT '年化收益率',
    exit_time VARCHAR(100) COMMENT '退出等待时间',
    notes TEXT COMMENT '备注',
    operation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '操作日期',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 4. 空投参与记录表
CREATE TABLE IF NOT EXISTS airdrop_participations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    project_name VARCHAR(100) NOT NULL COMMENT '项目名称',
    project_url VARCHAR(500) COMMENT '项目网址',
    project_twitter VARCHAR(200) COMMENT '项目方推特',
    participation_type ENUM('交互', '存款') NOT NULL COMMENT '参与类型',
    wallet_address VARCHAR(200) NOT NULL COMMENT '参与钱包地址',
    participation_amount DECIMAL(20,8) DEFAULT 0 COMMENT '参与金额',
    participation_token VARCHAR(20) COMMENT '参与Token',
    participation_amount_usdt DECIMAL(20,2) DEFAULT 0 COMMENT '参与金额USDT',
    participation_date DATE NOT NULL COMMENT '参与日期',
    expected_airdrop_date DATE COMMENT '预期空投日期',
    expected_reward DECIMAL(20,8) COMMENT '预期奖励',
    actual_reward DECIMAL(20,8) COMMENT '实际奖励',
    actual_apr DECIMAL(8,4) COMMENT '实际APR',
    status ENUM('进行中', '已空投') DEFAULT '进行中' COMMENT '状态',
    withdrawal_status ENUM('未提款', '已提款') DEFAULT '未提款' COMMENT '提款状态',
    notes TEXT COMMENT '备注',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 5. Token行情表
CREATE TABLE IF NOT EXISTS token_market (
    id INT AUTO_INCREMENT PRIMARY KEY,
    token VARCHAR(20) NOT NULL COMMENT 'Token符号',
    price_usdt DECIMAL(20,8) NOT NULL COMMENT 'USDT价格（8位小数）',
    price_change_24h DECIMAL(10,4) COMMENT '24小时涨跌幅（百分比）',
    price_change_24h_usdt DECIMAL(20,8) COMMENT '24小时价格变化（USDT）',
    volume_24h DECIMAL(20,2) COMMENT '24小时交易量',
    market_cap DECIMAL(20,2) COMMENT '市值（USDT）',
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后更新时间',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    UNIQUE KEY unique_token (token),
    INDEX idx_last_updated (last_updated),
    INDEX idx_token (token)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_position_token ON position_operations(token_symbol);
CREATE INDEX IF NOT EXISTS idx_position_date ON position_operations(operation_date);
CREATE INDEX IF NOT EXISTS idx_defi_project ON defi_operations(project);
CREATE INDEX IF NOT EXISTS idx_defi_token ON defi_operations(token);
CREATE INDEX IF NOT EXISTS idx_airdrop_project ON airdrop_participations(project_name);
CREATE INDEX IF NOT EXISTS idx_airdrop_status ON airdrop_participations(status);

-- 插入示例数据

-- 仓位操作示例数据
INSERT IGNORE INTO position_operations (operation_type, token_symbol, token_name, quantity, price, total_amount, reason) VALUES
('初始仓位', 'BTC', 'Bitcoin', 1, 100000, 100000, '初始持仓'),
('买入', 'BTC', 'Bitcoin', 0.1, 110000, 11000, '持续看好后市'),
('卖出', 'BTC', 'Bitcoin', 0.05, 120000, 6000, '降息预期下降，先清半仓'),
('买入', 'ETH', 'Ethereum', 1.5, 3500, 5250, '看好以太坊生态发展'),
('买入', 'SOL', 'Solana', 10, 150, 1500, '技术突破，短期看好');

-- 价格示例数据
INSERT IGNORE INTO current_prices (token_symbol, current_price, price_change_24h) VALUES
('BTC', 125000, 2.5),
('ETH', 3800, -1.2),
('SOL', 180, 8.5);

-- DEFI操作示例数据
INSERT IGNORE INTO defi_operations (project, project_url, operation_type, token, quantity, apy, exit_time, notes) VALUES
('Lido', 'https://lido.fi', '质押', 'ETH', 10.00, 4.25, '无锁定期', '在Lido上质押ETH，获得stETH'),
('Aave', 'https://aave.com', '借款', 'USDC', 1000.00, 8.75, '30天', '在Aave上借款USDC，用于短期资金周转'),
('Uniswap', 'https://uniswap.org', '添加LP', 'ETH', 5.00, 12.50, '无锁定期', '为ETH/USDC交易对提供流动性'),
('Compound', 'https://compound.finance', '质押', 'USDC', 5000.00, 3.20, '无锁定期', '在Compound上质押USDC赚取利息');

-- 空投参与示例数据
INSERT IGNORE INTO airdrop_participations (project_name, project_url, project_twitter, participation_type, wallet_address, participation_amount, participation_token, participation_amount_usdt, participation_date, expected_airdrop_date, expected_reward, actual_reward, actual_apr, status, withdrawal_status, notes) VALUES
('Jupiter', 'https://jup.ag', '@JupiterExchange', '交互', '0x1234567890abcdef', 0.00, 'SOL', 0.00, '2024-01-15', '2024-03-15', 100.00, 0.00, 0.00, '进行中', '未提款', '参与Jupiter空投活动，完成交互任务'),
('Pyth', 'https://pyth.network', '@PythNetwork', '存款', '0xabcdef1234567890', 1000.00, 'USDC', 1000.00, '2024-01-20', '2024-04-20', 50.00, 0.00, 0.00, '进行中', '未提款', '在Pyth上存款USDC，等待空投'),
('Tensor', 'https://tensor.trade', '@tensor_hq', '交互', '0x9876543210fedcba', 0.00, 'SOL', 0.00, '2024-02-01', '2024-05-01', 200.00, 0.00, 0.00, '进行中', '未提款', '参与Tensor NFT交易平台交互');

-- Token行情初始数据
INSERT IGNORE INTO token_market (token, price_usdt, price_change_24h, price_change_24h_usdt, volume_24h, market_cap) VALUES
('USDT', 1.00000000, 0.0000, 0.00000000, 0.00, 0.00),
('USDC', 1.00000000, 0.0000, 0.00000000, 0.00, 0.00),
('DAI', 1.00000000, 0.0000, 0.00000000, 0.00, 0.00),
('ETH', 2500.00000000, 0.0000, 0.00000000, 0.00, 0.00),
('BTC', 45000.00000000, 0.0000, 0.00000000, 0.00, 0.00),
('WBTC', 45000.00000000, 0.0000, 0.00000000, 0.00, 0.00),
('stETH', 2500.00000000, 0.0000, 0.00000000, 0.00, 0.00),
('aUSDC', 1.00000000, 0.0000, 0.00000000, 0.00, 0.00),
('cUSDC', 1.00000000, 0.0000, 0.00000000, 0.00, 0.00),
('UNI', 5.00000000, 0.0000, 0.00000000, 0.00, 0.00),
('LINK', 15.00000000, 0.0000, 0.00000000, 0.00, 0.00),
('AAVE', 100.00000000, 0.0000, 0.00000000, 0.00, 0.00),
('SOL', 180.00000000, 0.0000, 0.00000000, 0.00, 0.00);

-- 显示创建结果
SELECT '所有表创建完成' as status;
SELECT 
    TABLE_NAME as table_name,
    TABLE_ROWS as row_count
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'hackathon' 
ORDER BY TABLE_NAME;
