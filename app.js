/* eslint-disable no-undef */
const express = require("express");
const app = express();
const csrf = require("tiny-csrf");

const { Admin, Election, Questions, Voter } = require("./models");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");

const path = require("path");
const bcrypt = require("bcrypt");
const passport = require("passport");
const connectEnsureLogin = require("connect-ensure-login");
const session = require("express-session");
const flash = require("connect-flash");
const LocalStratergy = require("passport-local");

const saltRounds = 10;

app.set("views", path.join(__dirname, "views"));
app.use(flash());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser("Some secret String"));
app.use(csrf("this_should_be_32_character_long", ["POST", "PUT", "DELETE"]));

app.use(
  session({
    secret: "my-super-secret-key-2837428907583420",
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);
app.use((request, response, next) => {
  response.locals.messages = request.flash();
  next();
});
app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new LocalStratergy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    (username, password, done) => {
      Admin.findOne({ where: { email: username } })
        .then(async (user) => {
          const result = await bcrypt.compare(password, user.password);
          if (result) {
            return done(null, user);
          } else {
            return done(null, false, { message: "Invalid password" });
          }
        })
        .catch(() => {
          return done(null, false, { message: "You are not registered" });
        });
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});
passport.deserializeUser((id, done) => {
  Admin.findByPk(id)
    .then((user) => {
      done(null, user);
    })
    .catch((error) => {
      done(error, null);
    });
});

//setting the ejs is the engine
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

//Landing page
app.get("/", (request, response) => {
  if (request.user) {
    return response.redirect("/elections");
  } else {
    response.render("index", {
      title: "Online_Voting_Platform",
      csrfToken: request.csrfToken(),
    });
  }
});

//Home Page for Elections
app.get(
  "/elections",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    let loggedinuser = request.user.firstName + " " + request.user.lastName;
    try {
      const elections = await Election.getElections(request.user.id);
      if (request.accepts("html")) {
        response.render("elections", {
          title: "Online_Voting_Platform",
          userName: loggedinuser,
          elections,
        });
      } else {
        return response.json({
          elections,
        });
      }
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  }
);

//signup page
app.get("/signup", (request, response) => {
  response.render("signup", {
    title: "Signup",
    csrfToken: request.csrfToken(),
  });
});

//create admin account
app.post("/admin", async (request, response) => {
  if (!request.body.firstName) {
    request.flash("error", "Please enter your FirstName");
    return response.redirect("/signup");
  }
  if (!request.body.email) {
    request.flash("error", "Please enter email ID");
    return response.redirect("/signup");
  }
  if (!request.body.password) {
    request.flash("error", "Please enter your password");
    return response.redirect("/signup");
  }
  if (request.body.password < 8) {
    request.flash("error", "Password length should be atleast 8");
    return response.redirect("/signup");
  }
  const hashedPwd = await bcrypt.hash(request.body.password, saltRounds);
  try {
    const user = await Admin.createAdmin({
      firstName: request.body.firstName,
      lastName: request.body.lastName,
      email: request.body.email,
      password: hashedPwd,
    });
    request.login(user, (err) => {
      if (err) {
        console.log(err);
        response.redirect("/");
      } else {
        response.redirect("/elections");
      }
    });
  } catch (error) {
    request.flash("error", error.message);
    return response.redirect("/signup");
  }
});

//login page
app.get("/login", (request, response) => {
  if (request.user) {
    return response.redirect("/elections");
  }
  response.render("login", {
    title: "Login",
    csrfToken: request.csrfToken(),
  });
});

//login user
app.post(
  "/session",
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  (request, response) => {
    response.redirect("/elections");
  }
);

//signout
app.get("/signout", (request, response, next) => {
  request.logout((err) => {
    if (err) {
      return next(err);
    }
    response.redirect("/");
  });
});

//Creating Election in Election Page
app.get(
  "/elections/create",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    return response.render("create_new_election", {
      title: "Create an election",
      csrfToken: request.csrfToken(),
    });
  }
);

//Posting to Elections
app.post(
  "/elections",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.body.electionName.length < 5) {
      request.flash("error", "Election name length should be atleast 5");
      return response.redirect("/elections/create");
    }
    try {
      await Election.addElection({
        electionName: request.body.electionName,
        adminID: request.user.id,
      });
      return response.redirect("/elections");
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  }
);

//Manage Elections Home Page
app.get(
  "/elections/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    try {
      const election = await Election.getElection(request.params.id);
      const numberOfQuestions = await Questions.getNumberOfQuestions(
        request.params.id
      );
      const numberOfVoters = await Voter.getNumberOfVoters(request.params.id);
      return response.render("election_homepage", {
        id: request.params.id,
        title: election.electionName,
        nq: numberOfQuestions,
        nv: numberOfVoters,
      });
    } catch (error) {
      console.log(error);
      return response.status(422).json(error);
    }
  }
);

module.exports = app;
