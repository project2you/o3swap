import { Injectable } from '@angular/core';
import {
  ConnectChainType,
  EthWalletName,
  MESSAGE,
  RESET_VAULT_WALLET,
  Token,
  UPDATE_VAULT_WALLET,
  METAMASK_CHAIN,
  NETWORK,
  CHAINS,
} from '@lib';
import { Store } from '@ngrx/store';
import { NzMessageService } from 'ng-zorro-antd/message';
import { interval, Observable } from 'rxjs';
import { CommonService } from '../common.service';
import { SwapService } from '../swap.service';
import { VaultWallet } from 'src/app/_lib/vault';
import { take } from 'rxjs/operators';
import BigNumber from 'bignumber.js';
interface State {
  vault: any;
  language: any;
}
@Injectable()
export class VaultdMetaMaskWalletApiService {
  private myWalletName: EthWalletName = 'MetaMask';
  private ethereum;

  private vault$: Observable<any>;
  private vaultWallet: VaultWallet;

  private language$: Observable<any>;
  private lang: string;

  constructor(
    private store: Store<State>,
    private nzMessage: NzMessageService,
    private swapService: SwapService,
    private commonService: CommonService
  ) {
    this.language$ = store.select('language');
    this.language$.subscribe((state) => {
      this.lang = state.language;
    });
    this.vault$ = store.select('vault');
    this.vault$.subscribe((state) => {
      this.vaultWallet = state.vaultWallet;
    });
    if ((window as any).ethereum) {
      switch (true) {
        case (window as any).ethereum.isO3Wallet === true: {
          this.myWalletName = 'O3';
          break;
        }
        case (window as any).ethereum.isMathWallet === true: {
          this.myWalletName = 'MathWallet';
          break;
        }
        case (window as any).ethereum.isTokenPocket === true: {
          this.myWalletName = 'TokenPocket';
          break;
        }
        default: {
          this.myWalletName = 'MetaMask';
        }
      }
    }
  }

  //#region connect
  initConnect(): void {
    const intervalReq = interval(1000)
      .pipe(take(5))
      .subscribe(() => {
        if (!(window as any).ethereum) {
          return;
        } else {
          intervalReq.unsubscribe();
        }
        this.ethereum = (window as any).ethereum;
        if (this.ethereum.isConnected()) {
          this.ethereum.request({ method: 'eth_accounts' }).then((result) => {
            if (result.length === 0) {
              return;
            }
            const localVaultWallet = JSON.parse(
              sessionStorage.getItem('vaulteWallet')
            );
            if (
              localVaultWallet &&
              localVaultWallet.walletName === 'MetaMask'
            ) {
              this.vaultConnect(localVaultWallet.chain, false);
            }
          });
        }
      });
  }
  vaultConnect(chain: string, showMessage = true): Promise<VaultWallet> {
    if (!(window as any).ethereum) {
      this.swapService.toDownloadWallet(this.myWalletName);
      return;
    }
    this.ethereum = (window as any).ethereum;
    return this.ethereum
      .request({ method: 'eth_requestAccounts' })
      .then((result) => {
        if (result.length <= 0) {
          this.nzMessage.error(MESSAGE.UpdateMetaMaskExtension[this.lang]);
          return;
        }
        this.commonService.log(result);
        if (showMessage) {
          this.nzMessage.success(MESSAGE.ConnectionSucceeded[this.lang]);
        }
        this.vaultWallet = {
          walletName: this.myWalletName,
          address: result[0],
          chain: chain as ConnectChainType,
        };
        this.store.dispatch({
          type: UPDATE_VAULT_WALLET,
          data: this.vaultWallet,
        });
        this.addListener();
        return this.vaultWallet;
      })
      .catch((error) => {
        this.swapService.handleEthDapiError(error, this.myWalletName);
      });
  }
  //#endregion

  checkNetwork(fromToken: Token): boolean {
    if (!this.ethereum) {
      this.ethereum = (window as any).ethereum;
    }
    const chainId = new BigNumber(this.ethereum.chainId, 16).toNumber();
    const chain = METAMASK_CHAIN[chainId];
    if (chain !== fromToken.chain) {
      this.nzMessage.error(
        MESSAGE.SwitchMetaMaskNetwork[this.lang]([fromToken.chain, NETWORK])
      );
      return false;
    }
    return true;
  }

  sendTransaction(data, chain: CHAINS): Promise<any> {
    this.ethereum = (window as any).ethereum;
    return new Promise((resolve) => {
      this.ethereum
        .request(data)
        .then((hash) => {
          resolve(hash);
        })
        .catch((error) => {
          this.commonService.log(error);
          this.swapService.handleEthDapiError(error, this.myWalletName);
          resolve(undefined);
        });
    });
  }

  //#region private function
  private addListener(): void {
    this.ethereum.on('accountsChanged', (accounts) => {
      if (
        this.vaultWallet &&
        this.vaultWallet.walletName === this.myWalletName
      ) {
        const accountAddress = accounts.length > 0 ? accounts[0] : null;
        if (accountAddress !== null) {
          this.vaultWallet.address = accountAddress;
          this.store.dispatch({
            type: UPDATE_VAULT_WALLET,
            data: this.vaultWallet,
          });
        } else {
          this.store.dispatch({ type: RESET_VAULT_WALLET });
        }
      }
    });
  }
  //#endregion
}
