const mysql = require('mysql2/promise');
const axios = require('axios');

class TokenPriceService {
    constructor() {
        this.pool = null;
        this.updateInterval = null;
        this.isRunning = false;
        this.binanceBaseUrl = 'https://api.binance.com/api/v3';
        
        // 支持的Token列表（需要转换为Binance交易对格式）
        this.supportedTokens = [
            'BTC', 'ETH', 'BNB', 'ADA', 'XRP', 'SOL', 'SUI', 'DOGE', 'MATIC',
            'LINK', 'UNI', 'LTC','ATOM', 'AAVE', 'CRV'
        ];
        
        // Token到Binance交易对的映射
        this.tokenToSymbol = {
            'BTC': 'BTCUSDT', 'ETH': 'ETHUSDT', 'BNB': 'BNBUSDT', 'ADA': 'ADAUSDT',
            'XRP': 'XRPUSDT', 'SOL': 'SOLUSDT', 'SUI': 'SUIUSDT', 'DOGE': 'DOGEUSDT',
            'MATIC': 'MATICUSDT', 'LINK': 'LINKUSDT', 'UNI': 'UNIUSDT',
            'LTC': 'LTCUSDT', 'ATOM': 'ATOMUSDT', 'AAVE': 'AAVEUSDT', 'CRV': 'CRVUSDT'
        };
    }

    // 初始化数据库连接
    async initDatabase() {
        try {
            this.pool = mysql.createPool({
                host: process.env.DB_HOST || 'localhost',
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'hackathon',
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0
            });
            
            console.log('✅ Token价格服务数据库连接初始化成功');
            return true;
        } catch (error) {
            console.error('❌ Token价格服务数据库连接失败:', error);
            return false;
        }
    }

    // 从Binance获取Token价格
    async fetchTokenPrices() {
        try {
            // 构建请求的symbols数组
            const symbols = Object.values(this.tokenToSymbol);
            
            // 分批请求（Binance API限制每次最多100个symbol）
            const batchSize = 100;
            const batches = [];
            for (let i = 0; i < symbols.length; i += batchSize) {
                batches.push(symbols.slice(i, i + batchSize));
            }

            let allPrices = [];
            
            for (const batch of batches) {
                const symbolsParam = JSON.stringify(batch);
                const response = await axios.get(`${this.binanceBaseUrl}/ticker/24hr`, {
                    params: { symbols: symbolsParam },
                    timeout: 10000
                });
                
                if (response.data && Array.isArray(response.data)) {
                    allPrices = allPrices.concat(response.data);
                }
                
                // 避免请求过于频繁
                if (batches.length > 1) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            }

            return allPrices;
        } catch (error) {
            console.error('❌ 获取Binance价格失败:', error.message);
            return [];
        }
    }

    // 更新数据库中的Token价格
    async updateTokenPrices(prices) {
        if (!this.pool || prices.length === 0) return;

        try {
            const connection = await this.pool.getConnection();
            
            for (const price of prices) {
                const symbol = price.symbol;
                const token = this.getTokenFromSymbol(symbol);
                
                if (!token) continue;

                const priceUsdt = parseFloat(price.lastPrice);
                const priceChange24h = parseFloat(price.priceChangePercent);
                const priceChange24hUsdt = parseFloat(price.priceChange);
                const volume24h = parseFloat(price.volume);
                const marketCap = parseFloat(price.quoteVolume);

                // 更新或插入Token价格
                await connection.execute(`
                    INSERT INTO token_market (token, price_usdt, price_change_24h, price_change_24h_usdt, volume_24h, market_cap, last_updated)
                    VALUES (?, ?, ?, ?, ?, ?, NOW())
                    ON DUPLICATE KEY UPDATE
                        price_usdt = VALUES(price_usdt),
                        price_change_24h = VALUES(price_change_24h),
                        price_change_24h_usdt = VALUES(price_change_24h_usdt),
                        volume_24h = VALUES(volume_24h),
                        market_cap = VALUES(market_cap),
                        last_updated = NOW()
                `, [token, priceUsdt, priceChange24h, priceChange24hUsdt, volume24h, marketCap]);
            }

            connection.release();
            console.log(`✅ 更新了 ${prices.length} 个Token的价格信息`);
            
        } catch (error) {
            console.error('❌ 更新Token价格失败:', error);
        }
    }

    // 从Binance symbol获取Token名称
    getTokenFromSymbol(symbol) {
        for (const [token, binanceSymbol] of Object.entries(this.tokenToSymbol)) {
            if (binanceSymbol === symbol) {
                return token;
            }
        }
        return null;
    }

