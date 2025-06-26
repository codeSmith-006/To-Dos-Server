const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
require("dotenv").config();

// initialize Firebase admin
const base64 = process.env.FB_ADMIN_KEY;
const decodedJson = Buffer.from(base64, "base64").toString("utf-8");
const serviceAccount = JSON.parse(decodedJson);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Firebase verification middleware
const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req.headers?.authorization;
  const token = authHeader?.split(" ")[1];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({ message: "Unauthorized request" });
  }
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.decoded = decoded;
    next();
  } catch (error) {
    console.log("Error while decoded data:", error);
    return res.status(401).send({ message: "Unauthorized request" });
  }
};

// Setup MongoDB
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@clustercraft.fp390uo.mongodb.net/?retryWrites=true&w=majority&appName=ClusterCraft`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const database = client.db("To-Dos");
    const tasksCollection = database.collection("Tasks");

    // Create task endpoint
    app.post("/tasks", verifyFirebaseToken, async (req, res) => {
      const taskDetails = req.body;
      // ensure tableName field exists
      if (!taskDetails.tableName) {
        taskDetails.tableName = "Untitled";
      }
      const result = await tasksCollection.insertOne(taskDetails);
      res.send(result);
    });

    // Read tasks (user-specific)
    app.get("/tasks", verifyFirebaseToken, async (req, res) => {
      const all = await tasksCollection.find().toArray();
      const currentUser = req.decoded.email;
      const userTasks = all.filter((t) => t.User === currentUser);
      res.send(userTasks);
    });

    // Update task (edit name or mark finished)
    app.patch("/tasks", verifyFirebaseToken, async (req, res) => {
      const { targetId, action, Task, tableName } = req.body;
      if (!targetId || !action) {
        return res.status(400).json({ error: "Target id and action required" });
      }

      let updateDoc = {};
      if (action === "edit") {
        const fieldsToUpdate = {};
        if (Task) fieldsToUpdate.Task = Task;
        if (tableName) fieldsToUpdate.tableName = tableName;
        if (Object.keys(fieldsToUpdate).length === 0) {
          return res.status(400).json({ error: "No update fields provided" });
        }
        updateDoc = { $set: fieldsToUpdate };
      } else if (action === "mark-finished") {
        updateDoc = { $set: { isFinished: true } };
      } else {
        return res.status(400).json({ error: "Unsupported action" });
      }

      const query = { _id: new ObjectId(targetId) };
      const result = await tasksCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // Delete task
    app.delete("/tasks/:id", verifyFirebaseToken, async (req, res) => {
      const id = req.params.id;
      const result = await tasksCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });
  } finally {
    // keep alive
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("To‑Dos API 📝");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
