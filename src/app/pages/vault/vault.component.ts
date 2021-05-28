import { Component, OnDestroy, OnInit } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import {
  CommonService,
  VaultEthWalletApiService,
  SwapService,
  EthApiService,
} from '@core';
import { NzModalRef, NzModalService } from 'ng-zorro-antd/modal';
import { Unsubscribable, Observable, interval } from 'rxjs';
import {
  ApproveModalComponent,
  ApproveDrawerComponent,
  VaultStakeDrawerComponent,
  VaultStakeModalComponent,
  VaultUnlockCalculatorModalComponent,
} from '@shared';
import { Store } from '@ngrx/store';
import BigNumber from 'bignumber.js';
import {
  LP_STAKING_TOKENS,
  LP_TOKENS,
  MESSAGE,
  MyTransaction,
  O3STAKING_CONTRACT,
  O3TOKEN_CONTRACT,
  O3_TOKEN,
  Token,
  TOKEN_STAKING_TOKENS,
  TransactionType,
  UNLOCK_LP_TOKENS,
  USD_TOKENS,
} from '@lib';
import { NzDrawerService } from 'ng-zorro-antd/drawer';
import { VaultWallet } from 'src/app/_lib/vault';
interface State {
  language: any;
  vault: any;
  rates: any;
  app: any;
}
@Component({
  selector: 'app-vault',
  templateUrl: './vault.component.html',
  styleUrls: ['./vault.component.scss', './mobile.scss'],
})
export class VaultComponent implements OnInit, OnDestroy {
  langPageName = 'vault';
  langUnScribe: Unsubscribable;
  language$: Observable<any>;
  lang: string;

  isMobile = false;
  private vault$: Observable<any>;
  private vaultUnScribe: Unsubscribable;
  private vaultWallet: VaultWallet;
  isCanClick = true;

  ratesUnScribe: Unsubscribable;
  rates$: Observable<any>;
  rates = {};

  private appUnScribe: Unsubscribable;
  private app$: Observable<any>;
  private transactions: MyTransaction[];

  addressAirdropData = null;

  o3Locked = '--';
  o3Available = '--';
  o3Total = '--';

  totalProfit = '--';
  airdropO3 = ['0', '0'];
  airdropNumber = 2;
  stakeUnlockTokenList: any[] = UNLOCK_LP_TOKENS;
  o3StakingTokenList: any[] = TOKEN_STAKING_TOKENS;
  lpstakingTokenList: any[] = LP_STAKING_TOKENS;

  private loader: NzModalRef = null;
  private getDataInterval: Unsubscribable;

  constructor(
    private store: Store<State>,
    private modal: NzModalService,
    private nzMessage: NzMessageService,
    private vaultEthWalletApiService: VaultEthWalletApiService,
    private drawerService: NzDrawerService,
    private commonService: CommonService,
    private swapService: SwapService,
    private ethApiService: EthApiService
  ) {
    this.language$ = store.select('language');
    this.langUnScribe = this.language$.subscribe((state) => {
      this.lang = state.language;
    });
    this.vault$ = store.select('vault');
    this.rates$ = store.select('rates');
    this.app$ = store.select('app');
  }

  ngOnInit(): void {
    if (this.commonService.isMobileWidth()) {
      this.isMobile = true;
    }
    this.initAridrop();
    this.initO3Data();
    this.vaultUnScribe = this.vault$.subscribe((state) => {
      this.vaultWallet = state.vaultWallet;
      this.initO3Data();
      this.initAridrop();
    });
    this.appUnScribe = this.app$.subscribe((state) => {
      this.transactions = state.transactions;
    });
    this.ratesUnScribe = this.rates$.subscribe((state) => {
      this.rates = state.rates;
    });
    this.getDataInterval = interval(15000).subscribe(() => {
      this.initO3Data();
    });
  }
  ngOnDestroy(): void {
    if (this.vaultUnScribe) {
      this.vaultUnScribe.unsubscribe();
    }
    if (this.langUnScribe) {
      this.langUnScribe.unsubscribe();
    }
    if (this.ratesUnScribe) {
      this.ratesUnScribe.unsubscribe();
    }
    if (this.getDataInterval) {
      this.getDataInterval.unsubscribe();
    }
    if (this.appUnScribe) {
      this.appUnScribe.unsubscribe();
    }
    this.loader?.close();
  }

