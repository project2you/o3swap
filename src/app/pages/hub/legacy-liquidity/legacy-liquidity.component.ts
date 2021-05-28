import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { ApiService, CommonService, EthApiService, SwapService } from '@core';
import { Observable, Unsubscribable } from 'rxjs';
import { Store } from '@ngrx/store';
import { SwapStateType } from 'src/app/_lib/swap';
import {
  SWAP_CONTRACT_CHAIN_ID,
  METAMASK_CHAIN,
  BRIDGE_SLIPVALUE,
  Token,
  USD_TOKENS,
  LP_TOKENS,
  ConnectChainType,
  EthWalletName,
  MESSAGE,
  ETH_CROSS_SWAP_CONTRACT_HASH,
  MyTransaction,
  TransactionType,
} from '@lib';
import BigNumber from 'bignumber.js';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { ApproveDrawerComponent, ApproveModalComponent } from '@shared';
import { NzDrawerService } from 'ng-zorro-antd/drawer';

interface State {
  swap: SwapStateType;
  rates: any;
  language: any;
  app: any;
}
@Component({
  selector: 'app-legacy-liquidity',
  templateUrl: './legacy-liquidity.component.html',
  styleUrls: [
    '../liquidity/liquidity.component.scss',
    './legacy-liquidity.component.scss',
  ],
})
export class LegacyLiquidityComponent implements OnInit, OnDestroy {
  public BRIDGE_SLIPVALUE = BRIDGE_SLIPVALUE;
  public addLiquidityTokens: Token[] = JSON.parse(JSON.stringify(USD_TOKENS));

  public LPToken: Token;
  private LPTokens: Token[];
  public removeLiquidityInputAmount = [];
  public payAmount: string[] = [];
  private currentAddress: string;
  private currentChain: string;
  public showConnectWallet = false;
  public connectChainType: ConnectChainType;

  private swap$: Observable<any>;
  private swapUnScribe: Unsubscribable;
  private ethAccountAddress: string;
  private bscAccountAddress: string;
  private hecoAccountAddress: string;
  private ethWalletName: EthWalletName;
  private bscWalletName: EthWalletName;
  private hecoWalletName: EthWalletName;
  private metamaskNetworkId: number;
  private tokenBalance = { ETH: {}, NEO: {}, BSC: {}, HECO: {} };

  private ratesUnScribe: Unsubscribable;
  private rates$: Observable<any>;
  private rates = {};

  public langPageName = 'liquidity';
  private langUnScribe: Unsubscribable;
  private language$: Observable<any>;
  public lang: string;

  private appUnScribe: Unsubscribable;
  private app$: Observable<any>;
  private transactions: MyTransaction[];

  constructor(
    private apiService: ApiService,
    private commonService: CommonService,
    public store: Store<State>,
    private nzMessage: NzMessageService,
    private changeDetectorRef: ChangeDetectorRef,
    private modal: NzModalService,
    private drawerService: NzDrawerService,
    private ethApiService: EthApiService,
    private swapService: SwapService
  ) {
    this.language$ = store.select('language');
    this.langUnScribe = this.language$.subscribe((state) => {
      this.lang = state.language;
    });
    this.swap$ = store.select('swap');
    this.rates$ = store.select('rates');
    this.app$ = store.select('app');
    this.addLiquidityTokens.forEach((item) => {
      this.removeLiquidityInputAmount.push('');
      this.payAmount.push('--');
      item.amount = '--';
    });
  }

  ngOnInit(): void {
    this.ratesUnScribe = this.rates$.subscribe((state) => {
      this.rates = state.rates;
    });
    this.LPTokens = JSON.parse(JSON.stringify(LP_TOKENS));
    this.swapUnScribe = this.swap$.subscribe((state: SwapStateType) => {
      this.ethAccountAddress = state.ethAccountAddress;
      this.bscAccountAddress = state.bscAccountAddress;
      this.hecoAccountAddress = state.hecoAccountAddress;
      this.ethWalletName = state.ethWalletName;
      this.bscWalletName = state.bscWalletName;
      this.hecoWalletName = state.hecoWalletName;
      this.metamaskNetworkId = state.metamaskNetworkId;
      this.getCurrentChain();
      this.handleAccountBalance(state);
      this.handleCurrentAddress();
      this.getLPBalance();
      this.changeDetectorRef.detectChanges();
    });
    this.appUnScribe = this.app$.subscribe((state) => {
      this.transactions = state.transactions;
    });
  }

