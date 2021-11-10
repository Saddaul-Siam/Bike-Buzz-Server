const express = require('express')
var cors = require('cors')
const { MongoClient } = require('mongodb');
require('dotenv').config();
const admin = require("firebase-admin");
const ObjectId = require('mongodb').ObjectId;
const app = express();
const port = process.env.PORT || 5000;

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hg2sj.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function verifyToken(req, res, next) {
  if (req.headers?.authorization?.startsWith('Bearer ')) {
    const token = req.headers.authorization.split(' ')[1];

    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    }
    catch {

    }

  }
  next();
}

async function run() {
  try {
    await client.connect();
    const database = client.db("bike-buzz");

    const productsCollection = database.collection("products");
    const usersCollection = database.collection("users");
    const reviewCollection = database.collection("review");
    const ordersCollection = database.collection("orders");

    app.post('/users', async (req, res) => {
      const user = req.body
      const result = await usersCollection.insertOne(user);
      res.json(result);
    });

    app.put('/users', async (req, res) => {
      const user = req.body
      const filter = { email: user.email };
      const options = { upsert: true };
      const updateDoc = { $set: user };
      const result = await usersCollection.updateOne(filter, updateDoc, options);
      res.json(result);
    });

    app.put('/users/admin', verifyToken, async (req, res) => {
      const user = req.body;
      const requester = req.decodedEmail;
      if (requester) {
        const requesterAccount = await usersCollection.findOne({ email: requester });
        if (requesterAccount.role === 'admin') {
          const filter = { email: user.email };
          const updateDoc = { $set: { role: 'admin' } };
          const result = await usersCollection.updateOne(filter, updateDoc);
          res.json(result)
        }
      }
      else {
        res.status(403).json({ message: 'you do not have access to make admin' })
      }
    });

    app.get('/users/:email', async (req, res) => {
      console.log(req.params);
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let isAdmin = false;
      if (user?.role === 'admin') {
        isAdmin = true;
      }
      res.json({ admin: isAdmin });
    });

    // add products
    app.post('/addProducts', async (req, res) => {
      console.log(req.body);
      const result = await productsCollection.insertOne(req.body)
      res.json(result);
    });
    // get all products
    app.get('/products', async (req, res) => {
      const result = await productsCollection.find({}).toArray();
      res.json(result);
    });
    // delete products
    app.delete('/deleteProducts/:id', async (req, res) => {
      const id = req.params.id;
      const result = await productsCollection.deleteOne({ _id: ObjectId(id) })
      if (result.deletedCount === 1) {
        console.log("Successfully deleted one document.");
      } else {
        console.log("No documents matched the query. Deleted 0 documents.");
      }
    });

    // add review
    app.post('/addReview', async (req, res) => {
      const result = await reviewCollection.insertOne(req.body);
      res.json(result);
    });

    // get review 
    app.get('/review', async (req, res) => {
      const result = await reviewCollection.find({}).toArray();
      res.json(result);
    })


  }
  finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
});
