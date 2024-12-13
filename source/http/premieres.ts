const premieres = {
  premieres: [
    {
      name: "Punch Punch Forever",
      // NOTE: Make sure these are in seconds!
      timestamp: "1733981400",
      url: "https://uploads.ungrounded.net/alternate/5533000/5533728_alternate_267548.1080p.mp4",
    },
  ],
};

const get_premieres = (_req: Request) => {
  const respo = { data: premieres };
  return Response.json(respo);
};

export default get_premieres;