  async initO3Data(): Promise<void> {
    // head data
    Promise.all([
      this.vaultEthWalletApiService.getLockedOf() || '--',
      this.vaultEthWalletApiService.getUnlockedOf() || '--',
    ]).then((res) => {
      [this.o3Locked, this.o3Available] = res;
      const totleNum = new BigNumber(this.o3Locked).plus(
        new BigNumber(this.o3Available)
      );
      if (!totleNum.isNaN()) {
        this.o3Total = totleNum.toFixed();
      } else {
        this.o3Total = '--';
      }
    });
    // unlock zoon
    this.stakeUnlockTokenList.forEach(async (item: any) => {
      Promise.all([
        this.vaultEthWalletApiService.getStaked(item) || '--',
        this.swapService.getEthBalancByHash(
          item,
          this.vaultWallet?.address || ''
        ) || '--',
        this.vaultEthWalletApiService.claimableUnlocked(item) || '--',
        this.vaultEthWalletApiService.getUnlockSpeed(item) || '--',
      ]).then((res) => {
        [item.staked, item.remaining, item.claimable, item.speed] = res;
      });
    });
    // o3 Staking
    this.o3StakingTokenList.forEach(async (item: any) => {
      Promise.all([
        this.swapService.getEthBalancByHash(
          item,
          this.vaultWallet?.address || ''
        ) || '--',
        this.vaultEthWalletApiService.getO3StakingTotalStaing(item) || '--',
        this.vaultEthWalletApiService.getO3StakingStaked(item) || '--',
        this.vaultEthWalletApiService.getO3StakingSharePerBlock(item) || '0',
      ]).then((res) => {
        [item.balance, item.totalStaking, item.staked, item.sharePerBlock] =
          res;
        item.apy = this.getStakingAYP(item);
      });
    });
    // lp staking
    this.lpstakingTokenList.forEach(async (item: any) => {
      Promise.all([
        this.swapService.getEthBalancByHash(
          item,
          this.vaultWallet?.address || ''
        ) || '--',
        this.vaultEthWalletApiService.getO3StakingTotalStaing(item) || '--',
        this.vaultEthWalletApiService.getO3StakingStaked(item) || '--',
        this.vaultEthWalletApiService.getO3StakingSharePerBlock(item) || '0',
      ]).then((res) => {
        [item.balance, item.totalStaking, item.staked, item.sharePerBlock] =
          res;
        item.apy = this.getStakingAYP(item);
      });
    });
    let tempTotalProfit = new BigNumber('0');
    const earnO3TokenList = this.lpstakingTokenList.concat(
      this.o3StakingTokenList
    );
    for (const [index, item] of earnO3TokenList.entries()) {
      item.profit =
        (await this.vaultEthWalletApiService.getO3StakingTotalProfit(item)) ||
        '--';
      tempTotalProfit = new BigNumber(tempTotalProfit)
        .plus(new BigNumber(item.profit))
        .dp(18);
      if (
        (index === earnO3TokenList.length - 1 || this.totalProfit === '--') &&
        !tempTotalProfit.isNaN()
      ) {
        this.totalProfit = tempTotalProfit.toFixed() || '--';
      }
    }
    if (!this.vaultWallet) {
      this.totalProfit = '--';
    }
  }

