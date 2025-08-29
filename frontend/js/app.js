// 区块链操作日志记录本 - 前端应用逻辑

// 全局变量
let positionChart = null;
let defiChart = null;
let currentTab = 'position';

// DEFI表格排序相关变量
let currentDefiSortField = null;
let currentDefiSortDirection = 'desc'; // 默认按USDT价值倒序

// 表格排序功能相关变量
let currentSortField = null;
let currentSortDirection = 'asc';

// 工具函数：数据类型转换和验证
function processNumericData(data, fields) {
    if (Array.isArray(data)) {
        return data.map(item => processNumericData(item, fields));
    }
    
    const processed = { ...data };
    fields.forEach(field => {
        if (processed[field] !== null && processed[field] !== undefined) {
            processed[field] = parseFloat(processed[field]) || 0;
        } else {
            processed[field] = 0; // 确保undefined字段有默认值
        }
    });
    return processed;
}

// 工具函数：安全地获取数值
function safeNumber(value, defaultValue = 0) {
    if (value === null || value === undefined || isNaN(value)) {
        return defaultValue;
    }
    return parseFloat(value) || defaultValue;
}

// 工具函数：调试数据
function debugData(data, label) {
    console.log(`🔍 ${label}:`, data);
    if (Array.isArray(data) && data.length > 0) {
        console.log(`📊 ${label} 第一条记录:`, data[0]);
        console.log(`📊 ${label} 数据类型:`, Object.keys(data[0]).map(key => `${key}: ${typeof data[0][key]}`));
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// 初始化应用
function initializeApp() {
    setupTabNavigation();
    loadPositionData();
    loadDefiData();
    loadAirdropData();
    setupFormSubmissions();
    
    // 测试后端Token价格API连接并启动自动价格更新
    testBackendTokenPriceAPI().then(isConnected => {
        if (isConnected) {
            // 立即执行一次价格更新，然后启动定时器
            console.log('🚀 后端Token价格API连接成功，立即更新价格...');
            autoUpdatePrices().then(() => {
                // 价格更新完成后，启动定时器每分钟更新一次
                startAutoPriceUpdate();
            }).catch(error => {
                console.error('首次价格更新失败，但仍启动定时器:', error);
                startAutoPriceUpdate();
            });
        } else {
            showNotification('后端Token价格API连接失败，价格更新功能可能不可用', 'error');
        }
    });
}

// 设置标签页导航
function setupTabNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    navButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-tab');
            
            // 更新导航按钮状态
            navButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // 更新标签页内容
            tabContents.forEach(tab => tab.classList.remove('active'));
            document.getElementById(targetTab).classList.add('active');
            
            currentTab = targetTab;
            
            // 根据标签页加载相应数据
            switch(targetTab) {
                case 'position':
                    loadPositionData();
                    break;
                case 'defi':
                    loadDefiData();
                    break;
                case 'airdrop':
                    loadAirdropData();
                    break;
            }
        });
    });
}

// 设置表单提交事件
function setupFormSubmissions() {
    // 仓位表单
    document.getElementById('positionForm').addEventListener('submit', function(e) {
        e.preventDefault();
        submitPositionForm();
    });
    
    // 仓位编辑表单
    document.getElementById('positionEditForm').addEventListener('submit', function(e) {
        e.preventDefault();
        submitPositionEditForm();
    });
    
    // 导入表单
    document.getElementById('importForm').addEventListener('submit', function(e) {
        e.preventDefault();
        submitImportForm();
    });
    
    // DEFI表单
    document.getElementById('defiForm').addEventListener('submit', function(e) {
        e.preventDefault();
        submitDefiForm();
    });
    
    // 空投表单
    document.getElementById('airdropForm').addEventListener('submit', function(e) {
        e.preventDefault();
        submitAirdropForm();
    });
    
    // 空投编辑表单
    document.getElementById('airdropEditForm').addEventListener('submit', function(e) {
        e.preventDefault();
        submitAirdropEditForm();
    });
}

// ==================== 仓位相关功能 ====================

// 加载仓位数据
async function loadPositionData() {
    try {
        const [summaryResponse, recordsResponse] = await Promise.all([
            fetch('/api/position/summary'),
            fetch('/api/position')
        ]);
        
        if (summaryResponse.ok && recordsResponse.ok) {
            const summary = await summaryResponse.json();
            const records = await recordsResponse.json();
            
            // 调试数据
            debugData(summary, '仓位汇总数据');
            debugData(records, '仓位记录数据');
            
            // 数据类型转换和验证
            const processedSummary = processNumericData(summary, [
                'net_quantity', 'net_amount', 'avg_cost', 'current_price', 
                'current_value', 'price_change_24h', 'profit_loss', 
                'profit_loss_percentage', 'portfolio_percentage'
            ]);
            const processedRecords = processNumericData(records, ['quantity', 'price', 'total_amount']);
            
            // 存储数据到全局变量
            window.positionSummary = processedSummary;
            window.positionRecords = processedRecords;
            
            // 显示数据
            displayPositionSummary(processedSummary);
            displayPositionRecords(processedRecords);
            updatePositionOverview(processedSummary);
            
            // 立即更新价格数据
            console.log('🔄 加载仓位数据后，立即更新价格...');
            setTimeout(() => {
                autoUpdatePrices();
            }, 100);
            
        } else {
            console.error('❌ 加载仓位数据失败');
            showNotification('加载仓位数据失败', 'error');
        }
    } catch (error) {
        console.error('❌ 加载仓位数据时发生错误:', error);
        showNotification('加载仓位数据失败', 'error');
    }
}

// 显示仓位汇总表格
function displayPositionSummary(summary) {
    const container = document.getElementById('positionTableBody');
    
    // 调试信息
    console.log('🔍 仓位汇总数据:', summary);
    console.log('🔍 当前显示的价格数据:', summary.map(item => ({
        symbol: item.token_symbol,
        current_price: item.current_price,
        avg_cost: item.avg_cost,
        current_value: item.current_value
    })));
    
    if (summary.length === 0) {
        container.innerHTML = '<tr><td colspan="9" class="no-data">暂无仓位数据</td></tr>';
        return;
    }
    
    // 检查数据结构
    if (summary[0]) {
        console.log('📊 第一条记录字段:', Object.keys(summary[0]));
        console.log('📊 第一条记录数据:', summary[0]);
    }
    
    const html = summary.map(item => {
        // 安全地获取数值，避免undefined错误
        const net_quantity = parseFloat(item.net_quantity || 0);
        const avg_cost = parseFloat(item.avg_cost || 0);
        const current_price = parseFloat(item.current_price || 0);
        const current_value = parseFloat(item.current_value || 0);
        const portfolio_percentage = parseFloat(item.portfolio_percentage || 0);
        const price_change_24h = parseFloat(item.price_change_24h || 0);
        const profit_loss = parseFloat(item.profit_loss || 0);
        const profit_loss_percentage = parseFloat(item.profit_loss_percentage || 0);
        
        const profitClass = profit_loss >= 0 ? 'profit-positive' : 'profit-negative';
        const priceChangeClass = price_change_24h >= 0 ? 'price-change-positive' : 'price-change-negative';
        const priceChangeSymbol = price_change_24h >= 0 ? '+' : '';
        
        return `
            <tr>
                <td><strong>${item.token_symbol || 'N/A'}</strong></td>
                <td>${formatNumber(item.net_quantity)}</td>
                <td>${formatCurrency(item.avg_cost)}</td>
                <td>${formatCurrency(item.current_price)}</td>
                <td>${formatCurrency(item.current_value)}</td>
                <td>${formatPercentage(item.portfolio_percentage)}</td>
                <td class="${priceChangeClass}">${priceChangeSymbol}${formatPercentage(item.price_change_24h)}</td>
                <td class="${profitClass}">${profit_loss >= 0 ? '+' : ''}${formatCurrency(item.profit_loss)}</td>
                <td class="${profitClass}">${profit_loss_percentage >= 0 ? '+' : ''}${formatPercentage(item.profit_loss_percentage)}</td>
            </tr>
        `;
    }).join('');
    
    container.innerHTML = html;
    console.log('✅ 仓位汇总表格显示更新完成');
}

