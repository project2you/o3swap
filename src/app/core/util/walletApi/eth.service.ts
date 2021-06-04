import { Injectable } from '@angular/core';
import {
  ETH_CROSS_SWAP_CONTRACT_HASH,
  SwapStateType,
  MyTransaction,
  SWAP_CONTRACT_CHAIN_ID,
  Token,
  UPDATE_TX,
  TransactionType,
  ETH_SOURCE_ASSET_HASH,
  AssetQueryResponseItem,
  O3_AGGREGATOR_SLIPVALUE,
  TxAtPage,
  BRIDGE_SLIPVALUE,
  WETH_ASSET_HASH,
  AGGREGATOR_CONTRACT,
  POLY_WRAPPER_CONTRACT_HASH,
  O3_TOKEN,
  INIT_CHAIN_TOKENS,
  ADD_TX,
} from '@lib';
import { Store } from '@ngrx/store';
import BigNumber from 'bignumber.js';
import { interval, Observable, Unsubscribable } from 'rxjs';
import { CommonService } from '../common.service';
import { SwapService } from '../swap.service';
import Web3 from 'web3';
import { RpcApiService } from '../../api/rpc.service';
import { MetaMaskWalletApiService } from './metamask';
import { O3EthWalletApiService } from './o3-eth';
import { VaultEthWalletApiService } from './vault-eth.service';
import { ApiService } from '../../api/api.service';

interface State {
  swap: SwapStateType;
  app: any;
}
@Injectable()
export class EthApiService {
  private web3 = new Web3();

  private swap$: Observable<any>;
  private walletName = { ETH: '', BSC: '', HECO: '' };

  private appUnScribe: Unsubscribable;
  private app$: Observable<any>;
  private chainTokens = INIT_CHAIN_TOKENS;

  constructor(
    private store: Store<State>,
    private swapService: SwapService,
    private commonService: CommonService,
    private rpcApiService: RpcApiService,
    private o3EthWalletApiService: O3EthWalletApiService,
    private metaMaskWalletApiService: MetaMaskWalletApiService,
    private vaultEthWalletApiService: VaultEthWalletApiService,
    private apiService: ApiService
  ) {
    this.swap$ = store.select('swap');
    this.swap$.subscribe((state) => {
      this.walletName.ETH = state.ethWalletName;
      this.walletName.BSC = state.bscWalletName;
      this.walletName.HECO = state.hecoWalletName;
    });
    this.app$ = store.select('app');
    this.appUnScribe = this.app$.subscribe((state) => {
      this.chainTokens = state.chainTokens;
    });
  }

  //#region network
  checkNetwork(fromToken: Token): boolean {
    return this.metaMaskWalletApiService.checkNetwork(fromToken);
  }
  //#endregion

  //#region ETH<=>WETH HT<=>WHT BNB<=>WBNB swap
  async depositWEth(
    fromToken: Token, // eth
    toToken: Token, // weth
    inputAmount: string,
    fromAddress: string
  ): Promise<any> {
    this.commonService.log(`\u001b[32m  ✓ eth swap weth \u001b[0m`);
    const json = await this.swapService.getSwapJson('wEth');
    const swapContract = new this.web3.eth.Contract(
      json,
      '0xa2D7dfE65E9f1CF3F0d8feB3368673214422470e'
    );
    const data = swapContract.methods.deposit().encodeABI();
    const value = new BigNumber(inputAmount)
      .shiftedBy(fromToken.decimals)
      .toFixed();
    const requestData = {
      method: 'eth_sendTransaction',
      params: [
        this.commonService.getSendTransactionParams(
          fromAddress,
          '0xa2D7dfE65E9f1CF3F0d8feB3368673214422470e',
          data,
          value
        ),
      ],
    };
    return this.metaMaskWalletApiService
      .sendTransaction(requestData, fromToken.chain)
      .then((hash) => {
        this.commonService.log(hash);
        this.handleTx(
          fromToken,
          toToken,
          inputAmount,
          new BigNumber(inputAmount).shiftedBy(toToken.decimals).toFixed(),
          hash,
          'swap',
          TransactionType.swap,
          false
        );
        return hash;
      });
  }
  async withdrawalWeth(
    fromToken: Token, // weth
    toToken: Token, // eth
    inputAmount: string,
    fromAddress: string
  ): Promise<any> {
    this.commonService.log(`\u001b[32m  ✓ eth swap weth \u001b[0m`);
    const json = await this.swapService.getSwapJson('wEth');
    const swapContract = new this.web3.eth.Contract(
      json,
      WETH_ASSET_HASH[fromToken.chain].assetID
    );
    const data = swapContract.methods
      .withdraw(
        new BigNumber(inputAmount).shiftedBy(fromToken.decimals).toFixed()
      )
      .encodeABI();
    const requestData = {
      method: 'eth_sendTransaction',
      params: [
        this.commonService.getSendTransactionParams(
          fromAddress,
          WETH_ASSET_HASH[fromToken.chain].assetID,
          data
        ),
      ],
    };
    return this.metaMaskWalletApiService
      .sendTransaction(requestData, fromToken.chain)
      .then((hash) => {
        this.handleTx(
          fromToken,
          toToken,
          inputAmount,
          new BigNumber(inputAmount).shiftedBy(toToken.decimals).toFixed(),
          hash,
          'swap',
          TransactionType.swap,
          false
        );
        return hash;
      });
  }
  //#endregion

