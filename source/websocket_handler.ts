import { validate_request } from './newgrounds.ts';
import { EventEmitter } from 'node:events';

import {
  event_list_schema,
  type EventQueueMessage,
  type MultiplayerEvent,
} from './messages.ts';
import { event_schema } from './messages.ts';

export type WebsocketHandlerOptions = {
  port?: number;
};

interface SocketEventMap {
  client_connected: [username: string, WebSocket];
  client_disconnected: [username: string, WebSocket];
  client_message: [username: string, MultiplayerEvent, WebSocket];
}

type QueuedSocket = { socket: WebSocket; event_queue: MultiplayerEvent[] };
class WebsocketHandler extends EventEmitter<SocketEventMap> {
  port: number;

  clients: {
    [username: string]: QueuedSocket;
  } = {};

  client_list: QueuedSocket[] = [];

  constructor(options: WebsocketHandlerOptions) {
    super();
    this.port = options.port ?? 9000;
  }

  send_to_user(username: string, message: MultiplayerEvent, immediate = false) {
    const socket = this.clients[username];
    if (!socket) return;

    socket.event_queue.push(message);
    if (immediate) {
      this.flush_queue(socket);
    }
  }

  broadcast = (message: MultiplayerEvent, immediate = false) => {
    for (const socket of this.client_list) {
      socket.event_queue.push(message);
      if (immediate) {
        this.flush_queues();
      }
    }
  };

  flush_queue = (socket: QueuedSocket) => {
    if (socket.event_queue.length === 0) return;
    const msg: EventQueueMessage = { events: socket.event_queue };
    socket.event_queue = [];
    const encoded = JSON.stringify(msg);
    socket.socket.send(encoded);
  };

  flush_queues = () => {
    for (const socket of this.client_list) {
      this.flush_queue(socket);
    }
  };

  handle_request = async (
    req: Request,
    _info: Deno.ServeHandlerInfo<Deno.NetAddr>
  ): Promise<Response | null> => {
    if (req.headers.get('upgrade') !== 'websocket') {
      return null;
    }

    console.info('Received new websocket request...');

    const { username, session_id, valid } = await validate_request(req);

    if (!valid || !username || !session_id) {
      console.info('User session was invalid.');
      return new Response(null, { status: 403 });
    }

    const { socket, response } = Deno.upgradeWebSocket(req);

    socket.addEventListener('open', () => {
      this.clients[username] = { socket, event_queue: [] };
      this._refresh_user_list();
      this.emit('client_connected', username, socket);
    });

    socket.addEventListener('message', event => {
      try {
        const d = JSON.parse(event.data);

        let event_list: MultiplayerEvent[] = [];
        if (d.events) {
          const data = event_list_schema.safeParse(d);
          if (!data.success) {
            console.warn(`Could not parse event list: ${data.error}`);
            return;
          }
          event_list = data.data.events;
        } else {
          const data = event_schema.safeParse(d);
          if (!data.success) {
            console.warn(`Could not parse event: ${data.error}`);
            return;
          }

          event_list = [data.data];
        }

        for (const event of event_list) {
          event.timestamp = Date.now();
          this.emit('client_message', username, event, socket);
        }
      } catch (error) {
        if (error instanceof SyntaxError) {
          console.warn(
            `Received message in invalid format. Message content: ${event.data}`
          );
        } else {
          console.error(error);
        }
      }
    });

    socket.addEventListener('close', e => {
      delete this.clients[username];
      this._refresh_user_list();
      console.info(e);
      this.emit('client_disconnected', username, socket);
    });

    return response;
  };

  _refresh_user_list = () => {
    this.client_list = Object.values(this.clients);
  };
}

export default WebsocketHandler;
