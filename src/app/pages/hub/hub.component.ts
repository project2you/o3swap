import { Component, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { ApiService, EthApiService, CommonService } from '@core';
import {
  BRIDGE_SLIPVALUE,
  EthWalletName,
  SwapStateType,
  Token,
  USD_TOKENS,
  SOURCE_TOKEN_SYMBOL,
  ConnectChainType,
  ETH_SOURCE_ASSET_HASH,
  CONST_BRIDGE_TOKENS,
  INIT_CHAIN_TOKENS,
  MESSAGE,
  ETH_CROSS_SWAP_CONTRACT_HASH,
  MyTransaction,
  TransactionType,
} from '@lib';
import { Store } from '@ngrx/store';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalRef, NzModalService } from 'ng-zorro-antd/modal';
import BigNumber from 'bignumber.js';
import { interval, Observable, Unsubscribable } from 'rxjs';
import {
  ApproveModalComponent,
  ApproveDrawerComponent,
  HubTokenComponent,
} from '@shared';
import { NzDrawerService } from 'ng-zorro-antd/drawer';

interface State {
  swap: SwapStateType;
  app: any;
  rates: any;
  language: any;
}
@Component({
  selector: 'app-hub',
  templateUrl: './hub.component.html',
  styleUrls: ['./hub.component.scss', './mobile.scss'],
})
export class HubComponent implements OnInit, OnDestroy {
  CONST_BRIDGE_TOKENS = CONST_BRIDGE_TOKENS;
  SOURCE_TOKEN_SYMBOL = SOURCE_TOKEN_SYMBOL;
  BRIDGE_SLIPVALUE = BRIDGE_SLIPVALUE;
  USD_TOKENS = USD_TOKENS;
  fromToken: Token;
  toToken: Token;

  inputAmount: string;
  inputAmountFiat: string; // Dollar value of token amount
  inputAmountError: string;

  receiveAmount: string;
  receiveAmountFiat: string; // The value of the dollar received

  swapUnScribe: Unsubscribable;
  swap$: Observable<any>;
  ethAccountAddress: string;
  bscAccountAddress: string;
  hecoAccountAddress: string;
  ethWalletName: EthWalletName;
  bscWalletName: EthWalletName;
  hecoWalletName: EthWalletName;
  tokenBalances = { ETH: {}, BSC: {}, HECO: {} };

  appUnScribe: Unsubscribable;
  app$: Observable<any>;
  chainTokens = INIT_CHAIN_TOKENS;
  transactions: MyTransaction[];

  ratesUnScribe: Unsubscribable;
  rates$: Observable<any>;
  rates = {};

  fromAddress: string;
  toAddress: string;
  bridgeRate: string;
  polyFee: string;

  showFromTokenList = false;
  showToTokenList = false;
  showFromTokenListModalTimeout;
  showToTokenListModalTimeout;
  showConnectWallet = false;
  connectChainType: ConnectChainType;

  langPageName = 'hub';
  langUnScribe: Unsubscribable;
  language$: Observable<any>;
  lang: string;

  private loader: NzModalRef = null;
  constructor(
    public store: Store<State>,
    private apiService: ApiService,
    private modal: NzModalService,
    private nzMessage: NzMessageService,
    private changeDetectorRef: ChangeDetectorRef,
    private commonService: CommonService,
    private drawerService: NzDrawerService,
    private ethApiService: EthApiService
  ) {
    this.language$ = store.select('language');
    this.langUnScribe = this.language$.subscribe((state) => {
      this.lang = state.language;
    });
    this.swap$ = store.select('swap');
    this.app$ = store.select('app');
    this.rates$ = store.select('rates');
  }
  ngOnDestroy(): void {
    if (this.swapUnScribe) {
      this.swapUnScribe.unsubscribe();
    }
    if (this.appUnScribe) {
      this.appUnScribe.unsubscribe();
    }
    if (this.ratesUnScribe) {
      this.ratesUnScribe.unsubscribe();
    }
    if (this.langUnScribe) {
      this.langUnScribe.unsubscribe();
    }
  }

