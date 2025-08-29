// 简化的测试价格服务
class TestPriceService {
    constructor() {
        this.mockPrices = {
            'BTC': { current_price: 125000, price_change_24h: 2.5 },
            'ETH': { current_price: 3800, price_change_24h: -1.2 },
            'SOL': { current_price: 180, price_change_24h: 8.5 },
            'ADA': { current_price: 0.45, price_change_24h: 1.8 },
            'DOT': { current_price: 7.2, price_change_24h: -0.5 },
            'LINK': { current_price: 15.8, price_change_24h: 3.2 },
            'UNI': { current_price: 8.5, price_change_24h: 1.1 },
            'AAVE': { current_price: 120, price_change_24h: -2.1 },
            'MATIC': { current_price: 0.85, price_change_24h: 4.2 },
            'BNB': { current_price: 320, price_change_24h: 0.8 }
        };
    }

    // 获取单个Token价格
    async getCurrentPrice(tokenSymbol) {
        const symbol = tokenSymbol.toUpperCase();
        const priceData = this.mockPrices[symbol];
        
        if (priceData) {
            return {
                current_price: priceData.current_price,
                price_change_24h: priceData.price_change_24h,
                last_updated: new Date().toISOString()
            };
        }
        
        return {
            current_price: 0,
            price_change_24h: 0,
            last_updated: new Date().toISOString()
        };
    }

    // 批量获取价格
    async getBatchPrices(tokenSymbols) {
        const results = {};
        
        tokenSymbols.forEach(symbol => {
            const symbolUpper = symbol.toUpperCase();
            const priceData = this.mockPrices[symbolUpper];
            
            if (priceData) {
                results[symbolUpper] = {
                    current_price: priceData.current_price,
                    price_change_24h: priceData.price_change_24h,
                    last_updated: new Date().toISOString()
                };
            } else {
                results[symbolUpper] = {
                    current_price: 0,
                    price_change_24h: 0,
                    last_updated: new Date().toISOString()
                };
            }
        });
        
        console.log('🔍 测试价格服务返回数据:', results);
        return results;
    }

    // 清除缓存
    clearCache() {
        // 测试服务不需要缓存
    }

    // 获取缓存状态
    getCacheStatus() {
        return { message: '测试服务，无缓存' };
    }
}

module.exports = new TestPriceService();
