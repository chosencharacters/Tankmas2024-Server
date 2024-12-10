import type TankmasServer from '../tankmas_server.ts';

export type CommandFn = (params: {
  name: string;
  args: string[];
  server: TankmasServer;
}) => Promise<void> | void;

// remember to export server commands here.
export * from './broadcast.ts';
export * from './list.ts';
export * from './save.ts';
