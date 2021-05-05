import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { Token } from '@lib';
import { interval, Observable, Unsubscribable } from 'rxjs';
import { O3EthWalletApiService, MetaMaskWalletApiService } from '@core';
import { Store } from '@ngrx/store';

interface State {
  language: any;
}

@Component({
  selector: 'app-approve',
  templateUrl: './approve.component.html',
  styleUrls: ['./approve.component.scss'],
})
export class ApproveComponent implements OnInit, OnDestroy {
  @Input() aggregator?: string;
  @Input() spender?: string;
  @Input() fromToken: Token;
  @Input() fromAddress: string;
  @Input() walletName: string;
  @Output() closeThis = new EventEmitter();

  isApproveLoading = false;
  approveInterval: Unsubscribable;

  langPageName = 'app';
  langUnScribe: Unsubscribable;
  language$: Observable<any>;
  lang: string;

  constructor(
    private store: Store<State>,
    private o3EthWalletApiService: O3EthWalletApiService,
    private metaMaskWalletApiService: MetaMaskWalletApiService,
  ) {
    this.language$ = store.select('language');
    this.langUnScribe = this.language$.subscribe((state) => {
      this.lang = state.language;
    });
  }
  ngOnDestroy(): void {
    if (this.langUnScribe) {
      this.langUnScribe.unsubscribe();
    }
  }

  ngOnInit(): void {}

  approve(): void {
    if (this.approveInterval) {
      this.approveInterval.unsubscribe();
    }
    this.isApproveLoading = true;
    const swapApi = this.getEthDapiService();
    swapApi
      .approve(this.fromToken, this.fromAddress, this.aggregator, this.spender)
      .then((hash) => {
        if (hash) {
          this.approveInterval = interval(5000).subscribe(async () => {
            const receipt = await swapApi.getReceipt(
              hash,
              this.fromToken.chain
            );
            if (receipt !== null) {
              this.approveInterval.unsubscribe();
              this.isApproveLoading = false;
              this.close();
            }
          });
        } else {
          this.isApproveLoading = false;
        }
      });
  }

  getEthDapiService(): any {
    return this.walletName === 'MetaMask' || !this.walletName
      ? this.metaMaskWalletApiService
      : this.o3EthWalletApiService;
  }

  close(): void {
    this.closeThis.emit();
  }
}
