const { connectToDatabase } = require('./_db');
const { ObjectId } = require('mongodb');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const db = await connectToDatabase();
    const col = db.collection('warehouses');

    if (req.method === 'GET') {
      const list = await col.find({}).toArray();
      res.status(200).json(list.map(w => ({
        id: w._id.toString(), name: w.name, capacity: w.capacity,
        taskName: w.taskName, thresholdYellow: w.thresholdYellow, thresholdRed: w.thresholdRed
      })));
      return;
    }

    if (req.method === 'POST') {
      const body = req.body;
      const doc = {
        name: body.name, capacity: Number(body.capacity), taskName: body.taskName || '',
        thresholdYellow: Number(body.thresholdYellow) || 70, thresholdRed: Number(body.thresholdRed) || 90
      };
      const result = await col.insertOne(doc);
      res.status(200).json({ id: result.insertedId.toString(), ...doc });
      return;
    }

    if (req.method === 'PUT') {
      const id = req.query.id;
      const body = req.body;
      const update = {
        name: body.name, capacity: Number(body.capacity), taskName: body.taskName || '',
        thresholdYellow: Number(body.thresholdYellow) || 70, thresholdRed: Number(body.thresholdRed) || 90
      };
      await col.updateOne({ _id: new ObjectId(id) }, { $set: update });
      res.status(200).json({ id, ...update });
      return;
    }

    if (req.method === 'DELETE') {
      const id = req.query.id;
      await col.deleteOne({ _id: new ObjectId(id) });
      await db.collection('entries').deleteMany({ warehouseId: id });
      res.status(200).json({ ok: true });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
