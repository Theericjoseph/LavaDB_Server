var express = require('express');
var router = express.Router();
const authorization = require('../middleware/authorization');

// JWT_SECRET=St22KFn+DR5RH1cKJQAxXBRfXqcY5kLc
router.get('/countries', (req, res) => {
  req.db('data')
    .distinct('country')
    .orderBy('country', 'asc')
    .then((countries) => {
      const countryNames = countries.map(country => country.country);
      res.send(countryNames);
    })
    .catch((error) => {
      console.error(error);
      res.status(500).send('Internal Server Error');
    });
});

router.get("/volcanoes", (req, res) => {
  const country = req.query.country;
  const populated_within = req.query.populatedWithin;
  const validParams = ['country', 'populatedWithin'];

  // Check for invalid query parameters
  const queryParams = Object.keys(req.query);
  const invalidParams = queryParams.filter(param => !validParams.includes(param));
  if (invalidParams.length > 0) {
    return res.status(400).json({ error: true, message: `Invalid query parameters: ${invalidParams.join(', ')}. Only 'country' and 'populatedWithin' are permitted.` });
  }

  // Check for missing required query parameters
  if (queryParams.length === 0) {
    return res.status(400).json({ error: true, message: "Country is a required query parameter." });
  }

  const populatedWithinMapping = {
    "5km": "population_5km",
    "10km": "population_10km",
    "30km": "population_30km",
    "100km": "population_100km"
  };

  let query = req.db('data')
    .select("*")
    .where('country', "=", country);

  if (populated_within in populatedWithinMapping) {
    query = query.andWhere(populatedWithinMapping[populated_within], ">", 1);
  }
  else if (populated_within){
    res.status(400).json({error: true, message: "Invalid populated within parameter. Valid values are 5km, 10km, 30km, 100km."})
    return;
  }

    query.then(volcanoes => {
      // Map over the volcanoes and return a new object that only includes the properties you're interested in
      const formattedVolcanoes = volcanoes.map(volcano => ({
        id: volcano.id,
        name: volcano.name,
        country: volcano.country,
        region: volcano.region,
        subregion: volcano.subregion
      }))

      res.send(formattedVolcanoes);
    })
    // Ask dan tran about this
    .catch((error) => {
      console.log(error);
      res.status(400).json({Error: true, Message: "Country is a required query parameter."});
    });
});

router.get('/volcano/:volcano_id', authorization, (req, res) => {
  const volcano_id = req.params.volcano_id;
  let query = req.db('data').where('id', "=",  volcano_id);
  if (req.isAuthenticated) {
    query = query.select("*");
  } else {
    query = query.select("id", "name", "country", "region", "subregion", "last_eruption", "summit", "elevation", "latitude", "longitude");
  }

  query.then((volcanoes) => {
      if (volcanoes.length === 0) {
        res.status(404).json({error: true, message: `Volcano with ID ${volcano_id} not found.`});
        return;
      }
      res.json(volcanoes[0])
    })
    .catch((error) => {
      console.log(error);
      res.status(400).json({error: true, message: "Invalid query parameters. Query parameters are not permitted."});
    });
});

router.get('/me', (req, res) => {
  res.send({
    name: 'Eric Joseph Kizhakkebhagathu',
    student_number: 'n11190728',
  })
});
module.exports = router;