  async initAridrop(): Promise<void> {
    const address = this.vaultWallet?.address || '';
    for (let i = 0; i < this.airdropNumber; i++) {
      const airdropList =
        await this.vaultEthWalletApiService.getAirdropListJson(i);
      const addressAirdropInfo =
        airdropList[
          Object.keys(airdropList).find(
            (key) => key.toLowerCase() === address.toLowerCase()
          )
        ];
      if (!this.vaultWallet || !addressAirdropInfo) {
        this.airdropO3[i] = '0';
        continue;
      }
      this.addressAirdropData = addressAirdropInfo;
      this.vaultEthWalletApiService
        .isAirdropClaimed(addressAirdropInfo.index, i)
        .then((res) => {
          if (res) {
            this.airdropO3[i] = '0';
          } else {
            this.airdropO3[i] = new BigNumber(
              this.addressAirdropData?.amount,
              16
            )
              .div(new BigNumber(10).pow(18))
              .toFixed();
          }
        });
    }
  }

  async showUnlockStake(
    token: Token,
    balance: string,
    isStake: boolean = true
  ): Promise<void> {
    let modal;
    if (!this.checkWalletConnect()) {
      return;
    }
    if (this.vaultEthWalletApiService.checkNetwork(token) === false) {
      return;
    }
    if (!this.commonService.isMobileWidth()) {
      modal = this.modal.create({
        nzContent: VaultStakeModalComponent,
        nzFooter: null,
        nzTitle: null,
        nzClosable: false,
        nzClassName: 'custom-modal custom-stake-modal',
        nzComponentParams: {
          token,
          balance,
          isStake,
          recommendStakeLp: isStake ? this.calculateUnlockStake() : '',
        },
      });
    } else {
      modal = this.drawerService.create({
        nzContent: VaultStakeDrawerComponent,
        nzTitle: null,
        nzClosable: false,
        nzPlacement: 'bottom',
        nzWrapClassName: 'custom-drawer',
        nzContentParams: {
          token,
          balance,
          isStake,
          recommendStakeLp: isStake ? this.calculateUnlockStake() : '',
        },
      });
    }
    modal.afterClose.subscribe(async (res) => {
      if (res) {
        if (!this.checkBalance(balance, res)) {
          return;
        }
        this.loader = this.commonService.loading(
          isStake ? TransactionType.stake : TransactionType.unstake,
          {
            symbol1: token.symbol,
            value1: res,
          }
        );
        const showApprove = await this.checkShowApprove(
          token,
          this.vaultWallet.address,
          res,
          O3TOKEN_CONTRACT
        );
        if (showApprove === true) {
          this.showApproveModal(token, O3TOKEN_CONTRACT);
          this.loader?.close();
          return;
        }
        if (showApprove === 'error') {
          this.loader?.close();
          return;
        }
        if (isStake) {
          this.vaultEthWalletApiService
            .stakeO3(token, res)
            .then((_) => {
              this.loader.close();
            })
            .catch((_) => {
              this.loader.close();
            });
        } else {
          this.vaultEthWalletApiService
            .unstakeO3(token, res)
            .then((_) => {
              this.loader.close();
            })
            .catch((_) => {
              this.loader.close();
            });
        }
      }
    });
  }

