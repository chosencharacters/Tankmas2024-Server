// Learn more at https://docs.deno.com/runtime/manual/examples/module_metadata#concepts

class TestClient {
  socket: WebSocket;
  constructor(username: string, session: string) {
    const url = new URL(
      `ws://localhost:5000?username=${username}&session=${session}`
    );
    url.searchParams.set('username', username);
    url.searchParams.set('session', session);

    const socket = new WebSocket(url);
    socket.addEventListener('open', () => {
      // sendMessage({ type: 2, data: { username: 'ass', room_id: 1, x: 250 } });
    });

    socket.addEventListener('error', _err => {
      console.error('Failed to connect.');
    });

    socket.addEventListener('message', _event => {
      console.info(`got message`);
    });
    this.socket = socket;
  }

  move_to = (x: number, y: number) => {
    this.send_message({
      type: 2,
      data: {
        x,
        y,
      },
    });
  };

  switch_room = (room_id: number) => {
    this.send_message({
      type: 2,
      data: {
        room_id,
      },
    });
  };

  send_message = (msg: unknown) => {
    const data = JSON.stringify(msg);
    this.socket.send(data);
  };
}

export default TestClient;