  //#region USDT BUSD HUSD swap
  async swapCrossChain(
    fromToken: Token,
    toToken: Token,
    inputAmount: string,
    fromAddress: string,
    toAddress: string,
    receiveAmount: string,
    slipValue: number,
    polyFee: string,
    txAtPage: TxAtPage
  ): Promise<string> {
    this.commonService.log('poly swap');
    const json = await this.swapService.getSwapJson('swapper');
    const swapContract = new this.web3.eth.Contract(
      json,
      ETH_CROSS_SWAP_CONTRACT_HASH[fromToken.chain]
    );
    const bigNumberPolyFee = new BigNumber(polyFee)
      .shiftedBy(18)
      .dp(0)
      .toFixed();
    const params = {
      fromAssetHash: this.commonService.add0xHash(fromToken.assetID),
      toPoolId: 1,
      toChainId: SWAP_CONTRACT_CHAIN_ID[toToken.chain],
      toAssetHash: this.commonService.add0xHash(toToken.assetID),
      toAddress,
      amount: new BigNumber(inputAmount)
        .shiftedBy(fromToken.decimals)
        .toFixed(),
      minOutAmount: this.swapService.getMinAmountOut(receiveAmount, slipValue),
      fee: bigNumberPolyFee,
      id: 1,
    };
    this.commonService.log(params);
    this.commonService.log(`value: ${bigNumberPolyFee}`);
    const data = swapContract.methods
      .swap(
        params.fromAssetHash,
        params.toPoolId,
        params.toChainId,
        params.toAssetHash,
        params.toAddress,
        params.amount,
        params.minOutAmount,
        params.fee,
        params.id
      )
      .encodeABI();
    const requestData = {
      method: 'eth_sendTransaction',
      params: [
        this.commonService.getSendTransactionParams(
          fromAddress,
          ETH_CROSS_SWAP_CONTRACT_HASH[fromToken.chain],
          data,
          bigNumberPolyFee
        ),
      ],
    };
    if (
      (await this.commonService.getPreExecutionResult(
        requestData.params,
        fromToken
      )) !== true
    ) {
      return;
    }
    return this.metaMaskWalletApiService
      .sendTransaction(requestData, fromToken.chain)
      .then((hash) => {
        this.handleTx(
          fromToken,
          toToken,
          inputAmount,
          receiveAmount,
          hash,
          txAtPage,
          TransactionType.swap
        );
        return hash;
      });
  }
  //#endregion

