import {
  Component,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { DEFAULT_DEADLINE, DEFAULT_SLIPVALUE, UPDATE_SETTING } from '@lib';
import { Observable, Unsubscribable } from 'rxjs';
import { Store } from '@ngrx/store';
interface State {
  setting: any;
  language: any;
}

@Component({
  selector: 'app-swap-setting',
  templateUrl: './swap-setting.component.html',
  styleUrls: ['./swap-setting.component.scss'],
})
export class SwapSettingComponent implements OnInit, OnDestroy {
  @Output() closeThis = new EventEmitter();

  // setting modal
  settingUnScribe: Unsubscribable;
  setting$: Observable<any>;
  slipValue: any;
  isCustomSlip: boolean;
  deadline: number;

  // setting slip
  slipValueGroup = [0.1, 0.5, 1, 2];
  slipValueError: string;

  langPageName = 'swap';
  langUnScribe: Unsubscribable;
  language$: Observable<any>;
  lang: string;

  constructor(public store: Store<State>) {
    this.language$ = store.select('language');
    this.langUnScribe = this.language$.subscribe((state) => {
      this.lang = state.language;
    });
    this.setting$ = store.select('setting');
  }

  ngOnInit(): void {
    this.checkSlipValue();
    this.settingUnScribe = this.setting$.subscribe((state) => {
      this.slipValue = state.slipValue;
      this.deadline = state.deadline;
      this.isCustomSlip = state.isCustomSlip;
    });
  }

  ngOnDestroy(): void {
    if (this.settingUnScribe) {
      this.settingUnScribe.unsubscribe();
    }
    if (this.langUnScribe) {
      this.langUnScribe.unsubscribe();
    }
  }

  selectSlipValue(value: number): void {
    this.slipValue = value;
    this.isCustomSlip = false;
    this.checkSlipValue();
    this.updateSettingData();
  }
  clickCustomSlipValue(): void {
    if (this.isCustomSlip === false) {
      this.slipValue = '';
    }
    this.isCustomSlip = true;
  }
  inputSlipValue(event): void {
    this.slipValue = event.target.value;
    this.isCustomSlip = true;
    this.checkSlipValue();
    if (this.getSlipValue() !== Number(this.slipValue)) {
      return;
    }
    this.updateSettingData();
  }
  inputDeadline(event): void {
    this.deadline = event.target.value;
    if (this.getDeadline() !== Math.floor(Number(this.deadline))) {
      return;
    }
    this.updateSettingData();
  }
  close(): void {
    this.updateSettingData();
    this.closeThis.emit();
  }
  updateDeadline(): void {
    this.deadline = this.getDeadline();
  }
  updateSlipValue(): void {
    this.slipValue = this.getSlipValue();
  }

  //#region
  updateSettingData(): any {
    const settingObj = {
      deadline: this.getDeadline(),
      slipValue: this.getSlipValue(),
      isCustomSlip: this.isCustomSlip,
    };
    this.store.dispatch({ type: UPDATE_SETTING, data: settingObj });
  }
  checkSlipValue(): void {
    const tempSlip = Number(this.slipValue);
    if (Number.isNaN(tempSlip) || tempSlip <= 0) {
      return;
    }
    if (this.slipValue < 0.5) {
      this.slipValueError = 'Your transaction may fail';
    } else if (this.slipValue > 5) {
      this.slipValueError = 'Your transaction may be frontrun';
    } else if (this.slipValue >= 100) {
      this.slipValueError = 'Enter a valid slippage percentage';
    } else {
      this.slipValueError = '';
    }
  }
  getDeadline(): any {
    let tempDeadline = Math.floor(Number(this.deadline));
    if (Number.isNaN(tempDeadline) || tempDeadline <= 0) {
      tempDeadline = DEFAULT_DEADLINE;
    }
    return tempDeadline;
  }
  getSlipValue(): any {
    let tempSlip = Number(this.slipValue);
    if (Number.isNaN(tempSlip) || tempSlip <= 0 || tempSlip >= 100) {
      // this.isCustomSlip = false;
      tempSlip = DEFAULT_SLIPVALUE;
    }
    return tempSlip;
  }
  //#endregion
}
