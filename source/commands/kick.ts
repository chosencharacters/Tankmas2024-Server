import type { CommandFn } from './index.ts';

export const kick: CommandFn = ({ server, args }) => {
  const [username] = args ?? [];
  if (!username) {
    logger.info('No user specified.');
    return;
  }

  const kick_success = server.websockets.kick_user(username);
  if (!kick_success) {
    logger.info(`Could not find user "${username}".`);
  } else {
    logger.info(`Kicked ${username}`);
  }
};