  //#region O3 BO3 HO3 swap
  async swapO3CrossChain(
    fromToken: Token,
    toToken: Token,
    inputAmount: string,
    fromAddress: string,
    toAddress: string,
    receiveAmount: string,
    polyFee: string,
    txAtPage: TxAtPage
  ): Promise<string> {
    this.commonService.log('swap o3');
    const json = await this.swapService.getSwapJson('polyWrapper');
    const swapContract = new this.web3.eth.Contract(
      json,
      POLY_WRAPPER_CONTRACT_HASH[fromToken.chain]
    );
    const bigNumberPolyFee = new BigNumber(polyFee)
      .shiftedBy(O3_TOKEN.decimals)
      .dp(0)
      .toFixed();
    const params = {
      fromAsset: this.commonService.add0xHash(fromToken.assetID),
      toChainId: SWAP_CONTRACT_CHAIN_ID[toToken.chain],
      toAddress,
      amount: new BigNumber(inputAmount)
        .shiftedBy(fromToken.decimals)
        .toFixed(),
      fee: bigNumberPolyFee,
      id: 1,
    };
    this.commonService.log(params);
    const data = swapContract.methods
      .lock(
        params.fromAsset,
        params.toChainId,
        params.toAddress,
        params.amount,
        params.fee,
        params.id
      )
      .encodeABI();
    const requestData = {
      method: 'eth_sendTransaction',
      params: [
        this.commonService.getSendTransactionParams(
          fromAddress,
          POLY_WRAPPER_CONTRACT_HASH[fromToken.chain],
          data
        ),
      ],
    };
    if (
      (await this.commonService.getPreExecutionResult(
        requestData.params,
        fromToken
      )) !== true
    ) {
      return;
    }
    return this.metaMaskWalletApiService
      .sendTransaction(requestData, fromToken.chain)
      .then((hash) => {
        this.handleTx(
          fromToken,
          toToken,
          inputAmount,
          receiveAmount,
          hash,
          txAtPage,
          TransactionType.swap
        );
        return hash;
      });
  }
  //#endregion

