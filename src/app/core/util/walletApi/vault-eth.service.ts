import { Injectable } from '@angular/core';
import { ethers } from 'ethers';
import {
  O3_TOKEN,
  Token,
  O3STAKING_CONTRACT,
  O3TOKEN_CONTRACT,
  ETH_AIRDROP_CLAIM_CONTRACT,
  TransactionType,
  MyTransaction,
  ADD_TX,
  UPDATE_TX,
} from '@lib';
import { Store } from '@ngrx/store';
import { interval, Observable, of, Unsubscribable } from 'rxjs';
import { CommonService } from '../common.service';
import Web3 from 'web3';
import { VaultWallet } from 'src/app/_lib/vault';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs/operators';
import BigNumber from 'bignumber.js';
import { RpcApiService } from '@core/api/rpc.service';
import BalanceTree from '../markle/balance-tree';
import { VaultdMetaMaskWalletApiService } from './vault-metamask';
interface State {
  vault: any;
}
@Injectable()
export class VaultEthWalletApiService {
  private web3: Web3 = new Web3();
  private contractJson = {};
  private airdropListJson = [];

  private vault$: Observable<any>;
  private vaultWallet: VaultWallet;

  constructor(
    private http: HttpClient,
    private store: Store<State>,
    private commonService: CommonService,
    private rpcApiService: RpcApiService,
    private vaultdMetaMaskWalletApiService: VaultdMetaMaskWalletApiService
  ) {
    this.vault$ = store.select('vault');
    this.vault$.subscribe((state) => {
      this.vaultWallet = state.vaultWallet;
    });
  }

  checkNetwork(fromToken: Token): boolean {
    return this.vaultdMetaMaskWalletApiService.checkNetwork(fromToken);
  }

