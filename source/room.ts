import type { ConfigFile } from './tankmas_server.ts';
import type User from './user.ts';

class Room {
  user_list: User[] = [];
  name: string;
  id: number;
  identifier: string;
  maps: string[];

  constructor(config: ConfigFile['rooms'][0]) {
    this.name = config.name;
    this.id = config.id;
    this.identifier = config.identifier;
    this.maps = config.maps ?? [];
  }
}

export default Room;
