import Axios, { AxiosError, AxiosInstance, AxiosPromise, AxiosRequestConfig, AxiosResponse } from 'axios';
import { Stream } from 'stream';
import auth, { Auth, CloudType } from './Auth.js';
import { Logger } from './cli/Logger.js';
import { app } from './utils/app.js';
import { formatting } from './utils/formatting.js';

export interface CliRequestOptions extends AxiosRequestConfig {
  fullResponse?: boolean;
}

class Request {
  private req: AxiosInstance;
  private _logger?: Logger;
  private _debug: boolean = false;

  public set debug(debug: boolean) {
    // if the value to set is the same as current value return early to avoid
    // instantiating interceptors multiple times. This can happen when calling
    // one command from another
    if (this._debug === debug) {
      return;
    }

    this._debug = debug;

    if (this._debug) {
      this.req.interceptors.request.use(config => {
        if (this._logger) {
          this._logger.logToStderr('Request:');
          const properties: string[] = ['url', 'method', 'headers', 'responseType', 'decompress'];
          if (config.responseType !== 'stream') {
            properties.push('data');
          }
          this._logger.logToStderr(JSON.stringify(formatting.filterObject(config, properties), null, 2));
        }
        return config;
      });
      // since we're stubbing requests, response interceptor is never called in
      // tests, so let's exclude it from coverage
      /* c8 ignore next 26 */
      this.req.interceptors.response.use((response: AxiosResponse): AxiosResponse => {
        if (this._logger) {
          this._logger.logToStderr('Response:');
          const properties: string[] = ['status', 'statusText', 'headers'];
          if (response.headers['content-type'] &&
            response.headers['content-type'].indexOf('json') > -1) {
            properties.push('data');
          }
          this._logger.logToStderr(JSON.stringify({
            url: response.config.url,
            ...formatting.filterObject(response, properties)
          }, null, 2));
        }
        return response;
      }, (error: AxiosError): void => {
        if (this._logger) {
          const properties: string[] = ['status', 'statusText', 'headers'];
          this._logger.logToStderr('Request error:');
          this._logger.logToStderr(JSON.stringify({
            url: error.config?.url,
            ...formatting.filterObject(error.response, properties),
            error: (error as any).error
          }, null, 2));
        }
        throw error;
      });
    }
  }

  public get logger(): Logger | undefined {
    return this._logger;
  }

  public set logger(logger: Logger | undefined) {
    this._logger = logger;
  }

  constructor() {
    this.req = Axios.create({
      headers: {
        'user-agent': `NONISV|SharePointPnP|CLIMicrosoft365/${app.packageJson().version}`,
        'accept-encoding': 'gzip, deflate',
        'X-ClientService-ClientTag': `M365CLI:${app.packageJson().version}`
      },
      decompress: true,
      responseType: 'text',
      /* c8 ignore next */
      transformResponse: [data => data],
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });
    // since we're stubbing requests, request interceptor is never called in
    // tests, so let's exclude it from coverage
    /* c8 ignore next 7 */
    this.req.interceptors.request.use(config => {
      if (config.responseType === 'json') {
        config.transformResponse = Axios.defaults.transformResponse;
      }

      return config;
    });
    // since we're stubbing requests, response interceptor is never called in
    // tests, so let's exclude it from coverage
    /* c8 ignore next 15 */
    this.req.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error: AxiosError<any>): void => {
        if (error &&
          error.response &&
          error.response.data &&
          !(error.response.data instanceof Stream)) {
          // move error details from response.data to error property to make
          // it compatible with our code
          (error as any).error = JSON.parse(JSON.stringify(error.response.data));
        }

        throw error;
      }
    );
  }

  public post<TResponse>(options: CliRequestOptions): Promise<TResponse> {
    options.method = 'POST';
    return this.execute(options);
  }

  public get<TResponse>(options: CliRequestOptions): Promise<TResponse> {
    options.method = 'GET';
    return this.execute(options);
  }

  public patch<TResponse>(options: CliRequestOptions): Promise<TResponse> {
    options.method = 'PATCH';
    return this.execute(options);
  }

  public put<TResponse>(options: CliRequestOptions): Promise<TResponse> {
    options.method = 'PUT';
    return this.execute(options);
  }

  public delete<TResponse>(options: CliRequestOptions): Promise<TResponse> {
    options.method = 'DELETE';
    return this.execute(options);
  }

  public head<TResponse>(options: CliRequestOptions): Promise<TResponse> {
    options.method = 'HEAD';
    return this.execute(options);
  }

  public execute<TResponse>(options: CliRequestOptions, resolve?: (res: TResponse) => void, reject?: (error: any) => void): Promise<TResponse> {
    if (!this._logger) {
      return Promise.reject('Logger not set on the request object');
    }

    this.updateRequestForCloudType(options, auth.service.cloudType);

    return new Promise<TResponse>((_resolve: (res: TResponse) => void, _reject: (error: any) => void): void => {
      ((): Promise<string> => {
        if (options.headers && options.headers['x-anonymous']) {
          return Promise.resolve('');
        }
        else {
          const url = options.headers && options.headers['x-resource'] ? options.headers['x-resource'] : options.url;
          const resource: string = Auth.getResourceFromUrl(url as string);
          return auth.ensureAccessToken(resource, this._logger as Logger, this._debug);
        }
      })()
        .then((accessToken: string): AxiosPromise<TResponse> => {
          if (options.headers) {
            if (options.headers['x-anonymous']) {
              delete options.headers['x-anonymous'];
            }
            if (options.headers['x-resource']) {
              delete options.headers['x-resource'];
            }
            if (accessToken !== '') {
              options.headers.authorization = `Bearer ${accessToken}`;
            }
          }
          return this.req(options);
        })
        .then((res: any): void => {
          if (resolve) {
            resolve((options.responseType === 'stream' || options.fullResponse) ? res : res.data);
          }
          else {
            _resolve((options.responseType === 'stream' || options.fullResponse) ? res : res.data);
          }
        }, (error: AxiosError): void => {
          if (error && error.response &&
            (error.response.status === 429 ||
              error.response.status === 503)) {
            let retryAfter: number = parseInt(error.response.headers['retry-after'] || '10');
            if (isNaN(retryAfter)) {
              retryAfter = 10;
            }
            if (this._debug) {
              (this._logger as Logger).log(`Request throttled. Waiting ${retryAfter}sec before retrying...`);
            }
            setTimeout(() => {
              this.execute(options, resolve || _resolve, reject || _reject);
            }, retryAfter * 1000);
          }
          else {
            if (reject) {
              reject(error);
            }
            else {
              _reject(error);
            }
          }
        });
    });
  }

  private updateRequestForCloudType(options: AxiosRequestConfig, cloudType: CloudType): void {
    const url = new URL(options.url!);
    const hostname = `${url.protocol}//${url.hostname}`;
    const cloudUrl: string = Auth.getEndpointForResource(hostname, cloudType);
    options.url = options.url!.replace(hostname, cloudUrl);
  }
}

export default new Request();