  getContractJson(type: 'o3Json' | 'o3Staking' | 'airdrop'): Promise<any> {
    if (this.contractJson[type]) {
      return of(this.contractJson[type]).toPromise();
    }
    let path: string;
    switch (type) {
      case 'o3Json':
        path = 'assets/contracts-json/O3.json';
        break;
      case 'o3Staking':
        path = 'assets/contracts-json/O3Staking.json';
        break;
      case 'airdrop':
        path = 'assets/contracts-json/Airdrop.json';
        break;
    }
    return this.http
      .get(path)
      .pipe(
        map((res) => {
          this.contractJson[type] = res;
          return res;
        })
      )
      .toPromise();
  }
  getAirdropListJson(airdropIndex: number): Promise<any> {
    if (this.airdropListJson[airdropIndex]) {
      return of(this.airdropListJson[airdropIndex]).toPromise();
    }
    const path = `assets/datas/airdropList${airdropIndex}.json`;
    return this.http
      .get(path)
      .pipe(
        map((res) => {
          this.airdropListJson[airdropIndex] = res;
          return res;
        })
      )
      .toPromise();
  }
  //#region vault staking
  async o3StakingStake(
    token: Token,
    inputAmount: string,
    address?: string
  ): Promise<any> {
    const json = await this.getContractJson('o3Staking');
    const o3StakingContractHash =
      O3STAKING_CONTRACT[token.chain][token.assetID];
    const o3StakingContract = new this.web3.eth.Contract(
      json,
      o3StakingContractHash
    );
    const data = o3StakingContract.methods
      .stake(
        new BigNumber(inputAmount).shiftedBy(token.decimals).dp(0).toFixed()
      )
      .encodeABI();
    const requestData = {
      method: 'eth_sendTransaction',
      params: [
        this.commonService.getSendTransactionParams(
          address || this.vaultWallet.address,
          o3StakingContractHash,
          data
        ),
      ],
    };
    if (
      (await this.commonService.getPreExecutionResult(
        requestData.params,
        token
      )) !== true
    ) {
      return;
    }
    return this.vaultdMetaMaskWalletApiService
      .sendTransaction(requestData, token.chain)
      .then((hash) => {
        this.commonService.log(hash);
        this.handleTx(token, inputAmount, hash, TransactionType.stake);
        return hash;
      });
  }
  async o3StakingUnStake(token: Token, inputAmount: string): Promise<any> {
    const json = await this.getContractJson('o3Staking');
    const o3StakingContractHash =
      O3STAKING_CONTRACT[token.chain][token.assetID];
    const o3StakingContract = new this.web3.eth.Contract(
      json,
      o3StakingContractHash
    );
    const data = o3StakingContract.methods
      .unstake(
        new BigNumber(inputAmount).shiftedBy(token.decimals).dp(0).toFixed()
      )
      .encodeABI();
    const requestData = {
      method: 'eth_sendTransaction',
      params: [
        this.commonService.getSendTransactionParams(
          this.vaultWallet.address,
          o3StakingContractHash,
          data
        ),
      ],
    };
    if (
      (await this.commonService.getPreExecutionResult(
        requestData.params,
        token
      )) !== true
    ) {
      return;
    }
    return this.vaultdMetaMaskWalletApiService
      .sendTransaction(requestData, token.chain)
      .then((hash) => {
        this.commonService.log(hash);
        this.handleTx(token, inputAmount, hash, TransactionType.unstake);
        return hash;
      });
  }
  async o3StakingClaimProfit(
    token: Token,
    profit: string,
    address?: string
  ): Promise<any> {
    const json = await this.getContractJson('o3Staking');
    const o3StakingContractHash =
      O3STAKING_CONTRACT[token.chain][token.assetID];
    const o3StakingContract = new this.web3.eth.Contract(
      json,
      o3StakingContractHash
    );
    const data = o3StakingContract.methods.claimProfit().encodeABI();
    const requestData = {
      method: 'eth_sendTransaction',
      params: [
        this.commonService.getSendTransactionParams(
          address || this.vaultWallet.address,
          o3StakingContractHash,
          data
        ),
      ],
    };
    if (
      (await this.commonService.getPreExecutionResult(
        requestData.params,
        token
      )) !== true
    ) {
      return;
    }
    return this.vaultdMetaMaskWalletApiService
      .sendTransaction(requestData, token.chain)
      .then((hash) => {
        this.commonService.log(hash);
        this.handleTx(O3_TOKEN, profit, hash, TransactionType.claim);
        return hash;
      });
  }
  async getO3StakingTotalStaing(token: Token): Promise<string> {
    let params;
    const contractHash = O3STAKING_CONTRACT[token.chain][token.assetID];
    const json = await this.getContractJson('o3Staking');
    const o3Contract = new this.web3.eth.Contract(json, contractHash);
    const data = await o3Contract.methods.totalStaked().encodeABI();
    params = [
      this.commonService.getSendTransactionParams(
        this.vaultWallet?.address || contractHash,
        contractHash,
        data
      ),
      'latest',
    ];
    return this.rpcApiService.getEthCall(params, token).then((res) => {
      if (res) {
        return res;
      }
    });
  }
  async getO3StakingSharePerBlock(token: Token): Promise<string> {
    let params;
    const contractHash = O3STAKING_CONTRACT[token.chain][token.assetID];
    const json = await this.getContractJson('o3Staking');
    const o3Contract = new this.web3.eth.Contract(json, contractHash);
    const data = await o3Contract.methods.getSharePerBlock().encodeABI();
    params = [
      this.commonService.getSendTransactionParams(
        this.vaultWallet?.address || contractHash,
        contractHash,
        data
      ),
      'latest',
    ];
    return this.rpcApiService.getEthCall(params, token).then((res) => {
      if (res) {
        return res;
      }
    });
  }
  async getO3StakingTotalProfit(
    token: Token,
    address?: string
  ): Promise<string> {
    if (!this.vaultWallet && !address) {
      return;
    }
    let params;
    const contractHash = O3STAKING_CONTRACT[token.chain][token.assetID];
    const json = await this.getContractJson('o3Staking');
    const o3Contract = new this.web3.eth.Contract(json, contractHash);
    const data = await o3Contract.methods
      .getTotalProfit(address || this.vaultWallet.address)
      .encodeABI();
    params = [
      this.commonService.getSendTransactionParams(
        address || this.vaultWallet.address,
        contractHash,
        data
      ),
      'latest',
    ];
    return this.rpcApiService.getEthCall(params, token).then((res) => {
      if (res) {
        return res;
      }
    });
  }
  async getO3StakingStaked(token: Token, address?: string): Promise<string> {
    if (!this.vaultWallet && !address) {
      return;
    }
    let params;
    const contractHash = O3STAKING_CONTRACT[token.chain][token.assetID];
    const json = await this.getContractJson('o3Staking');
    const o3Contract = new this.web3.eth.Contract(json, contractHash);
    const data = await o3Contract.methods
      .getStakingAmount(address || this.vaultWallet.address)
      .encodeABI();
    params = [
      this.commonService.getSendTransactionParams(
        address || this.vaultWallet.address,
        contractHash,
        data
      ),
      'latest',
    ];
    return this.rpcApiService.getEthCall(params, token).then((res) => {
      if (res) {
        return res;
      }
    });
  }
  //#endregion