    // 同步新的Token到行情表
    async syncNewTokens() {
        if (!this.pool) return;

        try {
            const connection = await this.pool.getConnection();
            
            // 从仓位操作表获取Token（如果表存在）
            let positionTokens = [];
            try {
                const [result] = await connection.execute(`
                    SELECT DISTINCT token_symbol as token FROM position_operations
                    WHERE token_symbol IS NOT NULL AND token_symbol != ''
                `);
                positionTokens = result;
            } catch (error) {
                console.log('⚠️ position_operations表不存在，跳过');
            }

            // 从DEFI操作表获取Token（如果表存在）
            let defiTokens = [];
            try {
                const [result] = await connection.execute(`
                    SELECT DISTINCT token FROM defi_operations
                    WHERE token IS NOT NULL AND token != ''
                `);
                defiTokens = result;
            } catch (error) {
                console.log('⚠️ defi_operations表不存在，跳过');
            }

            // 从空投参与表获取Token（如果表存在）
            let airdropTokens = [];
            try {
                const [result] = await connection.execute(`
                    SELECT DISTINCT participation_token as token FROM airdrop_participations
                    WHERE participation_token IS NOT NULL AND participation_token != ''
                `);
                airdropTokens = result;
            } catch (error) {
                console.log('⚠️ airdrop_participations表不存在，跳过');
            }

            // 合并所有Token
            const allTokens = new Set();
            [...positionTokens, ...defiTokens, ...airdropTokens].forEach(item => {
                if (item.token) allTokens.add(item.token.toUpperCase());
            });

            // 检查哪些Token还没有在行情表中
            for (const token of allTokens) {
                const [existing] = await connection.execute(`
                    SELECT id FROM token_market WHERE token = ?
                `, [token]);

                if (existing.length === 0) {
                    // 插入新Token（使用默认价格）
                    await connection.execute(`
                        INSERT INTO token_market (token, price_usdt, price_change_24h, price_change_24h_usdt, volume_24h, market_cap)
                        VALUES (?, 1.00000000, 0.0000, 0.00000000, 0.00, 0.00)
                    `, [token]);
                    
                    console.log(`🆕 新增Token到行情表: ${token}`);
                }
            }

            connection.release();
            console.log('✅ Token同步完成');
            
        } catch (error) {
            console.error('❌ Token同步失败:', error);
        }
    }

    // 启动价格同步服务
    async start() {
        if (this.isRunning) {
            console.log('⚠️ Token价格服务已在运行中');
            return;
        }

        try {
            // 初始化数据库
            const dbReady = await this.initDatabase();
            if (!dbReady) {
                throw new Error('数据库连接失败');
            }

            // 同步新Token
            await this.syncNewTokens();

            // 立即执行一次价格更新
            await this.updatePrices();

            // 设置定时器，每分钟更新一次
            this.updateInterval = setInterval(async () => {
                await this.updatePrices();
            }, 60000); // 60秒

            this.isRunning = true;
            console.log('🚀 Token价格同步服务启动成功，每分钟更新一次');

        } catch (error) {
            console.error('❌ Token价格服务启动失败:', error);
            this.isRunning = false;
        }
    }

    // 停止价格同步服务
    stop() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        
        if (this.pool) {
            this.pool.end();
            this.pool = null;
        }
        
        this.isRunning = false;
        console.log('🛑 Token价格同步服务已停止');
    }

    // 更新价格的主方法
    async updatePrices() {
        try {
            console.log('🔄 开始更新Token价格...');
            
            // 获取价格
            const prices = await this.fetchTokenPrices();
            
            if (prices.length > 0) {
                // 更新数据库
                await this.updateTokenPrices(prices);
                
                // 同步新Token
                await this.syncNewTokens();
                
                console.log(`✅ 价格更新完成，处理了 ${prices.length} 个Token`);
            } else {
                console.log('⚠️ 未获取到价格数据');
            }
            
        } catch (error) {
            console.error('❌ 价格更新失败:', error);
        }
    }

    // 获取Token价格（供API使用）
    async getTokenPrice(token) {
        if (!this.pool) return null;

        try {
            const [rows] = await this.pool.execute(`
                SELECT token, price_usdt, price_change_24h, price_change_24h_usdt, 
                       volume_24h, market_cap, last_updated
                FROM token_market 
                WHERE token = ?
            `, [token.toUpperCase()]);

            console.log(rows);
            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            console.error('❌ 获取Token价格失败:', error);
            return null;
        }
    }

    // 批量获取Token价格（供API使用）
    async getBatchTokenPrices(tokens) {
        if (!this.pool || !Array.isArray(tokens)) return [];

        try {
            const placeholders = tokens.map(() => '?').join(',');
            const [rows] = await this.pool.execute(`
                SELECT token, price_usdt, price_change_24h, price_change_24h_usdt, 
                       volume_24h, market_cap, last_updated
                FROM token_market 
                WHERE token IN (${placeholders})
            `, tokens.map(t => t.toUpperCase()));

            return rows;
        } catch (error) {
            console.error('❌ 批量获取Token价格失败:', error);
            return [];
        }
    }

    // 获取所有Token价格（供API使用）
    async getAllTokenPrices() {
        if (!this.pool) return [];

        try {
            const [rows] = await this.pool.execute(`
                SELECT token, price_usdt, price_change_24h, price_change_24h_usdt, 
                       volume_24h, market_cap, last_updated
                FROM token_market 
                ORDER BY token
            `);

            return rows;
        } catch (error) {
            console.error('❌ 获取所有Token价格失败:', error);
            return [];
        }
    }
}

module.exports = TokenPriceService;
