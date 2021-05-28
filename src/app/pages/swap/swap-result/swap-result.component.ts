import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import {
  O3_AGGREGATOR_FEE,
  Token,
  NeoWalletName,
  AssetQueryResponse,
  AssetQueryResponseItem,
  SwapStateType,
  EthWalletName,
  USD_TOKENS,
  SOURCE_TOKEN_SYMBOL,
  WETH_ASSET_HASH,
  ConnectChainType,
  ETH_SOURCE_ASSET_HASH,
  NEO_TOKEN,
  NNEO_TOKEN,
  MESSAGE,
  O3_TOKEN,
  POLY_WRAPPER_CONTRACT_HASH,
  INIT_CHAIN_TOKENS,
  ETH_CROSS_SWAP_CONTRACT_HASH,
  AGGREGATOR_CONTRACT,
  MyTransaction,
  TransactionType,
} from '@lib';
import { ApiService, CommonService, EthApiService, NeoApiService } from '@core';
import { NzMessageService } from 'ng-zorro-antd/message';
import BigNumber from 'bignumber.js';
import { interval, Observable, timer, Unsubscribable } from 'rxjs';
import { Store } from '@ngrx/store';
import { NzModalRef, NzModalService } from 'ng-zorro-antd/modal';
import {
  ApproveModalComponent,
  ApproveDrawerComponent,
  SwapExchangeDrawerComponent,
  SwapExchangeModalComponent,
} from '@shared';
import { take } from 'rxjs/operators';
import { NzDrawerService } from 'ng-zorro-antd/drawer';

interface State {
  swap: SwapStateType;
  setting: any;
  rates: any;
  language: any;
  app: any;
}

@Component({
  selector: 'app-swap-result',
  templateUrl: './swap-result.component.html',
  styleUrls: [
    '../common.scss',
    './swap-result.component.scss',
    './mobile.scss',
  ],
})
export class SwapResultComponent implements OnInit, OnDestroy {
  SOURCE_TOKEN_SYMBOL = SOURCE_TOKEN_SYMBOL;
  @Input() fromToken: Token;
  @Input() toToken: Token;
  @Input() inputAmount: string; // Token amount
  @Input() initData: any;
  @Output() closePage = new EventEmitter<any>();
  @Output() swapFail = new EventEmitter();

  inquiryOptions = {
    path: '/assets/json/Inquerying.json',
  };

  // setting modal
  setting$: Observable<any>;
  settingUnScribe: Unsubscribable;
  slipValue: number;
  deadline: number;

  ratesUnScribe: Unsubscribable;
  rates$: Observable<any>;
  rates = {};

  swap$: Observable<any>;
  swapUnScribe: Unsubscribable;
  neoAccountAddress: string;
  ethAccountAddress: string;
  bscAccountAddress: string;
  hecoAccountAddress: string;
  neoWalletName: NeoWalletName;
  ethWalletName: EthWalletName;
  bscWalletName: EthWalletName;
  hecoWalletName: EthWalletName;
  tokenBalance = { ETH: {}, NEO: {}, BSC: {}, HECO: {} };

  TOKENS: Token[] = []; // All tokens
  O3_AGGREGATOR_FEE = O3_AGGREGATOR_FEE;
  showInquiry: boolean;
  inquiryInterval: Unsubscribable; // inquiry timer
  seconds = 30;
  inquiryTime = this.seconds;

  chooseSwapPath: AssetQueryResponseItem;
  chooseSwapPathIndex: number;
  receiveSwapPathArray: AssetQueryResponse;
  price: string; // Swap rate
  lnversePrice: string; // Swap inverse Rate

  polyFee: string;
  showPolyFee = false;
  showO3SwapFee = false;
  polyFeeSymbol: string;

  fromAddress: string;
  toAddress: string;
  showConnectWallet = false;
  connectChainType: ConnectChainType;
  isSwapCanClick = true;

  langPageName = 'swap';
  langUnScribe: Unsubscribable;
  language$: Observable<any>;
  lang: string;

  appUnScribe: Unsubscribable;
  app$: Observable<any>;
  chainTokens = INIT_CHAIN_TOKENS;
  transactions: MyTransaction[];

