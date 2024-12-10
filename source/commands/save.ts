import type { CommandFn } from './index.ts';

export const save: CommandFn = ({ server }) => {
  console.info('Saving data to DB...');
  server._write_to_db();
};
