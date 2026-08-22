const { connectToDatabase } = require('./_db');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const db = await connectToDatabase();
    const col = db.collection('settings');

    if (req.method === 'GET') {
      const doc = await col.findOne({ _id: 'global' });
      res.status(200).json({ totalAmount: doc ? doc.totalAmount : 0 });
      return;
    }

    if (req.method === 'PUT') {
      const totalAmount = Number(req.body.totalAmount) || 0;
      await col.updateOne({ _id: 'global' }, { $set: { totalAmount } }, { upsert: true });
      res.status(200).json({ totalAmount });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
