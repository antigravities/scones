const config = JSON.parse(require("fs").readFileSync("./config.json"));

const Express = require("express");
const Session = require("express-session");

const request = require("request-promise");

const Passport = require("passport");
const SteamStrategy = require("passport-steam").Strategy;

const fs = require("fs");

var sessions = {};
var gamelist;

Passport.serializeUser((user, callback) => {
  sessions[user.steamid] = user;
  callback(null, user.steamid);
});

Passport.deserializeUser((id, callback) => {
  callback(null, sessions[id]);
});

Passport.use(new SteamStrategy(config, async(identifier, profile, done) => {
  identifier = identifier.split("/")[5];

  let rprofile = {};
  rprofile.steamid = identifier;
  rprofile.persona_name = profile.displayName;
  rprofile.photo = profile.photos[2].value;
  rprofile.apps = JSON.parse(await request("http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=" + config.apiKey + "&steamid=" + identifier + "&format=json")).response.games.map(i => i.appid);

  done(null, rprofile);
}));

const app = Express();

app.use(Session({
  secret: config.secret,
  cookie: config.cookie,
  resave: true,
  saveUninitialized: true
}));

app.use(Passport.initialize());
app.use(Passport.session());

app.get("/authenticate", Passport.authenticate("steam"), (req, res) => {
  return res.redirect("/");
});

app.get("/deauthenticate", (req, res) => {
  req.logout();
  return res.redirect("/");
});

app.get("/", (req, res) => {
  let profile = {};

  if (req.isAuthenticated()) {
    profile.loggedin = true;
    profile.profile = req.user;
  }
  else {
    profile.loggedin = false;
    profile.profile = {};
  }

  res.end(fs.readFileSync("index.html").toString().replace("\"{{profile}}\"", JSON.stringify(profile)).replace("\"{{tradeables}}\"", JSON.stringify(gamelist)).replace(/\{\{myName\}\}/g, config.myName).replace("{{mySteamID}}", config.mySteamID));
});

async function getGameList() {
  let tradeables = JSON.parse(await request("https://barter.vg/u/" + config.barter + "/t/json"));

  return Object.values(tradeables.by_platform["1"]).map(i => {
    return { title: i.title, appid: parseInt(i.sku), ratio: i.tradable / i.wishlist, wishlists: i.wishlist }
  });
}

(async() => {
  gamelist = await getGameList();

  setInterval(async() => {
    gamelist = await getGameList();
  }, 300000);

  app.listen(config.port);
})();