  private loader: NzModalRef = null;
  constructor(
    public store: Store<State>,
    private apiService: ApiService,
    private nzMessage: NzMessageService,
    private commonService: CommonService,
    private modal: NzModalService,
    private drawerService: NzDrawerService,
    private ethApiService: EthApiService,
    private neoApiService: NeoApiService
  ) {
    this.language$ = store.select('language');
    this.langUnScribe = this.language$.subscribe((state) => {
      this.lang = state.language;
    });
    this.swap$ = store.select('swap');
    this.setting$ = store.select('setting');
    this.rates$ = store.select('rates');
    this.app$ = store.select('app');
    this.appUnScribe = this.app$.subscribe((state) => {
      this.chainTokens = state.chainTokens;
      this.transactions = state.transactions;
    });
  }

  ngOnInit(): void {
    this.init();
    this.checkO3SwapFee();
    this.getSwapPathFun();
    this.getNetworkFee();
    this.setInquiryInterval();
    this.swapUnScribe = this.swap$.subscribe((state) => {
      this.neoAccountAddress = state.neoAccountAddress;
      this.ethAccountAddress = state.ethAccountAddress;
      this.bscAccountAddress = state.bscAccountAddress;
      this.hecoAccountAddress = state.hecoAccountAddress;
      this.neoWalletName = state.neoWalletName;
      this.ethWalletName = state.ethWalletName;
      this.bscWalletName = state.bscWalletName;
      this.hecoWalletName = state.hecoWalletName;
      this.tokenBalance.NEO = state.balances;
      this.tokenBalance.ETH = state.ethBalances;
      this.tokenBalance.BSC = state.bscBalances;
      this.tokenBalance.HECO = state.hecoBalances;
      this.getFromAndToAddress();
    });
    this.settingUnScribe = this.setting$.subscribe((state) => {
      this.slipValue = state.slipValue;
      this.deadline = state.deadline;
    });
    this.ratesUnScribe = this.rates$.subscribe((state) => {
      this.rates = state.rates;
      this.handleReceiveSwapPathFiat();
    });
  }

  ngOnDestroy(): void {
    if (this.inquiryInterval) {
      this.inquiryInterval.unsubscribe();
    }
    if (this.swapUnScribe) {
      this.swapUnScribe.unsubscribe();
    }
    if (this.settingUnScribe) {
      this.settingUnScribe.unsubscribe();
    }
    if (this.ratesUnScribe) {
      this.ratesUnScribe.unsubscribe();
    }
    if (this.langUnScribe) {
      this.langUnScribe.unsubscribe();
    }
    if (this.appUnScribe) {
      this.appUnScribe.unsubscribe();
    }
    if (this.loader) {
      this.loader.destroy();
    }
  }

  init(): void {
    if (this.initData) {
      this.chooseSwapPath = this.initData.chooseSwapPath;
      this.chooseSwapPathIndex = this.initData.chooseSwapPathIndex;
      this.receiveSwapPathArray = this.initData.receiveSwapPathArray;
      this.price = this.initData.price;
      this.lnversePrice = this.initData.lnversePrice;
      this.polyFee = this.initData.polyFee;
      this.polyFeeSymbol = this.initData.polyFeeSymbol;
      this.showO3SwapFee = this.initData.showO3SwapFee;
      this.showInquiry = false;
    } else {
      this.showInquiry = true;
    }
  }

  setInquiryInterval(): void {
    this.inquiryTime = this.seconds;
    if (this.inquiryInterval) {
      this.inquiryInterval.unsubscribe();
    }
    this.inquiryInterval = interval(1000)
      .pipe(take(this.seconds))
      .subscribe((time) => {
        time++;
        this.inquiryTime = this.seconds - time;
        if (time === this.seconds) {
          this.getSwapPathFun();
          this.getNetworkFee();
          timer(1000).subscribe(() => {
            this.setInquiryInterval();
          });
        }
      });
  }

  backToHomePage(): void {
    const initData = {
      chooseSwapPath: this.chooseSwapPath,
      chooseSwapPathIndex: this.chooseSwapPathIndex,
      receiveSwapPathArray: this.receiveSwapPathArray,
      price: this.price,
      lnversePrice: this.lnversePrice,
      polyFee: this.polyFee,
      polyFeeSymbol: this.polyFeeSymbol,
      showO3SwapFee: this.showO3SwapFee,
    };
    this.closePage.emit(initData);
  }

