import type { CommandFn } from './index.ts';

export const clear_sessions: CommandFn = ({ name, args, server }) => {
  return Promise.resolve();
};
