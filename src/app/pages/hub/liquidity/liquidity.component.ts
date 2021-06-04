import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import {
  ApiService,
  CommonService,
  EthApiService,
  SwapService,
  VaultEthWalletApiService,
} from '@core';
import { Observable, Unsubscribable } from 'rxjs';
import { Store } from '@ngrx/store';
import { SwapStateType } from 'src/app/_lib/swap';
import {
  SWAP_CONTRACT_CHAIN_ID,
  BRIDGE_SLIPVALUE,
  Token,
  USD_TOKENS,
  LP_TOKENS,
  ConnectChainType,
  EthWalletName,
  SOURCE_TOKEN_SYMBOL,
  MESSAGE,
  O3_TOKEN,
  ETH_CROSS_SWAP_CONTRACT_HASH,
  MyTransaction,
  TransactionType,
} from '@lib';
import BigNumber from 'bignumber.js';
import { NzMessageService } from 'ng-zorro-antd/message';
import {
  ActivatedRoute,
  NavigationEnd,
  Router,
  RouterEvent,
} from '@angular/router';
import { NzModalRef, NzModalService } from 'ng-zorro-antd/modal';
import { ApproveDrawerComponent, ApproveModalComponent } from '@shared';
import { NzDrawerService } from 'ng-zorro-antd/drawer';
import { POOL_LIST } from 'src/app/_lib/pool';

type LiquidityType = 'add' | 'remove';
interface State {
  swap: SwapStateType;
  rates: any;
  language: any;
  app: any;
}
@Component({
  selector: 'app-liquidity',
  templateUrl: './liquidity.component.html',
  styleUrls: ['./liquidity.component.scss', './mobile.scss'],
})
export class LiquidityComponent implements OnInit, OnDestroy {
  public SOURCE_TOKEN_SYMBOL = SOURCE_TOKEN_SYMBOL;
  public BRIDGE_SLIPVALUE = BRIDGE_SLIPVALUE;
  public addLiquidityTokens: Token[] = JSON.parse(JSON.stringify(USD_TOKENS));
  public liquidityType: LiquidityType = 'add';

  public LPToken: Token = LP_TOKENS[1].find(
    (item) => item.chain === 'ETH'
  ) as Token;
  public LPStaked = '--';
  public LPEarned = '--';
  public LPTokenMoney = '--';
  public LPStakedMoney = '--';
  public LPEarnedMoney = '--';

  public addLiquidityInputAmount = [];
  public removeLiquidityInputAmount = [];
  public receiveAmount: string[] = [];
  public payAmount: string[] = [];
  public showConnectWallet = false;
  public connectChainType: ConnectChainType;
  public addPolyFee: string[] = [];
  public removePolyFee: string[] = [];
  public showAddPolyFee: boolean[] = [false, false, false];
  public showRemovePolyFee: boolean[] = [false, false, false];

  public poolId = 1;
  public pool = POOL_LIST[this.poolId];
  private swapUnScribe: Unsubscribable;
  private swap$: Observable<any>;
  public ethAccountAddress: string;
  public bscAccountAddress: string;
  public hecoAccountAddress: string;
  private ethWalletName: EthWalletName;
  private bscWalletName: EthWalletName;
  private hecoWalletName: EthWalletName;
  private tokenBalance = { ETH: {}, NEO: {}, BSC: {}, HECO: {} };

  private ratesUnScribe: Unsubscribable;
  private rates$: Observable<any>;
  private rates = {};
  private isSwapCanClick = true;

  public langPageName = 'liquidity';
  private langUnScribe: Unsubscribable;
  private language$: Observable<any>;
  public lang: string;

  private appUnScribe: Unsubscribable;
  private app$: Observable<any>;
  private transactions: MyTransaction[];

  private loader: NzModalRef = null;