  //#region aggregator contract swap
  async swapExactTokensForETH(
    fromToken: Token,
    toToken: Token,
    chooseSwapPath: AssetQueryResponseItem,
    inputAmount: string,
    fromAddress: string,
    toAddress: string,
    deadline: number,
    slipValue: number
  ): Promise<any> {
    this.commonService.log(
      `\u001b[32m  ✓ ${chooseSwapPath.aggregator} \u001b[0m`
    );
    this.commonService.log('swapExactTokensForETH');
    const json = await this.swapService.getAggregatorSwapJson(
      fromToken.chain,
      chooseSwapPath.aggregator
    );
    const swapContract = new this.web3.eth.Contract(
      json,
      AGGREGATOR_CONTRACT[fromToken.chain][chooseSwapPath.aggregator]
    );
    const receiveAmount =
      chooseSwapPath.amount[chooseSwapPath.amount.length - 1];
    const params = {
      amountIn: new BigNumber(inputAmount)
        .shiftedBy(fromToken.decimals)
        .toFixed(),
      swapAmountOutMin: this.swapService.getMinAmountOut(
        receiveAmount,
        slipValue
      ),
      path: chooseSwapPath.assetHashPath,
      to: toAddress,
      deadline: Math.floor(Date.now() / 1000 + deadline * 60),
    };
    this.commonService.log(params);
    const data = swapContract.methods
      .swapExactTokensForETHSupportingFeeOnTransferTokens(
        params.amountIn,
        params.swapAmountOutMin,
        params.path,
        params.to,
        params.deadline
      )
      .encodeABI();
    const requestData = {
      method: 'eth_sendTransaction',
      params: [
        this.commonService.getSendTransactionParams(
          fromAddress,
          AGGREGATOR_CONTRACT[fromToken.chain][chooseSwapPath.aggregator],
          data
        ),
      ],
    };
    if (
      (await this.commonService.getPreExecutionResult(
        requestData.params,
        fromToken
      )) !== true
    ) {
      return;
    }
    return this.metaMaskWalletApiService
      .sendTransaction(requestData, fromToken.chain)
      .then((hash) => {
        this.commonService.log(hash);
        this.handleTx(
          fromToken,
          toToken,
          inputAmount,
          receiveAmount,
          hash,
          'swap',
          TransactionType.swap,
          false
        );
        return hash;
      });
  }
  async swapExactETHForTokens(
    fromToken: Token,
    toToken: Token,
    chooseSwapPath: AssetQueryResponseItem,
    inputAmount: string,
    fromAddress: string,
    toAddress: string,
    deadline: number,
    slipValue: number
  ): Promise<any> {
    this.commonService.log(
      `\u001b[32m  ✓ ${chooseSwapPath.aggregator} \u001b[0m`
    );
    this.commonService.log('swapExactETHForTokens');
    const json = await this.swapService.getAggregatorSwapJson(
      fromToken.chain,
      chooseSwapPath.aggregator
    );
    const swapContract = new this.web3.eth.Contract(
      json,
      AGGREGATOR_CONTRACT[fromToken.chain][chooseSwapPath.aggregator]
    );
    const receiveAmount =
      chooseSwapPath.amount[chooseSwapPath.amount.length - 1];
    const params = {
      swapAmountOutMin: this.swapService.getMinAmountOut(
        receiveAmount,
        slipValue
      ),
      path: chooseSwapPath.assetHashPath,
      to: toAddress,
      deadline: Math.floor(Date.now() / 1000 + deadline * 60),
    };
    this.commonService.log(params);
    const value = new BigNumber(inputAmount)
      .shiftedBy(fromToken.decimals)
      .toFixed();
    this.commonService.log(`value: ${value}`);
    const data = swapContract.methods
      .swapExactETHForTokensSupportingFeeOnTransferTokens(
        params.swapAmountOutMin,
        params.path,
        params.to,
        params.deadline
      )
      .encodeABI();
    const requestData = {
      method: 'eth_sendTransaction',
      params: [
        this.commonService.getSendTransactionParams(
          fromAddress,
          AGGREGATOR_CONTRACT[fromToken.chain][chooseSwapPath.aggregator],
          data,
          value
        ),
      ],
    };
    if (
      (await this.commonService.getPreExecutionResult(
        requestData.params,
        fromToken
      )) !== true
    ) {
      return;
    }
    return this.metaMaskWalletApiService
      .sendTransaction(requestData, fromToken.chain)
      .then((hash) => {
        this.commonService.log(hash);
        this.handleTx(
          fromToken,
          toToken,
          inputAmount,
          receiveAmount,
          hash,
          'swap',
          TransactionType.swap,
          false
        );
        return hash;
      });
  }
  async swapExactTokensForTokens(
    fromToken: Token,
    toToken: Token,
    chooseSwapPath: AssetQueryResponseItem,
    inputAmount: string,
    fromAddress: string,
    toAddress: string,
    deadline: number,
    slipValue: number
  ): Promise<any> {
    this.commonService.log(
      `\u001b[32m  ✓ ${chooseSwapPath.aggregator} \u001b[0m`
    );
    this.commonService.log('swapExactTokensForTokens');
    const json = await this.swapService.getAggregatorSwapJson(
      fromToken.chain,
      chooseSwapPath.aggregator
    );
    const swapContract = new this.web3.eth.Contract(
      json,
      AGGREGATOR_CONTRACT[fromToken.chain][chooseSwapPath.aggregator]
    );
    const receiveAmount =
      chooseSwapPath.amount[chooseSwapPath.amount.length - 1];
    const params = {
      amountIn: new BigNumber(inputAmount)
        .shiftedBy(fromToken.decimals)
        .dp(0)
        .toFixed(),
      swapAmountOutMin: this.swapService.getMinAmountOut(
        receiveAmount,
        slipValue
      ),
      path: chooseSwapPath.assetHashPath,
      to: toAddress,
      deadline: Math.floor(Date.now() / 1000 + deadline * 60),
    };
    this.commonService.log(params);
    const data = swapContract.methods
      .swapExactTokensForTokensSupportingFeeOnTransferTokens(
        params.amountIn,
        params.swapAmountOutMin,
        params.path,
        params.to,
        params.deadline
      )
      .encodeABI();
    const requestData = {
      method: 'eth_sendTransaction',
      params: [
        this.commonService.getSendTransactionParams(
          fromAddress,
          AGGREGATOR_CONTRACT[fromToken.chain][chooseSwapPath.aggregator],
          data
        ),
      ],
    };
    if (
      (await this.commonService.getPreExecutionResult(
        requestData.params,
        fromToken
      )) !== true
    ) {
      return;
    }
    return this.metaMaskWalletApiService
      .sendTransaction(requestData, fromToken.chain)
      .then((hash) => {
        this.commonService.log(hash);
        this.handleTx(
          fromToken,
          toToken,
          inputAmount,
          receiveAmount,
          hash,
          'swap',
          TransactionType.swap,
          false
        );
        return hash;
      });
  }
  async swapExactETHForTokensCrossChain(
    fromToken: Token,
    toToken: Token,
    chooseSwapPath: AssetQueryResponseItem,
    inputAmount: string,
    fromAddress: string,
    toAddress: string,
    slipValue: number,
    polyFee: string,
    deadline: number
  ): Promise<string> {
    this.commonService.log(
      `\u001b[32m  ✓ ${chooseSwapPath.aggregator} \u001b[0m`
    );
    this.commonService.log('swapExactETHForTokensCrossChain');
    const json = await this.swapService.getAggregatorSwapJson(
      fromToken.chain,
      chooseSwapPath.aggregator
    );
    const swapContract = new this.web3.eth.Contract(
      json,
      AGGREGATOR_CONTRACT[fromToken.chain][chooseSwapPath.aggregator]
    );
    const amountOutA = chooseSwapPath.amount[chooseSwapPath.amount.length - 2];
    const bigNumberPolyFee = new BigNumber(polyFee)
      .shiftedBy(18)
      .dp(0)
      .toFixed();
    const receiveAmount =
      chooseSwapPath.amount[chooseSwapPath.amount.length - 1];
    const params = {
      swapAmountOutMin: this.swapService.getMinAmountOut(
        amountOutA,
        O3_AGGREGATOR_SLIPVALUE
      ),
      path: chooseSwapPath.assetHashPath,
      to: toAddress,
      deadline: Math.floor(Date.now() / 1000 + deadline * 60),
      toPoolId: 1,
      toChainId: SWAP_CONTRACT_CHAIN_ID[toToken.chain],
      toAssetHash: this.commonService.add0xHash(toToken.assetID),
      polyMinOutAmount: this.swapService.getMinAmountOut(
        receiveAmount,
        slipValue
      ),
      fee: bigNumberPolyFee,
    };
    this.commonService.log(params);
    const value = new BigNumber(inputAmount)
      .shiftedBy(fromToken.decimals)
      .plus(new BigNumber(bigNumberPolyFee))
      .dp(0)
      .toFixed();
    this.commonService.log(`value: ${value}`);
    const data = swapContract.methods
      .swapExactETHForTokensSupportingFeeOnTransferTokensCrossChain(
        params.swapAmountOutMin,
        params.path,
        params.to,
        params.deadline,
        params.toPoolId,
        params.toChainId,
        params.toAssetHash,
        params.polyMinOutAmount,
        params.fee
      )
      .encodeABI();
    const requestData = {
      method: 'eth_sendTransaction',
      params: [
        this.commonService.getSendTransactionParams(
          fromAddress,
          AGGREGATOR_CONTRACT[fromToken.chain][chooseSwapPath.aggregator],
          data,
          value
        ),
      ],
    };
    if (
      (await this.commonService.getPreExecutionResult(
        requestData.params,
        fromToken
      )) !== true
    ) {
      return;
    }
    return this.metaMaskWalletApiService
      .sendTransaction(requestData, fromToken.chain)
      .then((hash) => {
        this.commonService.log(hash);
        this.handleTx(
          fromToken,
          toToken,
          inputAmount,
          receiveAmount,
          hash,
          'swap',
          TransactionType.swap
        );
        return hash;
      });
  }
  async swapExactTokensForTokensCrossChain(
    fromToken: Token,
    toToken: Token,
    chooseSwapPath: AssetQueryResponseItem,
    inputAmount: string,
    fromAddress: string,
    toAddress: string,
    slipValue: number,
    polyFee: string,
    deadline: number
  ): Promise<string> {
    this.commonService.log(
      `\u001b[32m  ✓ ${chooseSwapPath.aggregator} \u001b[0m`
    );
    this.commonService.log('swapExactTokensForTokensCrossChain');
    const json = await this.swapService.getAggregatorSwapJson(
      fromToken.chain,
      chooseSwapPath.aggregator
    );
    const swapContract = new this.web3.eth.Contract(
      json,
      AGGREGATOR_CONTRACT[fromToken.chain][chooseSwapPath.aggregator]
    );
    const amountOutA = chooseSwapPath.amount[chooseSwapPath.amount.length - 2];
    const bigNumberPolyFee = new BigNumber(polyFee)
      .shiftedBy(18)
      .dp(0)
      .toFixed();
    const receiveAmount =
      chooseSwapPath.amount[chooseSwapPath.amount.length - 1];
    const params = {
      amountIn: new BigNumber(inputAmount)
        .shiftedBy(fromToken.decimals)
        .dp(0)
        .toFixed(),
      swapAmountOutMin: this.swapService.getMinAmountOut(
        amountOutA,
        O3_AGGREGATOR_SLIPVALUE
      ),
      path: chooseSwapPath.assetHashPath,
      to: toAddress,
      deadline: Math.floor(Date.now() / 1000 + deadline * 60),
      toPoolId: 1,
      toChainId: SWAP_CONTRACT_CHAIN_ID[toToken.chain],
      toAssetHash: this.commonService.add0xHash(toToken.assetID),
      polyMinOutAmount: this.swapService.getMinAmountOut(
        receiveAmount,
        slipValue
      ),
      fee: bigNumberPolyFee,
    };
    this.commonService.log(params);
    this.commonService.log(`value: ${bigNumberPolyFee}`);
    const data = swapContract.methods
      .swapExactTokensForTokensSupportingFeeOnTransferTokensCrossChain(
        params.amountIn,
        params.swapAmountOutMin,
        params.path,
        params.to,
        params.deadline,
        params.toPoolId,
        params.toChainId,
        params.toAssetHash,
        params.polyMinOutAmount,
        params.fee
      )
      .encodeABI();
    const requestData = {
      method: 'eth_sendTransaction',
      params: [
        this.commonService.getSendTransactionParams(
          fromAddress,
          AGGREGATOR_CONTRACT[fromToken.chain][chooseSwapPath.aggregator],
          data,
          bigNumberPolyFee
        ),
      ],
    };
    if (
      (await this.commonService.getPreExecutionResult(
        requestData.params,
        fromToken
      )) !== true
    ) {
      return;
    }
    return this.metaMaskWalletApiService
      .sendTransaction(requestData, fromToken.chain)
      .then((hash) => {
        this.commonService.log(hash);
        this.handleTx(
          fromToken,
          toToken,
          inputAmount,
          receiveAmount,
          hash,
          'swap',
          TransactionType.swap
        );
        return hash;
      });
  }
  //#endregion

