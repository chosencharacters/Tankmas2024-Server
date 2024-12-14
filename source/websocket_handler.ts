import { validate_request } from './newgrounds/newgrounds_sessions.ts';
import { EventEmitter } from 'node:events';

const WS_CLOSE_STATUS_OK = 1000;
const WS_CLOSE_STATUS_WRONG_DATA = 1003;

import {
  event_list_schema,
  EventType,
  type EventQueueMessage,
  type MultiplayerEvent,
} from './messages.ts';

import { event_schema } from './messages.ts';

export type WebsocketHandlerOptions = {
  port?: number;
};

interface SocketEventMap {
  client_connected: [{ username: string; session_id: string }, WebSocket];
  client_disconnected: [username: string, WebSocket];
  client_message: [username: string, MultiplayerEvent, WebSocket];
}

type QueuedSocket = {
  socket: WebSocket;
  event_queue: MultiplayerEvent[];
  closed: boolean;
};
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

    this._send_events(msg, socket.socket);
  };

  _send_events = (events: EventQueueMessage, socket: WebSocket) => {
    const encoded = JSON.stringify(events);
    socket.send(encoded);
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

    const { username, session_id, valid, protocol } =
      await validate_request(req);

    logger.info(`Websocket request (${username ?? 'unknown user'})`);

    if (!valid || !username || !session_id) {
      logger.info(`User session was invalid (${username}, ${session_id})`);
      return new Response(null, { status: 403 });
    }

    if (this.clients[username]) {
      const existing_client = this.clients[username];
      logger.info(`${username} has existing session. disconnect it.`);
      this._disconnect_client(username, existing_client);
    }

    logger.info(`Authenticated as ${username}`);

    const { socket, response } = Deno.upgradeWebSocket(req, { protocol });

    const own_client: QueuedSocket = { socket, event_queue: [], closed: false };

    const _on_open = (_e: Event) => {
      if (own_client.closed) return;

      /// Check if another connection has been made during the establishment of
      /// this socket. If so, close this one.
      if (this.clients[username]) {
        logger.info(`${username} managed to create duplicate session.`);
        this._disconnect_client(username, own_client);
        return;
      }

      this.clients[username] = own_client;
      this._refresh_user_list();
      this.emit('client_connected', { username, session_id }, socket);
    };

    const _on_message = (event: MessageEvent) => {
      if (own_client.closed) return;

      try {
        const d = JSON.parse(event.data);

        let event_list: MultiplayerEvent[] = [];
        if (d.events) {
          const data = event_list_schema.safeParse(d);
          if (!data.success) {
            logger.warn(`Could not parse event list: ${data.error}`);
            return;
          }
          event_list = data.data.events;
        } else {
          const data = event_schema.safeParse(d);
          if (!data.success) {
            logger.warn(`Could not parse event: ${data.error}`);
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
          logger.warn(
            `Received message in invalid format. Message content: ${event.data}`
          );

          this._disconnect_client(
            username,
            own_client,
            WS_CLOSE_STATUS_WRONG_DATA,
            'Server did not understand :('
          );
        } else {
          logger.error(error);
        }
      }
    };

    const _on_close = (_e: CloseEvent) => {
      this._disconnect_client(username, own_client);

      socket.removeEventListener('open', _on_open);
      socket.removeEventListener('close', _on_close);
      socket.removeEventListener('message', _on_message);
    };

    socket.addEventListener('open', _on_open);
    socket.addEventListener('close', _on_close);
    socket.addEventListener('message', _on_message);

    return response;
  };

  // Sends a good bye packet to the client and closes it
  request_socket_close = (
    socket: WebSocket,
    status_code?: number,
    reason?: string
  ) => {
    if (socket.readyState !== socket.OPEN) {
      return;
    }

    this._send_events(
      { events: [{ type: EventType.PleaseLeave, timestamp: Date.now() }] },
      socket
    );

    socket.close(status_code, reason);
  };

  kick_user = (username: string) => {
    const socket = this.clients[username];
    if (!socket) return false;
    this._disconnect_client(username, socket, 1000, 'Kicked.');
    return true;
  };

  _disconnect_client = (
    username: string,
    client: QueuedSocket,
    status_code = WS_CLOSE_STATUS_OK,
    reason?: string
  ) => {
    if (client.closed) return;

    client.closed = true;

    if (this.clients[username] === client) {
      delete this.clients[username];
      this._refresh_user_list();
    }

    const { socket } = client;
    this.emit('client_disconnected', username, socket);
    this.request_socket_close(socket, status_code, reason);
  };

  _refresh_user_list = () => {
    this.client_list = Object.values(this.clients);
  };
}

export default WebsocketHandler;
