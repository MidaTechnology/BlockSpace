const axios = require('axios');

class PriceService {
    constructor() {
        this.baseUrl = 'https://api.coingecko.com/api/v3';
        this.cache = new Map();
        this.cacheTimeout = 5 * 60 * 1000; // 5分钟缓存
    }

    // 获取Token的当前价格
    async getCurrentPrice(tokenSymbol) {
        try {
            // 检查缓存
            const cacheKey = tokenSymbol.toUpperCase();
            const cached = this.cache.get(cacheKey);
            if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.data;
            }

            // 获取价格数据
            const response = await axios.get(`${this.baseUrl}/simple/price`, {
                params: {
                    ids: this.getCoinGeckoId(tokenSymbol),
                    vs_currencies: 'usd',
                    include_24hr_change: true
                },
                timeout: 10000
            });

            const coinId = this.getCoinGeckoId(tokenSymbol);
            if (response.data && response.data[coinId]) {
                const priceData = response.data[coinId];
                const result = {
                    current_price: priceData.usd,
                    price_change_24h: priceData.usd_24h_change || 0,
                    last_updated: new Date().toISOString()
                };

                // 更新缓存
                this.cache.set(cacheKey, {
                    data: result,
                    timestamp: Date.now()
                });

                return result;
            }

            throw new Error(`无法获取 ${tokenSymbol} 的价格数据`);
        } catch (error) {
            console.error(`获取 ${tokenSymbol} 价格失败:`, error.message);
            // 返回默认值
            return {
                current_price: 0,
                price_change_24h: 0,
                last_updated: new Date().toISOString()
            };
        }
    }

    // 批量获取价格
    async getBatchPrices(tokenSymbols) {
        try {
            const uniqueSymbols = [...new Set(tokenSymbols)];
            const coinIds = uniqueSymbols.map(symbol => this.getCoinGeckoId(symbol)).filter(Boolean);
            
            if (coinIds.length === 0) {
                return {};
            }

            const response = await axios.get(`${this.baseUrl}/simple/price`, {
                params: {
                    ids: coinIds.join(','),
                    vs_currencies: 'usd',
                    include_24hr_change: true
                },
                timeout: 15000
            });

            const results = {};
            uniqueSymbols.forEach(symbol => {
                const coinId = this.getCoinGeckoId(symbol);
                if (response.data && response.data[coinId]) {
                    const priceData = response.data[coinId];
                    results[symbol.toUpperCase()] = {
                        current_price: priceData.usd,
                        price_change_24h: priceData.usd_24h_change || 0,
                        last_updated: new Date().toISOString()
                    };
                } else {
                    results[symbol.toUpperCase()] = {
                        current_price: 0,
                        price_change_24h: 0,
                        last_updated: new Date().toISOString()
                    };
                }
            });

            return results;
        } catch (error) {
            console.error('批量获取价格失败:', error.message);
            return {};
        }
    }

    // 获取CoinGecko的币种ID
    getCoinGeckoId(tokenSymbol) {
        const symbolMap = {
            'BTC': 'bitcoin',
            'ETH': 'ethereum',
            'SOL': 'solana',
            'ADA': 'cardano',
            'DOT': 'polkadot',
            'LINK': 'chainlink',
            'UNI': 'uniswap',
            'AAVE': 'aave',
            'MATIC': 'matic-network',
            'BNB': 'binancecoin',
            'XRP': 'ripple',
            'LTC': 'litecoin',
            'BCH': 'bitcoin-cash',
            'XLM': 'stellar',
            'XMR': 'monero',
            'DASH': 'dash',
            'ZEC': 'zcash',
            'XTZ': 'tezos',
            'ATOM': 'cosmos',
            'FIL': 'filecoin',
            'AVAX': 'avalanche-2',
            'NEAR': 'near',
            'ALGO': 'algorand',
            'VET': 'vechain',
            'ICP': 'internet-computer',
            'FTM': 'fantom',
            'THETA': 'theta-token',
            'EOS': 'eos',
            'TRX': 'tron',
            'IOTA': 'iota',
            'NEO': 'neo'
        };

        return symbolMap[tokenSymbol.toUpperCase()] || null;
    }

    // 清除缓存
    clearCache() {
        this.cache.clear();
    }

    // 获取缓存状态
    getCacheStatus() {
        const now = Date.now();
        const status = {};
        
        for (const [key, value] of this.cache.entries()) {
            const age = now - value.timestamp;
            status[key] = {
                age: Math.round(age / 1000), // 秒
                valid: age < this.cacheTimeout
            };
        }
        
        return status;
    }
}

module.exports = new PriceService();
