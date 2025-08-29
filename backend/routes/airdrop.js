const express = require('express');
const { pool } = require('../config/database');
const router = express.Router();

// 获取所有空投参与记录
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM airdrop_participations ORDER BY participation_date DESC'
        );
        res.json(rows);
    } catch (error) {
        console.error('获取空投记录失败:', error);
        res.status(500).json({ error: '获取空投记录失败' });
    }
});

// 添加新的空投参与记录
router.post('/', async (req, res) => {
    try {
        const { 
            project_name, 
            project_url, 
            project_twitter, 
            participation_type, 
            wallet_address, 
            participation_amount, 
            participation_token, 
            participation_amount_usdt, 
            participation_date, 
            expected_airdrop_date, 
            expected_reward, 
            actual_reward, 
            actual_apr, 
            status, 
            withdrawal_status,
            notes 
        } = req.body;
        
        const [result] = await pool.execute(
            `INSERT INTO airdrop_participations (
                project_name, project_url, project_twitter, participation_type, 
                wallet_address, participation_amount, participation_token, participation_amount_usdt, participation_date, 
                expected_airdrop_date, expected_reward, actual_reward, 
                actual_apr, status, withdrawal_status, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                project_name, 
                project_url || null, 
                project_twitter || null, 
                participation_type, 
                wallet_address, 
                participation_amount || 0, 
                participation_token || null, 
                participation_amount_usdt || 0, 
                participation_date, 
                expected_airdrop_date || null, 
                expected_reward || null, 
                actual_reward || null, 
                actual_apr || null, 
                status || '进行中', 
                withdrawal_status || '未提款',
                notes || ''
            ]
        );
        
        res.status(201).json({ 
            id: result.insertId, 
            message: '空投参与记录添加成功' 
        });
    } catch (error) {
        console.error('添加空投记录失败:', error);
        res.status(500).json({ error: '添加空投记录失败' });
    }
});

// 获取空投汇总信息
router.get('/summary', async (req, res) => {
    try {
        // 计算总体统计
        const [totalStats] = await pool.execute(`
            SELECT 
                COUNT(*) as total_projects,
                SUM(participation_amount_usdt) as total_participation,
                SUM(expected_reward) as total_expected,
                SUM(actual_reward) as total_actual,
                AVG(actual_apr) as avg_apr
            FROM airdrop_participations
        `);
        
        // 按状态分组统计（排除提款状态，只显示空投状态）
        const [statusStats] = await pool.execute(`
            SELECT 
                status,
                COUNT(*) as count,
                SUM(participation_amount_usdt) as total_participation,
                SUM(expected_reward) as total_expected,
                SUM(actual_reward) as total_actual,
                AVG(actual_apr) as avg_apr
            FROM airdrop_participations 
            GROUP BY status
            ORDER BY 
                CASE status 
                    WHEN '进行中' THEN 1 
                    WHEN '已空投' THEN 2 
                    ELSE 3 
                END
        `);
        
        const summary = {
            total_projects: totalStats[0].total_projects || 0,
            total_participation: parseFloat(totalStats[0].total_participation || 0),
            total_expected: parseFloat(totalStats[0].total_expected || 0),
            total_actual: parseFloat(totalStats[0].total_actual || 0),
            avg_apr: parseFloat(totalStats[0].avg_apr || 0),
            status_breakdown: statusStats.map(row => ({
                status: row.status,
                count: row.count,
                total_participation: parseFloat(row.total_participation || 0),
                total_expected: parseFloat(row.total_expected || 0),
                total_actual: parseFloat(row.total_actual || 0),
                avg_apr: parseFloat(row.avg_apr || 0)
            }))
        };
        
        res.json(summary);
    } catch (error) {
        console.error('获取空投汇总失败:', error);
        res.status(500).json({ error: '获取空投汇总失败' });
    }
});

// 更新空投状态
router.put('/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, actual_reward, actual_apr, notes } = req.body;
        
        const [result] = await pool.execute(
            'UPDATE airdrop_participations SET status = ?, actual_reward = ?, actual_apr = ?, notes = ? WHERE id = ?',
            [status, actual_reward, actual_apr, notes, id]
        );
        
        if (result.affectedRows > 0) {
            res.json({ message: '空投状态更新成功' });
        } else {
            res.status(404).json({ error: '记录不存在' });
        }
    } catch (error) {
        console.error('更新空投状态失败:', error);
        res.status(500).json({ error: '更新空投状态失败' });
    }
});

// 完整更新空投记录
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            project_name, 
            project_url, 
            project_twitter, 
            participation_type, 
            wallet_address, 
            participation_amount, 
            participation_token, 
            participation_amount_usdt, 
            participation_date, 
            expected_airdrop_date, 
            expected_reward, 
            actual_reward, 
            actual_apr, 
            status, 
            withdrawal_status,
            notes 
        } = req.body;
        
        const [result] = await pool.execute(
            `UPDATE airdrop_participations SET 
                project_name = ?, project_url = ?, project_twitter = ?, 
                participation_type = ?, wallet_address = ?, participation_amount = ?, 
                participation_token = ?, participation_amount_usdt = ?, participation_date = ?, expected_airdrop_date = ?, 
                expected_reward = ?, actual_reward = ?, actual_apr = ?, 
                status = ?, withdrawal_status = ?, notes = ?
            WHERE id = ?`,
            [
                project_name, 
                project_url || null, 
                project_twitter || null, 
                participation_type, 
                wallet_address, 
                participation_amount || 0, 
                participation_token || null, 
                participation_amount_usdt || 0, 
                participation_date, 
                expected_airdrop_date || null, 
                expected_reward || null, 
                actual_reward || null, 
                actual_apr || null, 
                status || '进行中', 
                withdrawal_status || '未提款',
                notes || '',
                id
            ]
        );
        
        if (result.affectedRows > 0) {
            res.json({ message: '空投记录更新成功' });
        } else {
            res.status(404).json({ error: '记录不存在' });
        }
    } catch (error) {
        console.error('更新空投记录失败:', error);
        res.status(500).json({ error: '更新空投记录失败' });
    }
});

// 获取特定状态的空投记录
router.get('/status/:status', async (req, res) => {
    try {
        const { status } = req.params;
        const [rows] = await pool.execute(
            'SELECT * FROM airdrop_participations WHERE status = ? ORDER BY participation_date DESC',
            [status]
        );
        res.json(rows);
    } catch (error) {
        console.error('获取状态空投记录失败:', error);
        res.status(500).json({ error: '获取状态空投记录失败' });
    }
});

// 获取特定参与类型的空投记录
router.get('/type/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const [rows] = await pool.execute(
            'SELECT * FROM airdrop_participations WHERE participation_type = ? ORDER BY participation_date DESC',
            [type]
        );
        res.json(rows);
    } catch (error) {
        console.error('获取参与类型空投记录失败:', error);
        res.status(500).json({ error: '获取参与类型空投记录失败' });
    }
});

// 删除空投参与记录
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.execute(
            'DELETE FROM airdrop_participations WHERE id = ?',
            [id]
        );
        
        if (result.affectedRows > 0) {
            res.json({ message: '记录删除成功' });
        } else {
            res.status(404).json({ error: '记录不存在' });
        }
    } catch (error) {
        console.error('删除空投记录失败:', error);
        res.status(500).json({ error: '删除空投记录失败' });
    }
});

module.exports = router;