  ngOnDestroy(): void {
    if (this.swapUnScribe) {
      this.swapUnScribe.unsubscribe();
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
  }

  async changeOutAmount(token: Token, index: number, $event?): Promise<void> {
    if (
      $event &&
      this.checkInputAmountDecimal($event.target.value, token.decimals) ===
        false
    ) {
      this.payAmount[index] = '--';
      return;
    }
    const inputAmount = new BigNumber(this.removeLiquidityInputAmount[index]);
    if (!inputAmount.isNaN() && inputAmount.comparedTo(0) > 0) {
      // if (inputAmount.comparedTo(50) === 1) {
      //   this.nzMessage.error(MESSAGE.maximumLimit[this.lang]);
      //   return;
      // }
      this.payAmount[index] = await this.apiService.getPoolInGivenSingleOut(
        token,
        this.removeLiquidityInputAmount[index]
      );
    } else {
      this.payAmount[index] = '--';
    }
  }

  async maxRemoveLiquidityInput(index: number): Promise<void> {
    if (!this.LPToken) {
      return;
    }
    if (
      !new BigNumber(this.LPToken.amount).isNaN() &&
      !new BigNumber(this.LPToken.amount).isZero()
    ) {
      this.payAmount[index] = this.LPToken.amount;
      this.removeLiquidityInputAmount[index] =
        await this.apiService.getSingleOutGivenPoolIn(
          this.addLiquidityTokens[index],
          this.payAmount[index]
        );
    }
  }

  async withdrawal(token: Token, index: number): Promise<void> {
    if (!this.LPToken) {
      return;
    }
    if (this.checkWalletConnect(token) === false) {
      return;
    }
    if (this.ethApiService.checkNetwork(token) === false) {
      return;
    }
    const lpBalance = new BigNumber(this.LPToken.amount);
    const lpPayAmount = new BigNumber(this.payAmount[index]);
    if (lpPayAmount.isNaN() || lpPayAmount.comparedTo(0) <= 0) {
      this.nzMessage.error(MESSAGE.WrongInput[this.lang]);
      return;
    }
    if (lpBalance.comparedTo(lpPayAmount) < 0) {
      this.nzMessage.error(MESSAGE.InsufficientBalance[this.lang]);
      return;
    }
    if (
      !this.removeLiquidityInputAmount[index] ||
      (this.removeLiquidityInputAmount[index] &&
        new BigNumber(this.removeLiquidityInputAmount[index]).comparedTo(0) <=
          0)
    ) {
      this.nzMessage.error(MESSAGE.receive0[this.lang]([token.symbol]));
      return;
    }
    const showApprove = await this.checkShowApprove(this.LPToken, lpPayAmount);
    if (showApprove === true) {
      this.showApproveModal(this.LPToken);
      return;
    }
    if (showApprove === 'error') {
      return;
    }
    const amountOut = new BigNumber(this.removeLiquidityInputAmount[index])
      .shiftedBy(token.decimals)
      .dp(0)
      .toFixed();
    const fee = await this.apiService.getFromEthPolyFee(token, token);
    this.ethApiService
      .removeLiquidity(
        this.LPToken,
        token,
        lpPayAmount.toFixed(),
        this.currentAddress,
        SWAP_CONTRACT_CHAIN_ID[token.chain],
        amountOut,
        fee
      )
      .then((res) => {
        this.commonService.log(res);
      })
      .catch((error) => {
        this.nzMessage.error(error);
      });
  }

  //#region
  private async checkShowApprove(token: Token, amount): Promise<any> {
    const spender = ETH_CROSS_SWAP_CONTRACT_HASH[token.chain];

    const allowance = await this.ethApiService.getAllowance(
      token,
      this.currentAddress,
      spender
    );
    if (new BigNumber(allowance).comparedTo(new BigNumber(amount)) >= 0) {
      return false;
    }
    this.transactions.forEach((item) => {
      if (
        item.transactionType === TransactionType.approve &&
        item.isPending &&
        item.contract === spender &&
        item.fromAddress === this.currentAddress &&
        item.fromToken.assetID === token.assetID &&
        item.fromToken.chain === token.chain
      ) {
        this.nzMessage.error(MESSAGE.waitApprove[this.lang]);
        return 'error';
      }
    });
    return true;
  }
  checkInputAmountDecimal(amount: string, decimals: number): boolean {
    const decimalPart = amount && amount.split('.')[1];
    if (decimalPart && decimalPart.length > decimals) {
      this.nzMessage.error(MESSAGE.decimalLimit[this.lang]);
      return false;
    }
    return true;
  }

  showApproveModal(token: Token): void {
    let walletName: string;
    switch (token.chain) {
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
          fromToken: token,
          fromAddress: this.currentAddress,
          walletName,
          txAtPage: 'liquidity',
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
          fromToken: token,
          fromAddress: this.currentAddress,
          walletName,
          txAtPage: 'liquidity',
        },
      });
    }
  }
  checkWalletConnect(token: Token): boolean {
    if (token.chain === 'ETH' && !this.ethAccountAddress) {
      this.nzMessage.error(MESSAGE.ConnectWalletFirst[this.lang](['ETH']));
      this.showConnectWallet = true;
      this.connectChainType = 'ETH';
      return false;
    }
    if (token.chain === 'BSC' && !this.bscAccountAddress) {
      this.nzMessage.error(MESSAGE.ConnectWalletFirst[this.lang](['BSC']));
      this.showConnectWallet = true;
      this.connectChainType = 'BSC';
      return false;
    }
    if (token.chain === 'HECO' && !this.hecoAccountAddress) {
      this.nzMessage.error(MESSAGE.ConnectWalletFirst[this.lang](['HECO']));
      this.showConnectWallet = true;
      this.connectChainType = 'HECO';
      return false;
    }
    return true;
  }
  getCurrentChain(): void {
    if (this.currentChain !== METAMASK_CHAIN[this.metamaskNetworkId]) {
      this.currentChain = METAMASK_CHAIN[this.metamaskNetworkId];
      const token = this.LPTokens.find(
        (item) => item.chain === this.currentChain
      );
      this.LPToken = token && JSON.parse(JSON.stringify(token));
    }
  }
  private getLPBalance(): void {
    if (!this.LPToken) {
      return;
    }
    if (
      (this.LPToken.chain === 'ETH' && !this.ethWalletName) ||
      (this.LPToken.chain === 'BSC' && !this.bscWalletName) ||
      (this.LPToken.chain === 'HECO' && !this.hecoWalletName)
    ) {
      this.LPToken.amount = '--';
      return;
    }
    this.swapService.getEthBalancByHash(this.LPToken).then((res) => {
      // this.LPToken['amount'] = res || '0';
      this.LPToken.amount = res || '0';
    });
  }
  private handleAccountBalance(state): void {
    this.tokenBalance.ETH = state.ethBalances;
    this.tokenBalance.BSC = state.bscBalances;
    this.tokenBalance.HECO = state.hecoBalances;
    this.addLiquidityTokens.forEach((item, index) => {
      if (this.tokenBalance[item.chain][item.assetID]) {
        this.addLiquidityTokens[index].amount =
          this.tokenBalance[item.chain][item.assetID].amount;
      } else {
        if (
          (item.chain === 'ETH' && this.ethAccountAddress) ||
          (item.chain === 'BSC' && this.bscAccountAddress) ||
          (item.chain === 'HECO' && this.hecoAccountAddress)
        ) {
          this.addLiquidityTokens[index].amount = '0';
        } else {
          this.addLiquidityTokens[index].amount = '--';
        }
      }
    });
  }
  private handleCurrentAddress(): void {
    switch (this.currentChain) {
      case 'ETH': {
        this.currentAddress = this.ethAccountAddress;
        break;
      }
      case 'BSC': {
        this.currentAddress = this.bscAccountAddress;
        break;
      }
      case 'HECO': {
        this.currentAddress = this.hecoAccountAddress;
        break;
      }
      default:
        return;
    }
  }
  //#endregion
}