  ngOnInit(): void {
    this.fromToken = JSON.parse(JSON.stringify(USD_TOKENS[0]));
    this.swapUnScribe = this.swap$.subscribe((state) => {
      this.ethAccountAddress = state.ethAccountAddress;
      this.bscAccountAddress = state.bscAccountAddress;
      this.hecoAccountAddress = state.hecoAccountAddress;
      this.ethWalletName = state.ethWalletName;
      this.bscWalletName = state.bscWalletName;
      this.hecoWalletName = state.hecoWalletName;
      this.getFromAndToAddress();
      this.handleAccountBalance(state);
    });
    this.appUnScribe = this.app$.subscribe((state) => {
      this.chainTokens = state.chainTokens;
      this.transactions = state.transactions;
    });
    this.ratesUnScribe = this.rates$.subscribe((state) => {
      this.rates = state.rates;
      this.calcutionInputAmountFiat();
      this.calcutionReceiveAmountFiat();
    });
  }

  clickShowTokenListModal(type: 'from' | 'to'): void {
    if (!this.commonService.isMobileWidth()) {
      return;
    }
    const drawerRef = this.drawerService.create({
      nzContent: HubTokenComponent,
      nzTitle: null,
      nzClosable: false,
      nzPlacement: 'bottom',
      nzWrapClassName: 'custom-drawer',
    });
    drawerRef.afterClose.subscribe((token) => {
      if (token) {
        this.selectToken(type, token);
      }
    });
  }

  showTokenListModal(type: 'from' | 'to'): void {
    if (this.commonService.isMobileWidth()) {
      return;
    }
    if (type === 'from') {
      clearTimeout(this.showFromTokenListModalTimeout);
      this.showFromTokenList = true;
    } else {
      clearTimeout(this.showToTokenListModalTimeout);
      this.showToTokenList = true;
    }
  }

  hideTokenListModal(type: 'from' | 'to'): void {
    if (type === 'from') {
      this.showFromTokenListModalTimeout = setTimeout(() => {
        this.showFromTokenList = false;
      }, 200);
    } else {
      this.showToTokenListModalTimeout = setTimeout(() => {
        this.showToTokenList = false;
      }, 200);
    }
  }

  selectToken(type: 'from' | 'to', token: Token): void {
    this.showFromTokenList = false;
    this.showToTokenList = false;
    if (type === 'from') {
      this.fromToken = token;
      if (
        this.toToken &&
        this.toToken.assetID === token.assetID &&
        this.toToken.chain === token.chain
      ) {
        this.toToken = null;
        this.toAddress = null;
      }
      this.checkInputAmountDecimal();
      this.checkInputAmountLimit();
      this.calcutionInputAmountFiat();
      this.getFromTokenAmount();
    } else {
      this.toToken = token;
      if (
        this.fromToken &&
        this.fromToken.assetID === token.assetID &&
        this.fromToken.chain === token.chain
      ) {
        this.fromToken = null;
        this.fromAddress = null;
      }
    }
    this.getNetworkFee();
    this.getFromAndToAddress();
    this.calcutionReceiveAmount();
  }
  exchangeToken(): void {
    if (this.toToken || this.fromToken) {
      const temp = this.fromToken;
      this.fromToken = this.toToken;
      this.toToken = temp;
      this.checkInputAmountDecimal();
      this.checkInputAmountLimit();
      this.calcutionInputAmountFiat();
      this.calcutionReceiveAmount();
      this.getFromAndToAddress();
      this.getNetworkFee();
      this.getFromTokenAmount();
    }
  }

  allInputAmount(): void {
    this.inputAmountError = '';
    this.inputAmount = (this.fromToken && this.fromToken.amount) || '0';
    this.calcutionInputAmountFiat();
    this.calcutionReceiveAmount();
    this.checkInputAmountLimit();
  }

  changeInputAmount($event): void {
    this.inputAmount = $event.target.value;
    this.checkInputAmountDecimal();
    this.checkInputAmountLimit();
    this.calcutionInputAmountFiat();
    this.calcutionReceiveAmount();
  }

