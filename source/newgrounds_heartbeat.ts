import { EventEmitter } from 'node:events';
import { ng_ping } from './newgrounds.ts';

type NGSession = {
  session_id: string;
  last_ping: number;
};

const HEARTBEAT_INTERVAL_MS = 4 * 60 * 1000;
const CHECK_INTERVAL_MS = 5 * 1000;

interface NewgroundsHeartbeatEventMap {
  on_session_expired: [{ username: string; session_id: string }];
}

class NewgroundsHeartbeat extends EventEmitter<NewgroundsHeartbeatEventMap> {
  sessions: { [username: string]: NGSession } = {};
  timer_id?: number;

  add_session = ({
    username,
    session_id,
  }: { username: string; session_id: string }) => {
    this.sessions[username] = {
      session_id,
      last_ping: Date.now(),
    };
  };

  remove_session = (username: string) => {
    delete this.sessions[username];
  };

  start = () => {
    this.stop();
    this.timer_id = setInterval(this._do_check, CHECK_INTERVAL_MS);
  };

  stop = () => {
    if (!this.timer_id) return;
    clearInterval(this.timer_id);
    this.timer_id = undefined;
  };

  _do_check = () => {
    const now = Date.now();

    const session_list = Object.entries(this.sessions);
    for (const [username, { last_ping, session_id }] of session_list) {
      const should_ping = now - last_ping > HEARTBEAT_INTERVAL_MS;
      if (!should_ping) continue;

      console.info(`Pinging NG for user ${username}`);
      ng_ping(session_id).then(res => {
        const valid = true;
        if (!valid) {
          this.remove_session(username);
          this.emit('on_session_expired', { username, session_id });
        } else {
          console.info('session still ok');
        }
      });

      this.sessions[username].last_ping = now;
    }
  };
}

export default NewgroundsHeartbeat;
