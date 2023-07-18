import { v4 } from 'uuid';
import { Logger } from '../../../../cli/Logger';
import GlobalOptions from '../../../../GlobalOptions';
import request, { CliRequestOptions } from '../../../../request';
import { formatting } from '../../../../utils/formatting';
import GraphCommand from '../../../base/GraphCommand';
import commands from '../../commands';

interface CommandArgs {
  options: Options;
}

interface AppInfo {
  appRoles: {
    allowedMemberTypes: ('User' | 'Application')[];
    description: string;
    displayName: string;
    id: string;
    value: string;
  }[];
  id: string;
}

interface Options extends GlobalOptions {
  allowedMembers: string;
  appId?: string;
  appObjectId?: string;
  appName?: string;
  claim: string;
  name: string;
  description: string;
}

class AadAppRoleAddCommand extends GraphCommand {
  private static readonly allowedMembers: string[] = ['usersGroups', 'applications', 'both'];

  public get name(): string {
    return commands.APP_ROLE_ADD;
  }

  public get description(): string {
    return 'Adds role to the specified Azure AD app registration';
  }

  constructor() {
    super();

    this.#initTelemetry();
    this.#initOptions();
    this.#initValidators();
    this.#initOptionSets();
  }

  #initTelemetry(): void {
    this.telemetry.push((args: CommandArgs) => {
      Object.assign(this.telemetryProperties, {
        appId: typeof args.options.appId !== 'undefined',
        appObjectId: typeof args.options.appObjectId !== 'undefined',
        appName: typeof args.options.appName !== 'undefined'
      });
    });
  }

  #initOptions(): void {
    this.options.unshift(
      { option: '--appId [appId]' },
      { option: '--appObjectId [appObjectId]' },
      { option: '--appName [appName]' },
      { option: '-n, --name <name>' },
      { option: '-d, --description <description>' },
      {
        option: '-m, --allowedMembers <allowedMembers>', autocomplete: AadAppRoleAddCommand.allowedMembers
      },
      { option: '-c, --claim <claim>' }
    );
  }

  #initValidators(): void {
    this.validators.push(
      async (args: CommandArgs) => {
        const { allowedMembers, claim } = args.options;

        if (AadAppRoleAddCommand.allowedMembers.indexOf(allowedMembers) < 0) {
          return `${allowedMembers} is not a valid value for allowedMembers. Valid values are ${AadAppRoleAddCommand.allowedMembers.join(', ')}`;
        }

        if (claim.length > 120) {
          return `Claim must not be longer than 120 characters`;
        }

        if (claim.startsWith('.')) {
          return 'Claim must not begin with .';
        }

        if (!/^[\w:!#$%&'()*+,-.\/:;<=>?@\[\]^+_`{|}~]+$/.test(claim)) {
          return `Claim can contain only the following characters a-z, A-Z, 0-9, :!#$%&'()*+,-./:;<=>?@[]^+_\`{|}~]+`;
        }

        return true;
      }
    );
  }

  #initOptionSets(): void {
    this.optionSets.push({ options: ['appId', 'appObjectId', 'appName'] });
  }

  public async commandAction(logger: Logger, args: CommandArgs): Promise<void> {
    try {
      const appId = await this.getAppObjectId(args, logger);
      const appInfo = await this.getAppInfo(appId, logger);

      if (this.verbose) {
        logger.logToStderr(`Adding role ${args.options.name} to Azure AD app ${appInfo.id}...`);
      }

      const requestOptions: CliRequestOptions = {
        url: `${this.resource}/v1.0/myorganization/applications/${appInfo.id}`,
        headers: {
          accept: 'application/json;odata.metadata=none'
        },
        responseType: 'json',
        data: {
          appRoles: appInfo.appRoles.concat({
            displayName: args.options.name,
            description: args.options.description,
            id: v4(),
            value: args.options.claim,
            allowedMemberTypes: this.getAllowedMemberTypes(args)
          })
        }
      };

      await request.patch(requestOptions);
    }
    catch (err: any) {
      this.handleRejectedODataJsonPromise(err);
    }
  }

  private async getAppInfo(appId: string, logger: Logger): Promise<AppInfo> {
    if (this.verbose) {
      logger.logToStderr(`Retrieving information about roles for Azure AD app ${appId}...`);
    }

    const requestOptions: CliRequestOptions = {
      url: `${this.resource}/v1.0/myorganization/applications/${appId}?$select=id,appRoles`,
      headers: {
        accept: 'application/json;odata.metadata=none'
      },
      responseType: 'json'
    };

    return request.get(requestOptions);
  }

  private getAllowedMemberTypes(args: CommandArgs): ('User' | 'Application')[] {
    switch (args.options.allowedMembers) {
      case 'usersGroups':
        return ['User'];
      case 'applications':
        return ['Application'];
      case 'both':
        return ['User', 'Application'];
      default:
        return [];
    }
  }

  private async getAppObjectId(args: CommandArgs, logger: Logger): Promise<string> {
    if (args.options.appObjectId) {
      return args.options.appObjectId;
    }

    const { appId, appName } = args.options;

    if (this.verbose) {
      logger.logToStderr(`Retrieving information about Azure AD app ${appId ? appId : appName}...`);
    }

    const filter: string = appId ?
      `appId eq '${formatting.encodeQueryParameter(appId)}'` :
      `displayName eq '${formatting.encodeQueryParameter(appName as string)}'`;

    const requestOptions: CliRequestOptions = {
      url: `${this.resource}/v1.0/myorganization/applications?$filter=${filter}&$select=id`,
      headers: {
        accept: 'application/json;odata.metadata=none'
      },
      responseType: 'json'
    };

    const res = await request.get<{ value: { id: string }[] }>(requestOptions);

    if (res.value.length === 1) {
      return res.value[0].id;
    }

    if (res.value.length === 0) {
      const applicationIdentifier = appId ? `ID ${appId}` : `name ${appName}`;
      throw `No Azure AD application registration with ${applicationIdentifier} found`;
    }

    throw `Multiple Azure AD application registration with name ${appName} found. Please disambiguate (app object IDs): ${res.value.map(a => a.id).join(', ')}`;

  }
}

module.exports = new AadAppRoleAddCommand();