  showRoutingModal(): void {
    let modal;
    if (!this.commonService.isMobileWidth()) {
      modal = this.modal.create({
        nzContent: SwapExchangeModalComponent,
        nzFooter: null,
        nzTitle: null,
        nzClosable: false,
        nzClassName: 'custom-modal',
        nzComponentParams: {
          chooseSwapPathIndex: this.chooseSwapPathIndex,
          receiveSwapPathArray: this.receiveSwapPathArray,
        },
      });
    } else {
      modal = this.drawerService.create({
        nzContent: SwapExchangeDrawerComponent,
        nzTitle: null,
        nzClosable: false,
        nzPlacement: 'bottom',
        nzWrapClassName: 'custom-drawer swap-exchange',
        nzContentParams: {
          chooseSwapPathIndex: this.chooseSwapPathIndex,
          receiveSwapPathArray: this.receiveSwapPathArray,
        },
      });
    }
    modal.afterClose.subscribe((index) => {
      if (index >= 0) {
        this.chooseSwapPathIndex = index;
        this.chooseSwapPath = this.receiveSwapPathArray[index];
        this.calculationPrice();
      }
    });
  }

  checkCanSwap(): boolean {
    if (
      this.chooseSwapPath &&
      new BigNumber(this.chooseSwapPath.receiveAmount).comparedTo(0) > 0
    ) {
      return true;
    }
    return false;
  }

  async swap(): Promise<void> {
    if (this.checkWalletConnect() === false) {
      return;
    }
    if (!this.fromAddress || !this.toAddress) {
      this.getFromAndToAddress();
    }
    if (
      this.fromToken.chain !== 'NEO' &&
      this.ethApiService.checkNetwork(this.fromToken) === false
    ) {
      return;
    }
    if (this.checkBalance() === false) {
      return;
    }
    this.loader = this.commonService.loading(TransactionType.swap, {
      symbol1: this.fromToken.symbol,
      symbol2: this.toToken.symbol,
      value1: this.inputAmount,
      value2: this.chooseSwapPath?.receiveAmount,
    });
    const showApprove = await this.checkShowApprove();
    if (showApprove === true) {
      this.inquiryInterval.unsubscribe();
      this.showApproveModal();
      this.loader?.close();
      return;
    }
    if (showApprove === 'error') {
      this.loader?.close();
      return;
    }
    if (this.inquiryInterval) {
      this.inquiryInterval.unsubscribe();
    }
    if (this.isSwapCanClick) {
      this.isSwapCanClick = false;
      setTimeout(() => {
        this.isSwapCanClick = true;
      }, 4000);
    } else {
      return;
    }

    // neo same chain
    if (this.fromToken.chain === 'NEO' && this.toToken.chain === 'NEO') {
      if (
        this.fromToken.assetID === NEO_TOKEN.assetID &&
        this.toToken.assetID === NNEO_TOKEN.assetID
      ) {
        this.mintNNeo();
        return;
      }
      if (
        this.fromToken.assetID === NNEO_TOKEN.assetID &&
        this.toToken.assetID === NEO_TOKEN.assetID
      ) {
        this.releaseNeo();
        return;
      }
      this.swapNeo();
      return;
    }
    // neo cross chain
    if (this.fromToken.chain === 'NEO' && this.toToken.chain !== 'NEO') {
      return;
    }
    // eth same chain
    if (this.fromToken.chain === this.toToken.chain) {
      if (
        this.fromToken.assetID === ETH_SOURCE_ASSET_HASH &&
        this.toToken.assetID === WETH_ASSET_HASH[this.toToken.chain].assetID
      ) {
        this.depositWEth();
        return;
      }
      if (
        this.fromToken.assetID ===
          WETH_ASSET_HASH[this.fromToken.chain].assetID &&
        this.toToken.assetID === ETH_SOURCE_ASSET_HASH
      ) {
        this.withdrawalWeth();
        return;
      }
      if (this.toToken.assetID === ETH_SOURCE_ASSET_HASH) {
        this.swapExactTokensForETH();
        return;
      }
      if (this.fromToken.assetID === ETH_SOURCE_ASSET_HASH) {
        this.swapExactETHForTokens();
        return;
      }
      this.swapExactTokensForTokens();
      return;
    }
    // eth cross chain
    if (this.fromToken.chain !== this.toToken.chain) {
      if (
        this.fromToken.assetID === O3_TOKEN.assetID &&
        this.toToken.assetID === O3_TOKEN.assetID
      ) {
        this.swapO3CrossChainEth();
        return;
      }
      const fromUsd = USD_TOKENS.find(
        (item) =>
          item.assetID === this.fromToken.assetID &&
          item.chain === this.fromToken.chain
      );
      const toUsd = USD_TOKENS.find(
        (item) =>
          item.assetID === this.toToken.assetID &&
          item.chain === this.toToken.chain
      );
      if (fromUsd && toUsd) {
        this.swapCrossChainEth();
        return;
      }
      if (!toUsd) {
        return;
      }
      if (this.fromToken.assetID === ETH_SOURCE_ASSET_HASH) {
        this.swapExactETHForTokensCrossChain();
        return;
      } else {
        this.swapExactTokensForTokensCrossChain();
      }
    }
  }
  reGetSwapPath(): void {
    if (this.inquiryInterval) {
      this.inquiryInterval.unsubscribe();
    }
    this.getSwapPathFun();
    this.getNetworkFee();
    this.setInquiryInterval();
  }
  //#region Contract call
  depositWEth(): void {
    this.ethApiService
      .depositWEth(
        this.fromToken,
        this.toToken,
        this.inputAmount,
        this.fromAddress
      )
      .then((res) => {
        if (res) {
          this.closePage.emit();
        }
        this.loader.close();
      });
  }

