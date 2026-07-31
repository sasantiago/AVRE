import { Injectable } from '@nestjs/common';
import { ChainNetwork } from '@prisma/client';
import { DepositVerifier } from './deposit-verifier.interface';
import { PolygonVerifier } from './polygon.verifier';
import { TronVerifier } from './tron.verifier';

@Injectable()
export class DepositVerifierRegistry {
  private readonly verifiers: Record<ChainNetwork, DepositVerifier>;

  constructor(tronVerifier: TronVerifier, polygonVerifier: PolygonVerifier) {
    this.verifiers = {
      [ChainNetwork.TRON_TRC20]: tronVerifier,
      [ChainNetwork.POLYGON]: polygonVerifier,
    };
  }

  get(chain: ChainNetwork): DepositVerifier {
    return this.verifiers[chain];
  }
}
