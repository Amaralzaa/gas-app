import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // CEP Proxy Route
  app.get("/api/cep/:cep", async (req, res) => {
    const { cep } = req.params;
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error("CEP Proxy error:", error);
      res.status(500).json({ error: "Failed to fetch CEP data" });
    }
  });

  // Screenshots e Galeria Route
  const brainDir = path.resolve('C:/Users/rafae/.gemini/antigravity/brain/48e2ed43-cdc3-434a-bc4a-cbc19e870b1a');
  app.use('/screenshots', express.static(path.join(brainDir, 'screenshots')));
  app.get('/galeria', (req, res) => {
    res.sendFile(path.join(brainDir, 'galeria_telas.html'));
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
