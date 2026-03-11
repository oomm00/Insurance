require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const { getAllPolicies, getPoliciesByUser, terminatePolicy, triggerPolicy } = require('./policyClient');

const app = express();
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(bodyParser.json());
app.use(cookieParser());

// Simple health
app.get('/health', (req, res) => res.json({ ok: true }));

// List policies (public)
app.get('/policies', async (req, res) => {
  try {
    const rows = await getAllPolicies();
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Get policies for an address
app.get('/policies/:address', async (req, res) => {
  try {
    const addr = req.params.address;
    const rows = await getPoliciesByUser(addr);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// Admin endpoints - simple password check via env ADMIN_ADDR
function checkAdmin(req, res, next) {
  const adminAddr = (process.env.ADMIN_ADDR || '').toLowerCase();
  const header = (req.header('x-admin') || '').toLowerCase();
  if (!adminAddr) return res.status(403).json({ error: 'admin not configured' });
  if (header !== adminAddr) return res.status(403).json({ error: 'forbidden' });
  next();
}

app.post('/terminate/:id', checkAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const tx = await terminatePolicy(id);
    res.json({ ok: true, txHash: tx.hash });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/trigger/:id', checkAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const tx = await triggerPolicy(id);
    res.json({ ok: true, txHash: tx.hash });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log('Backend listening on', port));
