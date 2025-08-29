const mysql = require('mysql2/promise');
const path = require('path');

// 尝试加载环境变量
try {
    require('dotenv').config({ path: path.join(__dirname, '../../.env') });
} catch (error) {
    console.log('使用默认环境配置');
}

// 数据库连接配置
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'blockchain_log',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// 创建连接池
const pool = mysql.createPool(dbConfig);

// 测试数据库连接
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('数据库连接成功！');
        connection.release();
    } catch (error) {
        console.error('数据库连接失败:', error);
    }
}

module.exports = {
    pool,
    testConnection
};