  checkCanInquiry(): boolean {
    if (!this.fromToken || !this.toToken || !this.inputAmount) {
      return false;
    }
    if (new BigNumber(this.inputAmount).comparedTo(0) <= 0) {
      return false;
    }
    if (this.checkInputAmountDecimal() === false) {
      return false;
    }
    if (this.checkInputAmountLimit() === false) {
      return false;
    }
    if (
      !this.receiveAmount ||
      (this.receiveAmount &&
        new BigNumber(this.receiveAmount).comparedTo(0) <= 0)
    ) {
      return false;
    }
    return true;
  }

  async swap(): Promise<void> {
    if (this.checkWalletConnect() === false) {
      return;
    }
    if (!this.fromAddress || !this.toAddress) {
      this.getFromAndToAddress();
    }
    if (this.ethApiService.checkNetwork(this.fromToken) === false) {
      return;
    }
    if (this.checkBalance() === false) {
      return;
    }
    this.loader = this.commonService.loading(TransactionType.swap, {
      symbol1: this.fromToken.symbol,
      symbol2: this.toToken.symbol,
      value1: this.inputAmount,
      value2: this.receiveAmount,
    });
    const showApprove = await this.checkShowApprove();
    if (showApprove === true) {
      this.showApproveModal();
      this.loader?.close();
      return;
    }
    if (showApprove === 'error') {
      this.loader?.close();
      return;
    }
    const bigNumberReceive = new BigNumber(this.receiveAmount)
      .shiftedBy(this.toToken.decimals)
      .dp(0)
      .toFixed();
    this.ethApiService
      .swapCrossChain(
        this.fromToken,
        this.toToken,
        this.inputAmount,
        this.fromAddress,
        this.toAddress,
        bigNumberReceive,
        BRIDGE_SLIPVALUE,
        this.polyFee,
        'bridge'
      )
      .then((res) => {
        if (res) {
          this.resetSwapData();
        }
        this.loader.close();
      });
  }

