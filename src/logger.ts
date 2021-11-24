import CatLoggr from 'cat-loggr/ts';
export const logger = new CatLoggr().setLevel(process.env.COMMANDS_DEBUG === 'true' ? 'debug' : 'info');
