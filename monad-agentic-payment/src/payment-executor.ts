/**
 * Payment Executor - 支付执行模块
 *
 * 负责在 Monad 链上执行支付交易
 * 支持：MPP 协议、失败重试、交易追踪
 */

import {
  Wallet,
  Provider,
  JsonRpcProvider,
  TransactionResponse,
  ethers,
} from 'ethers';
import {
  PaymentRequest,
  PaymentResult,
  PolicyCheckResult,
  MONAD_CONFIG,
  formatEthAmount,
} from './types.js';
import { PolicyEngine } from './policy-engine.js';

// MPP 合约 ABI（简化版，实际应使用完整 ABI）
const MPP_ABI = [
  'function initiatePayment(address recipient, uint256 amount) external payable',
  'function executePayment(bytes32 paymentId) external',
  'function cancelPayment(bytes32 paymentId) external',
  'event PaymentInitiated(bytes32 indexed paymentId, address indexed sender, address indexed recipient, uint256 amount)',
  'event PaymentExecuted(bytes32 indexed paymentId)',
];

export class PaymentExecutor {
  private provider: Provider;
  private policyEngine: PolicyEngine;
  private mppContractAddress: string;

  constructor(
    policyEngine: PolicyEngine,
    rpcUrl: string = MONAD_CONFIG.RPC_URL,
    mppContractAddress?: string
  ) {
    this.provider = new JsonRpcProvider(rpcUrl);
    this.policyEngine = policyEngine;
    this.mppContractAddress = mppContractAddress || '0x0000000000000000000000000000000000000000';
  }

