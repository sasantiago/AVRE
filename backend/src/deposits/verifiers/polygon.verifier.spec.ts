import { Prisma } from '@prisma/client';
import { PolygonVerifier } from './polygon.verifier';

describe('PolygonVerifier', () => {
  const txHash = '0x' + 'a'.repeat(64);
  const toAddress = '0x' + '2'.repeat(40);
  const fromAddress = '0x' + '1'.repeat(40);
  const contractAddress = '0x' + '3'.repeat(40);

  const envMap: Record<string, string> = {
    POLYGONSCAN_API_URL: 'https://polygonscan.test/api',
    POLYGONSCAN_API_KEY: 'ps-key',
    POLYGON_RPC_URL: 'https://polygon-rpc.test',
    USDC_POLYGON_CONTRACT_ADDRESS: contractAddress,
  };

  const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  const padTopic = (addr: string) => '0x' + '0'.repeat(24) + addr.slice(2).toLowerCase();

  let config: any;
  let verifier: PolygonVerifier;
  let receipt: any;
  let finalizedBlockHex: string;

  beforeEach(() => {
    config = { get: jest.fn((k: string) => envMap[k]) };
    verifier = new PolygonVerifier(config);

    receipt = {
      status: '0x1',
      blockNumber: '0x3e8', // 1000
      logs: [
        {
          address: contractAddress,
          topics: [TRANSFER_TOPIC, padTopic(fromAddress), padTopic(toAddress)],
          data: '0x5f5e100', // 100_000_000 -> 100 USDC (6 decimales)
        },
      ],
    };
    finalizedBlockHex = '0x401'; // 1025

    global.fetch = jest.fn((url: string, options?: any) => {
      if (!options) {
        // GET a Etherscan multichain (primaria)
        return Promise.resolve({ json: () => Promise.resolve({ result: receipt }) }) as any;
      }
      const body = JSON.parse(options.body);
      if (body.method === 'eth_getTransactionReceipt') {
        return Promise.resolve({ json: () => Promise.resolve({ result: receipt }) }) as any;
      }
      if (body.method === 'eth_getBlockByNumber') {
        return Promise.resolve({
          json: () => Promise.resolve({ result: { number: finalizedBlockHex } }),
        }) as any;
      }
      return Promise.resolve({ json: () => Promise.resolve({}) }) as any;
    }) as any;
  });

  const input = () => ({ txHash, toAddress, declaredAmountToken: new Prisma.Decimal('100') });

  it('éxito: doble fuente consistente (Etherscan + RPC), confirmations = finalized - txBlock', async () => {
    const result = await verifier.verify(input());
    expect(result.success).toBe(true);
    expect(result.verifiedAmountToken?.toString()).toBe('100');
    expect(result.sourceAddress?.toLowerCase()).toBe(fromAddress);
    expect(result.confirmations).toBe(25); // 1025 - 1000
  });

  it('confirmations negativo si el bloque de la tx es posterior al finalized (no confirmado)', async () => {
    finalizedBlockHex = '0x1'; // bloque finalized muy por detrás
    const result = await verifier.verify(input());
    expect(result.success).toBe(true);
    expect(result.confirmations).toBeLessThan(0);
  });

  it('falla si el status no es exitoso', async () => {
    receipt.status = '0x0';
    const result = await verifier.verify(input());
    expect(result.success).toBe(false);
  });

  it('falla si no hay un log Transfer del contrato esperado hacia la wallet de la plataforma', async () => {
    receipt.logs = [];
    const result = await verifier.verify(input());
    expect(result.success).toBe(false);
    expect(result.failureReason).toMatch(/transfer/i);
  });

  it('falla si el contrato del log no coincide con el USDC configurado', async () => {
    receipt.logs[0].address = '0x9999999999999999999999999999999999999d';
    const result = await verifier.verify(input());
    expect(result.success).toBe(false);
  });
});
