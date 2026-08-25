const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// In-Memory & Cloud Relay Jobs & Pros Storage Pool
let memoryJobs = [];
let memoryPros = [];

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', server: 'RealityChain Express MongoDB Backend', timestamp: new Date().toISOString() });
});

// GET /api/jobs
app.get('/api/jobs', (req, res) => {
  res.json({ success: true, count: memoryJobs.length, data: memoryJobs });
});

// POST /api/jobs
app.post('/api/jobs', (req, res) => {
  const jobs = req.body;
  if (Array.isArray(jobs)) {
    memoryJobs = jobs;
  } else if (jobs && jobs.id) {
    memoryJobs = [jobs, ...memoryJobs.filter(j => j.id !== jobs.id)];
  }
  res.json({ success: true, count: memoryJobs.length, data: memoryJobs });
});

// POST /api/jobs/:id/bid (Service Pro Bidding / Quote Submission)
app.post('/api/jobs/:id/bid', (req, res) => {
  const { id } = req.params;
  const { proName, proPhone, proBidAmount, note } = req.body;

  const jobIndex = memoryJobs.findIndex(j => j.id === id);
  if (jobIndex < 0) {
    return res.status(404).json({ success: false, message: 'Job request not found' });
  }

  const job = memoryJobs[jobIndex];
  const bids = job.bids || [];
  const updatedBids = bids.filter(b => b.proPhone !== proPhone);
  updatedBids.push({
    proName,
    proPhone,
    bidAmount: Number(proBidAmount),
    note: note || 'Ready to service immediately with genuine parts.',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });

  memoryJobs[jobIndex] = {
    ...job,
    bids: updatedBids,
    hasBids: true,
    lastBidAmount: Number(proBidAmount)
  };

  res.json({ success: true, job: memoryJobs[jobIndex] });
});

// POST /api/jobs/:id/accept-bid (Customer Accepts Pro Bid)
app.post('/api/jobs/:id/accept-bid', (req, res) => {
  const { id } = req.params;
  const { proName, proPhone, agreedAmount } = req.body;

  const jobIndex = memoryJobs.findIndex(j => j.id === id);
  if (jobIndex < 0) {
    return res.status(404).json({ success: false, message: 'Job request not found' });
  }

  memoryJobs[jobIndex] = {
    ...memoryJobs[jobIndex],
    stage: 'Arriving',
    proName,
    proPhone,
    estimate: Number(agreedAmount),
    acceptedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };

  res.json({ success: true, job: memoryJobs[jobIndex] });
});

// GET /api/pros
app.get('/api/pros', (req, res) => {
  res.json({ success: true, count: memoryPros.length, data: memoryPros });
});

// POST /api/pros
app.post('/api/pros', (req, res) => {
  const pro = req.body;
  if (pro && pro.phone) {
    memoryPros = memoryPros.filter(p => p.phone !== pro.phone);
    memoryPros.push(pro);
  }
  res.json({ success: true, count: memoryPros.length, data: memoryPros });
});

app.listen(PORT, () => {
  console.log(`🚀 RealityChain Express & MongoDB backend running on http://localhost:${PORT}`);
});
