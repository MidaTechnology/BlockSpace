const express = require('express');
const { pool } = require('../config/database');

const router = express.Router();

// 获取所有仓位操作记录（排除初始仓位）
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM position_operations ORDER BY operation_date DESC'
        );
        res.json(rows);
    } catch (error) {
        console.error('获取仓位记录失败:', error);
        res.status(500).json({ error: '获取仓位记录失败' });
    }
});

// 添加新的仓位操作
router.post('/', async (req, res) => {
    try {
        const { operation_type, token_symbol, token_name, quantity, price, reason } = req.body;
        const total_amount = quantity * price;
        
        // 处理空的reason字段，如果为空字符串则设为null
        const processedReason = reason === '' || reason === null ? null : reason;
        
        const [result] = await pool.execute(
            'INSERT INTO position_operations (operation_type, token_symbol, token_name, quantity, price, total_amount, reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [operation_type, token_symbol, token_name, quantity, price, total_amount, processedReason]
        );
        
        res.status(201).json({ 
            id: result.insertId, 
            message: '仓位操作记录添加成功' 
        });
    } catch (error) {
        console.error('添加仓位记录失败:', error);
        res.status(500).json({ error: '添加仓位记录失败' });
    }
});

// 获取仓位汇总信息
router.get('/summary', async (req, res) => {
    try {
        // 修复计算逻辑：正确计算净持仓数量和成本
        const [rows] = await pool.execute(`
            SELECT 
                po.token_symbol,
                po.token_name,
                SUM(CASE WHEN po.operation_type IN ('买入', '初始仓位') THEN po.quantity ELSE 0 END) as total_buy_quantity,
                SUM(CASE WHEN po.operation_type = '卖出' THEN po.quantity ELSE 0 END) as total_sell_quantity,
                SUM(CASE WHEN po.operation_type IN ('买入', '初始仓位') THEN po.total_amount ELSE 0 END) as total_buy_amount,
                SUM(CASE WHEN po.operation_type = '卖出' THEN po.total_amount ELSE 0 END) as total_sell_amount
            FROM position_operations po
            GROUP BY po.token_symbol, po.token_name
        `);
        
        // 获取所有Token符号
        const tokenSymbols = rows.map(row => row.token_symbol);
        
        console.log('📊 需要的Token符号:', tokenSymbols);
        console.log('📊 价格数据将由前端从后端Token价格服务获取');
        
        // 计算每个Token的持仓数量和成本
        const summary = rows.map(row => {
            // 修复计算逻辑：净持仓 = 买入总量 - 卖出总量
            const net_quantity = parseFloat(row.total_buy_quantity || 0) - parseFloat(row.total_sell_quantity || 0);
            // 净成本 = 买入总金额 - 卖出总金额
            const net_amount = parseFloat(row.total_buy_amount || 0) - parseFloat(row.total_sell_amount || 0);
            // 平均成本 = 净成本 / 净持仓数量
            const avg_cost = net_quantity > 0 ? net_amount / net_quantity : 0;
            
            // 调试信息：显示每个Token的计算过程
            console.log(`🔍 ${row.token_symbol}: 买入=${row.total_buy_quantity}, 卖出=${row.total_sell_quantity}, 净持仓=${net_quantity}`);
            console.log(`🔍 ${row.token_symbol}: 买入金额=${row.total_buy_amount}, 卖出金额=${row.total_sell_amount}, 净成本=${net_amount}`);
            
            // 使用平均成本价格作为当前价格的默认值，这样总仓位占比就能正确计算
            const current_price = avg_cost; // 使用平均成本作为默认价格
            const price_change_24h = 0; // 默认值，前端会更新
            
            // 计算盈亏（使用平均成本价格）
            const current_value = net_quantity * current_price;
            const profit_loss = current_value - net_amount;
            const profit_loss_percentage = net_amount > 0 ? (profit_loss / net_amount) * 100 : 0;
            
            // 计算总仓位占比 - 基于当前价值计算
            // 注意：这里使用平均成本作为当前价格，所以占比实际上是基于成本价值的占比
            // 前端获取到真实价格后，会重新计算正确的占比
            const total_portfolio_value = rows.reduce((sum, r) => {
                const r_net_quantity = parseFloat(r.total_buy_quantity || 0) - parseFloat(r.total_sell_quantity || 0);
                const r_net_amount = parseFloat(r.total_buy_amount || 0) - parseFloat(r.total_sell_amount || 0);
                const r_avg_cost = r_net_quantity > 0 ? r_net_amount / r_net_quantity : 0;
                const r_current_value = r_net_quantity * r_avg_cost;
                return sum + r_current_value;
            }, 0);
            
            const portfolio_percentage = total_portfolio_value > 0 ? (current_value / total_portfolio_value) * 100 : 0;
            
            return {
                token_symbol: row.token_symbol,
                token_name: row.token_name,
                net_quantity: net_quantity,
                net_amount: net_amount,
                avg_cost: avg_cost,
                current_price: current_price,
                current_value: current_value,
                price_change_24h: price_change_24h,
                profit_loss: profit_loss,
                profit_loss_percentage: profit_loss_percentage,
                portfolio_percentage: portfolio_percentage,
                total_buy_quantity: parseFloat(row.total_buy_quantity || 0),
                total_sell_quantity: parseFloat(row.total_sell_quantity || 0)
            };
        }).filter(item => item.net_quantity > 0) // 只返回有持仓的Token
        .sort((a, b) => b.portfolio_percentage - a.portfolio_percentage); // 按仓位占比倒序排列
        
        console.log('📊 过滤并排序后的汇总数据:', summary.map(item => ({
            symbol: item.token_symbol,
            net_quantity: item.net_quantity,
            net_amount: item.net_amount,
            avg_cost: item.avg_cost,
            portfolio_percentage: item.portfolio_percentage
        })));
        
        res.json(summary);
    } catch (error) {
        console.error('获取仓位汇总失败:', error);
        res.status(500).json({ error: '获取仓位汇总失败' });
    }
});

