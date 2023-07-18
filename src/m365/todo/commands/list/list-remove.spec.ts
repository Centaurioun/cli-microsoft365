import * as assert from "assert";
import * as sinon from "sinon";
import { telemetry } from "../../../../telemetry";
import auth from "../../../../Auth";
import { Cli } from "../../../../cli/Cli";
import { CommandInfo } from "../../../../cli/CommandInfo";
import { Logger } from "../../../../cli/Logger";
import Command, { CommandError } from "../../../../Command";
import request from "../../../../request";
import { pid } from "../../../../utils/pid";
import { session } from "../../../../utils/session";
import { sinonUtil } from "../../../../utils/sinonUtil";
import commands from "../../commands";
const command: Command = require("./list-remove");

describe(commands.LIST_REMOVE, () => {
  let cli: Cli;
  let log: string[];
  let logger: Logger;
  let promptOptions: any;
  let commandInfo: CommandInfo;

  before(() => {
    cli = Cli.getInstance();
    sinon.stub(auth, "restoreAuth").resolves();
    sinon.stub(telemetry, "trackEvent").returns();
    sinon.stub(pid, "getProcessName").returns("");
    sinon.stub(session, "getId").returns("");
    auth.service.connected = true;
    sinon.stub(Cli, "prompt").callsFake(async (options) => {
      promptOptions = options;
      return { continue: true };
    });
    commandInfo = Cli.getCommandInfo(command);
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
      },
    };
    (command as any).items = [];
    sinon
      .stub(cli, "getSettingWithDefaultValue")
      .callsFake((settingName, defaultValue) => defaultValue);
  });

  afterEach(() => {
    sinonUtil.restore([
      request.get,
      request.delete,
      cli.getSettingWithDefaultValue,
    ]);
  });

  after(() => {
    sinon.restore();
    auth.service.connected = false;
  });

  it("has correct name", () => {
    assert.strictEqual(command.name, commands.LIST_REMOVE);
  });

  it("has a description", () => {
    assert.notStrictEqual(command.description, null);
  });

  it("removes a To Do task list by name", async () => {
    sinon.stub(request, "get").callsFake(async (opts) => {
      if (
        opts.url ===
        "https://graph.microsoft.com/v1.0/me/todo/lists?$filter=displayName eq 'FooList'"
      ) {
        return {
          "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#lists",
          value: [
            {
              "@odata.etag": 'W/"m1fdwWoFiE2YS9yegTKoYwAA/ZGllw=="',
              displayName: "FooList",
              isOwner: true,
              isShared: false,
              wellknownListName: "none",
              id: "AAMkAGI3NDhlZmQzLWQxYjAtNGJjNy04NmYwLWQ0M2IzZTNlMDUwNAAuAAAAAACQ1l2jfH6VSZraktP8Z7auAQCbV93BagWITZhL3J6BMqhjAAD9pHIiAAA=",
            },
          ],
        };
      }

      throw "Invalid request";
    });
    sinon.stub(request, "delete").callsFake(async (opts) => {
      if (
        opts.url ===
        "https://graph.microsoft.com/v1.0/me/todo/lists/AAMkAGI3NDhlZmQzLWQxYjAtNGJjNy04NmYwLWQ0M2IzZTNlMDUwNAAuAAAAAACQ1l2jfH6VSZraktP8Z7auAQCbV93BagWITZhL3J6BMqhjAAD9pHIiAAA="
      ) {
        return;
      }

      throw "Invalid request";
    });

    await command.action(logger, {
      options: {
        name: "FooList",
      },
    } as any);
    assert.strictEqual(log.length, 0);
  });

  it("removes a To Do task list by name when confirm option is passed", async () => {
    sinon.stub(request, "get").callsFake(async (opts) => {
      if (
        opts.url ===
        "https://graph.microsoft.com/v1.0/me/todo/lists?$filter=displayName eq 'FooList'"
      ) {
        return {
          "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#lists",
          value: [
            {
              "@odata.etag": 'W/"m1fdwWoFiE2YS9yegTKoYwAA/ZGllw=="',
              displayName: "FooList",
              isOwner: true,
              isShared: false,
              wellknownListName: "none",
              id: "AAMkAGI3NDhlZmQzLWQxYjAtNGJjNy04NmYwLWQ0M2IzZTNlMDUwNAAuAAAAAACQ1l2jfH6VSZraktP8Z7auAQCbV93BagWITZhL3J6BMqhjAAD9pHIiAAA=",
            },
          ],
        };
      }

      throw "Invalid request";
    });
    sinon.stub(request, "delete").callsFake(async (opts) => {
      if (
        opts.url ===
        "https://graph.microsoft.com/v1.0/me/todo/lists/AAMkAGI3NDhlZmQzLWQxYjAtNGJjNy04NmYwLWQ0M2IzZTNlMDUwNAAuAAAAAACQ1l2jfH6VSZraktP8Z7auAQCbV93BagWITZhL3J6BMqhjAAD9pHIiAAA="
      ) {
        return;
      }

      throw "Invalid request";
    });

    await command.action(logger, {
      options: {
        name: "FooList",
        confirm: true,
      },
    } as any);
    assert.strictEqual(log.length, 0);
  });

  it("removes a To Do task list by id", async () => {
    sinon.stub(request, "get").callsFake(async (opts) => {
      if (
        opts.url ===
        "https://graph.microsoft.com/v1.0/me/todo/lists?$filter=displayName eq 'FooList'"
      ) {
        return {
          "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#lists",
          value: [
            {
              "@odata.etag": 'W/"m1fdwWoFiE2YS9yegTKoYwAA/ZGllw=="',
              displayName: "FooList",
              isOwner: true,
              isShared: false,
              wellknownListName: "none",
              id: "AAMkAGI3NDhlZmQzLWQxYjAtNGJjNy04NmYwLWQ0M2IzZTNlMDUwNAAuAAAAAACQ1l2jfH6VSZraktP8Z7auAQCbV93BagWITZhL3J6BMqhjAAD9pHIiAAA=",
            },
          ],
        };
      }

      throw "Invalid request";
    });
    sinon.stub(request, "delete").callsFake(async (opts) => {
      if (
        opts.url ===
        "https://graph.microsoft.com/v1.0/me/todo/lists/AAMkAGI3NDhlZmQzLWQxYjAtNGJjNy04NmYwLWQ0M2IzZTNlMDUwNAAuAAAAAACQ1l2jfH6VSZraktP8Z7auAQCbV93BagWITZhL3J6BMqhjAAD9pHIiAAA="
      ) {
        return;
      }

      throw "Invalid request";
    });

    await command.action(logger, {
      options: {
        id: "AAMkAGI3NDhlZmQzLWQxYjAtNGJjNy04NmYwLWQ0M2IzZTNlMDUwNAAuAAAAAACQ1l2jfH6VSZraktP8Z7auAQCbV93BagWITZhL3J6BMqhjAAD9pHIiAAA=",
      },
    } as any);
    assert.strictEqual(log.length, 0);
  });

  it("handles error correctly when a list is not found for a specific name", async () => {
    sinon.stub(request, "get").callsFake(async (opts) => {
      if (
        opts.url ===
        "https://graph.microsoft.com/v1.0/me/todo/lists?$filter=displayName eq 'FooList'"
      ) {
        return {
          "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#lists",
          value: [],
        };
      }

      throw "Invalid request";
    });
    sinon.stub(request, "delete").callsFake(async () => {
      return;
    });
    await assert.rejects(
      command.action(logger, { options: { name: "FooList" } } as any),
      new CommandError("The list FooList cannot be found"),
    );
  });

  it("handles error correctly", async () => {
    sinon.stub(request, "get").callsFake(async (opts) => {
      if (
        opts.url ===
        "https://graph.microsoft.com/v1.0/me/todo/lists?$filter=displayName eq 'FooList'"
      ) {
        return {
          "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#lists",
          value: [
            {
              "@odata.etag": 'W/"m1fdwWoFiE2YS9yegTKoYwAA/ZGllw=="',
              displayName: "FooList",
              isOwner: true,
              isShared: false,
              wellknownListName: "none",
              id: "AAMkAGI3NDhlZmQzLWQxYjAtNGJjNy04NmYwLWQ0M2IzZTNlMDUwNAAuAAAAAACQ1l2jfH6VSZraktP8Z7auAQCbV93BagWITZhL3J6BMqhjAAD9pHIiAAA=",
            },
          ],
        };
      }

      throw "Invalid request";
    });
    sinon.stub(request, "delete").rejects(new Error("An error has occurred"));

    await assert.rejects(
      command.action(logger, { options: { name: "FooList" } } as any),
      new CommandError("An error has occurred"),
    );
  });

  it("prompts before removing the list when confirm option not passed", async () => {
    sinon.stub(request, "get").callsFake(async (opts) => {
      if (
        opts.url ===
        "https://graph.microsoft.com/v1.0/me/todo/lists?$filter=displayName eq 'FooList'"
      ) {
        return {
          "@odata.context": "https://graph.microsoft.com/v1.0/$metadata#lists",
          value: [
            {
              "@odata.etag": 'W/"m1fdwWoFiE2YS9yegTKoYwAA/ZGllw=="',
              displayName: "FooList",
              isOwner: true,
              isShared: false,
              wellknownListName: "none",
              id: "AAMkAGI3NDhlZmQzLWQxYjAtNGJjNy04NmYwLWQ0M2IzZTNlMDUwNAAuAAAAAACQ1l2jfH6VSZraktP8Z7auAQCbV93BagWITZhL3J6BMqhjAAD9pHIiAAA=",
            },
          ],
        };
      }

      throw "Invalid request";
    });
    sinon.stub(request, "delete").callsFake(async (opts) => {
      if (
        opts.url ===
        "https://graph.microsoft.com/v1.0/me/todo/lists/AAMkAGI3NDhlZmQzLWQxYjAtNGJjNy04NmYwLWQ0M2IzZTNlMDUwNAAuAAAAAACQ1l2jfH6VSZraktP8Z7auAQCbV93BagWITZhL3J6BMqhjAAD9pHIiAAA="
      ) {
        return;
      }

      throw "Invalid request";
    });

    sinonUtil.restore(Cli.prompt);
    sinon.stub(Cli, "prompt").callsFake(async () => ({ continue: false }));

    command.action(logger, {
      options: {
        name: "FooList",
      },
    } as any);
    let promptIssued = false;

    if (promptOptions && promptOptions.type === "confirm") {
      promptIssued = true;
    }
    assert(promptIssued);
  });

  it("fails validation if both name and id are not set", async () => {
    const actual = await command.validate(
      {
        options: {
          name: null,
          id: null,
        },
      },
      commandInfo,
    );
    assert.notStrictEqual(actual, true);
  });

  it("passes validation when all parameters are valid", async () => {
    const actual = await command.validate(
      {
        options: {
          name: "Foo",
        },
      },
      commandInfo,
    );

    assert.strictEqual(actual, true);
  });

  it("fails validation if both name and id are set", async () => {
    const actual = await command.validate(
      {
        options: {
          name: "foo",
          id: "bar",
        },
      },
      commandInfo,
    );
    assert.notStrictEqual(actual, true);
  });
});
