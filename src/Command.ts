import os from 'os';
import auth from './Auth.js';
import GlobalOptions from './GlobalOptions.js';
import { Cli } from './cli/Cli.js';
import { CommandInfo } from './cli/CommandInfo.js';
import { CommandOptionInfo } from './cli/CommandOptionInfo.js';
import { Logger } from './cli/Logger.js';
import request from './request.js';
import { settingsNames } from './settingsNames.js';
import { telemetry } from './telemetry.js';
import { accessToken } from './utils/accessToken.js';
import { md } from './utils/md.js';
import { GraphResponseError } from './utils/odata.js';

interface CommandOption {
  option: string;
  autocomplete?: string[]
}

export interface CommandTypes {
  string: string[];
  boolean: string[];
}

export class CommandError {
  constructor(public message: string, public code?: number) {
  }
}

export class CommandErrorWithOutput {
  constructor(public error: CommandError, public stderr?: string) {
  }
}

interface ODataError {
  "odata.error": {
    code: string;
    message: {
      lang: string;
      value: string;
    }
  }
}

export interface CommandArgs {
  options: GlobalOptions;
}

interface OptionSet {
  options: string[];
  runsWhen?: (args: any) => boolean;
}

export default abstract class Command {
  protected debug: boolean = false;
  protected verbose: boolean = false;

  public telemetry: ((args: any) => void)[] = [];
  protected telemetryProperties: any = {};

  protected get allowedOutputs(): string[] {
    return ['csv', 'json', 'md', 'text', 'none'];
  }

  public options: CommandOption[] = [];
  public optionSets: OptionSet[] = [];
  public types: CommandTypes = {
    boolean: [],
    string: []
  };

  protected validators: ((args: any, command: CommandInfo) => Promise<boolean | string>)[] = [];

  public abstract get name(): string;
  public abstract get description(): string;

  constructor() {
    // These functions must be defined with # so that they're truly private
    // otherwise you'll get a ts2415 error (Types have separate declarations of
    // a private property 'x'.).
    // `private` in TS is a design-time flag and private members end-up being
    // regular class properties that would collide on runtime, which is why we
    // need the extra `#`

    this.#initTelemetry();
    this.#initOptions();
    this.#initValidators();
  }

