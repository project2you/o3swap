import { POLY_POOL_ADDRESS } from './contract';
import { NETWORK } from './network';
import { CurveAsset, Token, USD_TOKENS, WETH_TOKENS } from './token';

export interface Pool {
  poolId: number;
  contract: string;
  wrappedTokens: Token[];
  curveAssets: CurveAssets;
  chain: string;
}
export interface CurveAssets {
  ETH: CurveAsset;
  BSC: CurveAsset;
  HECO: CurveAsset;
}
export const CURVE_POOL_WRAPPER_TOKENS = {
  1: USD_TOKENS,
  2: WETH_TOKENS,
  3: WETH_TOKENS,
};

export const CURVE_POOL_ASSET = {
  1: {
    ETH: {
      assetID:
        NETWORK === 'MainNet'
          ? '0x061a87Aac7695b9cf9482043175fd3bE3374AB66'
          : '0x63799851696CDE43c2305dccd7208a03272BA591',
      decimals: 6,
    },
    BSC: {
      assetID:
        NETWORK === 'MainNet'
          ? '0xBFC0457548BB90D54123a71a7310BaDa8f4662c0'
          : '0x78Ec09343122737925f9839d7794de49FeB6B083',
      decimals: 18,
    },
    HECO: {
      assetID:
        NETWORK === 'MainNet'
          ? '0x0926B2DB9D053E0022419093CCd57b92301fB736'
          : '0xbdd265FC4D5b7E7a937608B91EDAFc38F27E4479',
      decimals: NETWORK === 'MainNet' ? 8 : 18,
    },
  },
  3: {
    ETH: {
      assetID: '0xfC555687536B7CAe0E22546DDeb49a9C1554B08a',
      decimals: 18,
    },
    BSC: {
      assetID: '0x487AF1B3e1f61b744eB66FAB05615C370fA6B6eF',
      decimals: 18,
    },
    HECO: {
      assetID: '0x0a2EA377d17d286D23C609Fad216AC98e0c5e57F',
      decimals: 18,
    },
  },
};

//#region pool list
export const POOL_LIST: Pool[] = [
  {
    poolId: 1,
    contract: POLY_POOL_ADDRESS[1],
    wrappedTokens: CURVE_POOL_WRAPPER_TOKENS[1],
    curveAssets: CURVE_POOL_ASSET[1],
    chain: 'ETH',
  },
  {
    // TestNet
    poolId: 3,
    contract: POLY_POOL_ADDRESS[3],
    wrappedTokens: CURVE_POOL_WRAPPER_TOKENS[3],
    curveAssets: CURVE_POOL_ASSET[3],
    chain: 'BSC',
  },
];
//#endregion