  /**
   * 执行支付（使用用户提供的钱包）
   */
  async executePayment(
    request: PaymentRequest,
    wallet: Wallet,
    policyCheckResult: PolicyCheckResult
  ): Promise<PaymentResult> {
    const now = new Date();

    try {
      // 1. 检查是否需要人工确认
      if (policyCheckResult.checks.humanApproval.required) {
        return {
          success: false,
          policyChecks: policyCheckResult,
          requiredHumanApproval: true,
          error: 'Payment requires human approval',
          timestamp: now,
        };
      }

      // 2. 构建交易
      const txRequest = await this.buildTransaction(request, wallet);

      // 3. 发送交易
      const tx: TransactionResponse = await wallet.sendTransaction(txRequest);

      // 4. 等待确认
      const receipt = await tx.wait();

      // 5. 记录支出
      const amountUSD = this.weiToUSD(request.amount);
      if (policyCheckResult.policyId) {
        this.policyEngine.recordSpend(policyCheckResult.policyId, amountUSD);
      }

      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt?.blockNumber,
        gasUsed: receipt?.gasUsed,
        policyChecks: policyCheckResult,
        requiredHumanApproval: false,
        timestamp: now,
      };
    } catch (error) {
      return {
        success: false,
        policyChecks: policyCheckResult,
        requiredHumanApproval: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: now,
      };
    }
  }

  /**
   * 使用 MPP 协议执行支付
   */
  async executeWithMPP(
    request: PaymentRequest,
    wallet: Wallet,
    policyCheckResult: PolicyCheckResult
  ): Promise<PaymentResult> {
    const now = new Date();

    try {
      // 1. 连接 MPP 合约
      const mppContract = new ethers.Contract(
        this.mppContractAddress,
        MPP_ABI,
        wallet
      );

      // 2. 发起支付
      const tx = await mppContract.initiatePayment(
        request.recipient,
        request.amount,
        { value: request.amount }
      );

      // 3. 等待确认
      const receipt = await tx.wait();

      // 4. 提取 Payment ID（从事件中）
      const paymentId = this.extractPaymentIdFromReceipt(receipt);

      // 5. 记录支出
      const amountUSD = this.weiToUSD(request.amount);
      if (policyCheckResult.policyId) {
        this.policyEngine.recordSpend(policyCheckResult.policyId, amountUSD);
      }

      return {
        success: true,
        txHash: tx.hash,
        blockNumber: receipt?.blockNumber,
        gasUsed: receipt?.gasUsed,
        policyChecks: policyCheckResult,
        requiredHumanApproval: false,
        timestamp: now,
      };
    } catch (error) {
      return {
        success: false,
        policyChecks: policyCheckResult,
        requiredHumanApproval: false,
        error: error instanceof Error ? error.message : 'MPP execution failed',
        timestamp: now,
      };
    }
  }

  /**
   * 批量执行支付（适合多个小额支付）
   */
  async executeBatchPayments(
    requests: PaymentRequest[],
    wallet: Wallet,
    policyCheckResults: PolicyCheckResult[]
  ): Promise<PaymentResult[]> {
    const results: PaymentResult[] = [];

    for (let i = 0; i < requests.length; i++) {
      const result = await this.executePayment(
        requests[i],
        wallet,
        policyCheckResults[i]
      );
      results.push(result);

      // 如果失败，可以选择继续或停止
      if (!result.success) {
        console.warn(`Batch payment ${i} failed: ${result.error}`);
      }
    }

    return results;
  }

  /**
   * 查询交易状态
   */
  async getTransactionStatus(txHash: string): Promise<{
    confirmed: boolean;
    blockNumber?: number;
    confirmations: number;
    status?: 'pending' | 'confirmed' | 'failed';
  }> {
    try {
      const tx = await this.provider.getTransaction(txHash);
      if (!tx) {
        return { confirmed: false, confirmations: 0 };
      }

      const receipt = await tx.wait();
      const currentBlock = await this.provider.getBlockNumber();

      return {
        confirmed: receipt !== null,
        blockNumber: receipt?.blockNumber,
        confirmations: receipt
          ? currentBlock - receipt.blockNumber
          : 0,
        status: receipt ? 'confirmed' : 'pending',
      };
    } catch (error) {
      return {
        confirmed: false,
        confirmations: 0,
      };
    }
  }

  /**
   * 重试失败的交易
   */
  async retryPayment(
    request: PaymentRequest,
    wallet: Wallet,
    policyCheckResult: PolicyCheckResult,
    options?: {
      maxRetries?: number;
      gasMultiplier?: number;
    }
  ): Promise<PaymentResult> {
    const maxRetries = options?.maxRetries ?? 3;
    const gasMultiplier = options?.gasMultiplier ?? 1.2;

    let lastError: string = '';

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // 构建交易（可调整 gas）
        const txRequest = await this.buildTransaction(request, wallet);

        if (attempt > 0) {
          // 增加 gas 价格
          txRequest.gasPrice = BigInt(
            Math.floor(Number(txRequest.gasPrice || 1n) * gasMultiplier)
          );
        }

        const tx = await wallet.sendTransaction(txRequest);
        const receipt = await tx.wait();

        if (receipt) {
          const amountUSD = this.weiToUSD(request.amount);
          if (policyCheckResult.policyId) {
            this.policyEngine.recordSpend(policyCheckResult.policyId, amountUSD);
          }

          return {
            success: true,
            txHash: tx.hash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed,
            policyChecks: policyCheckResult,
            requiredHumanApproval: false,
            timestamp: new Date(),
          };
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        console.warn(`Retry attempt ${attempt + 1} failed: ${lastError}`);
      }
    }

    return {
      success: false,
      policyChecks: policyCheckResult,
      requiredHumanApproval: false,
      error: `Failed after ${maxRetries} retries: ${lastError}`,
      timestamp: new Date(),
    };
  }

  /**
   * 构建交易对象
   */
  private async buildTransaction(
    request: PaymentRequest,
    wallet: Wallet
  ): Promise<{
    to: string;
    value: bigint;
    data: string;
    gasPrice?: bigint;
    gasLimit?: bigint;
  }> {
    const tx: {
      to: string;
      value: bigint;
      data: string;
      gasPrice?: bigint;
      gasLimit?: bigint;
    } = {
      to: request.recipient,
      value: request.amount,
      data: request.data || '0x',
    };

    // 估算 gas
    try {
      const gasLimit = await this.provider.estimateGas({
        ...tx,
        from: wallet.address,
      });
      tx.gasLimit = gasLimit * BigInt(120) / BigInt(100); // +20% buffer
    } catch {
      tx.gasLimit = BigInt(21000); // 默认转账
    }

    // 获取 gas 价格
    const feeData = await this.provider.getFeeData();
    tx.gasPrice = feeData.gasPrice || feeData.maxFeePerGas || undefined;

    return tx;
  }

  /**
   * 从收据中提取 Payment ID
   */
  private extractPaymentIdFromReceipt(receipt: any): string | null {
    // 简化实现，实际应解析事件日志
    return receipt?.hash || null;
  }

  /**
   * 将 wei 转换为 USD（简化版本）
   */
  private weiToUSD(wei: bigint): number {
    const ethAmount = Number(wei) / 1e18;
    return ethAmount * 2000; // 假设 1 ETH = $2000
  }

  /**
   * 获取钱包余额
   */
  async getBalance(address: string): Promise<bigint> {
    return this.provider.getBalance(address);
  }

  /**
   * 获取当前 gas 价格
   */
  async getGasPrice(): Promise<bigint> {
    const feeData = await this.provider.getFeeData();
    return feeData.gasPrice || feeData.maxFeePerGas || 0n;
  }
}
