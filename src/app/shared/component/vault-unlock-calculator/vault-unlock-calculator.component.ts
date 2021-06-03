import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  EventEmitter,
  Output,
} from '@angular/core';
import { RpcApiService } from '@core/api/rpc.service';
import { CommonService } from '@core/util/common.service';
import { SwapService } from '@core/util/swap.service';
import { O3_TOKEN, Token } from '@lib';
import { Store } from '@ngrx/store';
import BigNumber from 'bignumber.js';
import { Unsubscribable, Observable } from 'rxjs';
import Web3 from 'web3';

interface State {
  rates: any;
  language: any;
}

@Component({
  selector: 'app-vault-unlock-calculator',
  templateUrl: './vault-unlock-calculator.component.html',
  styleUrls: ['./vault-unlock-calculator.component.scss'],
})
export class VaultUnlockCalculatorComponent implements OnInit, OnDestroy {
  @Input() LPToken: Token;
  @Output() closeThis = new EventEmitter();

  lockedValue = '';
  lpValue = '';
  o3Value = '';
  UsdtValue = '';

  unlockSpeed = '--';
  unlockTime = '--';

  langPageName = 'vault';
  langUnScribe: Unsubscribable;
  language$: Observable<any>;
  lang: string;

  ratesUnScribe: Unsubscribable;
  rates$: Observable<any>;
  rates = {};

  private unlockBlockGap = new BigNumber(15000);
  private standerLp = new BigNumber('0.387298334620740688');
  private standerO3Amount = new BigNumber('300000');
  private lpTotalSupply = new BigNumber('0.387298334620740688');
  private lpO3Balance = new BigNumber('300000');
  private blockTime = new BigNumber(13.2);
  private K = new BigNumber(20).div(this.standerLp); // O3/LP/Block;

  constructor(
    store: Store<State>,
    private commonService: CommonService,
    private rpcApiService: RpcApiService,
    private swapService: SwapService
  ) {
    this.language$ = store.select('language');
    this.rates$ = store.select('rates');
    this.langUnScribe = this.language$.subscribe((state) => {
      this.lang = state.language;
    });
  }

  ngOnInit(): void {
    this.swapService
      .getEthBalancByHash(O3_TOKEN, this.LPToken.assetID)
      .then((res) => {
        this.lpO3Balance = new BigNumber(res);
      });
    this.rpcApiService
      .getEthCall(
        [
          this.commonService.getSendTransactionParams(
            undefined,
            this.LPToken.assetID,
            this.getTotalSupplyData()
          ),
          'latest',
        ],
        this.LPToken
      )
      .then((res) => {
        this.lpTotalSupply = new BigNumber(res);
      });
    this.ratesUnScribe = this.rates$.subscribe((state) => {
      this.rates = state.rates;
    });
  }

  ngOnDestroy(): void {
    if (this.langUnScribe) {
      this.langUnScribe.unsubscribe();
    }
    if (this.ratesUnScribe) {
      this.ratesUnScribe.unsubscribe();
    }
  }

  changeLockedValue($event): void {
    this.lockedValue = $event.target.value;
    const lockNum = new BigNumber(this.lockedValue);
    this.lpValue = lockNum
      .div(this.standerO3Amount)
      .times(this.standerLp)
      .dp(8)
      .toFixed();
    this.calculateO3();
    this.calculateSpeed();
  }
  calculateO3(): void {
    const lpBigNumber = new BigNumber(this.lpValue);
    if (lpBigNumber.isNaN()) {
      this.o3Value = '';
      return;
    }
    this.o3Value = lpBigNumber
      .div(this.lpTotalSupply)
      .times(this.lpO3Balance)
      .dp(8)
      .toFixed();
    this.calculateO3Price();
    this.calculateSpeed();
  }
  calculateLPValue(): void {
    const o3BigNumber = new BigNumber(this.o3Value);
    if (o3BigNumber.isNaN()) {
      this.lpValue = '';
      return;
    }
    this.lpValue = o3BigNumber
      .div(this.lpO3Balance)
      .times(this.lpTotalSupply)
      .dp(8)
      .toFixed();
    const lockNum = new BigNumber(this.lockedValue);
    this.calculateO3Price();
    if (lockNum.isNaN()) {
      return;
    }
    this.calculateSpeed();
  }

  calculateSpeed(): void {
    const lockNum = new BigNumber(this.lockedValue);
    if (lockNum.isNaN()) {
      this.unlockSpeed = '--';
      this.unlockTime = '--';
      return;
    }
    const lpNum = new BigNumber(this.lpValue);
    const currentSpeed = lpNum.times(this.K);
    const maxSpeed = lockNum.div(this.unlockBlockGap);
    if (currentSpeed.comparedTo(maxSpeed) === 1) {
      this.unlockSpeed = maxSpeed.dp(8).toFixed();
    } else {
      this.unlockSpeed = currentSpeed.dp(8).toFixed();
    }
    this.unlockTime = lockNum
      .div(this.unlockSpeed)
      .times(this.blockTime)
      .div(new BigNumber('3600'))
      .dp(2)
      .toFixed();
  }

  calculateO3Price(): void {
    const o3Price = this.commonService.getAssetRate(this.rates, O3_TOKEN);
    this.UsdtValue = new BigNumber(o3Price)
      .times(new BigNumber(this.o3Value))
      .dp(8)
      .toFixed();
  }

  close(): void {
    this.closeThis.emit();
  }
  getLp(): void {
    window.open(
      `https://app.uniswap.org/#/add/v2/${this.LPToken.pairTokens[0]}/${this.LPToken.pairTokens[1]}`
    );
  }

  private getTotalSupplyData(): string {
    return new Web3().eth.abi.encodeFunctionSignature({
      name: 'totalSupply',
      type: 'function',
      inputs: [],
    });
  }
}
