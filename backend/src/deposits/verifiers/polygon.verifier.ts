import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { DepositVerifier } from './deposit-verifier.interface';
import { VerificationInput, VerificationResult } from './verifier.types';

const USDC_DECIMALS = 6; // fijo por spec (§5.2, §6.3 #3).
// keccak256("Transfer(address,address,uint256)") — topic0 estándar ERC20.
const TRANSFER_EVENT_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

interface JsonRpcLog {
  address: string;
  topics: string[];
  data: string;
}

interface TransactionReceipt {
  status?: string; // '0x1' éxito, '0x0' falla
  blockNumber?: string; // hex
  logs?: JsonRpcLog[];
}

interface JsonRpcResponse<T> {
  result?: T;
}

// Doble fuente REAL a diferencia del WIP anterior (§6.3 #6, §12): Etherscan
// multichain (chainid=137) como primaria y el RPC directo como secundaria. Ambas
// devuelven la misma forma estándar de eth_getTransactionReceipt, así que se
// parsean con el mismo código.
@Injectable()
export class PolygonVerifier implements DepositVerifier {
  constructor(private readonly config: ConfigService) {}

  async verify(input: VerificationInput): Promise<VerificationResult> {
    const contractAddress = (
      this.config.get<string>('USDC_POLYGON_CONTRACT_ADDRESS') ?? ''
    ).toLowerCase();

    const [primaryReceipt, secondaryReceipt, finalizedBlock] = await Promise.all([
      this.fetchReceiptViaEtherscan(input.txHash),
      this.fetchReceiptViaRpc(input.txHash),
      this.fetchFinalizedBlockNumber(),
    ]);

    if (!primaryReceipt?.blockNumber || !secondaryReceipt?.blockNumber) {
      return this.fail(
        'No se encontró el recibo de la transacción en alguna de las dos fuentes',
        {
          primaryReceipt,
        },
        secondaryReceipt,
      );
    }
    if (primaryReceipt.status !== '0x1' || secondaryReceipt.status !== '0x1') {
      return this.fail('La transacción no figura como exitosa', primaryReceipt, secondaryReceipt);
    }

    const primaryTransfer = this.extractTransfer(primaryReceipt, contractAddress, input.toAddress);
    const secondaryTransfer = this.extractTransfer(
      secondaryReceipt,
      contractAddress,
      input.toAddress,
    );

    if (!primaryTransfer || !secondaryTransfer) {
      return this.fail(
        'No se encontró un evento Transfer del contrato USDC hacia la wallet de la plataforma',
        primaryReceipt,
        secondaryReceipt,
      );
    }
    if (primaryTransfer.amount !== secondaryTransfer.amount) {
      return this.fail(
        'El monto no coincide entre las dos fuentes (Etherscan vs RPC)',
        primaryReceipt,
        secondaryReceipt,
      );
    }
    if (primaryTransfer.from.toLowerCase() !== secondaryTransfer.from.toLowerCase()) {
      return this.fail(
        'La wallet de origen no coincide entre las dos fuentes',
        primaryReceipt,
        secondaryReceipt,
      );
    }

    const verifiedAmountToken = new Prisma.Decimal(primaryTransfer.amount.toString()).div(
      10 ** USDC_DECIMALS,
    );
    const txBlock = parseInt(primaryReceipt.blockNumber, 16);
    // Distancia al bloque finalized (§6.3 #7: Polygon se confirma contra `finalized`,
    // no `latest`). Negativo = todavía no finalizado.
    const confirmations = finalizedBlock - txBlock;

    return {
      success: true,
      verifiedAmountToken,
      sourceAddress: primaryTransfer.from,
      confirmations,
      rawPrimary: primaryReceipt,
      rawSecondary: secondaryReceipt,
    };
  }

  private fail(reason: string, rawPrimary: unknown, rawSecondary: unknown): VerificationResult {
    return { success: false, confirmations: 0, failureReason: reason, rawPrimary, rawSecondary };
  }

  private extractTransfer(
    receipt: TransactionReceipt,
    contractAddress: string,
    toAddress: string,
  ): { from: string; amount: bigint } | null {
    const log = receipt.logs?.find(
      (l) =>
        l.address?.toLowerCase() === contractAddress &&
        l.topics?.[0]?.toLowerCase() === TRANSFER_EVENT_TOPIC &&
        l.topics?.[2] &&
        `0x${l.topics[2].slice(-40)}`.toLowerCase() === toAddress.toLowerCase(),
    );
    if (!log?.topics?.[1]) return null;
    return {
      from: `0x${log.topics[1].slice(-40)}`,
      amount: BigInt(log.data),
    };
  }

  private async fetchReceiptViaEtherscan(txHash: string): Promise<TransactionReceipt | null> {
    const baseUrl = this.config.get<string>('POLYGONSCAN_API_URL');
    const apiKey = this.config.get<string>('POLYGONSCAN_API_KEY');
    const params = new URLSearchParams({
      chainid: '137',
      module: 'proxy',
      action: 'eth_getTransactionReceipt',
      txhash: txHash,
      apikey: apiKey ?? '',
    });
    const res = await fetch(`${baseUrl}?${params.toString()}`);
    const body = (await res.json()) as JsonRpcResponse<TransactionReceipt>;
    return body.result ?? null;
  }

  private async fetchReceiptViaRpc(txHash: string): Promise<TransactionReceipt | null> {
    const rpcUrl = this.config.get<string>('POLYGON_RPC_URL');
    const res = await fetch(rpcUrl!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionReceipt',
        params: [txHash],
      }),
    });
    const body = (await res.json()) as JsonRpcResponse<TransactionReceipt>;
    return body.result ?? null;
  }

  private async fetchFinalizedBlockNumber(): Promise<number> {
    const rpcUrl = this.config.get<string>('POLYGON_RPC_URL');
    const res = await fetch(rpcUrl!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBlockByNumber',
        params: ['finalized', false],
      }),
    });
    const body = (await res.json()) as JsonRpcResponse<{ number: string }>;
    return body.result?.number ? parseInt(body.result.number, 16) : 0;
  }
}
