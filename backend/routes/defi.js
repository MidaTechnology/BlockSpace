const express = require('express');
const { pool } = require('../config/database');
const router = express.Router();

// 获取所有DEFI操作记录
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM defi_operations ORDER BY operation_date DESC'
        );
        res.json(rows);
    } catch (error) {
        console.error('获取DEFI记录失败:', error);
        res.status(500).json({ error: '获取DEFI记录失败' });
    }
});

// 添加新的DEFI操作
router.post('/', async (req, res) => {
    try {
        const { 
            project, 
            project_url, 
            operation_type, 
            token, 
            quantity, 
            apy, 
            exit_time, 
            notes 
        } = req.body;
        
        const [result] = await pool.execute(
            'INSERT INTO defi_operations (project, project_url, operation_type, token, quantity, apy, exit_time, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [project, project_url, operation_type, token, quantity, apy, exit_time, notes]
        );
        
        res.status(201).json({ 
            id: result.insertId, 
            message: 'DEFI操作记录添加成功' 
        });
    } catch (error) {
        console.error('添加DEFI记录失败:', error);
        res.status(500).json({ error: '添加DEFI记录失败' });
    }
});

// 获取DEFI汇总信息
router.get('/summary', async (req, res) => {
    try {
        const [rows] = await pool.execute(`
            SELECT 
                project,
                token,
                operation_type,
                SUM(quantity) as total_quantity,
                AVG(apy) as avg_apy,
                COUNT(*) as operation_count
            FROM defi_operations 
            GROUP BY project, token, operation_type
        `);
        
        // 按项目分组汇总
        const projectSummary = {};
        rows.forEach(row => {
            if (!projectSummary[row.project]) {
                projectSummary[row.project] = {
                    project: row.project,
                    total_operations: 0,
                    tokens: {},
                    avg_apy: 0,
                    total_apy_count: 0
                };
            }
            
            if (!projectSummary[row.project].tokens[row.token]) {
                projectSummary[row.project].tokens[row.token] = {
                    token: row.token,
                    total_quantity: 0,
                    operations: {}
                };
            }
            
            projectSummary[row.project].tokens[row.token].operations[row.operation_type] = {
                type: row.operation_type,
                quantity: row.total_quantity,
                count: row.operation_count
            };
            
            projectSummary[row.project].tokens[row.token].total_quantity += row.total_quantity;
            projectSummary[row.project].total_operations += row.operation_count;
            
            if (row.avg_apy) {
                projectSummary[row.project].avg_apy += row.avg_apy;
                projectSummary[row.project].total_apy_count += 1;
            }
        });
        
        // 计算平均APR
        Object.values(projectSummary).forEach(project => {
            if (project.total_apy_count > 0) {
                project.avg_apy = project.avg_apy / project.total_apy_count;
            }
        });
        
        res.json(Object.values(projectSummary));
    } catch (error) {
        console.error('获取DEFI汇总失败:', error);
        res.status(500).json({ error: '获取DEFI汇总失败' });
    }
});

// 获取特定项目的DEFI操作
router.get('/project/:project', async (req, res) => {
    try {
        const { project } = req.params;
        const [rows] = await pool.execute(
            'SELECT * FROM defi_operations WHERE project = ? ORDER BY operation_date DESC',
            [project]
        );
        res.json(rows);
    } catch (error) {
        console.error('获取项目DEFI操作失败:', error);
        res.status(500).json({ error: '获取项目DEFI操作失败' });
    }
});

// 更新DEFI操作记录
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            project, 
            project_url, 
            operation_type, 
            token, 
            quantity, 
            apy, 
            exit_time, 
            notes 
        } = req.body;
        
        const [result] = await pool.execute(
            'UPDATE defi_operations SET project = ?, project_url = ?, operation_type = ?, token = ?, quantity = ?, apy = ?, exit_time = ?, notes = ? WHERE id = ?',
            [project, project_url, operation_type, token, quantity, apy, exit_time, notes, id]
        );
        
        if (result.affectedRows > 0) {
            res.json({ message: 'DEFI操作记录更新成功' });
        } else {
            res.status(404).json({ error: '记录不存在' });
        }
    } catch (error) {
        console.error('更新DEFI记录失败:', error);
        res.status(500).json({ error: '更新DEFI记录失败' });
    }
});

// 删除DEFI操作记录
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.execute(
            'DELETE FROM defi_operations WHERE id = ?',
            [id]
        );
        
        if (result.affectedRows > 0) {
            res.json({ message: '记录删除成功' });
        } else {
            res.status(404).json({ error: '记录不存在' });
        }
    } catch (error) {
        console.error('删除DEFI记录失败:', error);
        res.status(500).json({ error: '删除DEFI记录失败' });
    }
});

module.exports = router;
