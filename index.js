import express from 'express';
import { exec } from 'child_process';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

const app = express();
app.use(express.json());

app.post('/render', async (req, res) => {
  const tpl = req.body;
  const tmp = '/tmp/ffmpeg-api';
  await fs.mkdir(tmp, { recursive: true });

  // Descarga inputs
  await Promise.all(Object.entries(tpl.inputs).map(async ([key, url]) => {
    const data = await fetch(url);
    const buffer = await data.buffer();
    await fs.writeFile(path.join(tmp, key), buffer);
  }));

  // Construye filter_complex (ejemplo con overlay y subtítulos)
  const overlay = tpl.layers.find(l=>l.type==='overlay');
  const cmd = `
    ffmpeg -y \
      -i ${path.join(tmp,'video')} \
      -i ${path.join(tmp,'audio')} \
      -i ${path.join(tmp,'logo')} \
      -filter_complex "[0:v][2:v]overlay=${overlay.position.x}:${overlay.position.y},subtitles=${path.join(tmp,'subs.srt')}" \
      -map 0:v -map 1:a \
      ${path.join(tmp,'output.mp4')}
  `;

  exec(cmd, err => {
    if (err) return res.status(500).send(err.message);
    res.download(path.join(tmp,'output.mp4'), 'final.mp4');
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API FFmpeg en puerto ${PORT}`));
