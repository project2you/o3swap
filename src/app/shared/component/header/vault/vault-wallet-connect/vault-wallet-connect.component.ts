import {
  Component,
  OnInit,
  ChangeDetectorRef,
  Input,
  EventEmitter,
  Output,
  OnDestroy,
} from '@angular/core';
import {
  ETH_WALLETS,
  NEO_WALLETS,
  BSC_WALLETS,
  HECO_WALLETS,
  NeoWallet,
  EthWallet,
} from '@lib';
import {
  CommonService,
  ApiService,
  VaultdMetaMaskWalletApiService,
  NeolineWalletApiService,
  O3NeoWalletApiService,
  O3EthWalletApiService,
} from '@core';
import { Store } from '@ngrx/store';
import { Observable, Unsubscribable } from 'rxjs';
import { VaultWallet } from 'src/app/_lib/vault';

export type ConnectChainType = 'ETH' | 'NEO' | 'BSC' | 'HECO';
interface State {
  vault: any;
  language: any;
}

@Component({
  selector: 'app-vault-wallet-connect',
  templateUrl: './vault-wallet-connect.component.html',
  styleUrls: ['../../wallet-connect.scss'],
})
export class VaultWalletConnectComponent implements OnInit, OnDestroy {
  NEO_WALLETS = NEO_WALLETS;
  ETH_WALLETS = ETH_WALLETS;
  BSC_WALLETS = BSC_WALLETS;
  HECO_WALLETS = HECO_WALLETS;
  @Input() show: boolean;
  @Input() connectChainType: ConnectChainType;
  @Output() closePage = new EventEmitter();

  vault$: Observable<any>;
  vaultUnScribe: Unsubscribable;
  vaultWallet: VaultWallet;

  langPageName = 'app';
  langUnScribe: Unsubscribable;
  language$: Observable<any>;
  lang: string;

  showModal = true;

  constructor(
    store: Store<State>,
    private commonService: CommonService,
    public apiService: ApiService,
    private o3NeoWalletApiService: O3NeoWalletApiService,
    private neolineWalletApiService: NeolineWalletApiService,
    private vaultdMetaMaskWalletApiService: VaultdMetaMaskWalletApiService,
    private o3EthWalletApiService: O3EthWalletApiService,
    private changeDetectorRef: ChangeDetectorRef
  ) {
    this.language$ = store.select('language');
    this.langUnScribe = this.language$.subscribe((state) => {
      this.lang = state.language;
    });
    this.vault$ = store.select('vault');
  }
  ngOnDestroy(): void {
    if (this.vaultUnScribe) {
      this.vaultUnScribe.unsubscribe();
    }
    if (this.langUnScribe) {
      this.langUnScribe.unsubscribe();
    }
  }

  ngOnInit(): void {
    if (this.commonService.isMobileWidth()) {
      this.showModal = false;
    }
    this.commonService.log(this.show);
    this.vaultUnScribe = this.vault$.subscribe((state) => {
      this.vaultWallet = state.vaultWallet;
    });
  }

  copy(value: string): void {
    this.commonService.copy(value);
  }

  close(): void {
    this.closePage.emit();
  }

  //#region connect wallet modal
  async connectNeoWallet(wallet: NeoWallet): Promise<void> {
    if (
      this.vaultWallet &&
      this.vaultWallet.chain === 'NEO' &&
      this.vaultWallet.walletName === wallet.name
    ) {
      return;
    }
    let connectRes;
    switch (wallet.name) {
      case 'NeoLine':
        connectRes = await this.neolineWalletApiService.connect();
        break;
      case 'O3':
        connectRes = await this.o3NeoWalletApiService.connect();
        break;
    }
    if (connectRes) {
      this.close();
    }
  }

  async connectEthWallet(wallet: EthWallet): Promise<void> {
    if (
      this.vaultWallet &&
      this.vaultWallet.chain === this.connectChainType &&
      this.vaultWallet.walletName === wallet.name
    ) {
      return;
    }
    let connectRes;
    switch (wallet.name) {
      case 'MetaMask':
        connectRes = await this.vaultdMetaMaskWalletApiService.vaultConnect(
          this.connectChainType
        );
        break;
      case 'O3':
        if (this.o3EthWalletApiService.isMobileWallet) {
          connectRes = await this.vaultdMetaMaskWalletApiService.vaultConnect(
            this.connectChainType,
            this.o3EthWalletApiService.isMobileWallet
          );
        } else {
          // connectRes = await this.o3EthWalletApiService.connect(
          //   this.connectChainType
          // );
        }
        break;
      case 'MathWallet':
      case 'TokenPocket':
        if (this.o3EthWalletApiService.isMobileWallet) {
          connectRes = await this.vaultdMetaMaskWalletApiService.vaultConnect(
            this.connectChainType,
            true
          );
        }

        break;
    }
    if (connectRes) {
      this.close();
    }
  }
  //#endregion
}