  //#region vault o3
  async stakeO3(token: Token, inputAmount: string): Promise<any> {
    const json = await this.getContractJson('o3Json');
    const o3Contract = new this.web3.eth.Contract(json, O3TOKEN_CONTRACT);
    const data = o3Contract.methods
      .stake(
        token.assetID,
        new BigNumber(inputAmount).shiftedBy(token.decimals).dp(0).toFixed()
      )
      .encodeABI();
    const requestData = {
      method: 'eth_sendTransaction',
      params: [
        this.commonService.getSendTransactionParams(
          this.vaultWallet.address,
          O3TOKEN_CONTRACT,
          data
        ),
      ],
    };
    if (
      (await this.commonService.getPreExecutionResult(
        requestData.params,
        token
      )) !== true
    ) {
      return;
    }
    return this.vaultdMetaMaskWalletApiService
      .sendTransaction(requestData, token.chain)
      .then((hash) => {
        this.commonService.log(hash);
        this.handleTx(token, inputAmount, hash, TransactionType.stake);
        return hash;
      });
  }
  async unstakeO3(token: Token, inputAmount: string): Promise<any> {
    const json = await this.getContractJson('o3Json');
    const o3Contract = new this.web3.eth.Contract(json, O3TOKEN_CONTRACT);
    const data = o3Contract.methods
      .unstake(
        token.assetID,
        new BigNumber(inputAmount).shiftedBy(token.decimals).dp(0).toFixed()
      )
      .encodeABI();
    const requestData = {
      method: 'eth_sendTransaction',
      params: [
        this.commonService.getSendTransactionParams(
          this.vaultWallet.address,
          O3TOKEN_CONTRACT,
          data
        ),
      ],
    };
    if (
      (await this.commonService.getPreExecutionResult(
        requestData.params,
        token
      )) !== true
    ) {
      return;
    }
    return this.vaultdMetaMaskWalletApiService
      .sendTransaction(requestData, token.chain)
      .then((hash) => {
        this.commonService.log(hash);
        this.handleTx(token, inputAmount, hash, TransactionType.unstake);
        return hash;
      });
  }
  async claimUnlocked(token: Token, unlocked: string): Promise<any> {
    const json = await this.getContractJson('o3Json');
    const o3Contract = new this.web3.eth.Contract(json, O3TOKEN_CONTRACT);
    const data = o3Contract.methods.claimUnlocked(token.assetID).encodeABI();
    const requestData = {
      method: 'eth_sendTransaction',
      params: [
        this.commonService.getSendTransactionParams(
          this.vaultWallet.address,
          O3TOKEN_CONTRACT,
          data
        ),
      ],
    };
    if (
      (await this.commonService.getPreExecutionResult(
        requestData.params,
        token
      )) !== true
    ) {
      return;
    }
    return this.vaultdMetaMaskWalletApiService
      .sendTransaction(requestData, token.chain)
      .then((hash) => {
        this.commonService.log(hash);
        this.handleTx(O3_TOKEN, unlocked, hash, TransactionType.claim);
        return hash;
      });
  }
  async getUnlockedOf(): Promise<string> {
    const token = O3_TOKEN;
    if (!this.vaultWallet) {
      return;
    }
    let params;
    const json = await this.getContractJson('o3Json');
    const o3Contract = new this.web3.eth.Contract(json, O3TOKEN_CONTRACT);
    const data = await o3Contract.methods
      .unlockedOf(this.vaultWallet.address)
      .encodeABI();
    params = [
      this.commonService.getSendTransactionParams(
        this.vaultWallet.address,
        O3TOKEN_CONTRACT,
        data
      ),
      'latest',
    ];
    return this.rpcApiService.getEthCall(params, token).then((res) => {
      if (res) {
        return res;
      }
    });
  }
  async getLockedOf(): Promise<string> {
    const token = O3_TOKEN;
    if (!this.vaultWallet) {
      return;
    }
    let params;
    const json = await this.getContractJson('o3Json');
    const o3Contract = new this.web3.eth.Contract(json, O3TOKEN_CONTRACT);
    const data = await o3Contract.methods
      .lockedOf(this.vaultWallet.address)
      .encodeABI();
    params = [
      this.commonService.getSendTransactionParams(
        this.vaultWallet.address,
        O3TOKEN_CONTRACT,
        data
      ),
      'latest',
    ];
    return this.rpcApiService.getEthCall(params, token).then((res) => {
      if (res) {
        return res;
      }
    });
  }
  async getStaked(token: Token): Promise<string> {
    if (!this.vaultWallet) {
      return;
    }
    let params;
    const json = await this.getContractJson('o3Json');
    const o3Contract = new this.web3.eth.Contract(json, O3TOKEN_CONTRACT);
    const data = await o3Contract.methods.getStaked(token.assetID).encodeABI();
    params = [
      this.commonService.getSendTransactionParams(
        this.vaultWallet.address,
        O3TOKEN_CONTRACT,
        data
      ),
      'latest',
    ];
    return this.rpcApiService
      .getEthCall(params, token)
      .then((res) => {
        if (res) {
          return res;
        }
      })
      .catch(() => {});
  }
  async getUnlockSpeed(token: Token): Promise<string> {
    if (!this.vaultWallet) {
      return;
    }
    let params;
    const json = await this.getContractJson('o3Json');
    const o3Contract = new this.web3.eth.Contract(json, O3TOKEN_CONTRACT);
    const data = await o3Contract.methods
      .getUnlockSpeed(this.vaultWallet.address, token.assetID)
      .encodeABI();
    params = [
      this.commonService.getSendTransactionParams(
        this.vaultWallet.address,
        O3TOKEN_CONTRACT,
        data
      ),
      'latest',
    ];
    return this.rpcApiService.getEthCall(params, token).then((res) => {
      if (res) {
        return new BigNumber(res).div(new BigNumber('100000000')).toFixed();
      }
    });
  }
  async claimableUnlocked(token: Token): Promise<string> {
    if (!this.vaultWallet) {
      return;
    }
    let params;
    const json = await this.getContractJson('o3Json');
    const o3Contract = new this.web3.eth.Contract(json, O3TOKEN_CONTRACT);
    const data = await o3Contract.methods
      .claimableUnlocked(token.assetID)
      .encodeABI();
    params = [
      this.commonService.getSendTransactionParams(
        this.vaultWallet.address,
        O3TOKEN_CONTRACT,
        data
      ),
      'latest',
    ];
    return this.rpcApiService.getEthCall(params, token).then((res) => {
      if (res) {
        return res;
      }
    });
  }

