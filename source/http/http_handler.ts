import { validate_request } from '../newgrounds.ts';
import type TankmasServer from '../tankmas_server.ts';
import get_premieres from './premieres.ts';

const PLAYERS_ROUTE = new URLPattern({ pathname: '/players' });
const ROOM_ROUTE = new URLPattern({ pathname: '/rooms/:id' });
const ROOMS_ROUTE = new URLPattern({ pathname: '/rooms*' });

const SAVES_ROUTE = new URLPattern({ pathname: '/saves' });

const PREMIERES_ROUTE = new URLPattern({ pathname: '/premieres' });

// In this file you can handle requests that are not websocket related.
const webserver_handler = async (
  req: Request,
  server: TankmasServer
): Promise<Response> => {
  const headers = new Headers();
  headers.set(
    'Access-Control-Allow-Origin',
    '*'
    //'https://uploads.ungrounded.net'
  );
  headers.set(
    'Access-Control-Allow-Headers',
    '*'
    //'authorization,content-length',
  );

  // ALLOW THESE THINGS WHEN OPTIONS ASKED
  if (req.method === 'OPTIONS') {
    const res = new Response(null, { status: 200 });
    res.headers.set('Allow', 'Allow: OPTIONS, GET, HEAD, POST');
    return res;
  }

  if (PLAYERS_ROUTE.exec(req.url)) {
    const data = server.user_list.map(p => p.get_definition());
    return Response.json({ data }, { status: 200, headers });
  }

  const room_match = ROOM_ROUTE.exec(req.url);
  const room_id_str = room_match ? room_match.pathname.groups.id : undefined;
  if (room_id_str) {
    const room_id = Number.parseInt(room_id_str ?? '');
    const room = server._rooms[room_id];

    if (Number.isNaN(room_id) || !room) {
      return new Response('Not found.', { status: 404, headers });
    }

    const users = Object.fromEntries(
      room.user_list.map(u => [u.username, u.get_definition()])
    );

    return Response.json(
      {
        data: {
          ...room,
          user_list: undefined,
          users,
        },
      },
      { headers }
    );
  }

  if (ROOMS_ROUTE.exec(req.url)) {
    const data = Object.values(server._rooms).map(room => {
      return {
        ...room,
        user_list: room.user_list.map(u => u.get_definition()),
      };
    });

    return Response.json({ data }, { status: 200, headers });
  }

  if (PREMIERES_ROUTE.exec(req.url)) {
    return get_premieres(req);
  }

  // Save/load user saves.
  if (SAVES_ROUTE.exec(req.url)) {
    const { username, valid } = await validate_request(req);

    if (req.method === 'GET') {
      if (!valid || !username)
        return new Response(null, { status: 403, headers });

      const data = server.db.get_user_save(username);
      return Response.json(
        {
          data,
        },
        { status: 200, headers }
      );
    } else if (req.method === 'POST') {
      if (!valid || !username)
        return new Response(null, { status: 403, headers });
      const body = await req.json();
      if (typeof body.data !== 'string') {
        return new Response(null, { status: 400, headers });
      }

      server.db.store_user_save(username, body.data);
      return new Response(null, { status: 200, headers });
    }
  }

  return new Response('Not found.', { status: 404, headers });
};

export default webserver_handler;
