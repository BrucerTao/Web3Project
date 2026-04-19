import { StorageService, RiskConfig } from '../services/zeroGStorage.js';
import { ComputeService, MarketData } from '../services/zeroGCompute.js';

/**
 * 智能收益优化器
 * 扫描多个 DeFi 协议的收益率，自动执行最优收益策略
 */
export class YieldOptimizer {
  private storageService: StorageService;
  private computeService: ComputeService;
  private strategies: Map<string, YieldStrategy>;

  constructor() {
    this.storageService = new StorageService();
    this.computeService = new ComputeService();
    this.strategies = new Map();
  }

  /**
   * 添加收益策略
   */
  addStrategy(id: string, strategy: YieldStrategy): void {
    this.strategies.set(id, strategy);
    console.log(`✅ 添加收益策略：${id}`);
  }

  /**
   * 扫描当前最优收益率
   */
  async scanBestYield(): Promise<YieldOpportunity | null> {
    console.log('\n🔍 扫描 DeFi 收益机会...');

    // 模拟多个协议的收益率
    const opportunities: YieldOpportunity[] = [
      {
        protocol: 'Aave',
        asset: 'USDC',
        apy: 0.045,
        tvl: 1000000000,
        risk: 'LOW'
      },
      {
        protocol: 'Compound',
        asset: 'USDC',
        apy: 0.038,
        tvl: 800000000,
        risk: 'LOW'
      },
      {
        protocol: 'Curve',
        asset: '3pool',
        apy: 0.062,
        tvl: 500000000,
        risk: 'MEDIUM'
      },
      {
        protocol: 'Convex',
        asset: 'cvx3Crv',
        apy: 0.078,
        tvl: 300000000,
        risk: 'MEDIUM'
      }
    ];

    // 使用 AI 分析最优机会
    const bestOpportunity = await this.aiSelectBestOpportunity(opportunities);

    console.log(`🏆 最优机会：${bestOpportunity.protocol} - APY: ${(bestOpportunity.apy * 100).toFixed(2)}%`);

    return bestOpportunity;
  }

  /**
   * 使用 AI 选择最优收益机会
   */
  private async aiSelectBestOpportunity(
    opportunities: YieldOpportunity[]
  ): Promise<YieldOpportunity> {
    // 构建市场数据用于 AI 分析
    const marketData: MarketData = {
      prices: opportunities.map(o => o.apy * 10000),
      volumes: opportunities.map(o => o.tvl),
      high: opportunities.map(o => o.apy * 10000),
      low: opportunities.map(o => o.apy * 10000 * 0.8)
    };

    // 通过 0G Compute 进行 TEE 密封推理
    const inference = await this.computeService.requestInference(
      'yield-optimizer-v1',
      marketData,
      'optimize yield considering APY, TVL, and risk'
    );

    console.log(`🤖 AI 推荐置信度：${(inference.confidence * 100).toFixed(2)}%`);

    // 简单实现：选择最高 APY（考虑风险调整）
    const sorted = opportunities.sort((a, b) => {
      const riskAdjustment = { 'LOW': 1.0, 'MEDIUM': 0.9, 'HIGH': 0.7 };
      return b.apy * riskAdjustment[b.risk] - a.apy * riskAdjustment[a.risk];
    });

    return sorted[0];
  }

  /**
   * 执行收益优化策略
   */
  async optimize(): Promise<OptimizationResult> {
    const bestOpportunity = await this.scanBestYield();

    if (!bestOpportunity) {
      return {
        success: false,
        message: '未找到合适的收益机会'
      };
    }

    // 存储优化决策到 0G Storage
    const decisionRecord = {
      timestamp: Date.now(),
      action: 'YIELD_OPTIMIZE',
      protocol: bestOpportunity.protocol,
      asset: bestOpportunity.asset,
      apy: bestOpportunity.apy,
      amount: 10000 // 模拟投资金额
    };

    await this.storageService.storeTradeRecord({
      timestamp: Date.now(),
      strategyId: 'yield-optimizer-v1',
      action: 'BUY',
      symbol: `${bestOpportunity.asset}/${bestOpportunity.protocol}`,
      amount: decisionRecord.amount,
      price: bestOpportunity.apy
    });

    return {
      success: true,
      protocol: bestOpportunity.protocol,
      asset: bestOpportunity.asset,
      apy: bestOpportunity.apy,
      estimatedAnnualReturn: decisionRecord.amount * bestOpportunity.apy
    };
  }

  /**
   * 配置自动复投
   */
  async configureAutoCompound(config: AutoCompoundConfig): Promise<void> {
    await this.storageService.storeRiskConfig({
      maxPositionSize: config.maxPosition,
      stopLossPercent: 0,  // 收益策略通常不设止损
      takeProfitPercent: config.takeProfitThreshold,
      maxDailyLoss: config.maxDailyLoss,
      leverageLimit: config.leverageLimit
    });

    console.log('✅ 自动复投配置已保存到 0G Storage');
  }
}

export interface YieldStrategy {
  name: string;
  targetAPY: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  assets: string[];
}

export interface YieldOpportunity {
  protocol: string;
  asset: string;
  apy: number;
  tvl: number;
  risk: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface OptimizationResult {
  success: boolean;
  protocol?: string;
  asset?: string;
  apy?: number;
  estimatedAnnualReturn?: number;
  message?: string;
}

export interface AutoCompoundConfig {
  maxPosition: number;
  takeProfitThreshold: number;
  maxDailyLoss: number;
  leverageLimit: number;
  compoundInterval: 'hourly' | 'daily' | 'weekly';
}
