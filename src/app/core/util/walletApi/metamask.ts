import { Injectable } from '@angular/core';
import {
  EthWalletName,
  NETWORK,
  SwapStateType,
  Token,
  UPDATE_BSC_ACCOUNT,
  UPDATE_BSC_WALLET_NAME,
  UPDATE_ETH_ACCOUNT,
  UPDATE_ETH_WALLET_NAME,
  UPDATE_HECO_ACCOUNT,
  UPDATE_HECO_WALLET_NAME,
  UPDATE_METAMASK_NETWORK_ID,
  METAMASK_CHAIN,
  CHAINS,
  MESSAGE,
} from '@lib';
import { Store } from '@ngrx/store';
import BigNumber from 'bignumber.js';
import { NzMessageService } from 'ng-zorro-antd/message';
import { interval, Observable } from 'rxjs';
import { CommonService } from '../common.service';
import { SwapService } from '../swap.service';
import { take } from 'rxjs/operators';

interface State {
  swap: SwapStateType;
  language: any;
}
@Injectable()
export class MetaMaskWalletApiService {
  private myWalletName: EthWalletName = 'MetaMask';
  private ethereum;

  private swap$: Observable<any>;
  private walletName = { ETH: '', BSC: '', HECO: '' };
  private metamaskNetworkId: number;

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
    this.swap$ = store.select('swap');
    this.swap$.subscribe((state) => {
      this.walletName.ETH = state.ethWalletName;
      this.walletName.BSC = state.bscWalletName;
      this.walletName.HECO = state.hecoWalletName;
      this.metamaskNetworkId = state.metamaskNetworkId;
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
            const localEthWalletName = sessionStorage.getItem(
              'ethWalletName'
            ) as EthWalletName;
            const localBscWalletName = sessionStorage.getItem(
              'bscWalletName'
            ) as EthWalletName;
            const localHecoWalletName = sessionStorage.getItem(
              'hecoWalletName'
            ) as EthWalletName;
            if (localEthWalletName === 'MetaMask') {
              this.connect('ETH', false);
            }
            if (localBscWalletName === 'MetaMask') {
              this.connect('BSC', false);
            }
            if (localHecoWalletName === 'MetaMask') {
              this.connect('HECO', false);
            }
          });
        }
      });
  }

  connect(chain: string, showMessage = true): Promise<string> {
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
        const address = result[0];
        this.walletName[chain] = this.myWalletName;
        if (showMessage) {
          this.nzMessage.success(MESSAGE.ConnectionSucceeded[this.lang]);
        }
        this.swapService.listenEthBlockNumber();
        this.swapService.getEthBalance(chain as CHAINS, address);
        this.swapService.updateAccount(chain, address, this.myWalletName);
        this.addListener();
        return address;
      })
      .catch((error) => {
        this.swapService.handleEthDapiError(error, this.myWalletName);
      });
  }
  //#endregion

  checkNetwork(fromToken: Token): boolean {
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
    this.ethereum
      .request({ method: 'net_version' })
      .then((chainId) => {
        this.commonService.log('chainId: ' + chainId);
        const id = Number(chainId);
        if (this.metamaskNetworkId !== id) {
          this.metamaskNetworkId = id;
          this.store.dispatch({
            type: UPDATE_METAMASK_NETWORK_ID,
            data: id,
          });
        }
      })
      .catch((error) => {
        this.commonService.log(error);
      });
    this.ethereum.on('accountsChanged', (accounts) => {
      const address = accounts.length > 0 ? accounts[0] : null;
      this.updateAccount(address);
      if (address === null) {
        this.updateWalletName(null);
      }
      if (address) {
        this.swapService.getEthBalance('ETH');
        this.swapService.getEthBalance('BSC');
        this.swapService.getEthBalance('HECO');
      }
    });
    this.ethereum.on('chainChanged', (chainId) => {
      const id = Number(chainId);
      if (this.metamaskNetworkId !== id) {
        this.metamaskNetworkId = id;
        this.store.dispatch({
          type: UPDATE_METAMASK_NETWORK_ID,
          data: id,
        });
      }
    });
  }
  private updateAccount(data: string): void {
    if (this.walletName.ETH === 'MetaMask') {
      this.store.dispatch({
        type: UPDATE_ETH_ACCOUNT,
        data,
      });
    }
    if (this.walletName.BSC === 'MetaMask') {
      this.store.dispatch({
        type: UPDATE_BSC_ACCOUNT,
        data,
      });
    }
    if (this.walletName.HECO === 'MetaMask') {
      this.store.dispatch({
        type: UPDATE_HECO_ACCOUNT,
        data,
      });
    }
  }
  private updateWalletName(data: string): void {
    if (this.walletName.ETH === 'MetaMask') {
      this.walletName.ETH = null;
      this.store.dispatch({
        type: UPDATE_ETH_WALLET_NAME,
        data,
      });
    }
    if (this.walletName.BSC === 'MetaMask') {
      this.walletName.BSC = null;
      this.store.dispatch({
        type: UPDATE_BSC_WALLET_NAME,
        data,
      });
    }
    if (this.walletName.HECO === 'MetaMask') {
      this.walletName.HECO = null;
      this.store.dispatch({
        type: UPDATE_HECO_WALLET_NAME,
        data,
      });
    }
  }
  //#endregion
}
