import type { CommandFn } from './index.ts';

export const save: CommandFn = ({ server }) => {
  logger.info('Saving data to DB...');
  server._write_to_db();
};