// 显示仓位记录（表格形式）
function displayPositionRecords(records) {
    const container = document.getElementById('positionRecordsTableBody');
    
    if (records.length === 0) {
        container.innerHTML = '<tr><td colspan="10" class="no-data">暂无操作记录</td></tr>';
        return;
    }
    
    // 过滤掉初始仓位类型的记录，只显示买入和卖出
    const filteredRecords = records.filter(record => record.operation_type !== 'xxx');
    
    if (filteredRecords.length === 0) {
        container.innerHTML = '<tr><td colspan="10" class="no-data">暂无买入/卖出操作记录</td></tr>';
        return;
    }
    
    const html = filteredRecords.map(record => {
        // 评分显示
        let scoreDisplay = '';
        let scoreClass = '';
        if (record.score !== null && record.score !== undefined) {
            if (record.score >= 81) {
                scoreClass = 'score-excellent';
            } else if (record.score >= 61) {
                scoreClass = 'score-good';
            } else if (record.score >= 31) {
                scoreClass = 'score-average';
            } else {
                scoreClass = 'score-poor';
            }
        }
        
        // 复盘信息显示
        let reviewDisplay = '无';
        if (record.review && record.review.trim()) {
            // 如果复盘信息过长，截断并添加省略号，支持折行显示
            const maxLength = 50; // 最大显示长度
            if (record.review.length > maxLength) {
                reviewDisplay = `<div class="review-content" title="${record.review.replace(/"/g, '&quot;')}">
                    ${record.review.substring(0, maxLength)}...
                    <button class="review-expand-btn" onclick="showReviewDetail('${record.review.replace(/'/g, "\\'")}')" title="查看完整内容">
                        <i class="bi bi-arrow-right-circle"></i>
                    </button>
                </div>`;
            } else {
                reviewDisplay = `<div class="review-content" title="${record.review.replace(/"/g, '&quot;')}">
                    ${record.review}
                </div>`;
            }
        }
        
        // 检查是否为初始仓位
        const isInitialPosition = record.operation_type === '初始仓位';
        
        return `
            <tr>
                <td><span class="operation-type ${record.operation_type}">${record.operation_type}</span></td>
                <td><strong>${record.token_symbol}</strong></td>
                <td>${formatNumber(record.quantity)}</td>
                <td>${formatCurrency(record.price)}</td>
                <td>${formatCurrency(record.total_amount)}</td>
                <td>${record.reason || '无'}</td>
                <td>${new Date(record.operation_date).toLocaleString('zh-CN')}</td>
                <td class="score-column">
                    ${!isInitialPosition ? 
                        `<button class="score-btn ${scoreClass}" onclick="showScoreModal(${record.id})" title="${record.score !== null && record.score !== undefined ? '重新评分' : '点击评分'}">
                            ${record.score !== null && record.score !== undefined ? record.score + '分' : '未评分'}
                        </button>` : 
                        '<span class="no-score">--</span>'
                    }
                </td>
                <td class="review-column">${reviewDisplay}</td>
                <td class="actions-column">
                    <div class="action-buttons">
                        <button class="edit-btn" onclick="editPositionRecord(${record.id})" title="编辑记录">
                            <i class="bi bi-pencil-square"></i>
                        </button>
                        <button class="delete-btn" onclick="deletePositionRecord(${record.id})" title="删除记录">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    container.innerHTML = html;
}

// 更新仓位饼状图
function updatePositionChart(summary) {
    console.log('🎯 开始更新饼状图，数据:', summary);
    
    const ctx = document.getElementById('positionChart');
    if (!ctx) {
        console.error('❌ Canvas元素未找到');
        return;
    }
    
    console.log('✅ Canvas元素已找到');
    
    // 过滤掉没有持仓数量的Token，并确保有有效的当前价值
    const validSummary = summary.filter(item => {
        const hasQuantity = item.net_quantity && item.net_quantity > 0;
        const hasValue = item.current_value && item.current_value > 0;
        console.log(`🔍 ${item.token_symbol}: net_quantity=${item.net_quantity}, current_value=${item.current_value}, 有效=${hasQuantity && hasValue}`);
        return hasQuantity && hasValue;
    });
    
    console.log('📊 有效数据条数:', validSummary.length);
    
    if (validSummary.length === 0) {
        console.log('⚠️ 没有有效数据，隐藏图表');
        ctx.style.display = 'none';
        return;
    }
    
    ctx.style.display = 'block';
    console.log('✅ Canvas已显示');
    
    // 使用当前价值作为饼状图数据，确保数据准确性
    const data = {
        labels: validSummary.map(item => `${item.token_symbol || 'N/A'}`),
        datasets: [{
            data: validSummary.map(item => parseFloat(item.current_value || 0)),
            backgroundColor: [
                '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
                '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
            ],
            borderWidth: 2,
            borderColor: '#fff'
        }]
    };
    
    console.log('📊 饼状图数据:', data);
    
    try {
        // 检查Chart对象
        if (typeof Chart === 'undefined') {
            console.error('❌ Chart.js 未加载');
            return;
        }
        
        console.log('✅ Chart.js 已加载，版本:', Chart.version);
        
        // 如果图表已存在，直接更新数据而不重新创建
        if (positionChart) {
            console.log('🔄 更新现有图表数据');
            positionChart.data = data;
            positionChart.update('none'); // 使用 'none' 模式，无动画
            console.log('✅ 图表数据更新成功');
        } else {
            console.log('🆕 创建新图表');
            positionChart = new Chart(ctx, {
                type: 'pie',
                data: data,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    height: 400,
                    animation: {
                        duration: 1000, // 第一次创建时的动画时长
                        easing: 'easeInOutQuart'
                    },
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 20,
                                usePointStyle: true,
                                font: {
                                    size: 12
                                }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.parsed;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    return `${label}: ${value.toFixed(2)} USDT (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
            console.log('✅ 新图表创建成功');
        }
    } catch (error) {
        console.error('❌ 饼状图更新失败:', error);
        console.error('错误详情:', error.stack);
    }
}

// 更新DEFI饼状图
async function updateDefiChart(summaryData) {
    console.log('🎯 开始更新DEFI饼状图，数据:', summaryData);
    
    const ctx = document.getElementById('defiChart');
    if (!ctx) {
        console.error('❌ DEFI Canvas元素未找到');
        return;
    }
    
    console.log('✅ DEFI Canvas元素已找到');
    
    // 过滤掉没有价值的项目，并确保有有效的USDT价值
    const validSummary = summaryData.filter(item => {
        const combinedQuantity = item.netStaked - item.netBorrowed;
        const hasValue = Math.abs(combinedQuantity) > 0;
        console.log(`🔍 ${item.project}-${item.token}: combinedQuantity=${combinedQuantity}, 有效=${hasValue}`);
        return hasValue;
    });
    
    console.log('📊 DEFI有效数据条数:', validSummary.length);
    
    if (validSummary.length === 0) {
        console.log('⚠️ 没有有效DEFI数据，隐藏图表');
        ctx.style.display = 'none';
        return;
    }
    
    ctx.style.display = 'block';
    console.log('✅ DEFI Canvas已显示');
    
    try {
        // 获取所有Token的价格数据
        const tokens = [...new Set(validSummary.map(item => item.token))];
        console.log('🔍 需要获取价格的Token:', tokens);
        
        const prices = await getBatchTokenPrices(tokens);
        console.log('🔍 获取到的价格数据:', prices);
        
        const priceMap = new Map(prices.map(p => [p.token, p]));
        
        // 按项目分组，计算每个项目的总USDT价值
        const projectValueMap = new Map();
        
        validSummary.forEach(item => {
            const combinedQuantity = item.netStaked - item.netBorrowed;
            const projectKey = item.project;
            
            if (!projectValueMap.has(projectKey)) {
                projectValueMap.set(projectKey, 0);
            }
            
            // 计算实际的USDT价值
            const priceData = priceMap.get(item.token);
            let usdtValue = 0;
            
            if (priceData && priceData.price_usdt) {
                usdtValue = Math.abs(combinedQuantity) * parseFloat(priceData.price_usdt);
            } else {
                // 如果后端没有价格数据，使用默认价格
                usdtValue = calculateDefaultUSDTValue(item.token, Math.abs(combinedQuantity));
            }
            
            projectValueMap.set(projectKey, projectValueMap.get(projectKey) + usdtValue);
        });
        
        // 按USDT价值倒序排列项目
        const sortedProjects = Array.from(projectValueMap.entries())
            .sort((a, b) => b[1] - a[1]); // 按价值倒序排列
        
        // 转换为饼状图数据格式
        const data = {
            labels: sortedProjects.map(([project, value]) => project),
            datasets: [{
                data: sortedProjects.map(([project, value]) => value),
                backgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF',
                    '#FF9F40', '#FF6384', '#C9CBCF', '#4BC0C0', '#FF6384'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        };
        
        console.log('📊 DEFI饼状图数据:', data);
        
        // 检查Chart对象
        if (typeof Chart === 'undefined') {
            console.error('❌ Chart.js 未加载');
            return;
        }
        
        console.log('✅ Chart.js 已加载，版本:', Chart.version);
        
        // 如果图表已存在，直接更新数据而不重新创建
        if (defiChart) {
            console.log('🔄 更新现有DEFI图表数据');
            defiChart.data = data;
            defiChart.update('none'); // 使用 'none' 模式，无动画
            console.log('✅ DEFI图表数据更新成功');
        } else {
            console.log('🆕 创建新DEFI图表');
            defiChart = new Chart(ctx, {
                type: 'pie',
                data: data,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    height: 300,
                    animation: {
                        duration: 1000, // 第一次创建时的动画时长
                        easing: 'easeInOutQuart'
                    },
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 20,
                                usePointStyle: true,
                                font: {
                                    size: 12
                                }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.parsed;
                                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                    const percentage = ((value / total) * 100).toFixed(1);
                                    return `${label}: ${value.toFixed(2)} USDT (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
            console.log('✅ 新DEFI图表创建成功');
        }
        
    } catch (error) {
        console.error('❌ 更新DEFI饼状图失败:', error);
    }
}

// 显示仓位表单
function showPositionForm() {
    document.getElementById('positionModal').style.display = 'block';
}

// 关闭仓位表单
function closePositionModal() {
    document.getElementById('positionModal').style.display = 'none';
    document.getElementById('positionForm').reset();
}

// 提交仓位表单
async function submitPositionForm() {
    const tokenName = document.getElementById('tokenName').value;
    
    // 根据Token名称自动生成符号
    const tokenSymbolMap = {
        'Bitcoin': 'BTC',
        'Ethereum': 'ETH',
        'Solana': 'SOL',
        'Cardano': 'ADA',
        'Polkadot': 'DOT',
        'Chainlink': 'LINK',
        'Uniswap': 'UNI',
        'Aave': 'AAVE',
        'Polygon': 'MATIC',
        'Binance Coin': 'BNB',
        'Ripple': 'XRP',
        'Litecoin': 'LTC',
        'Bitcoin Cash': 'BCH',
        'Stellar': 'XLM',
        'Monero': 'XMR',
        'Dash': 'DASH',
        'Zcash': 'ZEC',
        'Tezos': 'XTZ',
        'Cosmos': 'ATOM',
        'Filecoin': 'FIL'
    };
    
    const tokenSymbol = tokenSymbolMap[tokenName] || tokenName.toUpperCase();
    
    // 获取reason值，如果为空则设为null
    const reasonValue = document.getElementById('reason').value.trim();
    const reason = reasonValue === '' ? null : reasonValue;
    
    const formData = {
        operation_type: document.getElementById('operationType').value,
        token_symbol: tokenSymbol,
        token_name: tokenName,
        quantity: parseFloat(document.getElementById('quantity').value),
        price: parseFloat(document.getElementById('price').value),
        reason: reason
    };
    
    try {
        const response = await fetch('/api/position', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        if (response.ok) {
            showNotification('仓位操作记录添加成功！', 'success');
            closePositionModal();
            loadPositionData();
        } else {
            const error = await response.json();
            showNotification(error.error || '添加失败', 'error');
        }
    } catch (error) {
        console.error('提交仓位表单失败:', error);
        showNotification('提交失败，请检查网络连接', 'error');
    }
}

// 提交仓位编辑表单
async function submitPositionEditForm() {
    const recordId = document.getElementById('editRecordId').value;
    const tokenName = document.getElementById('editTokenName').value;
    
    // 根据Token名称自动生成符号
    const tokenSymbolMap = {
        'Bitcoin': 'BTC',
        'Ethereum': 'ETH',
        'Solana': 'SOL',
        'Cardano': 'ADA',
        'Polkadot': 'DOT',
        'Chainlink': 'LINK',
        'Uniswap': 'UNI',
        'Aave': 'AAVE',
        'Polygon': 'MATIC',
        'Binance Coin': 'BNB',
        'Ripple': 'XRP',
        'Litecoin': 'LTC',
        'Bitcoin Cash': 'BCH',
        'Stellar': 'XLM',
        'Monero': 'XMR',
        'Dash': 'DASH',
        'Zcash': 'ZEC',
        'Tezos': 'XTZ',
        'Cosmos': 'ATOM',
        'Filecoin': 'FIL'
    };
    
    const tokenSymbol = tokenSymbolMap[tokenName] || tokenName.substring(0, 3).toUpperCase();
    
    // 获取reason值，如果为空则设为null
    const reasonValue = document.getElementById('editReason').value.trim();
    const reason = reasonValue === '' ? null : reasonValue;
    
    const formData = {
        operation_type: document.getElementById('editOperationType').value,
        token_symbol: tokenSymbol,
        token_name: tokenName,
        quantity: parseFloat(document.getElementById('editQuantity').value),
        price: parseFloat(document.getElementById('editPrice').value),
        reason: reason
    };
    
    try {
        const response = await fetch(`/api/position/${recordId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        if (response.ok) {
            showNotification('仓位操作记录修改成功！', 'success');
            closePositionEditModal();
            loadPositionData();
        } else {
            const error = await response.json();
            showNotification(error.error || '修改失败', 'error');
        }
    } catch (error) {
        console.error('提交仓位编辑表单失败:', error);
        showNotification('提交失败，请检查网络连接', 'error');
    }
}

// 提交导入表单
async function submitImportForm() {
    const exchangeName = document.getElementById('exchangeName').value;
    const apiKey = document.getElementById('apiKey').value.trim();
    const apiSecret = document.getElementById('apiSecret').value.trim();
    
    // 获取导入选项
    const importHistory = document.getElementById('importHistory').checked;
    const importPositions = document.getElementById('importPositions').checked;
    const importBalances = document.getElementById('importBalances').checked;
    
    if (!exchangeName) {
        showNotification('请选择交易所', 'error');
        return;
    }
    
    if (!apiKey || !apiSecret) {
        showNotification('请输入完整的API信息', 'error');
        return;
    }
    
    if (!importHistory && !importPositions && !importBalances) {
        showNotification('请至少选择一个导入选项', 'error');
        return;
    }
    
    const formData = {
        exchange: exchangeName,
        api_key: apiKey,
        api_secret: apiSecret,
        import_options: {
            history: importHistory,
            positions: importPositions,
            balances: importBalances
        }
    };
    
    try {
        // 显示导入中的提示
        showNotification('正在连接交易所API，请稍候...', 'info');
        
        // 这里暂时只是模拟，实际实现时会调用后端API
        console.log('🔗 导入配置:', formData);
        
        // 模拟API调用延迟
        setTimeout(() => {
            showNotification('交易所数据导入功能开发中，敬请期待！', 'info');
            closeImportModal();
        }, 2000);
        
    } catch (error) {
        console.error('提交导入表单失败:', error);
        showNotification('导入失败，请检查网络连接', 'error');
    }
}

// 编辑仓位记录
async function editPositionRecord(id) {
    try {
        // 获取记录详情
        const response = await fetch(`/api/position/${id}`);
        if (!response.ok) {
            throw new Error('获取记录详情失败');
        }
        
        const record = await response.json();
        console.log('🔍 编辑记录:', record);
        
        // 填充编辑表单
        document.getElementById('editRecordId').value = record.id;
        document.getElementById('editOperationType').value = record.operation_type;
        document.getElementById('editTokenName').value = record.token_name;
        document.getElementById('editQuantity').value = record.quantity;
        document.getElementById('editPrice').value = record.price;
        document.getElementById('editReason').value = record.reason || '';
        
        // 显示编辑模态框
        document.getElementById('positionEditModal').style.display = 'block';
        
    } catch (error) {
        console.error('获取记录详情失败:', error);
        showNotification('获取记录详情失败', 'error');
    }
}

// 关闭编辑模态框
function closePositionEditModal() {
    document.getElementById('positionEditModal').style.display = 'none';
    document.getElementById('positionEditForm').reset();
}

// 显示导入模态框
function showImportModal() {
    document.getElementById('importModal').style.display = 'block';
    // 重置表单
    document.getElementById('importForm').reset();
}

// 关闭导入模态框
function closeImportModal() {
    document.getElementById('importModal').style.display = 'none';
    document.getElementById('importForm').reset();
}

// 删除仓位记录
async function deletePositionRecord(id) {
    if (!confirm('确定要删除这条记录吗？')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/position/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification('记录删除成功！', 'success');
            loadPositionData();
        } else {
            const error = await response.json();
            showNotification(error.error || '删除失败', 'error');
        }
    } catch (error) {
        console.error('删除仓位记录失败:', error);
        showNotification('删除失败，请检查网络连接', 'error');
    }
}

// ==================== DEFI相关功能 ====================

// 加载DEFI数据
async function loadDefiData() {
    try {
        const [summaryResponse, recordsResponse] = await Promise.all([
            fetch('/api/defi/summary'),
            fetch('/api/defi')
        ]);
        
        if (summaryResponse.ok && recordsResponse.ok) {
            const summary = await summaryResponse.json();
            const records = await recordsResponse.json();
            
            // 数据类型转换和验证
            const processedRecords = records.map(record => ({
                ...record,
                quantity: parseFloat(record.quantity || 0),
                apy: record.apy ? parseFloat(record.apy || 0) : null
            }));
            
            // 保存当前DEFI记录数据到全局变量，供编辑功能使用
            window.currentDefiRecords = processedRecords;
            
            displayDefiSummary(summary, processedRecords);
            displayDefiRecordsTable(processedRecords);
        }
    } catch (error) {
        console.error('加载DEFI数据失败:', error);
        showNotification('加载DEFI数据失败', 'error');
    }
}

// 显示DEFI汇总
function displayDefiSummary(summary, records) {
    // 按项目名称+Token分组汇总
    const summaryMap = new Map();
    
    records.forEach(record => {
        const key = `${record.project}-${record.token}`;
        if (!summaryMap.has(key)) {
            summaryMap.set(key, {
                project: record.project,
                token: record.token,
                netStaked: 0,
                netBorrowed: 0,
                totalApy: 0,
                apyCount: 0,
                operationCount: 0
            });
        }
        
        const summaryItem = summaryMap.get(key);
        summaryItem.operationCount++;
        
        // 根据操作类型计算净数量
        switch (record.operation_type) {
            case '质押':
            case '添加LP':
                summaryItem.netStaked += record.quantity;
                break;
            case '赎回':
            case '撤出LP':
                summaryItem.netStaked -= record.quantity;
                break;
            case '借款':
                summaryItem.netBorrowed += record.quantity;
                break;
            case '还款':
                summaryItem.netBorrowed -= record.quantity;
                break;
        }
        
        // 累计年化收益率
        if (record.apy) {
            summaryItem.totalApy += record.apy;
            summaryItem.apyCount++;
        }
    });
    
    // 计算总价值（净质押价值，借款为负值）
    let totalApy = 0;
    let totalApyCount = 0;
    
    summaryMap.forEach(item => {
        if (item.apyCount > 0) {
            totalApy += item.totalApy;
            totalApyCount += item.apyCount;
        }
    });
    
    // 计算平均年化利率
    const avgApy = totalApyCount > 0 ? totalApy / totalApyCount : 0;
    
    // 更新概览数据（平均年化利率）
    // 注意：总价值将在displayDefiSummaryTable完成后更新，因为需要等待价格数据获取完成
    document.getElementById('avgApy').textContent = formatPercentage(avgApy);
    
    // 注意：每日收益将在displayDefiSummaryTable完成后更新
    // 因为需要等待价格数据获取完成
    
    // 显示汇总表格
    const summaryArray = Array.from(summaryMap.values());
    
    // 保存DEFI汇总数据到全局变量，供重试功能使用
    window.defiSummary = summaryArray;
    
    // 更新DEFI饼状图
    updateDefiChart(summaryArray);
    
    // 先显示汇总表格，然后计算正确的每日收益总和
    displayDefiSummaryTable(summaryArray);
    
    // 注意：每日收益总和将在displayDefiSummaryTable完成后通过回调更新
    // 因为需要等待价格数据获取完成
}

// 显示DEFI汇总表格
async function displayDefiSummaryTable(summaryData) {
    const container = document.getElementById('defiSummaryTableBody');
    
    if (!container) {
        console.error('❌ DEFI汇总表格容器未找到');
        return;
    }
    
    if (summaryData.length === 0) {
        container.innerHTML = '<tr><td colspan="7" class="no-data">暂无DEFI汇总数据</td></tr>';
        return;
    }
    
    console.log('🔍 DEFI汇总数据:', summaryData);
    
    // 显示加载状态
    container.innerHTML = '<tr><td colspan="7" class="loading">正在加载价格数据...</td></tr>';
    
    try {
        // 批量获取所有Token的价格
        const tokens = [...new Set(summaryData.map(item => item.token))];
        console.log('🔍 需要获取价格的Token:', tokens);
        
        const prices = await getBatchTokenPrices(tokens);
        console.log('🔍 获取到的价格数据:', prices);
        
        const priceMap = new Map(prices.map(p => [p.token, p]));
        
        const html = summaryData.map(item => {
            // 计算合并后的数量：净质押数量 - 净借款数量
            const combinedQuantity = item.netStaked - item.netBorrowed;
            const quantityClass = combinedQuantity > 0 ? 'positive' : combinedQuantity < 0 ? 'negative' : 'neutral';
            
            // 计算价值USDT（从后端价格服务获取）
            const priceData = priceMap.get(item.token);
            let usdtValue = 0;
            
            if (priceData && priceData.price_usdt) {
                // 使用后端价格服务的数据
                usdtValue = Math.abs(combinedQuantity) * parseFloat(priceData.price_usdt);
            } else {
                // 如果后端没有价格数据，使用默认价格
                usdtValue = calculateDefaultUSDTValue(item.token, Math.abs(combinedQuantity));
            }
            
            // 确保usdtValue是数字类型
            usdtValue = parseFloat(usdtValue) || 0;
            
            // 计算每日收益
            const avgApy = item.apyCount > 0 ? item.totalApy / item.apyCount : 0;
            const dailyEarnings = (avgApy / 100 / 365) * usdtValue; // 基于USDT价值计算，而不是数量
            
            // 获取退出时间（从原始记录中查找）
            const exitTime = getExitTimeForProject(item.project, item.token);
            
            return `
                <tr>
                    <td>
                        <div class="project-info">
                            <div class="project-name">${item.project}</div>
                        </div>
                    </td>
                    <td>${item.token}</td>
                    <td class="quantity-cell ${quantityClass}">
                        ${formatNumber(combinedQuantity)}
                    </td>
                    <td class="usdt-value-cell">
                        $${formatNumber(usdtValue)}
                    </td>
                    <td class="apy-cell">
                        ${avgApy > 0 ? formatPercentage(avgApy) : '--'}
                    </td>
                    <td class="earnings-cell">
                        ${dailyEarnings > 0 ? formatNumber(dailyEarnings) : '--'}
                    </td>
                    <td class="exit-time-cell">
                        ${exitTime ? exitTime + '天' : '--'}
                    </td>
                </tr>
            `;
        }).join('');
        
        container.innerHTML = html;
        console.log('✅ DEFI汇总表格显示完成');
        
        // 计算表格中所有行的每日收益总和和总价值
        let totalDailyEarnings = 0;
        let totalValue = 0;
        summaryData.forEach(item => {
            const combinedQuantity = item.netStaked - item.netBorrowed;
            const avgApy = item.apyCount > 0 ? item.totalApy / item.apyCount : 0;
            
            // 计算该行的USDT价值
            const priceData = priceMap.get(item.token);
            let usdtValue = 0;
            
            if (priceData && priceData.price_usdt) {
                usdtValue = Math.abs(combinedQuantity) * parseFloat(priceData.price_usdt);
            } else {
                usdtValue = calculateDefaultUSDTValue(item.token, Math.abs(combinedQuantity));
            }
            
            // 累加总价值（所有行的价值USDT总和）
            totalValue += usdtValue;
            
            // 计算该行的每日收益
            const dailyEarnings = (avgApy / 100 / 365) * usdtValue;
            totalDailyEarnings += dailyEarnings;
        });
        
        // 更新DEFI概览中的总价值和每日收益
        const totalValueElement = document.getElementById('totalValue');
        if (totalValueElement) {
            totalValueElement.textContent = formatCurrency(totalValue);
            console.log('✅ DEFI概览总价值已更新:', totalValue);
        }
        
        const dailyEarningsElement = document.getElementById('dailyEarnings');
        if (dailyEarningsElement) {
            dailyEarningsElement.textContent = formatCurrency(totalDailyEarnings);
            console.log('✅ DEFI概览每日收益已更新:', totalDailyEarnings);
        }
        
        // 更新DEFI饼状图，使用最新的价格数据
        updateDefiChart(summaryData);
        
        // 等待DOM更新完成后，再按USDT价值倒序排列
        setTimeout(() => {
            if (currentDefiSortField === null) {
                currentDefiSortField = 'usdt_value';
                sortDefiTable('usdt_value');
            }
        }, 100);
        
    } catch (error) {
        console.error('❌ 加载价格数据失败:', error);
        container.innerHTML = `<tr><td colspan="7" class="error">
            价格数据加载失败: ${error.message}<br>
            <button onclick="retryDefiSummary()" class="retry-btn">重试</button>
        </td></tr>`;
    }
}

// 计算Token的USDT价值（从价格服务获取）
async function calculateUSDTValue(token, quantity) {
    try {
        // 从价格服务获取实时价格
        const response = await fetch(`/api/token-price/${token}`);
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
                return quantity * parseFloat(data.data.price_usdt);
            }
        }
    } catch (error) {
        console.warn(`获取${token}价格失败，使用默认价格:`, error);
    }
    
    // 如果价格服务不可用，使用默认价格
    return calculateDefaultUSDTValue(token, quantity);
}

// 使用默认价格计算USDT价值（同步函数）
function calculateDefaultUSDTValue(token, quantity) {
    const defaultPrices = {
        'ETH': 2500, 'USDC': 1, 'USDT': 1, 'BTC': 45000, 'DAI': 1,
        'WBTC': 45000, 'stETH': 2500, 'aUSDC': 1, 'cUSDC': 1,
        'UNI': 5, 'LINK': 15, 'AAVE': 100
    };
    
    const price = defaultPrices[token] || 1;
    return quantity * price;
}

// 批量获取Token价格
async function getBatchTokenPrices(tokens) {
    try {
        const response = await fetch('/api/token-price/batch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ tokens })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success) {
                return data.data;
            }
        }
    } catch (error) {
        console.warn('批量获取Token价格失败:', error);
    }
    
    return [];
}

// 获取项目的退出时间
function getExitTimeForProject(project, token) {
    if (!window.currentDefiRecords) return null;
    
    // 查找该项目+Token的最新退出时间记录
    const records = window.currentDefiRecords.filter(record => 
        record.project === project && record.token === token
    );
    
    // 优先返回有退出时间的记录
    const recordsWithExitTime = records.filter(record => record.exit_time);
    if (recordsWithExitTime.length > 0) {
        // 返回最新的退出时间
        return recordsWithExitTime[recordsWithExitTime.length - 1].exit_time;
    }
    
    return null;
}

// 显示DEFI操作记录表格
function displayDefiRecordsTable(records) {
    const container = document.getElementById('defiRecordsTableBody');
    
    if (records.length === 0) {
        container.innerHTML = '<tr><td colspan="8" class="no-data">暂无DEFI记录</td></tr>';
        return;
    }
    
    const html = records.map(record => `
        <tr>
            <td>
                <div class="project-info">
                    ${record.project_url ? 
                        `<a href="${record.project_url}" target="_blank" class="project-name-link">${record.project}</a>` : 
                        `<div class="project-name">${record.project}</div>`
                    }
                </div>
            </td>
            <td>
                <span class="operation-type ${getOperationTypeClass(record.operation_type)}">
                    ${record.operation_type}
                </span>
            </td>
            <td>${record.token}</td>
            <td class="quantity-cell ${getQuantityColorClass(record.operation_type)}">
                ${getQuantityDisplay(record.operation_type, record.quantity)}
            </td>
            <td class="apy-cell">${record.apy ? formatPercentage(record.apy) : '--'}</td>
            <td>${record.exit_time ? record.exit_time + '天' : '--'}</td>
            <td>${new Date(record.operation_date).toLocaleDateString('zh-CN')}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn edit-btn" onclick="editDefiRecord(${record.id})" title="编辑记录">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                    <button class="action-btn delete-btn" onclick="deleteDefiRecord(${record.id})" title="删除记录">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
    
    container.innerHTML = html;
}

// 获取数量显示样式类
function getQuantityColorClass(operationType) {
    switch (operationType) {
        case '质押':
        case '添加LP':
        case '还款':
            return 'positive';
        case '赎回':
        case '撤出LP':
        case '借款':
            return 'negative';
        default:
            return 'neutral';
    }
}

// 获取数量显示格式
function getQuantityDisplay(operationType, quantity) {
    const num = parseFloat(quantity || 0);
    return formatNumber(num);
}

// 获取操作类型样式类
function getOperationTypeClass(operationType) {
    switch (operationType) {
        case '质押':
        case '添加LP':
            return 'stake';
        case '赎回':
        case '撤出LP':
            return 'unstake';
        case '借款':
            return 'borrow';
        case '还款':
            return 'repay';
        default:
            return 'default';
    }
}

// 显示DEFI表单
function showDefiForm() {
    document.getElementById('defiModal').style.display = 'block';
}

// 关闭DEFI表单
function closeDefiModal() {
    document.getElementById('defiModal').style.display = 'none';
    document.getElementById('defiForm').reset();
    
    // 重置编辑状态
    delete document.getElementById('defiForm').dataset.editId;
    document.querySelector('#defiModal h3').textContent = '添加DEFI操作';
}

// 提交DEFI表单
async function submitDefiForm() {
    const editId = document.getElementById('defiForm').dataset.editId;
    const isEdit = !!editId;
    
    const formData = {
        project: document.getElementById('defiProject').value,
        project_url: document.getElementById('defiProjectUrl').value,
        operation_type: document.getElementById('defiOperationType').value,
        token: document.getElementById('defiToken').value.toUpperCase(),
        quantity: parseFloat(document.getElementById('defiQuantity').value),
        apy: document.getElementById('defiApy').value ? parseFloat(document.getElementById('defiApy').value) : null,
        exit_time: document.getElementById('defiExitTime').value,
        notes: document.getElementById('defiNotes').value
    };
    
    try {
        const url = isEdit ? `/api/defi/${editId}` : '/api/defi';
        const method = isEdit ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        if (response.ok) {
            showNotification(`DEFI操作记录${isEdit ? '更新' : '添加'}成功！`, 'success');
            closeDefiModal();
            loadDefiData();
        } else {
            const error = await response.json();
            showNotification(error.error || `${isEdit ? '更新' : '添加'}失败`, 'error');
        }
    } catch (error) {
        console.error('提交DEFI表单失败:', error);
        showNotification('提交失败，请检查网络连接', 'error');
    }
}

// 编辑DEFI记录
function editDefiRecord(id) {
    // 查找要编辑的记录
    const record = window.currentDefiRecords ? window.currentDefiRecords.find(r => r.id === id) : null;
    if (!record) {
        showNotification('未找到要编辑的记录', 'error');
        return;
    }
    
    // 填充表单
    document.getElementById('defiProject').value = record.project;
    document.getElementById('defiProjectUrl').value = record.project_url || '';
    document.getElementById('defiOperationType').value = record.operation_type;
    document.getElementById('defiToken').value = record.token;
    document.getElementById('defiQuantity').value = record.quantity;
    document.getElementById('defiApy').value = record.apy || '';
    document.getElementById('defiExitTime').value = record.exit_time || '';
    document.getElementById('defiNotes').value = record.notes || '';
    
    // 设置编辑模式
    document.getElementById('defiForm').dataset.editId = id;
    document.querySelector('#defiModal h3').textContent = '编辑DEFI操作';
    
    // 显示表单
    showDefiForm();
}

// 删除DEFI记录
async function deleteDefiRecord(id) {
    if (!confirm('确定要删除这条记录吗？')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/defi/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification('记录删除成功！', 'success');
            loadDefiData();
        } else {
            const error = await response.json();
            showNotification(error.error || '删除失败', 'error');
        }
    } catch (error) {
        console.error('删除DEFI记录失败:', error);
        showNotification('删除失败，请检查网络连接', 'error');
    }
}

// ==================== 空投相关功能 ====================

// 加载空投数据
async function loadAirdropData() {
    try {
        const [summaryResponse, recordsResponse] = await Promise.all([
            fetch('/api/airdrop/summary'),
            fetch('/api/airdrop')
        ]);
        
        if (summaryResponse.ok && recordsResponse.ok) {
            const summary = await summaryResponse.json();
            const records = await recordsResponse.json();
            
            // 数据类型转换和验证
            const processedSummary = {
                ...summary,
                total_expected: parseFloat(summary.total_expected || 0),
                total_actual: parseFloat(summary.total_actual || 0),
                status_breakdown: summary.status_breakdown.map(item => ({
                    ...item,
                    total_expected: parseFloat(item.total_expected || 0),
                    total_actual: parseFloat(item.total_actual || 0)
                }))
            };
            
            const processedRecords = records.map(record => ({
                ...record,
                expected_reward: record.expected_reward ? parseFloat(record.expected_reward || 0) : null,
                actual_reward: record.actual_reward ? parseFloat(record.actual_reward || 0) : null
            }));
            
            // 保存当前空投记录数据到全局变量，供编辑功能使用
            window.currentAirdropRecords = processedRecords;
            
            displayAirdropSummary(processedSummary);
            displayAirdropRecords(processedRecords);
        }
    } catch (error) {
        console.error('加载空投数据失败:', error);
        showNotification('加载空投数据失败', 'error');
    }
}

// 显示空投汇总
function displayAirdropSummary(summary) {
    const container = document.getElementById('airdropSummary');
    
    const html = `
        <div class="summary-card">
            <h4>总体统计</h4>
            <p><strong>参与项目总数:</strong> ${summary.total_projects}</p>
            <p><strong>参与金额总额:</strong> ${summary.total_participation ? formatNumber(summary.total_participation) : '0'}</p>
            <p><strong>预期奖励总额:</strong> ${summary.total_expected ? formatNumber(summary.total_expected) : '-'}</p>
            <p><strong>实际奖励总额:</strong> ${summary.total_actual ? formatNumber(summary.total_actual) : '-'}</p>
            <p><strong>平均APR:</strong> ${summary.avg_apr ? formatPercentage(summary.avg_apr) : '-'}</p>
        </div>
        ${summary.status_breakdown.map(item => `
            <div class="summary-card">
                <h4>${item.status}</h4>
                <p><strong>项目数量:</strong> ${item.count}</p>
                <p><strong>参与金额:</strong> ${item.total_participation ? formatNumber(item.total_participation) : '0'}</p>
                <p><strong>预期奖励:</strong> ${item.total_expected ? formatNumber(item.total_expected) : '-'}</p>
                <p><strong>实际奖励:</strong> ${item.total_actual ? formatNumber(item.total_actual) : '-'}</p>
                <p><strong>平均APR:</strong> ${item.avg_apr ? formatPercentage(item.avg_apr) : '-'}</p>
            </div>
        `).join('')}
    `;
    
    container.innerHTML = html;
}

// 显示空投记录
function displayAirdropRecords(records) {
    const container = document.getElementById('airdropTableBody');
    
    if (records.length === 0) {
        container.innerHTML = '<tr><td colspan="10" class="no-data">暂无空投记录</td></tr>';
        return;
    }
    
    const html = records.map(record => `
        <tr>
            <td>
                <div class="project-info">
                    <div class="project-name">
                        ${record.project_url ? `<a href="${record.project_url}" target="_blank" class="project-name-link">${record.project_name}</a>` : record.project_name}
                    </div>
                    ${record.project_twitter ? `<div class="project-twitter"><a href="https://twitter.com/${record.project_twitter.replace('@', '')}" target="_blank" class="twitter-link">🐦 ${record.project_twitter}</a></div>` : ''}
                </div>
            </td>
            <td>
                <span class="participation-type ${record.participation_type === '存款' ? 'money' : 'interaction'}">
                    ${record.participation_type}
                </span>
            </td>
            <td>${record.participation_amount > 0 ? formatNumber(record.participation_amount) + ' ' + (record.participation_token || '') : '0.00'}</td>
            <td>${new Date(record.participation_date).toLocaleDateString('zh-CN')}</td>
            <td>${record.expected_airdrop_date ? new Date(record.expected_airdrop_date).toLocaleDateString('zh-CN') : '--'}</td>
            <td>${record.actual_reward ? formatNumber(record.actual_reward) : '--'}</td>
            <td>${record.actual_apr ? formatPercentage(record.actual_apr) : '--'}</td>
            <td>
                <div class="status-combined">
                    <div class="status-badge status-${record.status.replace(/\s+/g, '-')}">
                        ${record.status}
                    </div>
                    <div class="withdrawal-status-badge withdrawal-status-${record.withdrawal_status.replace(/\s+/g, '-')}">
                        ${record.withdrawal_status}
                    </div>
                </div>
            </td>
            <td>${record.notes || '--'}</td>
            <td>
                <div class="action-buttons">
                    <button class="action-btn edit-btn" onclick="editAirdropRecord(${record.id})" title="编辑状态">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                    <button class="action-btn delete-btn" onclick="deleteAirdropRecord(${record.id})" title="删除记录">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
    
    container.innerHTML = html;
}

// 显示空投表单
function showAirdropForm() {
    document.getElementById('airdropModal').style.display = 'block';
}

// 关闭空投表单
function closeAirdropModal() {
    document.getElementById('airdropModal').style.display = 'none';
    document.getElementById('airdropForm').reset();
}

// 提交空投表单
async function submitAirdropForm() {
    const formData = {
        project_name: document.getElementById('airdropProject').value,
        project_url: document.getElementById('airdropProjectUrl').value,
        project_twitter: document.getElementById('airdropProjectTwitter').value,
        participation_type: document.getElementById('airdropParticipationType').value,
        wallet_address: document.getElementById('airdropWalletAddress').value,
        participation_amount: document.getElementById('airdropParticipationAmount').value ? parseFloat(document.getElementById('airdropParticipationAmount').value) : 0,
        participation_token: document.getElementById('airdropParticipationToken').value,
        participation_amount_usdt: document.getElementById('airdropParticipationAmountUsdt').value ? parseFloat(document.getElementById('airdropParticipationAmountUsdt').value) : 0,
        participation_date: document.getElementById('airdropDate').value,
        expected_airdrop_date: document.getElementById('airdropExpectedDate').value || null,
        expected_reward: document.getElementById('airdropExpectedReward').value ? parseFloat(document.getElementById('airdropExpectedReward').value) : null,
        actual_reward: document.getElementById('airdropActualReward').value ? parseFloat(document.getElementById('airdropActualReward').value) : null,
        actual_apr: document.getElementById('airdropActualApr').value ? parseFloat(document.getElementById('airdropActualApr').value) : null,
        status: document.getElementById('airdropStatus').value,
        withdrawal_status: document.getElementById('airdropWithdrawalStatus').value,
        notes: document.getElementById('airdropNotes').value
    };
    
    try {
        const response = await fetch('/api/airdrop', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        if (response.ok) {
            showNotification('空投参与记录添加成功！', 'success');
            closeAirdropModal();
            loadAirdropData();
        } else {
            const error = await response.json();
            showNotification(error.error || '添加失败', 'error');
        }
    } catch (error) {
        console.error('提交空投表单失败:', error);
        showNotification('提交失败，请检查网络连接', 'error');
    }
}

// 编辑空投记录
function editAirdropRecord(id) {
    // 获取当前记录数据
    const record = getAirdropRecordById(id);
    if (!record) {
        showNotification('未找到记录数据', 'error');
        return;
    }
    
    // 填充编辑表单
    document.getElementById('editAirdropId').value = record.id;
    document.getElementById('editAirdropProject').value = record.project_name;
    document.getElementById('editAirdropProjectUrl').value = record.project_url || '';
    document.getElementById('editAirdropProjectTwitter').value = record.project_twitter || '';
    document.getElementById('editAirdropParticipationType').value = record.participation_type;
    document.getElementById('editAirdropWalletAddress').value = record.wallet_address;
    document.getElementById('editAirdropParticipationAmount').value = record.participation_amount ? parseFloat(record.participation_amount).toFixed(2) : '0.00';
    document.getElementById('editAirdropParticipationToken').value = record.participation_token || '';
    document.getElementById('editAirdropParticipationAmountUsdt').value = record.participation_amount_usdt ? parseFloat(record.participation_amount_usdt).toFixed(2) : '0.00';
    // 处理日期字段，确保格式正确
    document.getElementById('editAirdropDate').value = record.participation_date ? formatDateForInput(record.participation_date) : '';
    document.getElementById('editAirdropExpectedDate').value = record.expected_airdrop_date ? formatDateForInput(record.expected_airdrop_date) : '';
    document.getElementById('editAirdropExpectedReward').value = record.expected_reward ? parseFloat(record.expected_reward).toFixed(2) : '';
    document.getElementById('editAirdropActualReward').value = record.actual_reward ? parseFloat(record.actual_reward).toFixed(2) : '';
    document.getElementById('editAirdropActualApr').value = record.actual_apr ? parseFloat(record.actual_apr).toFixed(2) : '';
            document.getElementById('editAirdropStatus').value = record.status;
        document.getElementById('editAirdropWithdrawalStatus').value = record.withdrawal_status;
    document.getElementById('editAirdropNotes').value = record.notes || '';
    
    // 显示编辑模态框
    document.getElementById('airdropEditModal').style.display = 'block';
}

// 格式化日期为HTML date input字段需要的格式 (YYYY-MM-DD)
function formatDateForInput(dateString) {
    if (!dateString) return '';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '';
        
        // 格式化为 YYYY-MM-DD
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
    } catch (error) {
        console.error('日期格式化失败:', error);
        return '';
    }
}

// 获取空投记录数据
function getAirdropRecordById(id) {
    // 从当前显示的数据中查找记录
    const records = window.currentAirdropRecords || [];
    return records.find(record => record.id == id);
}

// 关闭空投编辑模态框
function closeAirdropEditModal() {
    document.getElementById('airdropEditModal').style.display = 'none';
    document.getElementById('airdropEditForm').reset();
}

// 设置模态框关闭事件
document.addEventListener('DOMContentLoaded', function() {
    // 空投编辑模态框关闭事件 - 不通过点击外部关闭，只能通过X号关闭
    // const airdropEditModal = document.getElementById('airdropEditModal');
    // if (airdropEditModal) {
    //     airdropEditModal.addEventListener('click', function(event) {
    //         if (event.target === airdropEditModal) {
    //                 closeAirdropEditModal();
    //         }
    //     });
    // }
});

// 更新空投记录（完整更新）
async function updateAirdropRecord(formData) {
    try {
        const response = await fetch(`/api/airdrop/${formData.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        if (response.ok) {
            showNotification('空投记录更新成功！', 'success');
            closeAirdropEditModal();
            loadAirdropData();
        } else {
            const error = await response.json();
            showNotification(error.error || '更新失败', 'error');
        }
    } catch (error) {
        console.error('更新空投记录失败:', error);
        showNotification('更新失败，请检查网络连接', 'error');
    }
}

// 提交空投编辑表单
async function submitAirdropEditForm() {
    const formData = {
        id: document.getElementById('editAirdropId').value,
        project_name: document.getElementById('editAirdropProject').value,
        project_url: document.getElementById('editAirdropProjectUrl').value,
        project_twitter: document.getElementById('editAirdropProjectTwitter').value,
        participation_type: document.getElementById('editAirdropParticipationType').value,
        wallet_address: document.getElementById('editAirdropWalletAddress').value,
        participation_amount: document.getElementById('editAirdropParticipationAmount').value ? parseFloat(document.getElementById('editAirdropParticipationAmount').value) : 0,
        participation_token: document.getElementById('editAirdropParticipationToken').value,
        participation_amount_usdt: document.getElementById('editAirdropParticipationAmountUsdt').value ? parseFloat(document.getElementById('editAirdropParticipationAmountUsdt').value) : 0,
        participation_date: document.getElementById('editAirdropDate').value,
        expected_airdrop_date: document.getElementById('editAirdropExpectedDate').value || null,
        expected_reward: document.getElementById('editAirdropExpectedReward').value ? parseFloat(document.getElementById('editAirdropExpectedReward').value) : null,
        actual_reward: document.getElementById('editAirdropActualReward').value ? parseFloat(document.getElementById('editAirdropActualReward').value) : null,
        actual_apr: document.getElementById('editAirdropActualApr').value ? parseFloat(document.getElementById('editAirdropActualApr').value) : null,
        status: document.getElementById('editAirdropStatus').value,
        withdrawal_status: document.getElementById('editAirdropWithdrawalStatus').value,
        notes: document.getElementById('editAirdropNotes').value
    };
    
    await updateAirdropRecord(formData);
}

// 删除空投记录
async function deleteAirdropRecord(id) {
    if (!confirm('确定要删除这条记录吗？')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/airdrop/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showNotification('记录删除成功！', 'success');
            loadAirdropData();
        } else {
            const error = await response.json();
            showNotification(error.error || '删除失败', 'error');
        }
    } catch (error) {
        console.error('删除空投记录失败:', error);
        showNotification('删除失败，请检查网络连接', 'error');
    }
}

// ==================== 通用功能 ====================

// 显示通知
function showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // 设置样式
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 600;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    // 根据类型设置背景色
    switch(type) {
        case 'success':
            notification.style.background = 'linear-gradient(45deg, #4facfe, #00f2fe)';
            break;
        case 'error':
            notification.style.background = 'linear-gradient(45deg, #f093fb, #f5576c)';
            break;
        default:
            notification.style.background = 'linear-gradient(45deg, #667eea, #764ba2)';
    }
    
    // 添加到页面
    document.body.appendChild(notification);
    
    // 3秒后自动移除
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// 添加CSS动画
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .no-data {
        text-align: center;
        color: #666;
        font-style: italic;
        padding: 40px;
        background: #f8f9fa;
        border-radius: 10px;
        border: 2px dashed #dee2e6;
    }
`;
document.head.appendChild(style);

// 使用后端Token价格API更新价格
async function autoUpdatePrices() {
    try {
        console.log('🔄 开始获取Token实时价格...');
        
        // 获取当前持仓的Token列表
        const summaryResponse = await fetch('/api/position/summary');
        if (!summaryResponse.ok) {
            throw new Error(`无法获取仓位数据: HTTP ${summaryResponse.status}`);
        }
        
        const summary = await summaryResponse.json();
        const tokenSymbols = summary.map(item => item.token_symbol);
        
        if (tokenSymbols.length === 0) {
            console.log('⚠️ 没有需要更新价格的Token');
            return;
        }
        
        console.log('🔍 准备获取以下Token的价格:', tokenSymbols);
        
        // 使用后端Token价格API获取价格
        const priceMap = await getBackendTokenPrices(tokenSymbols);
        
        // 检查是否有有效的价格数据
        const validPrices = Object.values(priceMap).filter(p => p.current_price > 0);
        const errorPrices = Object.values(priceMap).filter(p => p.error);
        
        console.log('📊 价格获取结果:', {
            total: tokenSymbols.length,
            success: validPrices.length,
            errors: errorPrices.length,
            errors: errorPrices.map(p => p.error)
        });
        
        if (validPrices.length === 0) {
            if (errorPrices.length > 0) {
                const errorMsg = `价格获取失败: ${errorPrices.map(p => p.error).join(', ')}`;
                showNotification(errorMsg, 'error');
            } else {
                showNotification('没有获取到有效的价格数据，请检查网络连接', 'error');
            }
            return;
        }
        
        console.log('🔍 获取到的后端Token价格数据:', priceMap);
        
        // 使用后端价格更新显示
        showNotification(`✅ 价格更新成功！获取到 ${validPrices.length} 个Token的最新价格`, 'success');
        updatePriceUpdateTime();
        
        // 更新前端显示，使用最新价格
        updatePositionDisplayWithPrices(priceMap);
        
    } catch (error) {
        console.error('自动更新价格失败:', error);
        
        // 提供更详细的错误信息
        let errorMessage = '价格更新失败';
        if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
            errorMessage = '网络连接失败，请检查网络设置或稍后重试';
        } else if (error.message) {
            errorMessage = `价格更新失败: ${error.message}`;
        }
        
        showNotification(errorMessage, 'error');
    }
}

// 使用后端Token价格API获取价格
async function getBackendTokenPrices(tokenSymbols) {
    const priceMap = {};
    
    try {
        console.log('🔍 开始从后端获取以下Token的价格:', tokenSymbols);
        
        if (tokenSymbols.length === 0) {
            console.log('⚠️ 没有Token需要获取价格');
            return priceMap;
        }
        
        // 使用后端批量API获取价格
        const response = await fetch('/api/token-price/batch', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ tokens: tokenSymbols })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('🔍 后端Token价格API响应数据:', data);
        
        if (!data.success || !Array.isArray(data.data)) {
            throw new Error('API响应格式错误，期望success和data字段');
        }
        
        // 处理每个Token的价格数据
        data.data.forEach(item => {
            const tokenSymbol = item.token;
            if (tokenSymbols.includes(tokenSymbol)) {
                priceMap[tokenSymbol] = {
                    current_price: parseFloat(item.price_usdt),
                    price_change_24h: parseFloat(item.price_change_24h || 0),
                    volume_24h: parseFloat(item.volume_24h || 0),
                    market_cap: parseFloat(item.market_cap || 0),
                    last_updated: item.last_updated,
                    symbol: tokenSymbol
                };
            }
        });
        
        console.log('✅ 成功获取后端价格数据:', priceMap);
        
    } catch (error) {
        console.error('❌ 获取后端Token价格失败:', error);
        
        // 为每个Token设置错误状态
        tokenSymbols.forEach(symbol => {
            priceMap[symbol] = {
                error: error.message,
                current_price: 0,
                price_change_24h: 0
            };
        });
    }
    
    return priceMap;
}

// 直接使用Binance价格更新前端显示
async function updatePositionDisplayWithPrices(priceMap) {
    try {
        console.log('🔍 开始更新前端显示，使用Binance价格数据:', priceMap);
        
        // 获取当前仓位数据
        const summaryResponse = await fetch('/api/position/summary');
        if (!summaryResponse.ok) {
            throw new Error('无法获取仓位数据');
        }
        
        const summary = await summaryResponse.json();
        console.log('🔍 当前仓位数据:', summary);
        
        // 使用Binance价格更新仓位显示
        const updatedSummary = summary.map(item => {
            const binancePrice = priceMap[item.token_symbol];
            if (binancePrice && binancePrice.current_price > 0) {
                // 使用Binance价格
                const current_price = binancePrice.current_price;
                const price_change_24h = binancePrice.price_change_24h;
                const net_quantity = parseFloat(item.net_quantity || 0);
                const net_amount = parseFloat(item.net_amount || 0);
                
                // 重新计算相关数据
                const current_value = net_quantity * current_price;
                const profit_loss = current_value - net_amount;
                const profit_loss_percentage = net_amount > 0 ? (profit_loss / net_amount) * 100 : 0;
                
                return {
                    ...item,
                    current_price: current_price,
                    price_change_24h: price_change_24h,
                    current_value: current_value,
                    profit_loss: profit_loss,
                    profit_loss_percentage: profit_loss_percentage
                };
            } else {
                // 保持原有数据
                return item;
            }
        });
        
        // 重新计算总仓位占比 - 使用真实价格
        const totalPortfolioValue = updatedSummary.reduce((sum, item) => {
            return sum + (item.current_value || 0);
        }, 0);
        
        // 更新每个Token的占比
        updatedSummary.forEach(item => {
            if (totalPortfolioValue > 0) {
                item.portfolio_percentage = ((item.current_value || 0) / totalPortfolioValue) * 100;
            } else {
                item.portfolio_percentage = 0;
            }
        });
        
        console.log('🔍 重新计算后的占比:', updatedSummary.map(item => ({
            symbol: item.token_symbol,
            current_value: item.current_value,
            portfolio_percentage: item.portfolio_percentage
        })));
        
        console.log('🔍 更新后的仓位数据:', updatedSummary);
        
        // 按照总仓位占比倒序排列
        const sortedUpdatedSummary = updatedSummary.sort((a, b) => 
            parseFloat(b.portfolio_percentage || 0) - parseFloat(a.portfolio_percentage || 0)
        );
        
        console.log('📊 排序后的更新数据:', sortedUpdatedSummary.map(item => ({
            symbol: item.token_symbol,
            percentage: item.portfolio_percentage,
            current_value: item.current_value
        })));
        
        // 更新显示
        displayPositionSummary(sortedUpdatedSummary);
        updatePositionChart(sortedUpdatedSummary);
        
        console.log('✅ 前端显示更新完成');
        
    } catch (error) {
        console.error('❌ 更新前端显示失败:', error);
        showNotification('更新显示失败，请刷新页面', 'error');
    }
}

// 更新价格更新时间显示
function updatePriceUpdateTime() {
    const now = new Date();
    const lastUpdateElement = document.getElementById('lastPriceUpdate');
    const nextUpdateElement = document.getElementById('nextPriceUpdate');
    
    if (lastUpdateElement) {
        lastUpdateElement.textContent = now.toLocaleString('zh-CN');
    }
    
    if (nextUpdateElement) {
        const nextUpdate = new Date(now.getTime() + 60 * 1000); // 1分钟后
        nextUpdateElement.textContent = nextUpdate.toLocaleString('zh-CN');
    }
}

// 启动自动价格更新定时器
function startAutoPriceUpdate() {
    console.log('🚀 启动自动价格更新定时器，每分钟更新一次...');
    
    // 每分钟更新一次价格
    setInterval(async () => {
        try {
            console.log('🔄 自动更新价格...');
            await autoUpdatePrices();
        } catch (error) {
            console.error('自动价格更新失败:', error);
        }
    }, 60 * 1000); // 60秒
    
    console.log('✅ 自动价格更新定时器已启动');
}

// 测试后端Token价格API连接
async function testBackendTokenPriceAPI() {
    try {
        console.log('🔍 开始测试后端Token价格API连接...');
        
        // 测试服务状态
        const statusResponse = await fetch('/api/token-price/status/health');
        if (!statusResponse.ok) {
            console.warn('⚠️ 后端Token价格API状态接口异常:', statusResponse.status);
            return false;
        }
        
        const statusData = await statusResponse.json();
        console.log('✅ 后端Token价格API状态:', statusData);
        
        // 测试获取单个Token价格
        const priceResponse = await fetch('/api/token-price/BTC');
        if (!priceResponse.ok) {
            console.warn('⚠️ 后端Token价格API价格接口异常:', priceResponse.status);
            return false;
        }
        
        const priceData = await priceResponse.json();
        console.log('✅ 后端Token价格API价格接口正常, BTC数据:', priceData);
        
        // 验证关键字段
        if (priceData.success && priceData.data && priceData.data.price_usdt) {
            console.log('✅ 价格数据字段验证通过');
            return true;
        } else {
            console.warn('⚠️ 价格数据字段缺失:', priceData);
            return false;
        }
        
    } catch (error) {
        console.error('❌ 后端Token价格API连接测试失败:', error);
        return false;
    }
}

// 测试单个Token价格获取（使用后端API）
async function testSingleTokenPrice(symbol = 'BTC') {
    try {
        console.log(`🔍 测试获取 ${symbol} 价格...`);
        
        const response = await fetch(`/api/token-price/${symbol}`);
        
        if (response.ok) {
            const data = await response.json();
            console.log(`✅ ${symbol} 价格数据:`, data);
            
            if (data.success && data.data) {
                // 解析关键字段
                const currentPrice = parseFloat(data.data.price_usdt);
                const priceChange24h = parseFloat(data.data.price_change_24h || 0);
                
                console.log(`📊 解析结果: 当前价格=${currentPrice}, 24h变化=${priceChange24h}%`);
                
                return {
                    success: true,
                    data: data.data,
                    parsed: {
                        current_price: currentPrice,
                        price_change_24h: priceChange24h
                    }
                };
            } else {
                console.warn(`⚠️ ${symbol} 价格数据格式错误:`, data);
                return {
                    success: false,
                    error: '数据格式错误'
                };
            }
        } else {
            const errorText = await response.text();
            console.error(`❌ 获取 ${symbol} 价格失败: HTTP ${response.status}, 错误: ${errorText}`);
            return {
                success: false,
                error: `HTTP ${response.status}: ${errorText}`
            };
        }
        
    } catch (error) {
        console.error(`❌ 测试 ${symbol} 价格获取异常:`, error);
        return {
            success: false,
            error: error.message
        };
    }
}



// 点击模态框外部关闭
window.onclick = function(event) {
    const positionModal = document.getElementById('positionModal');
    const positionEditModal = document.getElementById('positionEditModal');
    const importModal = document.getElementById('importModal');
    const defiModal = document.getElementById('defiModal');
    const airdropModal = document.getElementById('airdropModal');
    const priceModal = document.getElementById('priceModal');
    const scoreModal = document.getElementById('scoreModal');
    
    if (event.target === positionModal) {
        closePositionModal();
    }
    if (event.target === positionEditModal) {
        closePositionEditModal();
    }
    if (event.target === importModal) {
        closeImportModal();
    }
    // DEFI模态框不通过点击外部关闭，只能通过X号关闭
    // if (event.target === defiModal) {
    //     closeDefiModal();
    // }
    // 空投模态框不通过点击外部关闭，只能通过X号关闭
    // if (event.target === airdropModal) {
    //     closeAirdropModal();
    // }
    if (event.target === scoreModal) {
        closeScoreModal();
    }

}

// 打分功能相关函数

// 显示打分模态框
async function showScoreModal(recordId) {
    try {
        // 获取操作记录详情
        const response = await fetch(`/api/position/${recordId}`);
        if (!response.ok) {
            throw new Error('获取记录详情失败');
        }
        
        const record = await response.json();
        
        // 填充操作信息显示
        const operationInfo = document.getElementById('operationInfo');
        operationInfo.innerHTML = `
            <div class="info-row">
                <span class="info-label">操作类型:</span>
                <span class="info-value">${record.operation_type}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Token:</span>
                <span class="info-value">${record.token_symbol} (${record.token_name})</span>
            </div>
            <div class="info-row">
                <span class="info-label">数量:</span>
                <span class="info-value">${parseFloat(record.quantity || 0).toFixed(2)}</span>
            </div>
            <div class="info-row">
                <span class="info-label">价格:</span>
                <span class="info-value">${parseFloat(record.price || 0).toFixed(2)} USDT</span>
            </div>
            <div class="info-row">
                <span class="info-label">总金额:</span>
                <span class="info-value">${parseFloat(record.total_amount || 0).toFixed(2)} USDT</span>
            </div>
            <div class="info-row">
                <span class="info-label">操作原因:</span>
                <span class="info-value">${record.reason || '无'}</span>
            </div>
            <div class="info-row">
                <span class="info-label">操作时间:</span>
                <span class="info-value">${new Date(record.operation_date).toLocaleString('zh-CN')}</span>
            </div>
        `;
        
        // 设置记录ID
        document.getElementById('scoreRecordId').value = recordId;
        
        // 如果已有评分，填充现有数据
        if (record.score !== null && record.score !== undefined) {
            document.getElementById('score').value = record.score;
            document.getElementById('scoreValue').textContent = record.score;
        } else {
            document.getElementById('score').value = 50;
            document.getElementById('scoreValue').textContent = '50';
        }
        
        if (record.review) {
            document.getElementById('review').value = record.review;
        } else {
            document.getElementById('review').value = '';
        }
        
        // 显示模态框
        document.getElementById('scoreModal').style.display = 'block';
        
        // 设置评分滑块事件
        setupScoreSlider();
        
    } catch (error) {
        console.error('显示打分模态框失败:', error);
        showNotification('获取记录详情失败', 'error');
    }
}

// 关闭打分模态框
function closeScoreModal() {
    document.getElementById('scoreModal').style.display = 'none';
}

// 设置评分滑块事件
function setupScoreSlider() {
    const scoreSlider = document.getElementById('score');
    const scoreValue = document.getElementById('scoreValue');
    
    scoreSlider.addEventListener('input', function() {
        scoreValue.textContent = this.value;
    });
}

// 显示复盘详情
function showReviewDetail(review) {
    alert(`复盘详情:\n\n${review}`);
}

// 设置打分表单提交事件
document.addEventListener('DOMContentLoaded', function() {
    const scoreForm = document.getElementById('scoreForm');
    if (scoreForm) {
        scoreForm.addEventListener('submit', handleScoreSubmit);
    }
});

// 处理打分表单提交
async function handleScoreSubmit(event) {
    event.preventDefault();
    
    const recordId = document.getElementById('scoreRecordId').value;
    const score = parseInt(document.getElementById('score').value);
    const review = document.getElementById('review').value.trim();
    
    if (!review) {
        showNotification('请填写复盘感受和经验总结', 'error');
        return;
    }
    
    try {
        const response = await fetch(`/api/position/${recordId}/score`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ score, review })
        });
        
        if (response.ok) {
            const result = await response.json();
            showNotification('评分和复盘信息保存成功', 'success');
            closeScoreModal();
            
            // 重新加载数据以显示更新后的评分
            loadPositionData();
        } else {
            const error = await response.json();
            throw new Error(error.error || '保存失败');
        }
    } catch (error) {
        console.error('保存评分失败:', error);
        showNotification(`保存评分失败: ${error.message}`, 'error');
    }
}

// 仓位健康值计算函数
function calculatePortfolioHealth(summary) {
    if (!summary || summary.length === 0) {
        return { score: 0, details: {} };
    }
    
    let totalScore = 100;
    const details = {};
    
    // 1. 仓位集中度 (20分)
    let concentrationScore = 20;
    const totalValue = summary.reduce((sum, item) => sum + parseFloat(item.current_value || 0), 0);
    
    summary.forEach(item => {
        const percentage = (parseFloat(item.current_value || 0) / totalValue) * 100;
        if (percentage > 30) {
            const deduction = Math.min(percentage - 30, 20); // 最多扣20分
            concentrationScore -= deduction;
        }
    });
    concentrationScore = Math.max(0, concentrationScore);
    totalScore = totalScore - 20 + concentrationScore;
    details.concentration = { score: concentrationScore, max: 20 };
    
    // 2. 波动性 (30分) - 简化计算，假设BTC/ETH为低波动，其他为高波动
    let volatilityScore = 30;
    const highVolatilityTokens = ['BTC', 'ETH'];
    let highVolatilityValue = 0;
    
    summary.forEach(item => {
        if (!highVolatilityTokens.includes(item.token_symbol)) {
            highVolatilityValue += parseFloat(item.current_value || 0);
        }
    });
    
    const highVolatilityPercentage = (highVolatilityValue / totalValue) * 100;
    volatilityScore = Math.max(0, 20 - (highVolatilityPercentage * 0.2));
    totalScore = totalScore - 20 + volatilityScore;
    details.volatility = { score: volatilityScore, max: 20 };
    
    // 3. 市值规模 (20分) - 简化计算，假设主流币为大盘，其他为小盘
    let marketCapScore = 20;
    const largeCapTokens = ['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'SOL', 'ADA', 'XRP'];
    let smallCapValue = 0;
    
    summary.forEach(item => {
        if (!largeCapTokens.includes(item.token_symbol)) {
            smallCapValue += parseFloat(item.current_value || 0);
        }
    });
    
    const smallCapPercentage = (smallCapValue / totalValue) * 100;
    marketCapScore = Math.max(0, 20 - (smallCapPercentage * 0.2));
    totalScore = totalScore - 20 + marketCapScore;
    details.marketCap = { score: marketCapScore, max: 20 };
    
    // 4. 稳定币比例 (20分)
    let stablecoinScore = 0;
    const stablecoins = ['USDT', 'USDC', 'DAI', 'BUSD', 'TUSD'];
    let stablecoinValue = 0;
    
    summary.forEach(item => {
        if (stablecoins.includes(item.token_symbol)) {
            stablecoinValue += parseFloat(item.current_value || 0);
        }
    });
    
    const stablecoinPercentage = (stablecoinValue / totalValue) * 100;
    stablecoinScore = Math.min(20, stablecoinPercentage * 0.2);
    totalScore = totalScore - 20 + stablecoinScore;
    details.stablecoin = { score: stablecoinScore, max: 20 };
    
    // 5. 相关性 (10分) - 简化计算，假设不同币种相关性较低
    let correlationScore = 10;
    if (summary.length >= 3) {
        correlationScore = 10; // 多币种分散投资
    } else if (summary.length === 2) {
        correlationScore = 7; // 双币种
    } else {
        correlationScore = 3; // 单币种
    }
    totalScore = totalScore - 10 + correlationScore;
    details.correlation = { score: correlationScore, max: 10 };
    
    return {
        score: Math.round(totalScore),
        details: details
    };
}

// 更新仓位概览信息
function updatePositionOverview(summary) {
    if (!summary || summary.length === 0) {
        document.getElementById('totalPortfolioValue').textContent = '--';
        document.getElementById('tokenCount').textContent = '--';
        document.getElementById('portfolioHealth').textContent = '--';
        return;
    }
    
    // 计算总仓位价值
    const totalValue = summary.reduce((sum, item) => sum + parseFloat(item.current_value || 0), 0);
    document.getElementById('totalPortfolioValue').textContent = formatCurrency(totalValue);
    
    // 计算Token种类数量
    const tokenCount = summary.filter(item => parseFloat(item.net_quantity || 0) > 0).length;
    document.getElementById('tokenCount').textContent = tokenCount;
    
    // 计算并显示仓位健康值
    const health = calculatePortfolioHealth(summary);
    const healthElement = document.getElementById('portfolioHealth');
    
    let healthClass = 'health-poor';
    if (health.score >= 80) {
        healthClass = 'health-excellent';
    } else if (health.score >= 60) {
        healthClass = 'health-good';
    } else if (health.score >= 40) {
        healthClass = 'health-average';
    }
    
    healthElement.innerHTML = `
        <span class="health-score ${healthClass}">${health.score}分</span>
        <span>(${getHealthDescription(health.score)})</span>
    `;
    
    console.log('📊 仓位健康值详情:', health);
}

// 获取健康值描述
function getHealthDescription(score) {
    if (score >= 80) return '优秀';
    if (score >= 60) return '良好';
    if (score >= 40) return '一般';
    return '需改善';
}

// ==================== 通用工具函数 ====================

// 数值格式化函数：保留2位小数，如果小数位为0则只显示整数
function formatNumber(value) {
    if (value === null || value === undefined || isNaN(value)) {
        return '0';
    }
    
    const num = parseFloat(value);
    if (isNaN(num)) {
        return '0';
    }
    
    // 保留2位小数
    const formatted = num.toFixed(2);
    
    // 如果小数位为0，则只显示整数
    if (formatted.endsWith('.00')) {
        return formatted.slice(0, -3);
    }
    
    return formatted;
}

// 百分比格式化函数
function formatPercentage(value) {
    if (value === null || value === undefined || isNaN(value)) {
        return '0%';
    }
    
    const num = parseFloat(value);
    if (isNaN(num)) {
        return '0%';
    }
    
    // 保留2位小数
    const formatted = num.toFixed(2);
    
    // 如果小数位为0，则只显示整数
    if (formatted.endsWith('.00')) {
        return formatted.slice(0, -3) + '%';
    }
    
    return formatted + '%';
}

// 货币格式化函数（USDT）
function formatCurrency(value) {
    if (value === null || value === undefined || isNaN(value)) {
        return '0 USDT';
    }
    
    const num = parseFloat(value);
    if (isNaN(num)) {
        return '0 USDT';
    }
    
    // 保留2位小数
    const formatted = num.toFixed(2);
    
    // 如果小数位为0，则只显示整数
    if (formatted.endsWith('.00')) {
        return formatted.slice(0, -3) + ' USDT';
    }
    
    return formatted + ' USDT';
}

// ==================== 表格排序功能 ====================

// 表格排序函数
function sortTable(field) {
    const tableBody = document.getElementById('positionTableBody');
    const rows = Array.from(tableBody.querySelectorAll('tr'));
    
    // 如果点击的是同一列，则切换排序方向
    if (currentSortField === field) {
        currentSortDirection = currentSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        // 如果点击的是新列，则重置为升序
        currentSortField = field;
        currentSortDirection = 'asc';
    }
    
    // 更新排序按钮的图标
    updateSortButtons(field);
    
    // 对数据进行排序
    const sortedRows = rows.sort((a, b) => {
        const aValue = getCellValue(a, field);
        const bValue = getCellValue(b, field);
        
        if (currentSortDirection === 'asc') {
            return aValue - bValue;
        } else {
            return bValue - aValue;
        }
    });
    
    // 重新渲染表格
    tableBody.innerHTML = '';
    sortedRows.forEach(row => tableBody.appendChild(row));
    
    console.log(`📊 表格已按 ${field} 字段排序，方向：${currentSortDirection}`);
}

// 获取单元格数值
function getCellValue(row, field) {
    let cellIndex;
    
    switch (field) {
        case 'portfolio_percentage':
            cellIndex = 5; // 仓位占比列
            break;
        case 'price_change_24h':
            cellIndex = 6; // 24h涨跌幅列
            break;
        case 'profit_loss':
            cellIndex = 7; // 盈利金额列
            break;
        case 'profit_loss_percentage':
            cellIndex = 8; // 盈利百分比列
            break;
        default:
            return 0;
    }
    
    const cell = row.cells[cellIndex];
    if (!cell) return 0;
    
    // 提取数值，去除符号和单位
    let text = cell.textContent.trim();
    
    // 移除+/-符号和%符号
    text = text.replace(/[+\-%]/g, '');
    
    // 移除USDT单位
    text = text.replace(/\s*USDT/g, '');
    
    // 处理特殊情况：如果文本为空或只包含空格
    if (!text || text.trim() === '') {
        return 0;
    }
    
    const value = parseFloat(text);
    return isNaN(value) ? 0 : value;
}

// 更新排序按钮图标
function updateSortButtons(activeField) {
    // 重置所有排序按钮
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.innerHTML = '<i class="bi bi-arrow-down-up"></i>';
        btn.classList.remove('sort-asc', 'sort-desc');
    });
    
    // 更新当前排序列的按钮
    const activeButton = document.querySelector(`[data-sort="${activeField}"] .sort-btn`);
    if (activeButton) {
        if (currentSortDirection === 'asc') {
            activeButton.innerHTML = '<i class="bi bi-arrow-up"></i>';
            activeButton.classList.add('sort-asc');
        } else {
            activeButton.innerHTML = '<i class="bi bi-arrow-down"></i>';
            activeButton.classList.add('sort-desc');
        }
    }
}

// 移除多余的switchTab函数，使用原有的标签页切换逻辑

// DEFI汇总重试功能
function retryDefiSummary() {
    console.log('🔄 重试DEFI汇总数据加载...');
    if (window.defiSummary) {
        displayDefiSummaryTable(window.defiSummary);
    } else {
        console.error('❌ 没有可用的DEFI汇总数据');
    }
}

// ==================== DEFI表格排序功能 ====================

// DEFI表格排序函数
function sortDefiTable(field) {
    const tableBody = document.getElementById('defiSummaryTableBody');
    const rows = Array.from(tableBody.querySelectorAll('tr'));
    
    // 如果点击的是同一列，则切换排序方向
    if (currentDefiSortField === field) {
        currentDefiSortDirection = currentDefiSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        // 如果点击的是新列，则重置为升序
        currentDefiSortField = field;
        currentDefiSortDirection = 'asc';
    }
    
    // 更新排序按钮的图标
    updateDefiSortButtons(field);
    
    // 对数据进行排序
    const sortedRows = rows.sort((a, b) => {
        const aValue = getDefiCellValue(a, field);
        const bValue = getDefiCellValue(b, field);
        
        if (currentDefiSortDirection === 'asc') {
            return aValue - bValue;
        } else {
            return bValue - aValue;
        }
    });
    
    // 重新渲染表格
    tableBody.innerHTML = '';
    sortedRows.forEach(row => tableBody.appendChild(row));
    
    console.log(`📊 DEFI表格已按 ${field} 字段排序，方向：${currentDefiSortDirection}`);
}

// 获取DEFI表格单元格数值
function getDefiCellValue(row, field) {
    let cellIndex;
    
    switch (field) {
        case 'usdt_value':
            cellIndex = 3; // 价值USDT列
            break;
        case 'apr':
            cellIndex = 4; // APR列
            break;
        case 'daily_earnings':
            cellIndex = 5; // 每日收益列
            break;
        case 'exit_time':
            cellIndex = 6; // 退出时间列
            break;
        default:
            return 0;
    }
    
    const cell = row.cells[cellIndex];
    if (!cell) return 0;
    
    // 提取数值，去除符号和单位
    let text = cell.textContent.trim();
    
    // 移除$符号
    text = text.replace(/\$/g, '');
    
    // 移除USDT单位
    text = text.replace(/\s*USDT/g, '');
    
    // 移除%符号
    text = text.replace(/%/g, '');
    
    // 移除"天"单位
    text = text.replace(/\s*天/g, '');
    
    // 处理特殊情况：如果文本为空或只包含空格或为"--"
    if (!text || text.trim() === '' || text === '--') {
        return 0;
    }
    
    const value = parseFloat(text);
    return isNaN(value) ? 0 : value;
}

// 更新DEFI表格排序按钮图标
function updateDefiSortButtons(activeField) {
    // 重置所有DEFI排序按钮
    document.querySelectorAll('#defiSummaryTable .sort-btn').forEach(btn => {
        btn.innerHTML = '<i class="bi bi-arrow-down-up"></i>';
        btn.classList.remove('sort-asc', 'sort-desc');
    });
    
    // 更新当前排序列的按钮
    const activeButton = document.querySelector(`#defiSummaryTable [data-sort="${activeField}"] .sort-btn`);
    if (activeButton) {
        if (currentDefiSortDirection === 'asc') {
            activeButton.innerHTML = '<i class="bi bi-arrow-up"></i>';
            activeButton.classList.add('sort-asc');
        } else {
            activeButton.innerHTML = '<i class="bi bi-arrow-down"></i>';
            activeButton.classList.add('sort-desc');
        }
    }
}