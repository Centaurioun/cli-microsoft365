import * as assert from 'assert';
import * as sinon from 'sinon';
import { telemetry } from '../../../../telemetry';
import auth from '../../../../Auth';
import { Logger } from '../../../../cli/Logger';
import Command, { CommandError } from '../../../../Command';
import config from '../../../../config';
import request from '../../../../request';
import { pid } from '../../../../utils/pid';
import { session } from '../../../../utils/session';
import { sinonUtil } from '../../../../utils/sinonUtil';
import { spo } from '../../../../utils/spo';
import commands from '../../commands';
const command: Command = require('./knowledgehub-get');

describe(commands.KNOWLEDGEHUB_GET, () => {
  let log: string[];
  let logger: Logger;
  let requests: any[];

  before(() => {
    sinon.stub(auth, 'restoreAuth').resolves();
    sinon.stub(telemetry, 'trackEvent').returns();
    sinon.stub(pid, 'getProcessName').returns('');
    sinon.stub(session, 'getId').returns('');
    sinon.stub(spo, 'getRequestDigest').resolves({
      FormDigestValue: 'ABC',
      FormDigestTimeoutSeconds: 1800,
      FormDigestExpiresAt: new Date(),
      WebFullUrl: 'https://contoso.sharepoint.com'
    });
    auth.service.connected = true;
    auth.service.spoUrl = 'https://contoso.sharepoint.com';
  });

  beforeEach(() => {
    log = [];
    logger = {
      log: (msg: string) => {
        log.push(msg);
      },
      logRaw: (msg: string) => {
        log.push(msg);
      },
      logToStderr: (msg: string) => {
        log.push(msg);
      }
    };
    requests = [];
  });

  afterEach(() => {
    sinonUtil.restore([
      request.post
    ]);
  });

  after(() => {
    sinon.restore();
    auth.service.connected = false;
    auth.service.spoUrl = undefined;
  });

  it('has correct name', () => {
    assert.strictEqual(command.name, commands.KNOWLEDGEHUB_GET);
  });

  it('has a description', () => {
    assert.notStrictEqual(command.description, null);
  });

  it('Get the Knowledgehub Site', async () => {

    sinon.stub(request, 'post').callsFake(async (opts) => {
      requests.push(opts);

      if ((opts.url as string).indexOf('/_vti_bin/client.svc/ProcessQuery') > -1) {
        if (
          opts.headers?.['X-RequestDigest'] &&
          opts.data) {
          if (opts.data === `<Request xmlns="http://schemas.microsoft.com/sharepoint/clientquery/2009" AddExpandoFieldTypeSuffix="true" SchemaVersion="15.0.0.0" LibraryVersion="16.0.0.0" ApplicationName="${config.applicationName}"><Actions><ObjectPath Id="5" ObjectPathId="4"/><Method Name="GetKnowledgeHubSite" Id="6" ObjectPathId="4"/></Actions><ObjectPaths><Constructor Id="4" TypeId="{268004ae-ef6b-4e9b-8425-127220d84719}"/></ObjectPaths></Request>`) {
            return JSON.stringify([{ "SchemaVersion": "15.0.0.0", "LibraryVersion": "16.0.20516.12005", "ErrorInfo": null, "TraceCorrelationId": "1f527f9f-00b0-0000-5545-a8da6b2fb12e" }, 5, { "IsNull": false }, 6, "https:\/\/contoso.sharepoint.com\/sites\/knowledgesite"]);
          }
        }
      }

      throw 'Invalid request';
    });

    await command.action(logger, { options: {} });
    let setRequestIssued = false;
    requests.forEach(r => {
      if (r.url.indexOf('/_vti_bin/client.svc/ProcessQuery') > -1 &&
        r.headers['X-RequestDigest'] &&
        r.data === `<Request xmlns="http://schemas.microsoft.com/sharepoint/clientquery/2009" AddExpandoFieldTypeSuffix="true" SchemaVersion="15.0.0.0" LibraryVersion="16.0.0.0" ApplicationName="${config.applicationName}"><Actions><ObjectPath Id="5" ObjectPathId="4"/><Method Name="GetKnowledgeHubSite" Id="6" ObjectPathId="4"/></Actions><ObjectPaths><Constructor Id="4" TypeId="{268004ae-ef6b-4e9b-8425-127220d84719}"/></ObjectPaths></Request>`) {
        setRequestIssued = true;
      }
    });

    assert(setRequestIssued);
  });

  it('Get the Knowledgehub Site (debug)', async () => {
    sinon.stub(request, 'post').callsFake(async (opts) => {
      requests.push(opts);

      if ((opts.url as string).indexOf('/_vti_bin/client.svc/ProcessQuery') > -1) {
        if (
          opts.headers?.['X-RequestDigest'] &&
          opts.data) {
          if (opts.data === `<Request xmlns="http://schemas.microsoft.com/sharepoint/clientquery/2009" AddExpandoFieldTypeSuffix="true" SchemaVersion="15.0.0.0" LibraryVersion="16.0.0.0" ApplicationName="${config.applicationName}"><Actions><ObjectPath Id="5" ObjectPathId="4"/><Method Name="GetKnowledgeHubSite" Id="6" ObjectPathId="4"/></Actions><ObjectPaths><Constructor Id="4" TypeId="{268004ae-ef6b-4e9b-8425-127220d84719}"/></ObjectPaths></Request>`) {
            return JSON.stringify([{ "SchemaVersion": "15.0.0.0", "LibraryVersion": "16.0.20516.12005", "ErrorInfo": null, "TraceCorrelationId": "1f527f9f-00b0-0000-5545-a8da6b2fb12e" }, 5, { "IsNull": false }, 6, "https:\/\/contoso.sharepoint.com\/sites\/knowledgesite"]);
          }
        }
      }

      throw 'Invalid request';
    });
    await command.action(logger, { options: { debug: true } });
    let setRequestIssued = false;
    requests.forEach(r => {
      if (r.url.indexOf('/_vti_bin/client.svc/ProcessQuery') > -1 &&
        r.headers['X-RequestDigest'] &&
        r.data === `<Request xmlns="http://schemas.microsoft.com/sharepoint/clientquery/2009" AddExpandoFieldTypeSuffix="true" SchemaVersion="15.0.0.0" LibraryVersion="16.0.0.0" ApplicationName="${config.applicationName}"><Actions><ObjectPath Id="5" ObjectPathId="4"/><Method Name="GetKnowledgeHubSite" Id="6" ObjectPathId="4"/></Actions><ObjectPaths><Constructor Id="4" TypeId="{268004ae-ef6b-4e9b-8425-127220d84719}"/></ObjectPaths></Request>`) {
        setRequestIssued = true;
      }
    });

    assert(setRequestIssued);
  });

  it('Get the Knowledgehub Site - Empty / NO URL Available', async () => {

    sinon.stub(request, 'post').callsFake(async (opts) => {
      requests.push(opts);

      if ((opts.url as string).indexOf('/_vti_bin/client.svc/ProcessQuery') > -1) {
        if (
          opts.headers?.['X-RequestDigest'] &&
          opts.data) {
          if (opts.data === `<Request xmlns="http://schemas.microsoft.com/sharepoint/clientquery/2009" AddExpandoFieldTypeSuffix="true" SchemaVersion="15.0.0.0" LibraryVersion="16.0.0.0" ApplicationName="${config.applicationName}"><Actions><ObjectPath Id="5" ObjectPathId="4"/><Method Name="GetKnowledgeHubSite" Id="6" ObjectPathId="4"/></Actions><ObjectPaths><Constructor Id="4" TypeId="{268004ae-ef6b-4e9b-8425-127220d84719}"/></ObjectPaths></Request>`) {
            return JSON.stringify([{ "SchemaVersion": "15.0.0.0", "LibraryVersion": "16.0.20516.12005", "ErrorInfo": null, "TraceCorrelationId": "1f527f9f-00b0-0000-5545-a8da6b2fb12e" }, 5, { "IsNull": false }, 6, null]);
          }
        }
      }

      throw 'Invalid request';
    });

    await command.action(logger, { options: {} });
    let setRequestIssued = false;
    requests.forEach(r => {
      if (r.url.indexOf('/_vti_bin/client.svc/ProcessQuery') > -1 &&
        r.headers['X-RequestDigest'] &&
        r.data === `<Request xmlns="http://schemas.microsoft.com/sharepoint/clientquery/2009" AddExpandoFieldTypeSuffix="true" SchemaVersion="15.0.0.0" LibraryVersion="16.0.0.0" ApplicationName="${config.applicationName}"><Actions><ObjectPath Id="5" ObjectPathId="4"/><Method Name="GetKnowledgeHubSite" Id="6" ObjectPathId="4"/></Actions><ObjectPaths><Constructor Id="4" TypeId="{268004ae-ef6b-4e9b-8425-127220d84719}"/></ObjectPaths></Request>`) {
        setRequestIssued = true;
      }
    });

    assert(setRequestIssued);
  });

  it('correctly handles an error when getting Knowledgehub Site', async () => {
    sinonUtil.restore(request.post);
    sinon.stub(request, 'post').callsFake(async (opts) => {
      if ((opts.url as string).indexOf('/_api/contextinfo') > -1) {
        if (
          opts.headers?.accept &&
          (opts.headers.accept as string).indexOf('application/json') === 0) {
          return { FormDigestValue: 'abc' };
        }
      }

      if ((opts.url as string).indexOf('/_vti_bin/client.svc/ProcessQuery') > -1) {
        if (
          opts.headers?.['X-RequestDigest'] &&
          opts.data) {
          if (opts.data === `<Request xmlns="http://schemas.microsoft.com/sharepoint/clientquery/2009" AddExpandoFieldTypeSuffix="true" SchemaVersion="15.0.0.0" LibraryVersion="16.0.0.0" ApplicationName="${config.applicationName}"><Actions><ObjectPath Id="5" ObjectPathId="4"/><Method Name="GetKnowledgeHubSite" Id="6" ObjectPathId="4"/></Actions><ObjectPaths><Constructor Id="4" TypeId="{268004ae-ef6b-4e9b-8425-127220d84719}"/></ObjectPaths></Request>`) {
            return JSON.stringify([
              {
                "SchemaVersion": "15.0.0.0", "LibraryVersion": "16.0.7018.1204", "ErrorInfo": {
                  "ErrorMessage": "An error has occurred", "ErrorValue": null, "TraceCorrelationId": "965d299e-a0c6-4000-8546-cc244881a129", "ErrorCode": -1, "ErrorTypeName": "Microsoft.SharePoint.PublicCdn.TenantCdnAdministrationException"
                }, "TraceCorrelationId": "965d299e-a0c6-4000-8546-cc244881a129"
              }
            ]);
          }
        }
      }

      throw 'Invalid request';
    });

    await assert.rejects(command.action(logger, { options: {} }),
      new CommandError('An error has occurred'));
  });
});