  //#region
  async getNetworkFee(): Promise<void> {
    this.polyFee = '';
    if (this.fromToken && this.toToken) {
      this.polyFee = await this.apiService.getFromEthPolyFee(
        this.fromToken,
        this.toToken
      );
    }
  }
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
    if (!this.commonService.isMobileWidth()) {
      this.modal.create({
        nzContent: ApproveModalComponent,
        nzFooter: null,
        nzTitle: null,
        nzClosable: false,
        nzMaskClosable: false,
        nzClassName: 'custom-modal',
        nzComponentParams: {
          fromToken: this.fromToken,
          fromAddress: this.fromAddress,
          walletName,
          txAtPage: 'bridge',
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
          fromToken: this.fromToken,
          fromAddress: this.fromAddress,
          walletName,
          txAtPage: 'bridge',
        },
      });
    }
  }
  resetSwapData(): void {
    this.fromToken = JSON.parse(JSON.stringify(USD_TOKENS[0]));
    this.toToken = null;
    this.inputAmount = null;
    this.inputAmountFiat = null;
    this.receiveAmount = null;
    this.receiveAmountFiat = null;
    this.fromAddress = null;
    this.toAddress = null;
    this.bridgeRate = null;
  }
  handleAccountBalance(state): void {
    this.tokenBalances.ETH = state.ethBalances;
    this.tokenBalances.BSC = state.bscBalances;
    this.tokenBalances.HECO = state.hecoBalances;
    this.getFromTokenAmount();
  }
  getFromTokenAmount(): void {
    if (!this.fromToken) {
      return;
    }
    this.fromToken.amount = '0';
    if (this.tokenBalances[this.fromToken.chain][this.fromToken.assetID]) {
      this.fromToken.amount = this.tokenBalances[this.fromToken.chain][
        this.fromToken.assetID
      ].amount;
    }
    this.changeDetectorRef.detectChanges();
  }
  checkWalletConnect(): boolean {
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
  getFromAndToAddress(): void {
    switch (this.fromToken?.chain) {
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
    switch (this.toToken?.chain) {
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
  async checkShowApprove(): Promise<any> {
    const spender = ETH_CROSS_SWAP_CONTRACT_HASH[this.fromToken.chain];
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
  checkInputAmountDecimal(): boolean {
    const decimalPart = this.inputAmount && this.inputAmount.split('.')[1];
    if (
      this.fromToken &&
      decimalPart &&
      decimalPart.length > this.fromToken.decimals
    ) {
      this.inputAmountError = MESSAGE.decimalLimit[this.lang];
      return false;
    }
    this.inputAmountError = '';
    return true;
  }

  checkInputAmountLimit(): boolean {
    if (!this.fromToken) {
      this.inputAmountError = '';
      return;
    }
    const oneChainTokens: Token[] = this.chainTokens[this.fromToken.chain];
    const usdToken = oneChainTokens.find(
      (item) => item.assetID === this.fromToken.assetID
    );
    if (!usdToken) {
      this.inputAmountError = '';
      return;
    }
    // const inputAmountBig = new BigNumber(this.inputAmount);
    // const maxAmountBig = new BigNumber(usdToken.maxAmount);
    // if (inputAmountBig.comparedTo(maxAmountBig) === 1) {
    //   this.inputAmountError = MESSAGE.maximumLimit[this.lang];
    //   return false;
    // } else {
    //   return true;
    // }
    return true;
  }

  calcutionInputAmountFiat(): void {
    if (!this.fromToken) {
      this.inputAmountFiat = '';
      return;
    }
    const price = this.commonService.getAssetRate(this.rates, this.fromToken);
    if (this.inputAmount && price) {
      this.inputAmountFiat = new BigNumber(this.inputAmount)
        .multipliedBy(new BigNumber(price))
        .dp(2)
        .toFixed();
    } else {
      this.inputAmountFiat = '';
    }
  }

  calcutionReceiveAmountFiat(): void {
    if (!this.toToken) {
      this.receiveAmountFiat = '';
      return;
    }
    const price = this.commonService.getAssetRate(this.rates, this.fromToken);
    if (this.receiveAmount && price) {
      this.receiveAmountFiat = new BigNumber(this.receiveAmount)
        .multipliedBy(new BigNumber(price))
        .dp(2)
        .toFixed();
    } else {
      this.receiveAmountFiat = '';
    }
  }

  async calcutionReceiveAmount(): Promise<void> {
    this.getBridgeRate();
    if (!this.fromToken || !this.toToken || !this.inputAmount) {
      this.receiveAmount = '';
      return;
    }
    if (new BigNumber(this.inputAmount).comparedTo(0) <= 0) {
      this.receiveAmount = '';
      return;
    }
    this.receiveAmount = await this.apiService.getBridgeAmountOut(
      this.fromToken,
      this.toToken,
      this.inputAmount
    );
    this.calcutionReceiveAmountFiat();
    this.getBridgeRate();
  }
  getBridgeRate(): void {
    if (this.inputAmount && this.receiveAmount) {
      this.bridgeRate = new BigNumber(this.receiveAmount)
        .dividedBy(new BigNumber(this.inputAmount))
        .dp(4)
        .toFixed();
    } else {
      this.bridgeRate = '';
    }
  }
  checkBalance(): boolean {
    if (!this.tokenBalances || !this.tokenBalances[this.fromToken.chain]) {
      return false;
    }
    const chainBalances = this.tokenBalances[this.fromToken.chain];
    if (
      !chainBalances[this.fromToken.assetID] ||
      new BigNumber(chainBalances[this.fromToken.assetID].amount).comparedTo(
        new BigNumber(this.inputAmount)
      ) < 0
    ) {
      this.nzMessage.error(MESSAGE.InsufficientBalance[this.lang]);
      return false;
    }
    if (
      this.polyFee &&
      (!chainBalances[ETH_SOURCE_ASSET_HASH] ||
        new BigNumber(chainBalances[ETH_SOURCE_ASSET_HASH].amount).comparedTo(
          new BigNumber(this.polyFee)
        ) < 0)
    ) {
      this.nzMessage.error(
        MESSAGE.InsufficientPolyFee[this.lang]([
          SOURCE_TOKEN_SYMBOL[this.fromToken.chain],
        ])
      );
      return false;
    }
    return true;
  }
  //#endregion
}
