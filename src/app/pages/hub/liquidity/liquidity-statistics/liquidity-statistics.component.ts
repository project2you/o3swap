import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '@core';
import { Token, USD_TOKENS } from '@lib';
import { Store } from '@ngrx/store';
import BigNumber from 'bignumber.js';
import { Unsubscribable, Observable, interval } from 'rxjs';
import { POOL_LIST } from 'src/app/_lib/pool';

interface State {
  language: any;
}

@Component({
  selector: 'app-liquidity-statistics',
  templateUrl: './liquidity-statistics.component.html',
  styleUrls: ['./liquidity-statistics.component.scss', './mobile.scss'],
})
export class LiquidityStatisticsComponent implements OnInit, OnDestroy {
  private poolId = 1;
  private pool = POOL_LIST.find((item) => item.poolId === this.poolId);
  public ETHWrappedToken: Token = USD_TOKENS.find(
    (item) => item.symbol.indexOf('USDT') >= 0
  );
  public BSCWrappedToken: Token = USD_TOKENS.find(
    (item) => item.symbol.indexOf('BUSD') >= 0
  );
  public HECOWrappedToken: Token = USD_TOKENS.find(
    (item) => item.symbol.indexOf('HUSD') >= 0
  );

  public langPageName = 'hub';
  private langUnScribe: Unsubscribable;
  private language$: Observable<any>;
  public lang: string;

  public poolAssetBalance = {
    ALL: '',
    ETH: { value: '', percentage: '0' },
    BSC: { value: '', percentage: '0' },
    HECO: { value: '', percentage: '0' },
  };
  private getPusdtInterval: Unsubscribable;

  constructor(
    private store: Store<State>,
    private apiService: ApiService,
    private aRoute: ActivatedRoute
  ) {
    this.language$ = store.select('language');
    this.langUnScribe = this.language$.subscribe((state) => {
      this.lang = state.language;
    });
    this.initPool();
  }
  ngOnDestroy(): void {
    if (this.langUnScribe) {
      this.langUnScribe.unsubscribe();
    }
    if (this.getPusdtInterval) {
      this.getPusdtInterval.unsubscribe();
    }
  }

  ngOnInit(): void {
    this.getPusdtBalance();
    this.getPusdtInterval = interval(15000).subscribe(() => {
      this.getPusdtBalance();
    });
  }

  private initPool(): void {
    this.poolId = Number(this.aRoute.snapshot.queryParamMap.get('poolId'));
    this.pool = POOL_LIST.find((item) => item.poolId === this.poolId);
    this.ETHWrappedToken = this.pool.wrappedTokens.find(
      (item) => item.chain === 'ETH'
    );
    this.BSCWrappedToken = this.pool.wrappedTokens.find(
      (item) => item.chain === 'BSC'
    );
    this.HECOWrappedToken = this.pool.wrappedTokens.find(
      (item) => item.chain === 'HECO'
    );
  }

  async getPusdtBalance(): Promise<void> {
    this.poolAssetBalance.ETH.value = await this.apiService.getPUsdtBalance(
      this.pool.curveAssets.ETH.assetID,
      this.pool.curveAssets.ETH.decimals,
      this.poolId
    );
    this.poolAssetBalance.BSC.value = await this.apiService.getPUsdtBalance(
      this.pool.curveAssets.BSC.assetID,
      this.pool.curveAssets.BSC.decimals,
      this.poolId
    );
    this.poolAssetBalance.HECO.value = await this.apiService.getPUsdtBalance(
      this.pool.curveAssets.HECO.assetID,
      this.pool.curveAssets.HECO.decimals,
      this.poolId
    );
    this.poolAssetBalance.ALL = new BigNumber(this.poolAssetBalance.ETH.value)
      .plus(new BigNumber(this.poolAssetBalance.BSC.value))
      .plus(new BigNumber(this.poolAssetBalance.HECO.value))
      .toFixed();
    this.poolAssetBalance.ETH.percentage = new BigNumber(
      this.poolAssetBalance.ETH.value
    )
      .dividedBy(new BigNumber(this.poolAssetBalance.ALL))
      .times(100)
      .dp(3)
      .toFixed();
    this.poolAssetBalance.BSC.percentage = new BigNumber(
      this.poolAssetBalance.BSC.value
    )
      .dividedBy(new BigNumber(this.poolAssetBalance.ALL))
      .times(100)
      .dp(3)
      .toFixed();
    this.poolAssetBalance.HECO.percentage = new BigNumber(
      this.poolAssetBalance.HECO.value
    )
      .dividedBy(new BigNumber(this.poolAssetBalance.ALL))
      .times(100)
      .dp(3)
      .toFixed();
  }
}
