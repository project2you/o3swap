import { NETWORK } from './network';
import {
  LP_TOKENS,
  MASK_TOKEN,
  MATIC_TOKEN,
  O3_TOKEN,
  ONEINCH_TOKEN,
  PERP_TOKEN,
  SKL_TOKEN,
  WETH_TOKEN,
} from './token';

export const NEO_NNEO_CONTRACT_HASH =
  NETWORK === 'MainNet'
    ? 'f46719e2d16bf50cddcef9d4bbfece901f73cbb6'
    : '17da3881ab2d050fea414c80b3fa8324d756f60e';

export const NEO_SWAP_CONTRACT_HASH =
  NETWORK === 'MainNet'
    ? '89fa00d894c9a1475f8f94e84c79724b3faf64db'
    : '812d7291e2f0c89255cf355c1027872257d1ca37';

// from ETH (usdt, busd, husd swap，deposit and withdraw)
export const ETH_CROSS_SWAP_CONTRACT_HASH = {
  ETH:
    NETWORK === 'MainNet'
      ? '0x02e20ca05e38cbdf1a6235a7acdd34efc0434caa'
      : '0x8Baa27e659F55249bb36113346980BFFABC53AeF',
  BSC:
    NETWORK === 'MainNet'
      ? '0x3ec481143d688442E581aD7116Bf1ECC76669cfa'
      : '0x51FfD5196e3945c4CE25101eEB7f4062b97B9A1A',
  HECO:
    NETWORK === 'MainNet'
      ? '0x70f4d1176f9276ab4B31658f58F7473858F2b550'
      : '0x0488ADd7e3D4C58acb8DF7c487dAfC48e3224833',
};

export const POLY_WRAPPER_CONTRACT_HASH = {
  ETH:
    NETWORK === 'MainNet' ? '0x2aA63cd0b28FB4C31fA8e4E95Ec11815Be07b9Ac' : '',
  BSC:
    NETWORK === 'MainNet' ? '0xE3D0FB6E3cB5DA61EB18b06D035052441009d1E6' : '',
  HECO:
    NETWORK === 'MainNet' ? '0x4fE451186c0D69205ACc1fA00FD75fc6d71e47eE' : '',
};

export const SWAP_CONTRACT_CHAIN_ID = {
  BSC: NETWORK === 'MainNet' ? 6 : 79,
  HECO: NETWORK === 'MainNet' ? 7 : 7,
  ETH: NETWORK === 'MainNet' ? 2 : 2,
};

export const POLY_HOST_ADDRESS =
  NETWORK === 'MainNet'
    ? '0xa6157DaBDda80F8c956962AB7739f17F54BAAB7F'
    : '0x0687e6392de735B83ed2808797c92051B5dF5618';

export const AGGREGATOR_CONTRACT = {
  BSC: {
    Pancakeswap:
      NETWORK === 'MainNet'
        ? '0xdd827EB8Fd0C95a1372CcA8f2ded3406eE034f08'
        : '0xA78a195E6DCDa3eC2074CF8d0b8392602783107B',
  },
  ETH: {
    Uniswap:
      NETWORK === 'MainNet'
        ? '0x96cFA408CA039d9Afea0b8227be741Ef52e8a037'
        : '0x1296300290e32a24E0c8d3428DAcB8aC0f3B67d3',
  },
  HECO: {
    'Mdex-Heco':
      NETWORK === 'MainNet'
        ? '0xecbf96dd4fbfd666a849252ec022bf311a4ca002'
        : '0x77ddcf68bece64049adf7a261a432b344885381f',
  },
};

export const O3STAKING_CONTRACT = {
  ETH: {
    [O3_TOKEN.assetID]:
      NETWORK === 'MainNet'
        ? '0x0423f3b26593db401a3382b483981e619C808dfC'
        : '0x97058684943932e0158cC60F33a4a98f17066927',
    [LP_TOKENS.filter((item) => item.chain === 'ETH')[0].assetID]:
      NETWORK === 'MainNet'
        ? '0x0eE932A6E89619DD865221754813c5627d00AdB3'
        : '0x9A7Ae672cf00304c9CD54AC217a90B16e6EF4749',
    [WETH_TOKEN.assetID]: '0x33bFCD95b7C5A83a71ce6d579fdD651aaA8F8f28',
    [ONEINCH_TOKEN.assetID]: '0xE6D6E0924005d2F3c977Efc768bED7a121670859',
    [MATIC_TOKEN.assetID]: '0xe0EBdb726eC3563aBEA57BF6d2388960D71481fe',
    [SKL_TOKEN.assetID]: '0x415dbcd56206fa190b3be8572f3089198eac7526',
    [MASK_TOKEN.assetID]: '0x247E63265B360cD389e1194Ec9561fA9aB26dcBE',
    [PERP_TOKEN.assetID]: '0xEDdc506Ce6d0344c02fe4fb9126dB50a7C10402d',
  },
  BSC: {},
  HECO: {},
};

export const ETH_AIRDROP_CLAIM_CONTRACT = [
  NETWORK === 'MainNet'
    ? '0x510D056A63a2F9284179F2d39b8fDe7eB8ded609'
    : '0xEA8fCDC93185E7ffE9Bb98E1e57F8125aaA6453B',
  NETWORK === 'MainNet'
    ? '0x16a852a9593db9b392eb77a1b6c9d99c2fb75896'
    : '0x8D2Bf31607dAADaA422388445b9c7812A9a4ce36',
];

export const O3TOKEN_CONTRACT = O3_TOKEN.assetID;
