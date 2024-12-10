import type { CommandFn } from './index.ts';

export const broadcast: CommandFn = ({ name, args, server }) => {
  const rest = args.join(' ');
  if (rest) {
    const sticky = name === 'broadcast_sticky';
    console.info(`broadcasting message "${rest}"`);
    server.send_server_notification(rest, sticky);
  }

  return Promise.resolve();
};

export const broadcast_sticky = broadcast;
export const say = broadcast;
