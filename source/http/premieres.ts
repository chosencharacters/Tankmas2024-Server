const premieres = {
  premieres: {
    'test movie': {
      time: '2024-11-30 11:12AM',
      url: 'https://uploads.ungrounded.net/alternate/6243000/6243882_alternate_289698.720p.mp4?1732833997',
    },
    anoter_movie: {
      time: '2024-12-15 11:30AM',
      url: 'https://uploads.ungrounded.net/alternate/6243000/6243882_alternate_289698.720p.mp4?1732833997',
    },
  },
};

const get_premieres = (_req: Request) => {
  return Response.json(premieres);
};

export default get_premieres;