  async showStakingStake(
    token: Token,
    balance: string,
    isStake: boolean = true
  ): Promise<void> {
    if (!this.checkWalletConnect()) {
      return;
    }
    if (this.vaultEthWalletApiService.checkNetwork(token) === false) {
      return;
    }
    const contractHash = O3STAKING_CONTRACT[token.assetID];
    let modal;
    if (!this.commonService.isMobileWidth()) {
      modal = this.modal.create({
        nzContent: VaultStakeModalComponent,
        nzFooter: null,
        nzTitle: null,
        nzClosable: false,
        nzClassName: 'custom-modal custom-stake-modal',
        nzComponentParams: {
          token,
          balance,
          isStake,
        },
      });
    } else {
      modal = this.drawerService.create({
        nzContent: VaultStakeDrawerComponent,
        nzTitle: null,
        nzClosable: false,
        nzPlacement: 'bottom',
        nzWrapClassName: 'custom-drawer',
        nzContentParams: {
          token,
          balance,
          isStake,
        },
      });
    }
    modal.afterClose.subscribe(async (res) => {
      if (res) {
        if (!this.checkBalance(balance, res)) {
          return;
        }
        this.loader = this.commonService.loading(
          isStake ? TransactionType.stake : TransactionType.unstake,
          {
            symbol1: token.symbol,
            value1: res,
          }
        );
        const showApprove = await this.checkShowApprove(
          token,
          this.vaultWallet.address,
          res,
          contractHash
        );
        if (showApprove === true) {
          this.showApproveModal(token, contractHash);
          this.loader?.close();
          return;
        }
        if (showApprove === 'error') {
          this.loader?.close();
          return;
        }
        if (isStake) {
          this.vaultEthWalletApiService
            .o3StakingStake(token, res)
            .then((_) => {
              this.loader.close();
            })
            .catch((_) => {
              this.loader.close();
            });
        } else {
          this.vaultEthWalletApiService
            .o3StakingUnStake(token, res)
            .then((_) => {
              this.loader.close();
            })
            .catch((_) => {
              this.loader.close();
            });
        }
      }
    });
  }

  async claimUnlockO3(token: any): Promise<void> {
    if (!this.checkWalletConnect()) {
      return;
    }
    if (this.vaultEthWalletApiService.checkNetwork(token) === false) {
      return;
    }
    if (this.isCanClick) {
      this.isCanClick = false;
      setTimeout(() => {
        this.isCanClick = true;
      }, 4000);
    } else {
      return;
    }
    const claimable = new BigNumber(token.claimable);
    if (claimable.isNaN() || claimable.isZero()) {
      return;
    }
    const contractHash = O3TOKEN_CONTRACT;
    this.loader = this.commonService.loading(TransactionType.claim, {
      symbol1: 'O3',
      value1: token.claimable,
    });
    this.vaultEthWalletApiService
      .claimUnlocked(token, token.claimable)
      .then((_) => {
        this.loader.close();
      })
      .catch((_) => {
        this.loader.close();
      });
  }

  async claimProfit(token: any): Promise<void> {
    if (!this.checkWalletConnect()) {
      return;
    }
    if (this.vaultEthWalletApiService.checkNetwork(token) === false) {
      return;
    }
    if (this.isCanClick) {
      this.isCanClick = false;
      setTimeout(() => {
        this.isCanClick = true;
      }, 4000);
    } else {
      return;
    }
    const claimable = new BigNumber(token.profit);
    if (claimable.isNaN() || claimable.isZero()) {
      return;
    }
    const contractHash = O3STAKING_CONTRACT[token.assetID];
    this.loader = this.commonService.loading(TransactionType.claim, {
      symbol1: token.symbol,
      value1: token.profit,
    });
    this.vaultEthWalletApiService
      .o3StakingClaimProfit(token, token.profit)
      .then((_) => {
        this.loader.close();
      })
      .catch((_) => {
        this.loader.close();
      });
  }

  async claimAirdrop(airdropIndex: number): Promise<void> {
    if (!this.checkWalletConnect()) {
      return;
    }
    if (
      this.vaultEthWalletApiService.checkNetwork(
        this.stakeUnlockTokenList[0]
      ) === false
    ) {
      return;
    }
    if (this.isCanClick) {
      this.isCanClick = false;
      setTimeout(() => {
        this.isCanClick = true;
      }, 4000);
    } else {
      return;
    }
    this.loader = this.commonService.loading(TransactionType.claim, {
      symbol1: 'O3',
      value1: this.airdropO3[airdropIndex],
    });
    this.vaultEthWalletApiService
      .claimAirdrop(airdropIndex)
      .then((_) => {
        this.loader.close();
      })
      .catch((_) => {
        this.loader.close();
      });
  }

