import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
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
  CommonHttpResponse,
} from '@lib';
import { Store } from '@ngrx/store';
import BigNumber from 'bignumber.js';
import { Unsubscribable, Observable, interval } from 'rxjs';
import { POOL_LIST } from 'src/app/_lib/pool';
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
  public poolList = POOL_LIST;
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

  private LPToken: any = [];
  public totalVolume = [];
  public LPAPY = [];

  public allUsdtBalance: string;
  private getallUsdtInterval: Unsubscribable;
  public dailyVolume: string;
  constructor(
    private store: Store<State>,
    private vaultEthWalletApiService: VaultEthWalletApiService,
    private commonService: CommonService,
    private swapService: SwapService,
    private apiService: ApiService,
    private aRoute: ActivatedRoute
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
    this.getDailyVolume();
    this.getallUsdtInterval = interval(15000).subscribe(() => {
      this.getDailyVolume();
    });
  }

  getDailyVolume(): void {
    this.apiService.getTotalData().subscribe((res: CommonHttpResponse) => {
      if (res.status === 'success') {
        this.totalVolume = res.data.swap_vol_total;
        this.dailyVolume = res.data.swap_vol_24h;
        this.allUsdtBalance = res.data.pool_tvl;
      }
    });
  }

  initAPY(): void {
    this.poolList.forEach((pool, index) => {
      this.LPToken[index] = LP_TOKENS[pool.poolId].find(
        (item) => item.chain === pool.chain
      );
      Promise.all([
        this.swapService.getEthBalancByHash(
          this.LPToken[index],
          this.vaultWallet?.address || ''
        ) || '--',
        this.vaultEthWalletApiService.getO3StakingTotalStaing(
          this.LPToken[index]
        ) || '--',
        this.vaultEthWalletApiService.getO3StakingStaked(this.LPToken[index]) ||
          '--',
        this.vaultEthWalletApiService.getO3StakingSharePerBlock(
          this.LPToken[index]
        ) || '0',
      ]).then((res) => {
        [
          this.LPToken[index].balance,
          this.LPToken[index].totalStaking,
          this.LPToken[index].staked,
          this.LPToken[index].sharePerBlock,
        ] = res;
        this.LPAPY[index] = this.getStakingAPY(this.LPToken[index]);
      });
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
        LP_TOKENS[1].filter((item) => {
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
