// Used to sync commands in CLI

import dotenv from 'dotenv';
import { SlashCreator } from 'slash-create';
import { isInDist } from './util/dev';
import path from 'path';

let dotenvPath = path.join(process.cwd(), '.env');
if (isInDist) dotenvPath = path.join(process.cwd(), '..', '.env');
dotenv.config({ path: dotenvPath });

import { logger } from './logger';

const creator = new SlashCreator({
  applicationID: process.env.DISCORD_APP_ID,
  publicKey: process.env.DISCORD_PUBLIC_KEY,
  token: process.env.DISCORD_BOT_TOKEN
});

creator.on('debug', (message) => logger.log(message));
creator.on('warn', (message) => logger.warn(message));
creator.on('error', (error) => {
  logger.error(error);
  process.exit(1);
});
creator.on('synced', () => {
  logger.info('Commands synced!');
  process.exit(0);
});
creator.on('commandRegister', (command) => logger.info(`Registered command ${command.commandName}`));

creator.registerCommandsIn(path.join(__dirname, 'commands'));

if (process.env.COMMANDS_DEV_GUILD) {
  creator.commands.forEach((command) => {
    // @ts-ignore
    if (!command.guildIDs || command.guildIDs.length === 0) command.guildIDs = [process.env.COMMANDS_DEV_GUILD];
  });
}

creator.syncCommands();
