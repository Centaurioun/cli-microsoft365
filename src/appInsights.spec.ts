import assert from 'assert';
import fs from 'fs';
import sinon from 'sinon';
import { pid } from './utils/pid.js';
import { session } from './utils/session.js';
import { sinonUtil } from './utils/sinonUtil.js';

const env = Object.assign({}, process.env);

describe('appInsights', () => {
  afterEach(() => {
    sinonUtil.restore([
      fs.existsSync,
      pid.getProcessName,
      session.getId
    ]);
    process.env = env;
  });

  it('adds -dev label to version logged in the telemetry when CLI ran locally', async () => {
    sinon.stub(fs, 'existsSync').callsFake(() => true);
    const i: any = await import(`./appInsights.js#${Math.random()}`);
    assert(i.default.commonProperties.version.indexOf('-dev') > -1);
  });

  it('doesn\'t add -dev label to version logged in the telemetry when CLI installed from npm', async () => {
    const originalExistsSync = fs.existsSync;
    sinon.stub(fs, 'existsSync').callsFake(path => {
      if (path.toString().endsWith('src')) {
        return false;
      }
      else {
        return originalExistsSync(path);
      }
    });
    const i: any = await import(`./appInsights.js#${Math.random()}`);
    assert(i.default.commonProperties.version.indexOf('-dev') === -1);
  });

  it('sets env logged in the telemetry to \'docker\' when CLI run in CLI docker image', async () => {
    sinon.stub(fs, 'existsSync').callsFake(() => false);
    process.env.CLIMICROSOFT365_ENV = 'docker';
    const i: any = await import(`./appInsights.js#${Math.random()}`);
    assert(i.default.commonProperties.env === 'docker');
  });

  it(`sets shell to empty string if couldn't resolve name from pid`, async () => {
    sinon.stub(pid, 'getProcessName').callsFake(() => undefined);
    const i: any = await import(`./appInsights.js#${Math.random()}`);
    assert.strictEqual(i.default.commonProperties.shell, '');
  });
});