  constructor(
    private apiService: ApiService,
    private commonService: CommonService,
    public store: Store<State>,
    private nzMessage: NzMessageService,
    private router: Router,
    private aRoute: ActivatedRoute,
    private changeDetectorRef: ChangeDetectorRef,
    private modal: NzModalService,
    private drawerService: NzDrawerService,
    private ethApiService: EthApiService,
    private swapService: SwapService,
    private vaultEthWalletApiService: VaultEthWalletApiService
  ) {
    this.language$ = store.select('language');
    this.langUnScribe = this.language$.subscribe((state) => {
      this.lang = state.language;
    });
    this.swap$ = store.select('swap');
    this.rates$ = store.select('rates');
    this.app$ = store.select('app');
    this.initPool();
    this.addLiquidityTokens.forEach((item) => {
      this.addLiquidityInputAmount.push('');
      this.removeLiquidityInputAmount.push('');
      this.receiveAmount.push('--');
      this.payAmount.push('--');
      item.amount = '--';
    });
    this.router.events.subscribe((res: RouterEvent) => {
      if (res instanceof NavigationEnd) {
        this.liquidityType = res.url.indexOf('/remove') > 0 ? 'remove' : 'add';
      }
    });
  }

  ngOnInit(): void {
    this.ratesUnScribe = this.rates$.subscribe((state) => {
      this.rates = state.rates;
    });
    this.swapUnScribe = this.swap$.subscribe((state: SwapStateType) => {
      this.ethAccountAddress = state.ethAccountAddress;
      this.bscAccountAddress = state.bscAccountAddress;
      this.hecoAccountAddress = state.hecoAccountAddress;
      this.ethWalletName = state.ethWalletName;
      this.bscWalletName = state.bscWalletName;
      this.hecoWalletName = state.hecoWalletName;
      this.handleAccountBalance(state);
      this.initLPData();
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

  private initPool(): void {
    this.poolId = Number(this.aRoute.snapshot.queryParamMap.get('poolId'));
    this.pool = POOL_LIST.find((item) => item.poolId === this.poolId);
    this.LPToken = LP_TOKENS[this.poolId].find(
      (item) => item.chain === this.pool.chain
    );
    this.addLiquidityTokens = JSON.parse(
      JSON.stringify(this.pool.wrappedTokens)
    );
  }

  changeLiquidityType(params: LiquidityType): void {
    this.liquidityType = params;
  }

  async changeInAmount(token: Token, index: number, $event?): Promise<void> {
    if (
      $event &&
      this.checkInputAmountDecimal($event.target.value, token.decimals) ===
        false
    ) {
      this.receiveAmount[index] = '--';
      return;
    }
    const inputAmount = new BigNumber(this.addLiquidityInputAmount[index]);
    if (!inputAmount.isNaN() && inputAmount.comparedTo(0) > 0) {
      // if (inputAmount.comparedTo(50) === 1) {
      //   this.nzMessage.error(MESSAGE.maximumLimit[this.lang]);
      //   return;
      // }
      this.receiveAmount[index] = await this.apiService.getPoolOutGivenSingleIn(
        token,
        this.addLiquidityInputAmount[index]
      );
      this.addPolyFee[index] = await this.apiService.getFromEthPolyFee(
        token,
        this.LPToken
      );
    } else {
      this.receiveAmount[index] = '--';
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
      this.removePolyFee[index] = await this.apiService.getFromEthPolyFee(
        this.LPToken,
        token
      );
    } else {
      this.payAmount[index] = '--';
    }
  }

  async maxAddLiquidityInput(index: number): Promise<void> {
    if (!new BigNumber(this.addLiquidityTokens[index].amount).isNaN()) {
      this.addLiquidityInputAmount[index] =
        this.addLiquidityTokens[index].amount;
      this.receiveAmount[index] = await this.apiService.getPoolOutGivenSingleIn(
        this.addLiquidityTokens[index],
        this.addLiquidityInputAmount[index]
      );
      this.addPolyFee[index] = await this.apiService.getFromEthPolyFee(
        this.addLiquidityTokens[index],
        this.LPToken
      );
    }
    this.changeInAmount(this.addLiquidityTokens[index], index);
  }

  async maxRemoveLiquidityInput(index: number): Promise<void> {
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
      this.removePolyFee[index] = await this.apiService.getFromEthPolyFee(
        this.LPToken,
        this.addLiquidityTokens[index]
      );
    }
    this.changeInAmount(this.addLiquidityTokens[index], index);
  }

  async depost(token: Token, index: number): Promise<void> {
    // if (this.checkWalletConnect(token) === false) {
    //   return;
    // }
    // if (this.ethApiService.checkNetwork(token) === false) {
    //   return;
    // }
    if (this.isSwapCanClick) {
      this.isSwapCanClick = false;
      setTimeout(() => {
        this.isSwapCanClick = true;
      }, 4000);
    } else {
      this.loader?.close();
      return;
    }
    if (
      !this.receiveAmount[index] ||
      (this.receiveAmount[index] &&
        new BigNumber(this.receiveAmount[index]).comparedTo(0) <= 0)
    ) {
      this.nzMessage.error(MESSAGE.receive0[this.lang](['LP']));
      return;
    }
    const tokenBalance = new BigNumber(token.amount);
    const tokenAmount = new BigNumber(this.addLiquidityInputAmount[index]);
    // if (tokenAmount.isNaN() || tokenAmount.comparedTo(0) <= 0) {
    //   this.nzMessage.error(MESSAGE.WrongInput[this.lang]);
    //   return;
    // }
    // if (tokenBalance.comparedTo(tokenAmount) < 0) {
    //   this.nzMessage.error(MESSAGE.InsufficientBalance[this.lang]);
    //   return;
    // }
    this.loader = this.commonService.loading(TransactionType.deposit, {
      symbol1: token.symbol,
      symbol2: this.LPToken.symbol,
      value1: this.addLiquidityInputAmount[index],
      value2: this.receiveAmount[index],
    });
    const showApprove = await this.checkShowApprove(
      token,
      tokenAmount,
      this.getFromTokenAddress(token)
    );
    if (showApprove === true) {
      this.showApproveModal(token);
      this.loader?.close();
      return;
    }
    if (showApprove === 'error') {
      this.loader?.close();
      return;
    }
    const amountOut = new BigNumber(this.receiveAmount[index])
      .shiftedBy(this.LPToken.decimals)
      .dp(0)
      .toFixed();
    if (!this.addPolyFee[index]) {
      this.addPolyFee[index] = await this.apiService.getFromEthPolyFee(
        token,
        this.LPToken
      );
    }
    this.ethApiService
      .addLiquidity(
        token,
        this.LPToken,
        this.addLiquidityInputAmount[index],
        this.getFromTokenAddress(token),
        SWAP_CONTRACT_CHAIN_ID[this.LPToken.chain],
        amountOut,
        this.addPolyFee[index],
        this.poolId
      )
      .then((res) => {
        this.commonService.log(res);
        this.loader.close();
      })
      .catch((error) => {
        this.nzMessage.error(error);
        this.loader.close();
      });
  }

  async withdrawal(token: Token, index: number): Promise<void> {
    if (this.checkWalletConnect(token) === false) {
      return;
    }
    if (this.ethApiService.checkNetwork(this.LPToken) === false) {
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
    this.loader = this.commonService.loading(TransactionType.withdraw, {
      symbol1: this.LPToken.symbol,
      symbol2: token.symbol,
      value1: this.payAmount[index],
      value2: this.removeLiquidityInputAmount[index],
    });
    const showApprove = await this.checkShowApprove(
      this.LPToken,
      lpPayAmount,
      this.getFromTokenAddress(token)
    );
    if (showApprove === true) {
      this.showApproveModal(this.LPToken);
      this.loader?.close();
      return;
    }
    if (showApprove === 'error') {
      this.loader?.close();
      return;
    }
    const amountOut = new BigNumber(this.removeLiquidityInputAmount[index])
      .shiftedBy(token.decimals)
      .dp(0)
      .toFixed();
    if (!this.removePolyFee[index]) {
      this.removePolyFee[index] = await this.apiService.getFromEthPolyFee(
        this.LPToken,
        token
      );
    }
    this.ethApiService
      .removeLiquidity(
        this.LPToken,
        token,
        lpPayAmount.toFixed(),
        this.getFromTokenAddress(this.LPToken),
        SWAP_CONTRACT_CHAIN_ID[token.chain],
        amountOut,
        this.removePolyFee[index],
        this.poolId
      )
      .then((res) => {
        this.commonService.log(res);
        this.loader.close();
      })
      .catch((error) => {
        this.nzMessage.error(error);
        this.loader.close();
      });
  }

  //#region
  checkInputAmountDecimal(amount: string, decimals: number): boolean {
    const decimalPart = amount && amount.split('.')[1];
    if (decimalPart && decimalPart.length > decimals) {
      this.nzMessage.error(MESSAGE.decimalLimit[this.lang]);
      return false;
    }
    return true;
  }
  private async checkShowApprove(
    token: Token,
    amount,
    address: string
  ): Promise<any> {
    const spender = ETH_CROSS_SWAP_CONTRACT_HASH[token.chain];

    const allowance = await this.ethApiService.getAllowance(
      token,
      address,
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
        item.fromAddress === address &&
        item.fromToken.assetID === token.assetID &&
        item.fromToken.chain === token.chain
      ) {
        this.nzMessage.error(MESSAGE.waitApprove[this.lang]);
        return 'error';
      }
    });
    return true;
  }
  getFromTokenAddress(token: Token): string {
    switch (token.chain) {
      case 'ETH':
        return this.ethAccountAddress;
      case 'BSC':
        return this.bscAccountAddress;
      case 'HECO':
        return this.hecoAccountAddress;
    }
  }
  showApproveModal(token: Token, spender?: string): void {
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
          fromAddress: this.getFromTokenAddress(token),
          walletName,
          spender,
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
          fromAddress: this.getFromTokenAddress(token),
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
    if (!this.ethAccountAddress) {
      this.nzMessage.error(MESSAGE.ConnectWalletFirst[this.lang](['ETH']));
      this.showConnectWallet = true;
      this.connectChainType = 'ETH';
      return false;
    }
    return true;
  }
  private initLPData(): void {
    if (!this.LPToken) {
      return;
    }
    if (!this.ethWalletName) {
      this.LPToken.amount = '--';
      return;
    }
    Promise.all([
      this.swapService.getEthBalancByHash(
        this.LPToken,
        this.ethAccountAddress
      ) || '0',
      this.vaultEthWalletApiService.getO3StakingStaked(
        this.LPToken,
        this.ethAccountAddress
      ) || '--',
      this.vaultEthWalletApiService.getO3StakingTotalProfit(
        this.LPToken,
        this.ethAccountAddress
      ) || '--',
    ]).then((res) => {
      [this.LPToken.amount, this.LPStaked, this.LPEarned] = res;
      if (!this.LPToken.amount) {
        this.LPToken.amount = '0';
      }
      const O3Price = this.getTokenPrice(O3_TOKEN);
      const LPPrice = this.getTokenPrice(this.LPToken);
      const lpTokenMoney = new BigNumber(this.LPToken.amount).times(
        new BigNumber(LPPrice)
      );
      const lpStakedMoney = new BigNumber(LPPrice).times(
        new BigNumber(this.LPStaked)
      );
      const lpEnearnedMoney = new BigNumber(O3Price).times(
        new BigNumber(this.LPEarned)
      );
      this.LPTokenMoney = lpTokenMoney.isNaN() ? '--' : lpTokenMoney.toFixed();
      this.LPStakedMoney = lpStakedMoney.isNaN()
        ? '--'
        : lpStakedMoney.toFixed();
      this.LPEarnedMoney = lpEnearnedMoney.isNaN()
        ? '--'
        : lpEnearnedMoney.toFixed();
    });
  }
  private getTokenPrice(token: Token): string {
    if (
      LP_TOKENS[this.poolId].filter((item) => {
        return this.commonService.judgeAssetHash(token.assetID, item.assetID);
      }).length > 0
    ) {
      return this.commonService.getAssetRateByHash(
        this.rates,
        this.pool.wrappedTokens[0].assetID,
        this.pool.wrappedTokens[0].chain
      );
    }
    return this.commonService.getAssetRateByHash(
      this.rates,
      token.assetID,
      token.chain
    );
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
  //#endregion
}
