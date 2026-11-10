# The Viyana — Quotation Maker

Paste the order details (English, Sinhala or mixed). The website uses AI to tidy the menu, fix
spelling, and put it into the Viyana quotation design. Press **Download PDF** to save it.

```
public/        the website (design in quote.css, layout logic + terms in app.js)
lib/parse.js   AI prompt that turns pasted notes into quotation data (runs on the server)
api/parse.js   Vercel serverless function
server.js      plain Node server (for your computer or any Node host)
```

The NVIDIA API key is used only on the server. It is never sent to the browser.

## Run on your computer

1. Install Node.js 18 or newer.
2. Copy `.env.example` to `.env` and put your key in it:
   `NVIDIA_API_KEY=nvapi-...`
3. Start it with `npm start` and open http://localhost:3000

## Put it online for free (Vercel)

1. Upload this folder to a **private** GitHub repository (`.env` is ignored, so the key is not uploaded).
2. Go to vercel.com, sign in with GitHub, and click **Add New → Project**. Then pick the repository.
3. Under **Environment Variables**, add:
   - `NVIDIA_API_KEY` = your NVIDIA key
   - `APP_PASSWORD` = a password for your staff (recommended, so strangers can't use your key)
4. Click **Deploy**. You get a link like `https://viyana-quote.vercel.app`, which works on your phone too.

Other hosts (Render, Railway, a VPS) work too: run `npm start` and set the same environment variables.

## Changing things

- Address, phone, terms, validity days: the top of `public/app.js`
- Colours and fonts: `public/quote.css`
- How the AI reads orders: `lib/parse.js`
- Quotation numbers count up automatically (VQ-2026-004, 005, …) on each device. You can also type a number.
- Any text on the quotation can be clicked and corrected before downloading.
