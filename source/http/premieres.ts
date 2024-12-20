import { parse } from 'jsr:@std/datetime/parse';

const premieres = [
  {
    name: "Dr. Good's Movie",
    time: '2024-12-13 02:16PM',
    length: 1034000,
    url: 'https://uploads.ungrounded.net/alternate/6268000/6268139_alternate_291404.720p.mp4?1734069205',
  },
  {
    name: "Dr. Good's Movie",
    time: '2024-12-21 05:00PM',
    length: 530000,
    url: 'https://uploads.ungrounded.net/alternate/1865000/1865703_alternate_184213.720p.mp4?1716028231',
  },
  /*
  {
    name: "Dr. Good's Movie",
    time: '2024-12-13 02:16PM',
    length: 653000,
    url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  },
  {
    name: "Dr. Good's Movie 2",
    time: '2024-12-14 02:16PM',
    length: 734000,
    url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
  },
  {
    name: "Dri. Good's Movie 4",
    time: '2024-12-17 04:16PM',
    length: 594000,
    url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
  },
  {
    name: "Dri. Go3od's Movie 4",
    time: '2024-12-21 00:47AM',
    length: 887000,
    url: 'http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
  },
  */
];

const get_premieres = (_req: Request) => {
  const premiere_list = premieres.map(({ name, time, url, length }) => {
    const date = parse(time, 'yyyy-MM-dd hh:mma');
    const released = date.getTime() <= Date.now() + 1000;
    return {
      name,
      timestamp: date.getTime() / 1000.0,
      released,
      length,
      url: released ? url : undefined,
    };
  });

  const respo = {
    premieres: premiere_list,
  };

  return Response.json(respo);
};

export default get_premieres;
