const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { testConnection } = require('./config/database');

// 导入路由
const airdropRoutes = require('./routes/airdrop');
const defiRoutes = require('./routes/defi');
const positionRoutes = require('./routes/position');
const { router: tokenPriceRoutes, setTokenPriceService } = require('./routes/tokenPrice');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 静态文件服务 - 使用绝对路径
const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend')));

// 使用路由
app.use('/api/airdrop', airdropRoutes);
app.use('/api/defi', defiRoutes);
app.use('/api/position', positionRoutes);
app.use('/api/token-price', tokenPriceRoutes);

// 根路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// 调试路由
app.get('/debug', (req, res) => {
    res.sendFile(path.join(__dirname, '../debug.html'));
});

// 错误处理中间件
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: '服务器内部错误' });
});

// 启动服务器
app.listen(PORT, async () => {
    console.log(`🚀 服务器启动成功，端口: ${PORT}`);
    
    try {
        await testConnection();
        
        // 启动Token价格服务
        const TokenPriceService = require('./services/tokenPriceService');
        const tokenPriceService = new TokenPriceService();
        await tokenPriceService.start();
        
        // 将Token价格服务实例传递给路由
        setTokenPriceService(tokenPriceService);
        
        console.log('✅ Token价格服务启动成功');
        
        // 优雅关闭
        process.on('SIGINT', async () => {
            console.log('\n🛑 收到SIGINT信号，正在关闭服务器...');
            await tokenPriceService.stop();
            process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
            console.log('\n🛑 收到SIGTERM信号，正在关闭服务器...');
            await tokenPriceService.stop();
            process.exit(0);
        });
        
    } catch (error) {
        console.error('❌ 启动Token价格服务失败:', error);
    }
});

module.exports = app;
