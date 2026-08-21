const { connectToDatabase } = require('./_db');
const { ObjectId } = require('mongodb');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const db = await connectToDatabase();
    const col = db.collection('entries');

    if (req.method === 'GET') {
      const filter = {};
      if (req.query.warehouseId) filter.warehouseId = req.query.warehouseId;
      const list = await col.find(filter).toArray();
      res.status(200).json(list.map(e => ({
        id: e._id.toString(), warehouseId: e.warehouseId, date: e.date,
        truck: e.truck, vessel: e.vessel, weight: e.weight, taskName: e.taskName
      })));
      return;
    }

    if (req.method === 'POST') {
      const body = req.body;
      const doc = {
        warehouseId: body.warehouseId, date: body.date, truck: body.truck,
        vessel: body.vessel || '', weight: Number(body.weight), taskName: body.taskName || ''
      };
      const result = await col.insertOne(doc);
      res.status(200).json({ id: result.insertedId.toString(), ...doc });
      return;
    }

    if (req.method === 'DELETE') {
      const id = req.query.id;
      await col.deleteOne({ _id: new ObjectId(id) });
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