  async isAirdropClaimed(
    index: number,
    airdropIndex: number
  ): Promise<boolean> {
    if (!this.vaultWallet) {
      return;
    }
    let params;
    const constractHash = ETH_AIRDROP_CLAIM_CONTRACT[airdropIndex];
    const json = await this.getContractJson('airdrop');
    const o3Contract = new this.web3.eth.Contract(json, constractHash);
    const data = await o3Contract.methods.isClaimed(index).encodeABI();
    params = [
      this.commonService.getSendTransactionParams(
        this.vaultWallet.address,
        constractHash,
        data
      ),
      'latest',
    ];
    return this.rpcApiService.getEthCall(params, O3_TOKEN, true).then((res) => {
      if (new BigNumber(res).comparedTo(0) === 0) {
        return false;
      } else {
        return true;
      }
    });
  }

  async claimAirdrop(airdropIndex: number): Promise<string> {
    if (!this.vaultWallet) {
      return;
    }
    const constractHash = ETH_AIRDROP_CLAIM_CONTRACT[airdropIndex];
    const list = await this.getAirdropListJson(airdropIndex);
    const listArr = [];
    for (const key in list) {
      if (Object.prototype.hasOwnProperty.call(list, key)) {
        const element = list[key];
        listArr.push({
          account: key,
          amount: ethers.BigNumber.from(element.amount),
        });
      }
    }
    const json = await this.getContractJson('airdrop');
    const addressKey = Object.keys(list).find(
      (key) => key.toLowerCase() === this.vaultWallet.address.toLowerCase()
    );
    const o3Contract = new this.web3.eth.Contract(json, constractHash);
    const addressInfo = list[addressKey];
    const account = addressKey;
    const amount = ethers.BigNumber.from(addressInfo.amount);
    const balanceTree = new BalanceTree(listArr);
    const data = o3Contract.methods
      .claim(
        addressInfo.index,
        account,
        amount,
        balanceTree.getProof(addressInfo.index, account, amount)
      )
      .encodeABI();
    const requestData = {
      method: 'eth_sendTransaction',
      params: [
        this.commonService.getSendTransactionParams(
          account,
          constractHash,
          data
        ),
      ],
    };
    return this.vaultdMetaMaskWalletApiService
      .sendTransaction(requestData, 'ETH')
      .then((hash) => {
        this.commonService.log(hash);
        this.handleTx(
          O3_TOKEN,
          new BigNumber(addressInfo.amount).shiftedBy(-18).toFixed(),
          hash,
          TransactionType.claim
        );
        return hash;
      });
  }
  //#endregion

