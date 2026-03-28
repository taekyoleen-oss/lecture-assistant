const express = require('express');
const multer  = require('multer');
const { execFile } = require('child_process');
const path  = require('path');
const fs    = require('fs');
const os    = require('os');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Static files ──────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── File upload (PPT/PPTX only, max 100MB) ────────────────
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.ppt', '.pptx'].includes(ext)) cb(null, true);
    else cb(new Error('PPT 또는 PPTX 파일만 허용됩니다.'));
  },
});

// ── GET /api/convert-status — LibreOffice 가용 여부 확인 ──
app.get('/api/convert-status', (_req, res) => {
  execFile('soffice', ['--version'], { timeout: 5000 }, (err, stdout) => {
    if (err) return res.json({ available: false });
    res.json({ available: true, version: stdout.trim() });
  });
});

// ── POST /convert — PPT/PPTX → PDF 변환 ──────────────────
app.post('/convert', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '파일이 없습니다.' });

  const inputPath  = req.file.path;
  const outputDir  = os.tmpdir();
  // LibreOffice는 입력 파일 basename + .pdf 로 저장
  const outputPath = path.join(outputDir, path.basename(inputPath) + '.pdf');

  execFile(
    'soffice',
    ['--headless', '--convert-to', 'pdf', '--outdir', outputDir, inputPath],
    { timeout: 120_000 },
    (err) => {
      try { fs.unlinkSync(inputPath); } catch {}

      if (err) {
        console.error('LibreOffice error:', err.message);
        return res.status(500).json({ error: '변환 실패: ' + err.message });
      }

      if (!fs.existsSync(outputPath)) {
        return res.status(500).json({ error: '변환된 파일을 찾을 수 없습니다.' });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="converted.pdf"');

      const stream = fs.createReadStream(outputPath);
      stream.pipe(res);
      stream.on('close', () => { try { fs.unlinkSync(outputPath); } catch {} });
      stream.on('error', ()  => { try { fs.unlinkSync(outputPath); } catch {} });
    }
  );
});

// ── Multer error handler ──────────────────────────────────
app.use((err, _req, res, _next) => {
  res.status(400).json({ error: err.message });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