  //#region liquidity
  async addLiquidity(
    fromToken: Token,
    toToken: Token,
    inputAmount: string,
    address: string,
    toChainId: number,
    receiveAmount: string,
    fee: string,
    poolId: number = 1
  ): Promise<string> {
    this.commonService.log('add liquidity');
    const json = await this.swapService.getSwapJson('swapper');
    const swapContract = new this.web3.eth.Contract(
      json,
      ETH_CROSS_SWAP_CONTRACT_HASH[fromToken.chain]
    );
    const bigNumberPolyFee = new BigNumber(fee).shiftedBy(18).dp(0).toFixed();
    const params = {
      fromAssetHash: this.commonService.add0xHash(fromToken.assetID),
      toPoolId: poolId,
      toChainId,
      toAddress: address,
      amount: new BigNumber(inputAmount)
        .shiftedBy(fromToken.decimals)
        .toFixed(),
      minOutAmount: this.swapService.getMinAmountOut(
        receiveAmount,
        BRIDGE_SLIPVALUE
      ),
      fee: bigNumberPolyFee,
      id: 1,
    };
    this.commonService.log(params);
    this.commonService.log(`value: ${bigNumberPolyFee}`);
    const data = swapContract.methods
      .add_liquidity(
        params.fromAssetHash,
        params.toPoolId,
        params.toChainId,
        params.toAddress,
        params.amount,
        params.minOutAmount,
        params.fee,
        params.id
      )
      .encodeABI();
    const requestData = {
      method: 'eth_sendTransaction',
      params: [
        this.commonService.getSendTransactionParams(
          address,
          ETH_CROSS_SWAP_CONTRACT_HASH[fromToken.chain],
          data,
          bigNumberPolyFee
        ),
      ],
    };
    if (
      (await this.commonService.getPreExecutionResult(
        requestData.params,
        fromToken
      )) !== true
    ) {
      return;
    }
    return this.metaMaskWalletApiService
      .sendTransaction(requestData, fromToken.chain)
      .then((hash) => {
        this.commonService.log(hash);
        this.handleTx(
          fromToken,
          toToken,
          inputAmount,
          receiveAmount,
          hash,
          'liquidity',
          TransactionType.deposit
        );
        return hash;
      });
  }
  async removeLiquidity(
    fromToken: Token, // LP token
    toToken: Token,
    inputAmount: string,
    address: string,
    toChainId: number,
    receiveAmount: string,
    fee: string,
    poolId: number = 1
  ): Promise<string> {
    this.commonService.log('remove liquidity');
    const json = await this.swapService.getSwapJson('swapper');
    const swapContract = new this.web3.eth.Contract(
      json,
      ETH_CROSS_SWAP_CONTRACT_HASH[fromToken.chain]
    );
    const bigNumberPolyFee = new BigNumber(fee).shiftedBy(18).dp(0).toFixed();
    const params = {
      fromAssetHash: this.commonService.add0xHash(fromToken.assetID),
      toPoolId: poolId,
      toChainId,
      toAssetHash: this.commonService.add0xHash(toToken.assetID),
      toAddress: address,
      amount: new BigNumber(inputAmount)
        .shiftedBy(fromToken.decimals)
        .toFixed(),
      minOutAmount: this.swapService.getMinAmountOut(
        receiveAmount,
        BRIDGE_SLIPVALUE
      ),
      fee: bigNumberPolyFee,
      id: 1,
    };
    this.commonService.log(params);
    this.commonService.log(`value: ${bigNumberPolyFee}`);
    const data = swapContract.methods
      .remove_liquidity(
        params.fromAssetHash,
        params.toPoolId,
        params.toChainId,
        params.toAssetHash,
        params.toAddress,
        params.amount,
        params.minOutAmount,
        params.fee,
        params.id
      )
      .encodeABI();
    const requestData = {
      method: 'eth_sendTransaction',
      params: [
        this.commonService.getSendTransactionParams(
          address,
          ETH_CROSS_SWAP_CONTRACT_HASH[fromToken.chain],
          data,
          bigNumberPolyFee
        ),
      ],
    };
    if (
      (await this.commonService.getPreExecutionResult(
        requestData.params,
        fromToken
      )) !== true
    ) {
      return;
    }
    return this.metaMaskWalletApiService
      .sendTransaction(requestData, fromToken.chain)
      .then((hash) => {
        this.commonService.log(hash);
        this.handleTx(
          fromToken,
          toToken,
          inputAmount,
          receiveAmount,
          hash,
          'liquidity',
          TransactionType.withdraw
        );
        return hash;
      });
  }
  //#endregion