  withdrawalWeth(): void {
    this.ethApiService
      .withdrawalWeth(
        this.fromToken,
        this.toToken,
        this.inputAmount,
        this.fromAddress
      )
      .then((res) => {
        if (res) {
          this.closePage.emit();
        }
        this.loader.close();
      });
  }

  swapNeoCrossChainEth(): void {
    this.neoApiService
      .swapCrossChain(
        this.fromToken,
        this.toToken,
        this.chooseSwapPath,
        this.inputAmount,
        this.slipValue,
        this.deadline,
        this.ethAccountAddress
      )
      .then((res) => {
        this.commonService.log(res);
        if (res) {
          this.closePage.emit();
        }
        this.loader.close();
      });
  }

  swapNeo(): void {
    this.neoApiService
      .swap(
        this.fromToken,
        this.toToken,
        this.chooseSwapPath,
        this.inputAmount,
        this.slipValue,
        this.deadline
      )
      .then((res) => {
        this.commonService.log(res);
        if (res) {
          this.closePage.emit();
        }
        this.loader.close();
      });
  }

  mintNNeo(): void {
    this.neoApiService
      .mintNNeo(this.fromToken, this.toToken, this.inputAmount)
      .then((res) => {
        this.commonService.log(res);
        if (res) {
          this.closePage.emit();
        }
        this.loader.close();
      });
  }

  releaseNeo(): void {
    this.neoApiService
      .releaseNeo(
        this.fromToken,
        this.toToken,
        this.inputAmount,
        this.neoAccountAddress
      )
      .then((res) => {
        this.commonService.log(res);
        if (res) {
          this.closePage.emit();
        }
        this.loader.close();
      });
  }

  swapExactTokensForETH(): void {
    this.ethApiService
      .swapExactTokensForETH(
        this.fromToken,
        this.toToken,
        this.chooseSwapPath,
        this.inputAmount,
        this.fromAddress,
        this.toAddress,
        this.deadline,
        this.slipValue
      )
      .then((res) => {
        if (res) {
          this.closePage.emit();
        }
        this.loader.close();
      });
  }

  swapExactETHForTokens(): void {
    this.ethApiService
      .swapExactETHForTokens(
        this.fromToken,
        this.toToken,
        this.chooseSwapPath,
        this.inputAmount,
        this.fromAddress,
        this.toAddress,
        this.deadline,
        this.slipValue
      )
      .then((res) => {
        if (res) {
          this.closePage.emit();
        }
        this.loader.close();
      });
  }

