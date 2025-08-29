const express = require('express');
const router = express.Router();

// 移除Token价格服务实例的创建，改为接收外部传入的实例
let tokenPriceService = null;

// 设置Token价格服务实例的方法
function setTokenPriceService(service) {
    tokenPriceService = service;
}

// 获取单个Token价格
router.get('/:token', async (req, res) => {
    try {
        // 检查服务是否可用
        if (!tokenPriceService || !tokenPriceService.pool) {
            return res.status(503).json({ error: 'Token价格服务不可用' });
        }

        const { token } = req.params;
        
        if (!token) {
            return res.status(400).json({ error: 'Token参数不能为空' });
        }

        const priceData = await tokenPriceService.getTokenPrice(token);
        
        if (!priceData) {
            return res.status(404).json({ error: 'Token价格信息未找到' });
        }

        res.json({
            success: true,
            data: priceData
        });

    } catch (error) {
        console.error('获取Token价格失败:', error);
        res.status(500).json({ error: '获取Token价格失败' });
    }
});

// 批量获取Token价格
router.post('/batch', async (req, res) => {
    try {
        // 检查服务是否可用
        if (!tokenPriceService || !tokenPriceService.pool) {
            return res.status(503).json({ error: 'Token价格服务不可用' });
        }

        const { tokens } = req.body;
        
        if (!Array.isArray(tokens) || tokens.length === 0) {
            return res.status(400).json({ error: 'tokens参数必须是包含Token的数组' });
        }

        // 限制批量请求数量
        if (tokens.length > 100) {
            return res.status(400).json({ error: '单次请求最多支持100个Token' });
        }

        const pricesData = await tokenPriceService.getBatchTokenPrices(tokens);
        
        res.json({
            success: true,
            data: pricesData,
            count: pricesData.length
        });

    } catch (error) {
        console.error('批量获取Token价格失败:', error);
        res.status(500).json({ error: '批量获取Token价格失败' });
    }
});

// 获取所有Token价格
router.get('/', async (req, res) => {
    try {
        // 检查服务是否可用
        if (!tokenPriceService || !tokenPriceService.pool) {
            return res.status(503).json({ error: 'Token价格服务不可用' });
        }

        const pricesData = await tokenPriceService.getAllTokenPrices();
        
        res.json({
            success: true,
            data: pricesData,
            count: pricesData.length
        });

    } catch (error) {
        console.error('获取所有Token价格失败:', error);
        res.status(500).json({ error: '获取所有Token价格失败' });
    }
});

// 手动触发价格更新（管理员接口）
router.post('/update', async (req, res) => {
    try {
        // 检查服务是否可用
        if (!tokenPriceService || !tokenPriceService.pool) {
            return res.status(503).json({ error: 'Token价格服务不可用' });
        }

        // 这里可以添加管理员验证逻辑
        await tokenPriceService.updatePrices();
        
        res.json({
            success: true,
            message: '价格更新已触发'
        });

    } catch (error) {
        console.error('手动更新价格失败:', error);
        res.status(500).json({ error: '手动更新价格失败' });
    }
});

// 获取服务状态
router.get('/status/health', async (req, res) => {
    try {
        // 检查服务是否可用
        if (!tokenPriceService || !tokenPriceService.pool) {
            return res.status(503).json({ error: 'Token价格服务不可用' });
        }

        const isRunning = tokenPriceService.isRunning;
        const lastUpdate = await getLastUpdateTime();
        
        res.json({
            success: true,
            data: {
                service_status: isRunning ? 'running' : 'stopped',
                last_update: lastUpdate,
                supported_tokens_count: Object.keys(tokenPriceService.tokenToSymbol || {}).length
            }
        });

    } catch (error) {
        console.error('获取服务状态失败:', error);
        res.status(500).json({ error: '获取服务状态失败' });
    }
});

// 获取最后更新时间
async function getLastUpdateTime() {
    try {
        if (!tokenPriceService || !tokenPriceService.pool) {
            return null;
        }

        const [rows] = await tokenPriceService.pool.execute(`
            SELECT MAX(last_updated) as last_updated
            FROM token_market
        `);
        
        return rows[0]?.last_updated || null;
    } catch (error) {
        return null;
    }
}

module.exports = { router, setTokenPriceService };