  //#region approve
  async getAllowance(
    fromToken: Token,
    fromAddress: string,
    spender: string
  ): Promise<any> {
    this.commonService.log('\u001b[32m  ✓ start get allowance \u001b[0m');
    let tokenhash = fromToken.assetID;
    if (fromToken.assetID === ETH_SOURCE_ASSET_HASH) {
      tokenhash = WETH_ASSET_HASH[fromToken.chain].assetID;
    }
    const json = await this.swapService.getSwapJson('ethErc20');
    const ethErc20Contract = new this.web3.eth.Contract(json, tokenhash);
    const data = ethErc20Contract.methods
      .allowance(fromAddress, spender)
      .encodeABI();
    const requestData = {
      method: 'eth_call',
      params: [
        this.commonService.getSendTransactionParams(
          fromAddress,
          tokenhash,
          data
        ),
        'latest',
      ],
    };
    return this.metaMaskWalletApiService
      .sendTransaction(requestData, fromToken.chain)
      .then((result) => {
        this.commonService.log('allowance: ' + result);
        if (new BigNumber(result, 16).isNaN()) {
          return 0;
        }
        return new BigNumber(result, 16)
          .shiftedBy(-fromToken.decimals)
          .toFixed();
      });
  }
  async approve(
    txAtPage: TxAtPage,
    fromToken: Token,
    fromAddress: string,
    aggregator?: string,
    spender?: string
  ): Promise<any> {
    let approveToken = fromToken;
    if (fromToken.assetID === ETH_SOURCE_ASSET_HASH) {
      approveToken = this.chainTokens[fromToken.chain].find(
        (item: Token) =>
          item.assetID === WETH_ASSET_HASH[fromToken.chain].assetID
      );
    }
    let contract = ETH_CROSS_SWAP_CONTRACT_HASH[fromToken.chain];
    if (aggregator) {
      contract = AGGREGATOR_CONTRACT[fromToken.chain][aggregator];
    }
    if (spender) {
      contract = spender;
    }
    const json = await this.swapService.getSwapJson('ethErc20');
    const ethErc20Contract = new this.web3.eth.Contract(
      json,
      approveToken.assetID
    );
    const data = ethErc20Contract.methods
      .approve(
        contract,
        '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
      )
      .encodeABI();
    const requestData = {
      method: 'eth_sendTransaction',
      params: [
        this.commonService.getSendTransactionParams(
          fromAddress,
          approveToken.assetID,
          data
        ),
      ],
    };
    return this.metaMaskWalletApiService
      .sendTransaction(requestData, fromToken.chain)
      .then((hash) => {
        if (txAtPage === 'vault') {
          this.vaultEthWalletApiService.handleTx(
            approveToken,
            '0',
            hash,
            TransactionType.approve,
            contract,
            fromAddress
          );
        } else {
          this.handleTx(
            approveToken,
            approveToken,
            '0',
            '0',
            hash,
            txAtPage,
            TransactionType.approve,
            false,
            contract,
            fromAddress
          );
        }
        return hash;
      });
  }
  //#endregion