  swapExactTokensForTokens(): void {
    this.ethApiService
      .swapExactTokensForTokens(
        this.fromToken,
        this.toToken,
        this.chooseSwapPath,
        this.inputAmount,
        this.fromAddress,
        this.toAddress,
        this.deadline,
        this.slipValue
      )
      .then((res) => {
        if (res) {
          this.closePage.emit();
        }
        this.loader.close();
      });
  }

  swapExactETHForTokensCrossChain(): void {
    this.ethApiService
      .swapExactETHForTokensCrossChain(
        this.fromToken,
        this.toToken,
        this.chooseSwapPath,
        this.inputAmount,
        this.fromAddress,
        this.toAddress,
        this.slipValue,
        this.polyFee,
        this.deadline
      )
      .then((res) => {
        if (res) {
          this.closePage.emit();
        }
        this.loader.close();
      });
  }
  swapExactTokensForTokensCrossChain(): void {
    this.ethApiService
      .swapExactTokensForTokensCrossChain(
        this.fromToken,
        this.toToken,
        this.chooseSwapPath,
        this.inputAmount,
        this.fromAddress,
        this.toAddress,
        this.slipValue,
        this.polyFee,
        this.deadline
      )
      .then((res) => {
        if (res) {
          this.closePage.emit();
        }
        this.loader.close();
      });
  }

  swapO3CrossChainEth(): void {
    this.ethApiService
      .swapO3CrossChain(
        this.fromToken,
        this.toToken,
        this.inputAmount,
        this.fromAddress,
        this.toAddress,
        new BigNumber(this.chooseSwapPath.receiveAmount)
          .shiftedBy(O3_TOKEN.decimals)
          .toFixed(),
        this.polyFee,
        'swap'
      )
      .then((res) => {
        if (res) {
          this.closePage.emit();
        }
        this.loader.close();
      });
  }

  swapCrossChainEth(): void {
    this.ethApiService
      .swapCrossChain(
        this.fromToken,
        this.toToken,
        this.inputAmount,
        this.fromAddress,
        this.toAddress,
        this.chooseSwapPath.amount[this.chooseSwapPath.amount.length - 1],
        this.slipValue,
        this.polyFee,
        'swap'
      )
      .then((res) => {
        if (res) {
          this.closePage.emit();
        }
        this.loader.close();
      });
  }
  //#endregion

