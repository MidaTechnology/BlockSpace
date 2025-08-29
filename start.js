#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 启动区块链操作日志记录本...');

// 确保从项目根目录启动
const projectRoot = __dirname;
const backendPath = path.join(projectRoot, 'backend');

console.log(`📁 项目根目录: ${projectRoot}`);
console.log(`📁 后端目录: ${backendPath}`);

// 启动后端服务器
const server = spawn('node', ['server.js'], {
    cwd: backendPath,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' }
});

server.on('error', (error) => {
    console.error('❌ 启动服务器失败:', error);
    process.exit(1);
});

server.on('exit', (code) => {
    if (code !== 0) {
        console.error(`❌ 服务器异常退出，退出码: ${code}`);
        process.exit(code);
    }
});

// 处理进程信号
process.on('SIGINT', () => {
    console.log('\n🛑 正在关闭服务器...');
    server.kill('SIGINT');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 正在关闭服务器...');
    server.kill('SIGTERM');
    process.exit(0);
});
