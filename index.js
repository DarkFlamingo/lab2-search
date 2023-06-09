const {
  Client
} = require('@elastic/elasticsearch');
const express = require('express');
const bodyParser = require('body-parser');
const uuid = require('uuid');
const cors = require('cors')

const APP_PORT = 3001;
const INDEX_NAME = 'games';

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(cors());

const client = new Client({
  node: '...',
  auth: {
    username: '...',
    password: '...',
  }
});

async function testConnection() {
  try {
    const res = await client.info();

    console.log("Test connection: ", res);
  } catch (err) {
    console.error(err);
  }
}

app.get('/games', async (req, res) => {
  try {
    const {
      name,
      date,
      price,
      mainCategory,
    } = req.query;

    const query = {
      bool: {
        must: [],
      }
    }

    if (name !== undefined) {
      query.bool.must.push({
        wildcard: {
          name: {
            value: `*${name}*`,
            case_insensitive: true,
          },
        },
      });
    }

    if (price !== undefined) {
      const parsedPrice = JSON.parse(price);

      const item = {
        range: {
          price: {
            gte: parsedPrice.min,
            lte: parsedPrice.max,
          },
        }
      }

      query.bool.must.push(item)
    }

    if (mainCategory !== undefined) {
      query.bool.must.push({
        term: {
          mainCategory,
        }
      })
    }

    if (date !== undefined) {
      const parsedDate = JSON.parse(date);

      const minDate = (new Date(parsedDate.min)).toISOString();
      const maxDate = (new Date(parsedDate.max)).toISOString();

      query.bool.must.push({
        range: {
          date: {
            gte: minDate,
            lte: maxDate,
          }
        }
      })
    }

    const result = await client.search({
      index: INDEX_NAME,
      query: query.bool.must.length !== 0 ? query : {
        match_all: {},
      },
    });

    const games = result.hits.hits.map(hit => ({
      ...hit._source,
      id: hit._id,
    }));

    res.send(games);
  } catch (err) {
    res.send("Internal server error").statusCode(500);
    console.error(err);
  }
});

app.post('/games', async (req, res) => {
  try {
    const game = req.body;

    const {
      _id
    } = await client.index({
      index: INDEX_NAME,
      body: {
        id: uuid.v4(),
        ...game
      }
    });

    const result = await client.search({
      index: INDEX_NAME,
    });

    const games = result.hits.hits.map(hit => ({
      ...hit._source,
      id: hit._id,
    }));

    const createdGames = games.find(game => game.id === _id);

    res.send(createdGames);
  } catch (err) {
    console.error(err);
    res.send("Something went wrong").status(500);
  }
});

app.put('/games/:id', async (req, res) => {
  try {
    const {
      id
    } = req.params;

    const game = req.body;

    const {
      body: result
    } = await client.update({
      index: INDEX_NAME,
      id,
      body: {
        doc: game
      }
    }).catch(() => {
      res.send("Not Found").status(404);
    });

    res.send(result);

  } catch (err) {
    console.error(err);
    res.send("Something went wrong").status(500);
  }
});

app.delete('/games/:id', async (req, res) => {
  try {
    const {
      id
    } = req.params;

    const {
      result,
      _id
    } = await client.delete({
      index: INDEX_NAME,
      id
    });

    res.send(result === "deleted" && id === _id);
  } catch (err) {
    console.error(err);
    res.send("Not Found").status(404);
  }
});

app.listen(APP_PORT, () => {
  try {
    testConnection();
  } catch (err) {
    console.error(err);
  }

  console.log(`Example app listening on port ${APP_PORT}`)
})