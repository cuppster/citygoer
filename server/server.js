//
// # City Goer
//

var 
  util        = require('util'),
  Log         = require('log'),
  log         = new Log(),
  express     = require('express'),
  Redis       = require('redis'),
  program     = require('commander');
  
// ## setup cli
//
program
  .version('0.0.1')
  .option('-p, --port <n>', 'Start server on this port number', 8133)
  .parse(process.argv);
  
log.info("starting server on port : " + program.port);

// ## setup app
//
var app = express.createServer();

// ## add redis and give to app
var redis = Redis.createClient();
app.redis = redis;

// ## middleware
//
log.info('adding commmon middleware...');
app.use(express.bodyParser());
app.use(express.methodOverride());

// ## CORS middleware
// 
// see: http://stackoverflow.com/questions/7067966/how-to-allow-cors-in-express-nodejs
var allowCrossDomain = function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      
    // intercept OPTIONS method
    if ('OPTIONS' == req.method) {
      res.send(200);
    }
    else {
      next();
    }
};
app.use(allowCrossDomain);

// ## setup routes
//
var placesResource = require('./places');

// ### api methods
//
app.get   ('/near',         placesResource.near);
app.post  ('/here',         placesResource.createHere);
app.get   ('/follow',       placesResource.follow);

// ## start listening
//
app.listen(program.port);
log.info("server ready on port: %s", program.port);
