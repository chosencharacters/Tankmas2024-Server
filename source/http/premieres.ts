import { parse } from 'jsr:@std/datetime/parse';

const premieres = [
  {
    name: 'Punch Punch Forever',
    // NOTE: Make sure these are in seconds!
    time: '2024-12-12 04:30PM',
    url: 'https://uploads.ungrounded.net/alternate/5533000/5533728_alternate_267548.1080p.mp4',
  },
  {
    name: "Dr. Good's Movie",
    time: '2024-12-13 02:16PM',
    url: 'https://uploads.ungrounded.net/alternate/6268000/6268139_alternate_291404.720p.mp4?1734069205',
  },
];

const get_premieres = (_req: Request) => {
  const premiere_list = premieres.map(({ name, time, url }) => {
    const date = parse(time, 'yyyy-MM-dd hh:mma');
    const released = date.getTime() <= Date.now() + 1000;
    return {
      name,
      timestamp: date.getTime() / 1000.0,
      released,
      url: released ? url : undefined,
    };
  });

  const respo = {
    premieres: premiere_list,
  };

  return Response.json(respo);
};

export default get_premieres;
