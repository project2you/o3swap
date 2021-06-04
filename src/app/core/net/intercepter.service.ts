import { Injectable, Injector } from '@angular/core';
import {
  HttpInterceptor as NgHttpInterceptor,
  HttpEvent,
  HttpHandler,
  HttpRequest,
  HttpResponseBase,
  HttpResponse,
} from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';

import { CommonHttpResponse } from '@lib';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzMessageService } from 'ng-zorro-antd/message';

// http Error code correspondence error message
const CODE_MESSAGE = {
  0: 'Unknown error',
};

// Return error code correspondence error message
const RESPONSE_ERROR = {};
// Ignore Error
const IGNORE_ERROR = new Set([]);

@Injectable()
export class HttpInterceptor implements NgHttpInterceptor {
  constructor(
    private nzNotification: NzNotificationService,
    private injector: Injector
  ) {}

  intercept(
    request: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    return next.handle(request).pipe(
      mergeMap((event: any) => {
        // Allow unified pairs request error handling
        if (event instanceof HttpResponseBase) {
          return this.handleError(event);
        }
        // Go on
        return of(event);
      }),
      catchError((error) => {
        return this.handleError(error);
      })
    );
  }

  private get message(): NzMessageService {
    return this.injector.get(NzMessageService);
  }

  private checkStatus(ev: HttpResponseBase): any {
    if (
      (ev.status >= 200 && ev.status < 300) ||
      ev.status === 400 ||
      ev.status === 0
    ) {
      return;
    }
    const errortext = CODE_MESSAGE[ev.status] || ev.statusText;
    this.nzNotification.error(`Request error ${ev.status}: `, errortext);
  }

  private handleError(ev: HttpResponseBase): Observable<any> {
    this.checkStatus(ev);
    return of(ev);
  }
}