  //#region private function
  handleTx(
    fromToken: Token,
    inputAmount: string,
    txHash: string,
    transactionType: TransactionType,
    contract?: string,
    fromAddress?: string
  ): void {
    if (!txHash) {
      return;
    }
    const pendingTx: MyTransaction = {
      txid: this.commonService.remove0xHash(txHash),
      isPending: true,
      isFailed: false,
      fromToken,
      amount: inputAmount,
      transactionType,
      contract,
      fromAddress,
    };
    this.commonService.showTxDetail(pendingTx);
    this.store.dispatch({
      type: ADD_TX,
      data: pendingTx,
    });
    this.listenTxReceipt(pendingTx);
  }
  private listenTxReceipt(pendingTx: MyTransaction): void {
    const myInterval = interval(5000).subscribe(() => {
      this.rpcApiService
        .getEthTxReceipt(pendingTx.txid, pendingTx.fromToken.chain)
        .subscribe(
          (receipt) => {
            if (receipt) {
              myInterval.unsubscribe();
              if (new BigNumber(receipt.status, 16).isZero()) {
                pendingTx.isPending = false;
                pendingTx.isFailed = true;
              } else {
                pendingTx.isPending = false;
              }
              this.store.dispatch({ type: UPDATE_TX, data: pendingTx });
            }
          },
          (error) => {
            myInterval.unsubscribe();
            this.commonService.log(error);
          }
        );
    });
  }
  //#endregion
}
