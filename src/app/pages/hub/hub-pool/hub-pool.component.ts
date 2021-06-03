import { Component, OnInit, OnDestroy } from '@angular/core';
import {
  ApiService,
  CommonService,
  SwapService,
  VaultEthWalletApiService,
} from '@core';
import {
  O3_TOKEN,
  Token,
  LP_TOKENS,
  USD_TOKENS,
  ETH_PUSDT_ASSET,
  CommonHttpResponse,
} from '@lib';
import { Store } from '@ngrx/store';
import BigNumber from 'bignumber.js';
import { Unsubscribable, Observable, interval } from 'rxjs';
import { VaultWallet } from 'src/app/_lib/vault';

interface State {
  language: any;
  rates: any;
  vault: any;
}

@Component({
  selector: 'app-hub-pool',
  templateUrl: './hub-pool.component.html',
  styleUrls: ['./hub-pool.component.scss', './mobile.scss'],
})
export class HubPoolComponent implements OnInit, OnDestroy {
  public langPageName = 'hub';
  private langUnScribe: Unsubscribable;
  private language$: Observable<any>;
  public lang: string;

  private ratesUnScribe: Unsubscribable;
  private rates$: Observable<any>;
  private rates = {};

  private vaultUnScribe: Unsubscribable;
  private vault$: Observable<any>;
  private vaultWallet: VaultWallet;

  private LPToken: any = LP_TOKENS.filter((item) => item.chain === 'ETH')[0];
  public totalVolume = '--';
  public LPAPY = '--';

  public allUsdtBalance: string;
  private getallUsdtInterval: Unsubscribable;
  public dailyVolume: string;

  constructor(
    private store: Store<State>,
    private vaultEthWalletApiService: VaultEthWalletApiService,
    private commonService: CommonService,
    private swapService: SwapService,
    private apiService: ApiService
  ) {
    this.language$ = store.select('language');
    this.langUnScribe = this.language$.subscribe((state) => {
      this.lang = state.language;
    });
    this.rates$ = store.select('rates');
    this.ratesUnScribe = this.rates$.subscribe((state) => {
      this.rates = state.rates;
      this.initAPY();
    });
    this.vault$ = store.select('vault');
    this.vaultUnScribe = this.vault$.subscribe((state) => {
      this.vaultWallet = state.vaultWallet;
    });
  }
  ngOnDestroy(): void {
    if (this.langUnScribe) {
      this.langUnScribe.unsubscribe();
    }
    if (this.ratesUnScribe) {
      this.ratesUnScribe.unsubscribe();
    }
    if (this.getallUsdtInterval) {
      this.getallUsdtInterval.unsubscribe();
    }
    if (this.vaultUnScribe) {
      this.vaultUnScribe.unsubscribe();
    }
  }

  ngOnInit(): void {
    this.initAPY();
    this.getAllUsdtBalance();
    this.getDailyVolume();
    this.getallUsdtInterval = interval(15000).subscribe(() => {
      this.getAllUsdtBalance();
    });
  }

  getDailyVolume(): void {
    this.apiService.getTotalData().subscribe((res: CommonHttpResponse) => {
      if (res.status === 'success') {
        this.totalVolume = res.data.swap_vol_total;
        this.dailyVolume = res.data.swap_vol_24h;
      }
    });
  }

  async getAllUsdtBalance(): Promise<void> {
    const usdtBalance = await this.apiService.getPUsdtBalance(
      ETH_PUSDT_ASSET.ETH.assetID,
      ETH_PUSDT_ASSET.ETH.decimals
    );
    const busdBalance = await this.apiService.getPUsdtBalance(
      ETH_PUSDT_ASSET.BSC.assetID,
      ETH_PUSDT_ASSET.BSC.decimals
    );
    const husdBalance = await this.apiService.getPUsdtBalance(
      ETH_PUSDT_ASSET.HECO.assetID,
      ETH_PUSDT_ASSET.HECO.decimals
    );
    this.allUsdtBalance = new BigNumber(usdtBalance)
      .plus(new BigNumber(busdBalance))
      .plus(new BigNumber(husdBalance))
      .toFixed();
  }

  initAPY(): void {
    Promise.all([
      this.swapService.getEthBalancByHash(
        this.LPToken,
        this.vaultWallet?.address || ''
      ) || '--',
      this.vaultEthWalletApiService.getO3StakingTotalStaing(this.LPToken) ||
        '--',
      this.vaultEthWalletApiService.getO3StakingStaked(this.LPToken) || '--',
      this.vaultEthWalletApiService.getO3StakingSharePerBlock(this.LPToken) ||
        '0',
    ]).then((res) => {
      [
        this.LPToken.balance,
        this.LPToken.totalStaking,
        this.LPToken.staked,
        this.LPToken.sharePerBlock,
      ] = res;
      this.LPAPY = this.getStakingAPY(this.LPToken);
    });
  }

  getStakingAPY(token: any): string {
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
}
