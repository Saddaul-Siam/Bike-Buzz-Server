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

    //////////////////////////// User section ////////////////////////////////////

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
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let isAdmin = false;
      if (user?.role === 'admin') {
        isAdmin = true;
      }
      res.json({ admin: isAdmin });
    });
    //////////////////////////// User section ////////////////////////////////////

    //////////////////////////// Products section ////////////////////////////////////
    // add products
    app.post('/addProducts', async (req, res) => {
      // console.log(req.body);
      const result = await productsCollection.insertOne(req.body)
      res.json(result);
    });

    // get all products
    app.get('/products', async (req, res) => {
      const result = await productsCollection.find({}).toArray();
      res.json(result);
    });

    // get single product
    app.get('/product/:id', async (req, res) => {
      const filter = req.params.id;
      const result = await productsCollection.findOne({ _id: ObjectId(filter) });
      res.json(result);
    });

    // get home pages service products
    app.get('/mainServices', async (req, res) => {
      const result = await productsCollection.find({}).limit(6).toArray();
      res.json(result);
    });

    // delete products
    app.delete('/deleteProducts/:id', async (req, res) => {
      const id = req.params.id;
      const result = await productsCollection.deleteOne({ _id: ObjectId(id) })
      res.json(result)
    });

    //////////////////////////// Products section ////////////////////////////////////

    //////////////////////////// Review section ////////////////////////////////////

    // add review
    app.post('/addReview', async (req, res) => {
      const result = await reviewCollection.insertOne(req.body);
      res.json(result);
    });

    // get review 
    /* app.get('/reviews', async (req, res) => {
      const cursor = reviewCollection.find({});
      const page = req.query.page;
      const size = parseInt(req.query.size);
      let reviews;
      const count = await cursor.count();
      if (page) {
        reviews = await cursor.skip(page * size).limit(size).toArray();
      }
      else {
        reviews = await cursor.toArray();
      }
      res.json({
        count,
        reviews
      });
    }); */


    app.get('/reviews', async (req, res) => {
      const cursor = reviewCollection.find({});
      const page = req.query.page;
      const size = parseInt(req.query.size);
      let reviews;
      const count = await cursor.count();

      if (page) {
        reviews = await cursor.skip(page * size).limit(size).toArray();
      }
      else {
        reviews = await cursor.toArray();
      }

      res.send({
        count,
        reviews
      });
    });

    //////////////////////////// Review section ////////////////////////////////////


    //////////////////////////// order sections ////////////////////////////////////

    // orders post api
    app.post('/order', async (req, res) => {
      const result = await ordersCollection.insertOne(req.body)
      res.json(result);
    });

    // get all orders
    app.get('/orders', async (req, res) => {
      const result = await ordersCollection.find({}).toArray();
      res.json(result);
    });

    // get order by email
    app.get('/order/:email', async (req, res) => {
      const result = await ordersCollection.find({ email: req.params.email }).toArray()
      res.json(result);
    });

    // update order
    app.put('/order/:id', async (req, res) => {
      const filter = { _id: ObjectId(req.params.id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          status: req.body.status
        },
      };
      const result = await ordersCollection.updateOne(filter, updateDoc, options);
      res.json(result);
    })

    // delete single order
    app.delete('/order/:id', async (req, res) => {
      const id = req.params.id;
      const result = await ordersCollection.deleteOne({ _id: ObjectId(id) })
      res.json(result)
    })
    //////////////////////////// order sections ////////////////////////////////////

  }
  finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Bike buzz server is running!')
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
});
