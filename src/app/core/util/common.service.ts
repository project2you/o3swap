import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '@env/environment';
import {
  ETH_RPC_HOST,
  MESSAGE,
  METAMASK_CHAIN_ID,
  MyTransaction,
  Token,
} from '@lib';
import { Store } from '@ngrx/store';
import { TxProgressModalComponent } from '../../shared/modal/tx-progress/tx-progress.component';
import { TxProgressDrawerComponent } from '../../shared/drawers/tx-progress/tx-progress.component';
import { LoadingDialogModalComponent } from '@shared/modal/loading-dialog/loading-dialog.component';
import BigNumber from 'bignumber.js';
import { NzDrawerService } from 'ng-zorro-antd/drawer';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalRef, NzModalService } from 'ng-zorro-antd/modal';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
interface State {
  language: any;
}

@Injectable()
export class CommonService {
  private isProduction = environment.production;

  private language$: Observable<any>;
  private lang: string;
  constructor(
    public store: Store<State>,
    private nzMessage: NzMessageService,
    private http: HttpClient,
    private modal: NzModalService,
    private drawerService: NzDrawerService
  ) {
    this.language$ = store.select('language');
    this.language$.subscribe((state) => {
      this.lang = state.language;
    });
  }

  showTxDetail(txItem: MyTransaction): void {
    if (!this.isMobileWidth()) {
      this.modal.create({
        nzContent: TxProgressModalComponent,
        nzFooter: null,
        nzTitle: null,
        nzClosable: false,
        nzMaskClosable: true,
        nzClassName: 'custom-modal tx-modal',
        nzComponentParams: {
          transaction: txItem,
        },
      });
    } else {
      this.drawerService.create({
        nzContent: TxProgressDrawerComponent,
        nzTitle: null,
        nzClosable: false,
        nzPlacement: 'bottom',
        nzWrapClassName: 'custom-drawer tx-progress',
        nzContentParams: {
          transaction: txItem,
        },
      });
    }
  }

  loading(transactionType?, params?): NzModalRef {
    return this.modal.create({
      nzContent: LoadingDialogModalComponent,
      nzFooter: null,
      nzTitle: null,
      nzClosable: false,
      nzWidth: 320,
      nzClassName: 'custom-modal',
      nzComponentParams: {
        transactionType,
        params,
      },
    });
  }

  //#region global
  log(value: any): void {
    if (this.isProduction === false) {
      console.log(value);
    }
  }
  copy(value: string): void {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.setAttribute('value', value);
    input.select();
    if (document.execCommand('copy')) {
      document.execCommand('copy');
      this.nzMessage.success(MESSAGE.CopiedSuccessfully[this.lang]);
    }
    document.body.removeChild(input);
  }
  isMobileWidth(): boolean {
    return window.document.getElementsByTagName('body')[0].clientWidth <= 750;
  }
  //#endregion

  //#region asset
  getAssetRate(rates: {}, token: Token): string {
    let chain = token.chain.toLowerCase();
    if (chain === 'neo') {
      chain = 'neo2';
    }
    if (!rates[chain]) {
      return;
    }
    const tokenRate = rates[chain][token.symbol.toLowerCase()];
    if (tokenRate) {
      if (
        tokenRate.asset_id &&
        this.remove0xHash(tokenRate.asset_id).toLowerCase() ===
          this.remove0xHash(token.assetID).toLowerCase()
      ) {
        return tokenRate.price;
      }
    }
    return;
  }
  getAssetRateByHash(rates: {}, hash: string, chainType: string): string {
    let chain = chainType.toLowerCase();
    if (chain === 'neo') {
      chain = 'neo2';
    }
    if (!rates[chain]) {
      return;
    }
    const rateList = rates[chain];
    const filterKey = Object.keys(rateList).filter(
      (key) =>
        this.remove0xHash(hash).toLowerCase() ===
        this.remove0xHash(rateList[key].asset_id).toLowerCase()
    );
    if (filterKey.length > 0) {
      return rateList[filterKey[0]].price;
    } else {
      return '0';
    }
  }
  judgeAssetHash(hash: string, anotherHash: string): boolean {
    return (
      this.remove0xHash(hash).toLowerCase() ===
      this.remove0xHash(anotherHash).toLowerCase()
    );
  }
  //#endregion

  //#region handle number, string
  add0xHash(hash: string): string {
    if ((hash || '').startsWith('0x')) {
      return hash;
    } else {
      return `0x${hash}`;
    }
  }
  remove0xHash(hash: string): string {
    if ((hash || '').startsWith('0x')) {
      return hash.slice(2);
    } else {
      return hash || '';
    }
  }
  decimalToInteger(value, decimals: number): string {
    if (new BigNumber(value).isNaN()) {
      return '';
    }
    return new BigNumber(value).shiftedBy(decimals).dp(0).toFixed();
  }
  //#endregion

  //#region eth dapi
  getSendTransactionParams(
    from: string,
    to: string,
    data: string,
    value?: string,
    gas?: string,
    gasPrice?: string
  ): object {
    if (value && !value.startsWith('0x')) {
      value = '0x' + new BigNumber(value).toString(16);
    }
    to = this.add0xHash(to);
    return {
      from,
      to,
      value,
      gas,
      gasPrice,
      data,
    };
  }
  getPreExecutionResult(data: any[], fromToken: Token): Promise<boolean> {
    this.log('------pre execution');
    data.push('latest');
    return this.http
      .post(ETH_RPC_HOST[fromToken.chain], {
        jsonrpc: '2.0',
        id: METAMASK_CHAIN_ID[fromToken.chain],
        method: 'eth_call',
        params: data,
      })
      .pipe(
        map((res: any) => {
          if (res.error) {
            this.nzMessage.error(
              res.error.message || MESSAGE.contractPreExecutionError[this.lang]
            );
            return false;
          }
          return true;
        })
      )
      .toPromise();
  }
  //#endregion
}
