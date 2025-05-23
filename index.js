require('dotenv').config();
console.log("✅ Server file loaded");
console.log("✅ Running the actual index.js");
process.stdout.write("👀 Direct write\n");
console.log("File path:", __filename);
require('fs').writeFileSync('startup-check.txt', `Started at ${new Date().toISOString()}`);



const express = require('express');
const bodyParser = require('body-parser');
const { OpenAI } = require('openai');
const pdfLib = require('pdf-lib');
const { PDFDocument, rgb, StandardFonts } = pdfLib;
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3001;

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// === HTML UI ===
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// === TEXT VERSION (to screen) ===
app.post('/api/create-dream-zine', async (req, res) => {
  const { dream } = req.body;
  if (!dream) return res.status(400).send('No dream provided.');

  const prompt = `
You are a career counsler
The user has entered the following dream:
"${dream}"

Create content for a foldable zine with the following categories:
1. Estimated Timeline
2. Foundation Phase
3. Growth Phase
4. Mastery Phase
5. How to Apply
6. Schooling Needed
7. Essential Tools
8. Joy Plan & Inspiring Figures

Respond with each category labeled in this format:
"Estimated Timeline:\n..."
"Foundation Phase:\n..."
(no intro or explanation)
`;

  try {
    const gpt = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 800
    });

    const zineText = gpt.choices[0].message.content.trim();
    res.json({ zineText });
  } catch (err) {
    console.error("Zine generation error:", err);
    res.status(500).send("Failed to generate zine.");
  }
});

// === PDF VERSION ===
app.post('/api/generate-zine-pdf', async (req, res) => {
  console.log("🚨 PDF generation route hit");
  const { dream } = req.body;
  if (!dream) return res.status(400).send('No dream provided.');

  const prompt = `
You are a career coach. We need to help highschoolers accomplsih their dream jobs

The user has entered the following dream:
"${dream}"

Create content for a foldable zine with the following categories:
1. Estimated Timeline
2. Foundation Phase
3. Growth Phase
4. Mastery Phase
5. How to Apply
6. Schooling Needed
7. Essential Tools
8. Joy Plan & Inspiring Figures

Respond with each category labeled in this format:
"Estimated Timeline:\n..."

elaborate with 100 words for each
`;

  try {
    const gpt = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.8,
      max_tokens: 800
    });

    const fullText = gpt.choices[0].message.content.trim();

    const labels = [
      'Estimated Timeline',
      'Foundation Phase',
      'Growth Phase',
      'Mastery Phase',
      'How to Apply',
      'Schooling Needed',
      'Essential Tools',
      'Joy Plan & Inspiring Figures'

    ];

    const blocks = {};
    let current = null;
    fullText.split('\n').forEach(line => {
      const label = labels.find(l => line.startsWith(l));
      if (label) {
        current = label;
        blocks[current] = line.replace(`${label}:`, '').trim() + '\n';
      } else if (current) {
        blocks[current] += line + '\n';
      }
    });

    const zineChunks = labels.map(label => blocks[label]?.trim() || '');

    const imagePath = path.join(__dirname, 'dream_roadmap_zine.png');
    const imageBytes = fs.readFileSync(imagePath);
    const pdfDoc = await PDFDocument.create();
    const image = await pdfDoc.embedPng(imageBytes);
    const page = pdfDoc.addPage([image.width, image.height]);

    page.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height
      
    });
    console.log("Image width:", image.width, "height:", image.height);


    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const placements = [
      { x: 0, y: 2500, rotate: 180 }, // try way up top right
      { x: 100, y: 1050, rotate: 180 },
      { x: 300,  y: 800, rotate: 180 },
      { x: 500,  y: 700,  rotate: 180 },
      { x: 700, y: 600,  rotate: 0 },
      { x: 900, y: 500,  rotate: 0 },
      { x: 1100, y: 400,  rotate: 0 },
      { x: 200, y: 300,  rotate: 0 }
    ];

console.log(placements[0][1],placements[0][2]);
    zineChunks.forEach((text, i) => {
      const { x, y, rotate } = placements[i];
   
      
      page.drawText(`P${i + 1}: ` + text.slice(0, 300), {
        x,
        y,
        font,
        size: 16,
        color: rgb(0.2, 0.2, 0.2),
        maxWidth: 180,
        lineHeight: 16
      });
    });
    console.log("Image width:", image.width, "height:", image.height);


    const pdfBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error("Zine PDF generation failed:", err);
    res.status(500).send('Failed to generate zine PDF');
  }
});


app.listen(port, '0.0.0.0', () => {
  console.log(`\u{1F680} Zine generator running at http://0.0.0.0:${port}`);
});
