import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { NzMessageService } from 'ng-zorro-antd/message';
import o3dapi from 'o3-dapi-core';
import o3dapiNeo from 'o3-dapi-neo';
import { CommonService } from '../common.service';
import { SwapService } from '../swap.service';
import { NeoWalletName, SwapStateType, MESSAGE } from '@lib';
import { interval, Observable, Unsubscribable } from 'rxjs';

interface State {
  swap: SwapStateType;
  language: any;
}

@Injectable()
export class O3NeoWalletApiService {
  private myWalletName: NeoWalletName = 'O3';
  private o3DapiIsReady = false;
  private blockNumberInterval: Unsubscribable;

  private swap$: Observable<any>;
  private neoWalletName: string;

  private language$: Observable<any>;
  private lang: string;

  constructor(
    store: Store<State>,
    private nzMessage: NzMessageService,
    private swapService: SwapService,
    private commonService: CommonService
  ) {
    this.language$ = store.select('language');
    this.language$.subscribe((state) => {
      this.lang = state.language;
    });
    o3dapi.initPlugins([o3dapiNeo]);
    o3dapi.NEO.addEventListener(o3dapi.NEO.Constants.EventName.READY, () => {
      this.o3DapiIsReady = true;
    });
    this.swap$ = store.select('swap');
    this.swap$.subscribe((state) => {
      this.neoWalletName = state.neoWalletName;
    });
  }

  //#region connect
  connect(): Promise<string> {
    if (this.o3DapiIsReady === false) {
      this.nzMessage.info(MESSAGE.O3DAPINotReady[this.lang]);
    }
    return o3dapi.NEO.getAccount()
      .then((result) => {
        this.commonService.log(result);
        if (!result.address) {
          return;
        }
        this.nzMessage.success(MESSAGE.ConnectionSucceeded[this.lang]);
        this.swapService.updateAccount(
          'NEO',
          result.address,
          this.myWalletName
        );
        this.swapService.getNeoBalances(this.myWalletName);
        this.listenBlockNumber();
        return result.address;
      })
      .catch((error) => {
        this.swapService.handleNeoDapiError(error, this.myWalletName);
      });
  }
  //#endregion

  invoke(params): Promise<any> {
    return o3dapi.NEO.invoke(params)
      .then(({ txid }) => {
        return txid;
      })
      .catch((error) => {
        this.commonService.log(error);
        this.swapService.handleNeoDapiError(error, this.myWalletName);
      });
  }

  //#region private function
  private listenBlockNumber(): void {
    if (this.blockNumberInterval) {
      return;
    }
    this.blockNumberInterval = interval(15000).subscribe(() => {
      this.swapService.getNeoBalances(this.myWalletName);
      // 没有连接时不获取 balances
      if (this.neoWalletName !== this.myWalletName) {
        this.blockNumberInterval.unsubscribe();
      }
    });
  }
  //#endregion
}