  getStakingAYP(token: any): string {
    const tokenPrice = this.getTokenPrice(token);
    const O3TokenPrice = this.getTokenPrice(O3_TOKEN);
    const yearSecond = new BigNumber('31536000');
    const blockTime = new BigNumber('15');
    const yearBlock = yearSecond.div(blockTime);
    const sharePerBlock = new BigNumber(token.sharePerBlock);
    const totalStaked = token.totalStaking;
    const result = yearBlock.times(sharePerBlock).div(totalStaked).times(100);
    let priceRatio = new BigNumber(O3TokenPrice).div(new BigNumber(tokenPrice));
    if (token.assetID === O3_TOKEN.assetID) {
      priceRatio = new BigNumber(1);
    }
    if (
      priceRatio.isNaN() ||
      priceRatio.comparedTo(0) === 0 ||
      !priceRatio.isFinite() ||
      result.isNaN()
    ) {
      return '--';
    } else {
      return result.times(priceRatio).toFixed();
    }
  }
  getLP(token: Token): void {
    window.open(
      `https://app.uniswap.org/#/add/v2/${token.pairTokens[0]}/${token.pairTokens[1]}`
    );
  }

  getTokenPrice(token: Token): string {
    if (token.pairTokens) {
      let resultPrice = new BigNumber(0);
      token.pairTokens.forEach((item) => {
        const price = this.commonService.getAssetRateByHash(
          this.rates,
          item,
          token.chain
        );
        if (new BigNumber(price).comparedTo(0) <= 0) {
          return '0';
        }
        resultPrice = resultPrice.plus(new BigNumber(price));
      });
      return resultPrice.toFixed();
    } else {
      if (
        LP_TOKENS.filter((item) => {
          return this.commonService.judgeAssetHash(token.assetID, item.assetID);
        }).length > 0
      ) {
        return this.commonService.getAssetRateByHash(
          this.rates,
          USD_TOKENS[0].assetID,
          USD_TOKENS[0].chain
        );
      }
      return this.commonService.getAssetRateByHash(
        this.rates,
        token.assetID,
        token.chain
      );
    }
  }

  async checkShowApprove(
    token: Token,
    address: string,
    inputAmount: string,
    spender: string
  ): Promise<any> {
    const balance = await this.ethApiService.getAllowance(
      token,
      address,
      spender
    );
    if (new BigNumber(balance).comparedTo(new BigNumber(inputAmount)) >= 0) {
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
  checkBalance(balance: string, input: string): boolean {
    const balanceNumber = new BigNumber(balance);
    const inputNumber = new BigNumber(input);
    if (balanceNumber.comparedTo(input) < 0 || balanceNumber.isNaN()) {
      this.nzMessage.error(MESSAGE.InsufficientBalance[this.lang]);
      return false;
    }
    return true;
  }
  checkWalletConnect(): boolean {
    if (!this.vaultWallet) {
      this.nzMessage.error(MESSAGE.ConnectWalletFirst[this.lang](['ETH']));
      return false;
    }
    return true;
  }
  showApproveModal(token: Token, spender: string): void {
    const walletName = this.vaultWallet.walletName;
    const address = this.vaultWallet.address;
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
          fromAddress: address,
          walletName,
          spender,
          txAtPage: 'vault',
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
          fromAddress: address,
          walletName,
          spender,
          txAtPage: 'vault',
        },
      });
    }
  }

  showCalculator(): void {
    if (!this.commonService.isMobileWidth()) {
      this.modal.create({
        nzContent: VaultUnlockCalculatorModalComponent,
        nzFooter: null,
        nzTitle: null,
        nzClosable: false,
        nzClassName: 'custom-modal calculator',
        nzComponentParams: {
          LPToken: this.stakeUnlockTokenList[0],
        },
      });
    }
  }

  calculateUnlockStake(): string {
    const lockNum = new BigNumber(this.o3Locked);
    const standerBalnce = new BigNumber(300000);
    const standerLp = new BigNumber('0.387298334620740688');
    return lockNum.div(standerBalnce).times(standerLp).dp(8).toFixed();
  }
}
