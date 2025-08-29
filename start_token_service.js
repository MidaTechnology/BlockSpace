#!/usr/bin/env node

/**
 * Token价格同步服务启动脚本
 * 可以独立运行，也可以集成到主服务器中
 */

require('dotenv').config();
const TokenPriceService = require('./backend/services/tokenPriceService');

async function main() {
    console.log('🚀 启动Token价格同步服务...');
    
    try {
        const tokenPriceService = new TokenPriceService();
        
        // 启动服务
        await tokenPriceService.start();
        
        console.log('✅ Token价格同步服务启动成功');
        console.log('📊 服务特性:');
        console.log('   - 每分钟从Binance API获取最新价格');
        console.log('   - 自动同步新Token到行情表');
        console.log('   - 支持30+主流Token的价格更新');
        console.log('   - 提供RESTful API接口');
        
        // 优雅关闭处理
        process.on('SIGINT', async () => {
            console.log('\n🛑 收到关闭信号，正在停止服务...');
            tokenPriceService.stop();
            process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
            console.log('\n🛑 收到终止信号，正在停止服务...');
            tokenPriceService.stop();
            process.exit(0);
        });
        
        // 保持进程运行
        console.log('\n⏰ 服务运行中，按 Ctrl+C 停止...');
        
    } catch (error) {
        console.error('❌ 启动Token价格同步服务失败:', error);
        process.exit(1);
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    main().catch(error => {
        console.error('❌ 服务运行失败:', error);
        process.exit(1);
    });
}

module.exports = main;
