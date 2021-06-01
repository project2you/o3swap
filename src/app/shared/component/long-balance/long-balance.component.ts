import {
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
} from '@angular/core';
import { BigNumber } from 'bignumber.js';

@Component({
  selector: 'app-long-balance',
  templateUrl: './long-balance.component.html',
  styleUrls: ['./long-balance.component.scss'],
})
export class LongBalanceComponent implements OnInit, OnChanges {
  @Input() defaultValue = '0';
  @Input() length = 12;
  @Input() balance: string;
  @Input() decimals = -1;
  @Input() countInMillions = false;

  displayBalance: string;
  showTooltip = false;

  constructor() {}
  ngOnChanges(changes: SimpleChanges): void {
    this.handleBalance();
  }

  ngOnInit(): void {}

  handleBalance(): void {
    this.showTooltip = false;
    if (!this.balance || new BigNumber(this.balance).isNaN()) {
      return;
    }
    const stringValue = this.balance.toString();
    const dataGroup = stringValue.split('.');
    if (this.countInMillions) {
      if (dataGroup[0].length > 9) {
        const millonNumber =
          dataGroup[0].slice(0, -9) + '.' + dataGroup[0].slice(-9);
        this.showTooltip = true;
        this.displayBalance = new BigNumber(millonNumber).dp(2).toFixed() + 'B';
        return;
      }
      if (dataGroup[0].length > 6) {
        const millonNumber =
          dataGroup[0].slice(0, -6) + '.' + dataGroup[0].slice(-6);
        this.showTooltip = true;
        this.displayBalance = new BigNumber(millonNumber).dp(2).toFixed() + 'M';
        return;
      }
      // if (dataGroup[0].length > 3) {
      //   const millonNumber = dataGroup[0].slice(0, -3) + '.' + dataGroup[0].slice(-3);
      //   this.showTooltip = true;
      //   this.displayBalance = new BigNumber(millonNumber).dp(2).toFixed() + 'K';
      //   return;
      // }
    }
    if (dataGroup[0].length >= this.length) {
      this.displayBalance = dataGroup[0];
      this.showTooltip = true;
    } else if (stringValue.length > this.length) {
      this.displayBalance = stringValue.substring(0, this.length);
      this.showTooltip = true;
      if (new BigNumber(this.displayBalance).dp(8).toFixed() === '0') {
        this.displayBalance = '0.00000000...';
      }
    }
    if (this.showTooltip) {
      if (this.decimals !== -1) {
        this.displayBalance = new BigNumber(this.displayBalance)
          .dp(this.decimals)
          .toFixed();
      }
    } else {
      if (this.decimals !== -1) {
        const tempBalance = new BigNumber(this.balance)
          .dp(this.decimals)
          .toFixed();
        if (this.balance !== tempBalance) {
          this.showTooltip = true;
          this.displayBalance = tempBalance;
        }
      }
    }
  }
}