  #initTelemetry(): void {
    this.telemetry.push((args: CommandArgs) => {
      Object.assign(this.telemetryProperties, {
        debug: this.debug.toString(),
        verbose: this.verbose.toString(),
        output: args.options.output,
        query: typeof args.options.query !== 'undefined'
      });
    });
  }

  #initOptions(): void {
    this.options.unshift(
      { option: '--query [query]' },
      {
        option: '-o, --output [output]',
        autocomplete: this.allowedOutputs
      },
      { option: '--verbose' },
      { option: '--debug' }
    );
  }

  #initValidators(): void {
    this.validators.push(
      (args, command) => this.validateUnknownOptions(args, command),
      (args, command) => this.validateRequiredOptions(args, command),
      args => this.validateOutput(args),
      (args, command) => this.validateOptionSets(args, command)
    );
  }

  private async validateUnknownOptions(args: CommandArgs, command: CommandInfo): Promise<string | boolean> {
    if (this.allowUnknownOptions()) {
      return true;
    }

    // if the command doesn't allow unknown options, check if all specified
    // options match command options
    for (const optionFromArgs in args.options) {
      let matches: boolean = false;

      for (let i = 0; i < command.options.length; i++) {
        const option: CommandOptionInfo = command.options[i];
        if (optionFromArgs === option.long ||
          optionFromArgs === option.short) {
          matches = true;
          break;
        }
      }

      if (!matches) {
        return `Invalid option: '${optionFromArgs}'${os.EOL}`;
      }
    }

    return true;
  }

  private async validateRequiredOptions(args: CommandArgs, command: CommandInfo): Promise<string | boolean> {
    const shouldPrompt = Cli.getInstance().getSettingWithDefaultValue<boolean>(settingsNames.prompt, true);

    let inquirer: typeof import('inquirer') | undefined;
    let prompted: boolean = false;
    for (let i = 0; i < command.options.length; i++) {
      if (!command.options[i].required ||
        typeof args.options[command.options[i].name] !== 'undefined') {
        continue;
      }

      if (!shouldPrompt) {
        return `Required option ${command.options[i].name} not specified`;
      }

      if (!prompted) {
        prompted = true;
        Cli.log('Provide values for the following parameters:');
      }

      if (!inquirer) {
        inquirer = await import('inquirer');
      }

      const missingRequireOptionValue = await inquirer.default
        .prompt({
          name: 'missingRequireOptionValue',
          message: `${command.options[i].name}: `
        })
        .then(result => result.missingRequireOptionValue);

      args.options[command.options[i].name] = missingRequireOptionValue;
    }

    this.processOptions(args.options);

    return true;
  }

  private async validateOptionSets(args: CommandArgs, command: CommandInfo): Promise<string | boolean> {
    const optionsSets: OptionSet[] | undefined = command.command.optionSets;
    if (!optionsSets || optionsSets.length === 0) {
      return true;
    }

    let inquirer: typeof import('inquirer') | undefined;
    const shouldPrompt = Cli.getInstance().getSettingWithDefaultValue<boolean>(settingsNames.prompt, true);

    const argsOptions: string[] = Object.keys(args.options);

    for (const optionSet of optionsSets.sort(opt => opt.runsWhen ? 0 : 1)) {
      if (optionSet.runsWhen && !optionSet.runsWhen!(args)) {
        continue;
      }

      const commonOptions = argsOptions.filter(opt => optionSet.options.includes(opt));
      if (commonOptions.length === 0) {
        if (!shouldPrompt) {
          return `Specify one of the following options: ${optionSet.options.join(', ')}.`;
        }

        await this.promptForOptionSetNameAndValue(args, optionSet, inquirer);
      }

      if (commonOptions.length > 1) {
        if (!shouldPrompt) {
          return `Specify one of the following options: ${optionSet.options.join(', ')}, but not multiple.`;
        }

        await this.promptForSpecificOption(args, commonOptions, inquirer);
      }
    }

    return true;
  }

  private async promptForOptionSetNameAndValue(args: CommandArgs, optionSet: OptionSet, inquirer?: typeof import('inquirer')): Promise<void> {
    if (!inquirer) {
      inquirer = await import('inquirer');
    }

    Cli.log(`Please specify one of the following options:`);
    const resultOptionName = await inquirer.default.prompt<{ missingRequiredOptionName: string }>({
      type: 'list',
      name: 'missingRequiredOptionName',
      message: `Option to use:`,
      choices: optionSet.options
    });
    const missingRequiredOptionName = resultOptionName.missingRequiredOptionName;

    const resultOptionValue = await inquirer.default
      .prompt({
        name: 'missingRequiredOptionValue',
        message: `${missingRequiredOptionName}:`
      });

    args.options[missingRequiredOptionName] = resultOptionValue.missingRequiredOptionValue;
    Cli.log();
  }

  private async promptForSpecificOption(args: CommandArgs, commonOptions: string[], inquirer?: typeof import('inquirer')): Promise<void> {
    if (!inquirer) {
      inquirer = await import('inquirer');
    }

    Cli.log(`Multiple options for an option set specified. Please specify the correct option that you wish to use.`);

    const requiredOptionNameResult = await inquirer.default.prompt<{ missingRequiredOptionName: string }>({
      type: 'list',
      name: 'missingRequiredOptionName',
      message: `Option to use:`,
      choices: commonOptions
    });

    commonOptions.filter(y => y !== requiredOptionNameResult.missingRequiredOptionName).map(optionName => args.options[optionName] = undefined);
    Cli.log();
  }

  private async validateOutput(args: CommandArgs): Promise<string | boolean> {
    if (args.options.output &&
      this.allowedOutputs.indexOf(args.options.output) < 0) {
      return `'${args.options.output}' is not a valid output type. Allowed output types are ${this.allowedOutputs.join(', ')}`;
    }
    else {
      return true;
    }
  }

  public alias(): string[] | undefined {
    return;
  }

  /**
   * Returns list of properties that should be returned in the text output.
   * Returns all properties if no default properties specified
   */
  public defaultProperties(): string[] | undefined {
    return;
  }

  public allowUnknownOptions(): boolean | undefined {
    return;
  }

  /**
   * Processes options after resolving them from the user input and before
   * passing them on to command action for execution. Used for example for
   * expanding server-relative URLs to absolute in spo commands
   * @param options Object that contains command's options
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function
  public async processOptions(options: any): Promise<void> {
  }

  public abstract commandAction(logger: Logger, args: any): Promise<void>;

  public async action(logger: Logger, args: CommandArgs): Promise<void> {
    try {
      await auth.restoreAuth();
    }
    catch (error: any) {
      throw new CommandError(error);
    }

    this.initAction(args, logger);

    if (!auth.service.connected) {
      throw new CommandError('Log in to Microsoft 365 first');
    }

    try {
      this.loadValuesFromAccessToken(args);
      await this.commandAction(logger, args);
    }
    catch (ex) {
      if (ex instanceof CommandError) {
        throw ex;
      }
      throw new CommandError(ex as any);
    }
  }

  public async validate(args: CommandArgs, command: CommandInfo): Promise<boolean | string> {
    for (const validate of this.validators) {
      const result = await validate(args, command);
      if (result !== true) {
        return result;
      }
    }

    return true;
  }

  public getCommandName(alias?: string): string {
    if (alias &&
      this.alias()?.includes(alias)) {
      return alias;
    }

    let commandName: string = this.name;
    let pos: number = commandName.indexOf('<');
    const pos1: number = commandName.indexOf('[');
    if (pos > -1 || pos1 > -1) {
      if (pos1 > -1) {
        pos = pos1;
      }

      commandName = commandName.substr(0, pos).trim();
    }

    return commandName;
  }

  protected handleRejectedODataPromise(res: any): void {
    if (res.error) {
      try {
        const err: ODataError = JSON.parse(res.error);
        throw new CommandError(err['odata.error'].message.value);
      }
      catch (err: any) {
        if (err instanceof CommandError) {
          throw err;
        }

        try {
          const graphResponseError: GraphResponseError = res.error;
          if (graphResponseError.error.code) {
            throw new CommandError(graphResponseError.error.code + " - " + graphResponseError.error.message);
          }
          else {
            throw new CommandError(graphResponseError.error.message);
          }
        }
        catch (err: any) {
          if (err instanceof CommandError) {
            throw err;
          }

          throw new CommandError(res.error);
        }
      }
    }
    else {
      if (res instanceof Error) {
        throw new CommandError(res.message);
      }
      else {
        throw new CommandError(res);
      }
    }
  }

  protected handleRejectedODataJsonPromise(response: any): void {
    if (response.error &&
      response.error['odata.error'] &&
      response.error['odata.error'].message) {
      throw new CommandError(response.error['odata.error'].message.value);
    }

    if (!response.error) {
      if (response instanceof Error) {
        throw new CommandError(response.message);
      }
      else {
        throw new CommandError(response);
      }
    }

    if (response.error.error &&
      response.error.error.message) {
      throw new CommandError(response.error.error.message);
    }

    if (response.error.message) {
      throw new CommandError(response.error.message);
    }

    if (response.error.error_description) {
      throw new CommandError(response.error.error_description);
    }

    try {
      const error: any = JSON.parse(response.error);
      if (error &&
        error.error &&
        error.error.message) {
        throw new CommandError(error.error.message);
      }
      else {
        throw new CommandError(response.error);
      }
    }
    catch (err: any) {
      if (err instanceof CommandError) {
        throw err;
      }
      throw new CommandError(response.error);
    }
  }

  protected handleError(rawResponse: any): void {
    if (rawResponse instanceof Error) {
      throw new CommandError(rawResponse.message);
    }
    else {
      throw new CommandError(rawResponse);
    }
  }

  protected handleRejectedPromise(rawResponse: any): void {
    this.handleError(rawResponse);
  }

  protected initAction(args: CommandArgs, logger: Logger): void {
    this.debug = args.options.debug || process.env.CLIMICROSOFT365_DEBUG === '1';
    this.verbose = this.debug || args.options.verbose || process.env.CLIMICROSOFT365_VERBOSE === '1';
    request.debug = this.debug;
    request.logger = logger;

    telemetry.trackEvent(this.getUsedCommandName(), this.getTelemetryProperties(args));
  }

  protected getUnknownOptions(options: any): any {
    const unknownOptions: any = JSON.parse(JSON.stringify(options));
    // remove minimist catch-all option
    delete unknownOptions._;

    const knownOptions: CommandOption[] = this.options;
    const longOptionRegex: RegExp = /--([^\s]+)/;
    const shortOptionRegex: RegExp = /-([a-z])\b/;
    knownOptions.forEach(o => {
      const longOptionName: string = (longOptionRegex.exec(o.option) as RegExpExecArray)[1];
      delete unknownOptions[longOptionName];

      // short names are optional so we need to check if the current command has
      // one before continuing
      const shortOptionMatch: RegExpExecArray | null = shortOptionRegex.exec(o.option);
      if (shortOptionMatch) {
        const shortOptionName: string = shortOptionMatch[1];
        delete unknownOptions[shortOptionName];
      }
    });

    return unknownOptions;
  }

  protected trackUnknownOptions(telemetryProps: any, options: any): void {
    const unknownOptions: any = this.getUnknownOptions(options);
    const unknownOptionsNames: string[] = Object.getOwnPropertyNames(unknownOptions);
    unknownOptionsNames.forEach(o => {
      telemetryProps[o] = true;
    });
  }

  protected addUnknownOptionsToPayload(payload: any, options: any): void {
    const unknownOptions: any = this.getUnknownOptions(options);
    const unknownOptionsNames: string[] = Object.getOwnPropertyNames(unknownOptions);
    unknownOptionsNames.forEach(o => {
      payload[o] = unknownOptions[o];
    });
  }

  private loadValuesFromAccessToken(args: CommandArgs): void {
    if (!auth.service.accessTokens[auth.defaultResource]) {
      return;
    }

    const token = auth.service.accessTokens[auth.defaultResource].accessToken;
    const optionNames: string[] = Object.getOwnPropertyNames(args.options);
    optionNames.forEach(option => {
      const value = args.options[option];
      if (!value || typeof value !== 'string') {
        return;
      }

      const lowerCaseValue = value.toLowerCase().trim();
      if (lowerCaseValue === '@meid' || lowerCaseValue === '@meusername') {
        const isAppOnlyAccessToken = accessToken.isAppOnlyAccessToken(auth.service.accessTokens[auth.defaultResource].accessToken);
        if (isAppOnlyAccessToken) {
          throw `It's not possible to use ${value} with application permissions`;
        }
      }
      if (lowerCaseValue === '@meid') {
        args.options[option] = accessToken.getUserIdFromAccessToken(token);
      }
      if (lowerCaseValue === '@meusername') {
        args.options[option] = accessToken.getUserNameFromAccessToken(token);
      }
    });
  }

  protected async showDeprecationWarning(logger: Logger, deprecated: string, recommended: string): Promise<void> {
    const cli: Cli = Cli.getInstance();
    if (cli.currentCommandName &&
      cli.currentCommandName.indexOf(deprecated) === 0) {
      const chalk = (await import('chalk')).default;
      await logger.logToStderr(chalk.yellow(`Command '${deprecated}' is deprecated. Please use '${recommended}' instead`));
    }
  }

  protected async warn(logger: Logger, warning: string): Promise<void> {
    const chalk = (await import('chalk')).default;
    await logger.logToStderr(chalk.yellow(warning));
  }

  protected getUsedCommandName(): string {
    const cli: Cli = Cli.getInstance();
    const commandName: string = this.getCommandName();
    if (!cli.currentCommandName) {
      return commandName;
    }

    if (cli.currentCommandName &&
      cli.currentCommandName.indexOf(commandName) === 0) {
      return commandName;
    }

    // since the command was called by something else than its name
    // it must have aliases
    const aliases: string[] = this.alias() as string[];

    for (let i: number = 0; i < aliases.length; i++) {
      if (cli.currentCommandName.indexOf(aliases[i]) === 0) {
        return aliases[i];
      }
    }

    // shouldn't happen because the command is called either by its name or alias
    return '';
  }

  private getTelemetryProperties(args: any): any {
    this.telemetry.forEach(t => t(args));
    return this.telemetryProperties;
  }

  public async getTextOutput(logStatement: any[]): Promise<string> {
    // display object as a list of key-value pairs
    if (logStatement.length === 1) {
      const obj: any = logStatement[0];
      const propertyNames: string[] = [];
      Object.getOwnPropertyNames(obj).forEach(p => {
        propertyNames.push(p);
      });

      let longestPropertyLength: number = 0;
      propertyNames.forEach(p => {
        if (p.length > longestPropertyLength) {
          longestPropertyLength = p.length;
        }
      });

      const output: string[] = [];
      propertyNames.sort().forEach(p => {
        output.push(`${p.length < longestPropertyLength ? p + new Array(longestPropertyLength - p.length + 1).join(' ') : p}: ${Array.isArray(obj[p]) || typeof obj[p] === 'object' ? JSON.stringify(obj[p]) : obj[p]}`);
      });

      return output.join('\n') + '\n';
    }
    // display object as a table where each property is a column
    else {
      const Table = (await import('easy-table')).default;
      const t = new Table();
      logStatement.forEach((r: any) => {
        if (typeof r !== 'object') {
          return;
        }

        Object.getOwnPropertyNames(r).forEach(p => {
          t.cell(p, r[p]);
        });
        t.newRow();
      });

      return t.toString();
    }
  }

  public getJsonOutput(logStatement: any): string {
    return JSON
      .stringify(logStatement, null, 2)
      // replace unescaped newlines with escaped newlines #2807
      .replace(/([^\\])\\n/g, '$1\\\\\\n');
  }

  public async getCsvOutput(logStatement: any[], options: GlobalOptions): Promise<string> {
    const { stringify } = await import('csv-stringify/sync');
    const cli = Cli.getInstance();

    if (logStatement && logStatement.length > 0 && !options.query) {
      logStatement.map(l => {
        for (const x of Object.keys(l)) {
          if (typeof l[x] === 'object') {
            delete l[x];
          }
        }
      });
    }

    // https://csv.js.org/stringify/options/
    return stringify(logStatement, {
      header: cli.getSettingWithDefaultValue<boolean>(settingsNames.csvHeader, true),
      escape: cli.getSettingWithDefaultValue(settingsNames.csvEscape, '"'),
      quote: cli.config.get(settingsNames.csvQuote),
      quoted: cli.getSettingWithDefaultValue<boolean>(settingsNames.csvQuoted, false),
      // eslint-disable-next-line camelcase
      quoted_empty: cli.getSettingWithDefaultValue<boolean>(settingsNames.csvQuotedEmpty, false)
    });
  }

  public getMdOutput(logStatement: any[], command: Command, options: GlobalOptions): string {
    const output: string[] = [
      `# ${command.getCommandName()} ${Object.keys(options).filter(o => o !== 'output').map(k => `--${k} "${options[k]}"`).join(' ')}`, os.EOL,
      os.EOL,
      `Date: ${(new Date().toLocaleDateString())}`, os.EOL,
      os.EOL
    ];

    if (logStatement && logStatement.length > 0) {
      logStatement.forEach(l => {
        if (!l) {
          return;
        }

        const title = this.getLogItemTitle(l);
        const id = this.getLogItemId(l);

        if (title && id) {
          output.push(`## ${title} (${id})`, os.EOL, os.EOL);
        }
        else if (title) {
          output.push(`## ${title}`, os.EOL, os.EOL);
        }
        else if (id) {
          output.push(`## ${id}`, os.EOL, os.EOL);
        }

        output.push(
          `Property | Value`, os.EOL,
          `---------|-------`, os.EOL
        );
        output.push(Object.keys(l).filter(x => {
          if (!options.query && typeof l[x] === 'object') {
            return;
          }

          return x;
        }).map(k => {
          const value = l[k];

          return `${md.escapeMd(k)} | ${md.escapeMd(value)}`;
        }).join(os.EOL), os.EOL);
        output.push(os.EOL);
      });
    }

    return output.join('').trimEnd();
  }

  private getLogItemTitle(logItem: any): string | undefined {
    return logItem.title ?? logItem.Title ??
      logItem.displayName ?? logItem.DisplayName ??
      logItem.name ?? logItem.Name;
  }

  private getLogItemId(logItem: any): string | undefined {
    return logItem.id ?? logItem.Id ?? logItem.ID ??
      logItem.uniqueId ?? logItem.UniqueId ??
      logItem.objectId ?? logItem.ObjectId ??
      logItem.url ?? logItem.Url ?? logItem.URL;
  }
}
