import { format_time } from '../util.ts';
import type { CommandFn } from './index.ts';

export const list: CommandFn = ({ server }) => {
  const player_count = `Player Count: ${server.user_list.length}`;
  const user_list = server.user_list
    .map(u => {
      const seconds = u.current_session_time / 1000.0;
      return `${u.username} - ${format_time(seconds)}`;
    })
    .join('\n');
  if (user_list.length) console.info(user_list);

  console.info(player_count);
};
