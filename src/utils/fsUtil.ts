import * as fs from 'fs';
import * as path from 'path';

const copyCommands = {
  bash: {
    copyCommand: 'cp',
    copyDestinationParam: ' '
  },
  powershell: {
    copyCommand: 'Copy-Item',
    copyDestinationParam: ' -Destination '
  },
  cmd: {
    copyCommand: 'copy',
    copyDestinationParam: ' '
  }
};

const createDirectoryCommands = {
  bash: {
    createDirectoryCommand: 'mkdir',
    createDirectoryPathParam: ' "',
    createDirectoryNameParam: '/',
    createDirectoryItemTypeParam: '"'
  },
  powershell: {
    createDirectoryCommand: 'New-Item',
    createDirectoryPathParam: ' -Path "',
    createDirectoryNameParam: '" -Name "',
    createDirectoryItemTypeParam: '" -ItemType "directory"'
  },
  cmd: {
    createDirectoryCommand: 'mkdir',
    createDirectoryPathParam: ' "',
    createDirectoryNameParam: '\\',
    createDirectoryItemTypeParam: '"'
  }
};

const addFileCommands = {
  bash: {
    addFileCommand: 'cat > [FILEPATH] << EOF [FILECONTENT]EOF'
  },
  powershell: {
    addFileCommand: "@'[FILECONTENT]'@ | Out-File -FilePath [FILEPATH]"
  },
  cmd: {
    addFileCommand: "echo [FILECONTENT] > [FILEPATH]"
  }
};

const removeFileCommands = {
  bash: {
    removeFileCommand: 'rm'
  },
  powershell: {
    removeFileCommand: 'Remove-Item'
  },
  cmd: {
    removeFileCommand: 'del'
  }
};

export const fsUtil = {
  readdirR(dir: string): string | string[] {
    return fs.statSync(dir).isDirectory()
      ? Array.prototype.concat(...fs.readdirSync(dir).map(f => fsUtil.readdirR(path.join(dir, f))))
      : dir;
  },

  // from: https://stackoverflow.com/a/22185855
  copyRecursiveSync(src: string, dest: string, replaceTokens?: (s: string) => string): void {
    const exists: boolean = fs.existsSync(src);
    const stats: false | fs.Stats = exists && fs.statSync(src);
    const isDirectory: boolean = exists && (stats as fs.Stats).isDirectory();

    if (replaceTokens) {
      dest = replaceTokens(dest);
    }

    if (isDirectory) {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest);
      }
      fs.readdirSync(src).forEach(function (childItemName) {
        fsUtil.copyRecursiveSync(path.join(src, childItemName),
          path.join(dest, childItemName), replaceTokens);
      });
    }
    else {
      fs.copyFileSync(src, dest);
    }
  },

  getSafeFileName(input: string): string {
    return input.replace(/'/g, "''");
  },

  getCopyCommand(command: string, shell: string): string {
    return (copyCommands as any)[shell][command];
  },

  getDirectoryCommand(command: string, shell: string): string {
    return (createDirectoryCommands as any)[shell][command];
  },

  getAddCommand(command: string, shell: string): string {
    return (addFileCommands as any)[shell][command];
  },

  getRemoveCommand(command: string, shell: string): string {
    return (removeFileCommands as any)[shell][command];
  }
};