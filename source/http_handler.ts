import { validate_request } from './newgrounds.ts';
import type TankmasServer from './tankmas_server.ts';

const PLAYERS_ROUTE = new URLPattern({ pathname: '/players' });
const ROOM_ROUTE = new URLPattern({ pathname: '/rooms/:id' });
const ROOMS_ROUTE = new URLPattern({ pathname: '/rooms*' });

const SAVES_ROUTE = new URLPattern({ pathname: '/saves' });

// In this file you can handle requests that are not websocket related.
const webserver_handler = async (
  req: Request,
  server: TankmasServer
): Promise<Response> => {
  if (PLAYERS_ROUTE.exec(req.url)) {
    const data = server.users.map(p => p.get_definition());
    return Response.json({ data }, { status: 200 });
  }

  const room_match = ROOM_ROUTE.exec(req.url);
  const room_id_str = room_match ? room_match.pathname.groups.id : undefined;
  if (room_id_str) {
    const room_id = Number.parseInt(room_id_str ?? '');
    const room = server.rooms[room_id];

    if (Number.isNaN(room_id) || !room) {
      return new Response('Not found.', { status: 404 });
    }

    const users = Object.fromEntries(
      room.user_list.map(u => [u.username, u.get_definition()])
    );

    return Response.json({
      data: {
        ...room,
        user_list: undefined,
        users,
      },
    });
  }

  if (ROOMS_ROUTE.exec(req.url)) {
    const data = Object.values(server.rooms).map(room => {
      return {
        ...room,
        user_list: room.user_list.map(u => u.get_definition()),
      };
    });

    return Response.json({ data }, { status: 200 });
  }

  // Save/load user saves.
  if (SAVES_ROUTE.exec(req.url)) {
    const { username, valid } = await validate_request(req);

    if (!valid || !username) return new Response(null, { status: 403 });

    if (req.method === 'GET') {
      const data = server.db.get_user_save(username);
      return Response.json(
        {
          data,
        },
        { status: 200 }
      );
    } else if (req.method === 'POST') {
      const body = await req.json();
      if (typeof body.data !== 'string') {
        return new Response(null, { status: 400 });
      }

      server.db.store_user_save(username, body.data);
      return new Response(null, { status: 200 });
    }
  }

  return new Response('Not found.', { status: 404 });
};

export default webserver_handler;