  //#region
  showApproveModal(): void {
    let walletName: string;
    switch (this.fromToken.chain) {
      case 'ETH':
        walletName = this.ethWalletName;
        break;
      case 'BSC':
        walletName = this.bscWalletName;
        break;
      case 'HECO':
        walletName = this.hecoWalletName;
        break;
    }
    let spender;
    if (
      this.fromToken.assetID === O3_TOKEN.assetID &&
      this.toToken.assetID === O3_TOKEN.assetID
    ) {
      spender = POLY_WRAPPER_CONTRACT_HASH[this.fromToken.chain];
    }
    let approveToken = this.fromToken;
    if (this.fromToken.assetID === ETH_SOURCE_ASSET_HASH) {
      approveToken = this.chainTokens[this.fromToken.chain].find(
        (item: Token) =>
          item.assetID === WETH_ASSET_HASH[this.fromToken.chain].assetID
      );
    }
    if (!this.commonService.isMobileWidth()) {
      this.modal.create({
        nzContent: ApproveModalComponent,
        nzFooter: null,
        nzTitle: null,
        nzClosable: false,
        nzMaskClosable: false,
        nzClassName: 'custom-modal',
        nzComponentParams: {
          fromToken: approveToken,
          fromAddress: this.fromAddress,
          aggregator: this.chooseSwapPath.aggregator,
          walletName,
          spender,
          txAtPage: 'swap',
        },
      });
    } else {
      this.drawerService.create({
        nzContent: ApproveDrawerComponent,
        nzTitle: null,
        nzClosable: false,
        nzPlacement: 'bottom',
        nzWrapClassName: 'custom-drawer approve',
        nzContentParams: {
          fromToken: approveToken,
          fromAddress: this.fromAddress,
          aggregator: this.chooseSwapPath.aggregator,
          walletName,
          spender,
          txAtPage: 'swap',
        },
      });
    }
  }
  async checkShowApprove(): Promise<any> {
    this.commonService.log('check show approve');
    if (this.fromToken.chain === 'NEO' || this.toToken.chain === 'NEO') {
      this.commonService.log('check show approve return');
      return false;
    }
    if (
      (WETH_ASSET_HASH[this.fromToken.chain] &&
        this.fromToken.assetID ===
          WETH_ASSET_HASH[this.fromToken.chain].assetID &&
        this.toToken.assetID === ETH_SOURCE_ASSET_HASH) ||
      this.fromToken.assetID === ETH_SOURCE_ASSET_HASH
    ) {
      this.commonService.log('check show approve return');
      return false;
    }
    let spender = ETH_CROSS_SWAP_CONTRACT_HASH[this.fromToken.chain];
    if (this.chooseSwapPath.aggregator) {
      spender =
        AGGREGATOR_CONTRACT[this.fromToken.chain][
          this.chooseSwapPath.aggregator
        ];
    }
    if (
      this.fromToken.assetID === O3_TOKEN.assetID &&
      this.toToken.assetID === O3_TOKEN.assetID
    ) {
      spender = POLY_WRAPPER_CONTRACT_HASH[this.fromToken.chain];
    }

    const balance = await this.ethApiService.getAllowance(
      this.fromToken,
      this.fromAddress,
      spender
    );
    if (
      new BigNumber(balance).comparedTo(new BigNumber(this.inputAmount)) >= 0
    ) {
      return false;
    }
    this.transactions.forEach((item) => {
      if (
        item.transactionType === TransactionType.approve &&
        item.isPending &&
        item.contract === spender &&
        item.fromAddress === this.fromAddress &&
        item.fromToken.assetID === this.fromToken.assetID &&
        item.fromToken.chain === this.fromToken.chain
      ) {
        this.nzMessage.error(MESSAGE.waitApprove[this.lang]);
        return 'error';
      }
    });
    return true;
  }
  getSwapPathFun(): void {
    this.chooseSwapPath = null;
    this.apiService
      .getSwapPath(this.fromToken, this.toToken, this.inputAmount)
      .then((res) => {
        this.showInquiry = false;
        if (res && res.length === 0) {
          this.nzMessage.error(MESSAGE.quoteAgain[this.lang]);
        }
        if (!res || res.length === 0) {
          this.swapFail.emit();
        }
        if (res && res.length > 0) {
          this.commonService.log(res);
          this.receiveSwapPathArray = res;
          this.handleReceiveAmount();
          this.handleReceiveSwapPathFiat();
          this.calculationPrice();
        }
      });
  }
  handleReceiveAmount(): void {
    this.receiveSwapPathArray.forEach((item, index) => {
      this.receiveSwapPathArray[index].receiveAmount = new BigNumber(
        item.receiveAmount
      )
        .shiftedBy(-this.toToken.decimals)
        .toFixed();
    });
    this.chooseSwapPathIndex = 0;
    this.chooseSwapPath = this.receiveSwapPathArray[0];
  }
  handleReceiveSwapPathFiat(): void {
    if (!this.receiveSwapPathArray) {
      return;
    }
    const price = this.commonService.getAssetRate(this.rates, this.toToken);
    if (!price) {
      return;
    }
    this.receiveSwapPathArray.forEach((item, index) => {
      // calculate money
      this.receiveSwapPathArray[index].fiat = new BigNumber(item.receiveAmount)
        .multipliedBy(new BigNumber(price))
        .dp(2)
        .toFixed();
    });
  }
  async getNetworkFee(): Promise<void> {
    this.polyFee = '';
    if (this.fromToken.chain !== this.toToken.chain) {
      this.polyFee = await this.apiService.getFromEthPolyFee(
        this.fromToken,
        this.toToken
      );
      if (
        this.fromToken.assetID === O3_TOKEN.assetID &&
        this.toToken.assetID === O3_TOKEN.assetID
      ) {
        this.handleReceiveO3();
        this.polyFeeSymbol = O3_TOKEN.symbol;
      } else {
        this.polyFeeSymbol = SOURCE_TOKEN_SYMBOL[this.fromToken.chain];
      }
    }
  }
  handleReceiveO3(): void {
    if (
      new BigNumber(this.chooseSwapPath.amount[1]).comparedTo(
        new BigNumber(this.polyFee).shiftedBy(O3_TOKEN.decimals)
      ) <= 0
    ) {
      this.chooseSwapPath.receiveAmount = 0;
    } else {
      this.chooseSwapPath.receiveAmount = new BigNumber(
        this.chooseSwapPath.amount[1]
      )
        .minus(new BigNumber(this.polyFee).shiftedBy(O3_TOKEN.decimals))
        .shiftedBy(-O3_TOKEN.decimals)
        .dp(O3_TOKEN.decimals)
        .toFixed();
    }
    this.receiveSwapPathArray.forEach((item) => {
      item.receiveAmount = this.chooseSwapPath.receiveAmount;
    });
    this.handleReceiveSwapPathFiat();
    this.calculationPrice();
  }
  checkO3SwapFee(): void {
    if (this.fromToken.chain === this.toToken.chain) {
      if (
        (this.fromToken.chain === 'NEO' &&
          this.fromToken.assetID === NEO_TOKEN.assetID &&
          this.toToken.assetID === NNEO_TOKEN.assetID) ||
        (this.fromToken.chain === 'NEO' &&
          this.fromToken.assetID === NNEO_TOKEN.assetID &&
          this.toToken.assetID === NEO_TOKEN.assetID) ||
        (this.fromToken.chain === 'ETH' &&
          this.fromToken.assetID === ETH_SOURCE_ASSET_HASH &&
          this.toToken.assetID ===
            WETH_ASSET_HASH[this.toToken.chain].assetID) ||
        (this.fromToken.chain === 'ETH' &&
          this.fromToken.assetID ===
            WETH_ASSET_HASH[this.fromToken.chain].assetID &&
          this.toToken.assetID === ETH_SOURCE_ASSET_HASH) ||
        (this.fromToken.chain === 'BSC' &&
          this.fromToken.assetID ===
            WETH_ASSET_HASH[this.fromToken.chain].assetID &&
          this.toToken.assetID === ETH_SOURCE_ASSET_HASH) ||
        (this.fromToken.chain === 'BSC' &&
          this.fromToken.assetID === ETH_SOURCE_ASSET_HASH &&
          this.toToken.assetID ===
            WETH_ASSET_HASH[this.toToken.chain].assetID) ||
        (this.fromToken.chain === 'HECO' &&
          this.fromToken.assetID === ETH_SOURCE_ASSET_HASH &&
          this.toToken.assetID ===
            WETH_ASSET_HASH[this.toToken.chain].assetID) ||
        (this.fromToken.chain === 'HECO' &&
          this.fromToken.assetID ===
            WETH_ASSET_HASH[this.fromToken.chain].assetID &&
          this.toToken.assetID === ETH_SOURCE_ASSET_HASH)
      ) {
        this.showO3SwapFee = false;
        return;
      }
    } else {
      this.showPolyFee = true;
    }
    if (this.fromToken.chain === 'NEO') {
      this.showO3SwapFee = true;
    }
    const fromUsd = USD_TOKENS.find(
      (item) =>
        item.assetID === this.fromToken.assetID &&
        item.chain === this.fromToken.chain
    );
    const toUsd = USD_TOKENS.find(
      (item) =>
        item.assetID === this.toToken.assetID &&
        item.chain === this.toToken.chain
    );
    if (fromUsd && toUsd) {
      this.showO3SwapFee = false;
    } else {
      this.showO3SwapFee = true;
    }
  }
  calculationPrice(): void {
    if (this.chooseSwapPath && this.chooseSwapPath.receiveAmount === 0) {
      this.price = '--';
      this.lnversePrice = '--';
    }
    if (this.chooseSwapPath && this.chooseSwapPath.receiveAmount) {
      this.price = new BigNumber(this.chooseSwapPath.receiveAmount)
        .dividedBy(new BigNumber(this.inputAmount))
        .dp(7)
        .toFixed();
      this.lnversePrice = new BigNumber(this.inputAmount)
        .dividedBy(new BigNumber(this.chooseSwapPath.receiveAmount))
        .dp(7)
        .toFixed();
    }
  }
  getFromAndToAddress(): void {
    switch (this.fromToken.chain) {
      case 'NEO':
        this.fromAddress = this.neoAccountAddress;
        break;
      case 'ETH':
        this.fromAddress = this.ethAccountAddress;
        break;
      case 'BSC':
        this.fromAddress = this.bscAccountAddress;
        break;
      case 'HECO':
        this.fromAddress = this.hecoAccountAddress;
        break;
    }
    switch (this.toToken.chain) {
      case 'NEO':
        this.toAddress = this.neoAccountAddress;
        break;
      case 'ETH':
        this.toAddress = this.ethAccountAddress;
        break;
      case 'BSC':
        this.toAddress = this.bscAccountAddress;
        break;
      case 'HECO':
        this.toAddress = this.hecoAccountAddress;
        break;
    }
  }
  checkWalletConnect(): boolean {
    if (
      (this.fromToken.chain === 'NEO' || this.toToken.chain === 'NEO') &&
      !this.neoAccountAddress
    ) {
      this.nzMessage.error(MESSAGE.ConnectWalletFirst[this.lang](['NEO']));
      this.showConnectWallet = true;
      this.connectChainType = 'NEO';
      return false;
    }
    if (
      (this.fromToken.chain === 'ETH' || this.toToken.chain === 'ETH') &&
      !this.ethAccountAddress
    ) {
      this.nzMessage.error(MESSAGE.ConnectWalletFirst[this.lang](['ETH']));
      this.showConnectWallet = true;
      this.connectChainType = 'ETH';
      return false;
    }
    if (
      (this.fromToken.chain === 'BSC' || this.toToken.chain === 'BSC') &&
      !this.bscAccountAddress
    ) {
      this.nzMessage.error(MESSAGE.ConnectWalletFirst[this.lang](['BSC']));
      this.showConnectWallet = true;
      this.connectChainType = 'BSC';
      return false;
    }
    if (
      (this.fromToken.chain === 'HECO' || this.toToken.chain === 'HECO') &&
      !this.hecoAccountAddress
    ) {
      this.nzMessage.error(MESSAGE.ConnectWalletFirst[this.lang](['HECO']));
      this.showConnectWallet = true;
      this.connectChainType = 'HECO';
      return false;
    }
    return true;
  }
  checkBalance(): boolean {
    if (!this.tokenBalance || !this.tokenBalance[this.fromToken.chain]) {
      return false;
    }
    const chainBalances = this.tokenBalance[this.fromToken.chain];
    if (
      !chainBalances[this.fromToken.assetID] ||
      new BigNumber(chainBalances[this.fromToken.assetID].amount).comparedTo(
        new BigNumber(this.inputAmount)
      ) < 0
    ) {
      this.nzMessage.error(MESSAGE.InsufficientBalance[this.lang]);
      return false;
    }
    // Have poly fee, swap token
    if (
      this.showPolyFee &&
      this.polyFee &&
      this.fromToken.assetID !== ETH_SOURCE_ASSET_HASH &&
      this.polyFeeSymbol !== 'O3'
    ) {
      if (
        !chainBalances[ETH_SOURCE_ASSET_HASH] ||
        new BigNumber(chainBalances[ETH_SOURCE_ASSET_HASH].amount).comparedTo(
          new BigNumber(this.polyFee)
        ) < 0
      ) {
        this.nzMessage.error(
          MESSAGE.InsufficientPolyFee[this.lang]([
            SOURCE_TOKEN_SYMBOL[this.fromToken.chain],
          ])
        );
        return false;
      }
    }
    // Have poly fee, swap native assets
    if (
      this.showPolyFee &&
      this.polyFee &&
      this.fromToken.assetID === ETH_SOURCE_ASSET_HASH
    ) {
      const allNeedBalance = new BigNumber(this.inputAmount).plus(
        new BigNumber(this.polyFee)
      );
      if (
        !chainBalances[ETH_SOURCE_ASSET_HASH] ||
        new BigNumber(chainBalances[ETH_SOURCE_ASSET_HASH].amount).comparedTo(
          allNeedBalance
        ) < 0
      ) {
        this.nzMessage.error(
          MESSAGE.InsufficientAmountAndPolyFee[this.lang]([
            SOURCE_TOKEN_SYMBOL[this.fromToken.chain],
          ])
        );
        return false;
      }
    }
    return true;
  }
  //#endregion
}