  //#region private function
  private handleTx(
    fromToken: Token,
    toToken: Token,
    inputAmount: string,
    receiveAmount: string,
    txHash: string,
    txAtPage: TxAtPage,
    transactionType: TransactionType,
    hasCrossChain = true,
    contract?: string,
    fromAddress?: string
  ): void {
    if (!txHash) {
      return;
    }
    const pendingTx: MyTransaction = {
      txid: this.commonService.remove0xHash(txHash),
      isPending: true,
      isFailed: false,
      fromToken,
      toToken,
      amount: inputAmount,
      receiveAmount: new BigNumber(receiveAmount)
        .shiftedBy(-toToken.decimals)
        .toFixed(),
      transactionType,
      contract,
      fromAddress,
    };
    if (hasCrossChain) {
      pendingTx.progress = {
        step1: { hash: this.commonService.remove0xHash(txHash), status: 1 },
        step2: { hash: '', status: 0 },
        step3: { hash: '', status: 0 },
      };
    }
    this.commonService.showTxDetail(pendingTx);
    this.store.dispatch({ type: ADD_TX, data: pendingTx });
    this.listenTxReceipt(pendingTx);
  }
  listenTxReceipt(pendingTx: MyTransaction): void {
    const myInterval = interval(5000).subscribe(() => {
      this.rpcApiService
        .getEthTxReceipt(pendingTx.txid, pendingTx.fromToken.chain)
        .subscribe(
          (receipt) => {
            if (receipt) {
              myInterval.unsubscribe();
              if (new BigNumber(receipt.status, 16).isZero()) {
                pendingTx.isPending = false;
                pendingTx.isFailed = true;
                this.store.dispatch({ type: UPDATE_TX, data: pendingTx });
              } else {
                if (!pendingTx.progress) {
                  pendingTx.isPending = false;
                  this.swapService.getEthBalance(pendingTx.fromToken.chain);
                  this.store.dispatch({ type: UPDATE_TX, data: pendingTx });
                } else {
                  this.apiService.setRequestCrossInterval(pendingTx);
                }
              }
            }
          },
          (error) => {
            myInterval.unsubscribe();
            this.commonService.log(error);
          }
        );
    });
  }
  private getEthDapiService(token: Token): any {
    return this.walletName[token.chain] === 'MetaMask' ||
      !this.walletName[token.chain]
      ? this.metaMaskWalletApiService
      : this.o3EthWalletApiService;
  }
  //#endregion
}