// 获取特定Token的操作历史
router.get('/token/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const [rows] = await pool.execute(
            'SELECT * FROM position_operations WHERE token_symbol = ? ORDER BY operation_date DESC',
            [symbol]
        );
        res.json(rows);
    } catch (error) {
        console.error('获取Token操作历史失败:', error);
        res.status(500).json({ error: '获取Token操作历史失败' });
    }
});

// 获取单个仓位操作记录
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.execute(
            'SELECT * FROM position_operations WHERE id = ?',
            [id]
        );
        
        if (rows.length === 0) {
            res.status(404).json({ error: '记录不存在' });
            return;
        }
        
        res.json(rows[0]);
    } catch (error) {
        console.error('获取仓位记录失败:', error);
        res.status(500).json({ error: '获取仓位记录失败' });
    }
});

// 更新仓位操作记录
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { operation_type, token_symbol, token_name, quantity, price, reason } = req.body;
        
        // 验证记录是否存在
        const [existingRows] = await pool.execute(
            'SELECT id FROM position_operations WHERE id = ?',
            [id]
        );
        
        if (existingRows.length === 0) {
            res.status(404).json({ error: '记录不存在' });
            return;
        }
        
        // 处理空的reason字段
        const processedReason = reason === '' || reason === null ? null : reason;
        const total_amount = quantity * price;
        
        // 更新记录
        const [result] = await pool.execute(
            `UPDATE position_operations 
             SET operation_type = ?, token_symbol = ?, token_name = ?, quantity = ?, 
                 price = ?, total_amount = ?, reason = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [operation_type, token_symbol, token_name, quantity, price, total_amount, processedReason, id]
        );
        
        if (result.affectedRows > 0) {
            res.json({ 
                message: '仓位操作记录更新成功',
                id: id
            });
        } else {
            res.status(500).json({ error: '更新失败' });
        }
    } catch (error) {
        console.error('更新仓位记录失败:', error);
        res.status(500).json({ error: '更新仓位记录失败' });
    }
});

// 删除仓位操作记录
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.execute(
            'DELETE FROM position_operations WHERE id = ?',
            [id]
        );
        
        if (result.affectedRows > 0) {
            res.json({ message: '记录删除成功' });
        } else {
            res.status(404).json({ error: '记录不存在' });
        }
    } catch (error) {
        console.error('删除仓位记录失败:', error);
        res.status(500).json({ error: '删除仓位记录失败' });
    }
});

// 获取当前价格
router.get('/prices', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM current_prices ORDER BY token_symbol');
        res.json(rows);
    } catch (error) {
        console.error('获取价格失败:', error);
        res.status(500).json({ error: '获取价格失败' });
    }
});

// 自动更新所有Token价格


// 手动更新特定Token价格


// 为操作记录打分
router.post('/:id/score', async (req, res) => {
    try {
        const { id } = req.params;
        const { score, review } = req.body;
        
        // 验证评分范围
        if (score < 0 || score > 100) {
            res.status(400).json({ error: '评分必须在0-100之间' });
            return;
        }
        
        // 验证记录是否存在
        const [existingRows] = await pool.execute(
            'SELECT id FROM position_operations WHERE id = ?',
            [id]
        );
        
        if (existingRows.length === 0) {
            res.status(404).json({ error: '记录不存在' });
            return;
        }
        
        // 更新评分和复盘信息
        const [result] = await pool.execute(
            `UPDATE position_operations 
             SET score = ?, review = ?, review_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [score, review, id]
        );
        
        if (result.affectedRows > 0) {
            res.json({ 
                message: '评分和复盘信息保存成功',
                id: id
            });
        } else {
            res.status(500).json({ error: '保存失败' });
        }
    } catch (error) {
        console.error('保存评分失败:', error);
        res.status(500).json({ error: '保存评分失败' });
    }
});

// 获取操作记录的评分信息
router.get('/:id/score', async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.execute(
            'SELECT id, score, review, review_date FROM position_operations WHERE id = ?',
            [id]
        );
        
        if (rows.length === 0) {
            res.status(404).json({ error: '记录不存在' });
            return;
        }
        
        res.json(rows[0]);
    } catch (error) {
        console.error('获取评分信息失败:', error);
        res.status(500).json({ error: '获取评分信息失败' });
    }
});

module.exports = router;
