var express = require('express');
var router = express.Router();
const jwt = require('jsonwebtoken');
const JWT_SECRET =process.env.JWT_SECRET;
const bcrypt = require('bcrypt');
const authorization = require('../middleware/authorization');

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});

router.post('/register', (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;

  // Verify body
  if (!email || !password) {
    res.status(400).json({error: true, message: "Request body incomplete, both email and password are required"});
    return;
  }

  // Determine if user already exists in the table
  const queryUsers = req.db.from("users").select("*").where("email", "=", email);
  queryUsers.then(users => {
    if (users.length > 0){
      throw new Error("User already exists");
    }

    // Insert user into the table
    const saltRounds = 10;
    const hash = bcrypt.hashSync(password, saltRounds);
    return req.db.from("users").insert({email, password: hash});
  })
  .then(() => {
    res.status(201).json({message: "User created"});
  })
  .catch(err => {
    res.status(500).json({error: true, message: err.message});
  });
});

router.post('/login', (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  // Verify body
  if (!email || !password) {
    res.status(400).json({error:true, message: "Request body incomplete, both email and password are required"});
    return;
  }

  const queryUsers = req.db.from("users").select("*").where("email", "=", email);
  queryUsers.then((users) => {
    if (users.length === 0) {
      throw new Error("Incorrect email or password");
    }

    // compare passwords
    const user = users[0];
    return bcrypt.compare(password, user.password);
  })
  .then(match => {
    if (!match) {
      throw new Error("Passwords do not match");
    }
    // Create and return JWT token
    const expires_in = 60 * 60 * 24;
    const exp = Math.floor(Date.now() / 1000) + expires_in;
    const user = {email: email, exp: exp};
    const token = jwt.sign(user, JWT_SECRET);
    res.status(200).json({
      token,
      token_type: "Bearer",
      expires_in
    });
  })
  .catch(err => {
    console.log(err);
    res.status(401).json({error: true, message: err.message});
  });
});

router.get('/:email/profile', authorization, (req, res) => {
  const email = req.params.email;
  const queryUsers = req.db("users").where("email", "=", email);

  if (req.isAuthenticated && req.user === email) {
    queryUsers.select("email", "firstName", "lastName", "dob", "address");
  } else {
    queryUsers.select("email", "firstName", "lastName");
  }
  queryUsers.then(users => {
    if (users.length === 0){
      res.status(404).json({error: true, message: "User not found"});
      return;
    }
    else if (users[0].dob == null) {
      res.json(users[0]);
      return;
    }
    const dob = users[0].dob;
    const dobString = `${dob.getFullYear()}-${('0' + (dob.getMonth() + 1)).slice(-2)}-${('0' + dob.getDate()).slice(-2)}`;
    res.status(200).json({email: users[0].email, firstName: users[0].firstName, lastName: users[0].lastName, dob: dobString, address: users[0].address});
  })

})

router.put('/:email/profile', authorization, (req, res) => {
  const email = req.params.email;
  const body = req.body;


  // Check if firstName, lastName, dob, and address are included in the request body
  if (!body.firstName || !body.lastName || !body.dob || !body.address) {
    res.status(400).json({ error: true, message: "Request body incomplete: firstName, lastName, dob and address are required." });
    return;
  }

  // Check if firstName, lastName, and address are strings
  if (typeof body.firstName !== 'string' || typeof body.lastName !== 'string' || typeof body.address !== 'string') {
    res.status(400).json({ error: true, message: "Request body invalid: firstName, lastName and address must be strings only." });
    return;
  }

  // Check if dob is in the format YYYY-MM-DD
  const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dobRegex.test(body.dob)) {
    res.status(400).json({ error: true, message: "Invalid input: dob must be a real date in format YYYY-MM-DD." });
    return;
  }

  // Check if dob is a valid date and in the past
  const dob = new Date(body.dob);
  const now = new Date();
  if (isNaN(dob)) {
    res.status(400).json({ error: true, message: "Invalid input: dob must be a real date in format YYYY-MM-DD." });
    return;
  }
  else if (dob >= now) {
    res.status(400).json({ error: true, message: "Invalid input: dob must be a date in the past." });
    return;
  }

  // Check for JavaScript date rollover
  const dobString = dob.toISOString().substring(0, 10); // Convert Date object to YYYY-MM-DD format
  if (dobString !== body.dob) {
    res.status(400).json({ error: true, message: "Invalid input: dob must be a real date in format YYYY-MM-DD." });
    return;
  }

  if (!req.isAuthenticated) {
    res.status(401).json({error: true, message: "Unauthorized"});
    return;
  }
  else if (req.user !== email) {
    res.status(403).json({error: true, message: "Forbidden"});
    return;
  }

  const queryUsers = req.db("users").where("email", "=", email);
  queryUsers.update(body)
    .then(() => {
      return req.db("users").where("email", "=", email);
    })
    .then(users => {
      const dob = users[0].dob;
      const dobString = `${dob.getFullYear()}-${('0' + (dob.getMonth() + 1)).slice(-2)}-${('0' + dob.getDate()).slice(-2)}`;
      res.status(200).json({email: users[0].email, firstName: users[0].firstName, lastName: users[0].lastName, dob: dobString, address: users[0].address});
    })
    .catch(err => {
      res.status(400).json({error: true, message: err.message});
    });
});


module.exports = router;
