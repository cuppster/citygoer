// # places resources
//
// see: http://open.mapquestapi.com/xapi/api/0.6/node[amenity=pub][bbox=-77.041579,38.885851,-77.007247,38.900881]
//
// ## example requests:
//
// * http://open.mapquestapi.com/xapi/api/0.6/node[amenity=pub][bbox=-77.041579,38.885851,-77.007247,38.900881]
//

// ## XAPI responses look like this:
//
/*
<osm version="0.6" generator="Osmosis SNAPSHOT-r26564">
  <node id="486343837" version="3" timestamp="2010-05-20T06:32:50Z" uid="12055" user="aude" changeset="4754157" lat="38.8975639" lon="-77.0202807">
    <tag k="name" v="The Green Turtle Sports Bar & Grill"/>
    <tag k="amenity" v="pub"/>
    <tag k="addr:street" v="F Street NW"/>
    <tag k="addr:housenumber" v="601"/>
  </node>
*/
  
var
  fs        = require('fs'),
  request   = require('request'),
  xml2js    = require('xml2js'),
  Log       = require('log'),
  log       = new Log(),
  _         = require('underscore'),
  moment    = require('moment'),
  Places    = exports;
  
  
// ## magic numbers
//
var ONE_DAY_S = 60 * 60 * 24;
var ONE_DAY_MS = 1000 * 60 * 60 * 24;

// ## Follow
Places.follow = function(req, res, next) {

  var redis = req.app.redis;
  
  var max = Date.now();
  var min = max - ( ONE_DAY_MS );
  
  log.debug('min = %s, max = %s', min ,max);
  
  redis
  
    //.multi()
  
    .zrevrangebyscore('here', max, min, "WITHSCORES", function(err, reply) {
   
      log.debug('raw %s', reply);
    //.exec(function(err, reply) {
    
      if (err) {
        log.error(err);
        res.send(500);
      }
      else {
        
        var follow = [];
        if (reply && 0 < reply.length)
          follow = JSON.parse('[' + reply + ']');
          
        if (0 < follow.length) {
        
          var updatedFollow = [];
          
          _.each( _.range(0, follow.length, 2), function (i) {
          
            var data = follow[i];
            var timestamp = follow[i+1];
            
            var date = moment(new Date(timestamp));
            data.when = date.format("LLLL");
            
            var reltime = date.from(moment());
            data.relwhen = reltime;
            
            updatedFollow.push(data);
          });
          
          follow = updatedFollow;
          
        
        }
          
        sendJSON(req, res, follow);
        
      }
    });

  
  //sendJSON(req, res, [ {name: "The Green Turtle Sports Bar & Grill"}]);

}


//
// ## Here
//
Places.createHere = function(req, res, next) {

  var redis = req.app.redis;
  
  log.debug('Places.HERE');

  // location
  var node_id     = req.param('node_id');
  var name        = req.param('name');
  var lat         = parseFloat(req.param('lat')) || 36.175;
  var lon         = parseFloat(req.param('lon')) ||  -115.136389;

  // status
  var status = req.param('status');
  log.debug('status = %s', status);
  
  var nodekey = 'node:' + node_id;
  
  redis.multi()
    .hmset(nodekey, { name: name, lat: lat, lon:lon })
    .expire(nodekey, ONE_DAY_S)
    .zadd('here', Date.now(), JSON.stringify({status: status, name: name, node_id: node_id}))
    //.zremrangebyscore(...)
    .exec(function(err, reply) {
    
      log.debug('inserted %s', status);
      sendJSON(req, res, "OK");
      
    });
}
 
// ## Near 
//
Places.near = function(req, res, next) {

  log.debug('Places.near');

  // location
  var lat = parseFloat(req.param('lat')) || 36.175;
  var lon = parseFloat(req.param('lon')) ||  -115.136389;

  // type
  var placeType = req.param('type') || "*";

  var topLeft   = destinationPoint(lat, lon, -45, 1);
  var botRight  = destinationPoint(lat, lon, 135, 1);

  var top       = topLeft[0];
  var left      = topLeft[1];
  var bottom    = botRight[0];
  var right     = botRight[1];  

  log.debug("top = %s, left = %s, bottom = %s, right = %s", top, left, bottom, right);

  // [amenity={type}][bbox={left},{bottom},{right},{top}]
  //var url = "http://open.mapquestapi.com/xapi/api/0.6/node[amenity=pub][bbox=-77.041579,38.885851,-77.007247,38.900881]";
  var url = "http://open.mapquestapi.com/xapi/api/0.6/node[amenity=%type][bbox=%left,%bottom,%right,%top]";

  url = url.replace('%top', top);
  url = url.replace('%bottom', bottom);
  url = url.replace('%right', right);
  url = url.replace('%left', left);  
  url = url.replace('%type', placeType);

  log.debug("url = %s", url);

  //fs.readFile(__dirname + '/responses/xapi1.xml', function(err, data) {
  request(url, function (err, response, data) {
    if (err) {
      log.warn(err);
      res.send(500);
    }
    else {
    
      // log.debug(data);
      
      var parser = new xml2js.Parser({explicitArray: true});
      parser.parseString(data, function (err, result) {      
        if (err) {
          log.warn(err);
          res.send(500);
        }
        else {
        
          var sweep = _.map(result.node, function(item) {
            
            // lat lon
            var rec = {};
            rec.lat = item['@'].lat;
            rec.lon = item['@'].lon;
            
            // node id
            var node_id = item['@'].id;            
            rec.node_id  = node_id;
            
            // how many people are here?
            rec.headCount = Math.floor(Math.random() * 12); 
           
            // tags
            var tags = {};
            var taglist = [];
            var address = {};
            
            _.each(item.tag, function(tag) {    
               
              var key = tag['@'].k;
              var val = tag['@'].v;
              
              var add = true;
              
              if (0 == key.indexOf('gnis:'))
                add = false;
                
              switch (key) {
              
                // special...
                case 'name':
                  rec.name = val; break;                  
                case 'source':
                  rec.source = val; break;
                case 'amenity':
                  rec.type = val; break;
                case 'addr:street':
                  address.street = val; break;
                case 'addr:housenumber':
                  address.housenumber = val; break;
                case 'ele':
                  rec.elevation = parseFloat(val); break;
                  
                // ignore these...
                case 'dataset': 
                case 'is_in':
                case 'created_by':
                  break;
                  
                // all other tags...
                default:
                
                  if (add) {
                    tags[key] = val;
                    taglist.push(val);
                  }
                  break;
              }
            
            });
            
            // assign data
            rec.tags      = tags;            
            rec.taglist   = taglist;
            rec.address   = address;          
            return rec;
          });
        
          sendJSON(req, res, sweep);
        }
      });
    }
  }) 
}
 
 
 
 
/////////////////////////////////////////////////////////

 
var 
  MIME_JSON         = 'application/json';
  MIME_JSONP        = 'application/jsonp';
  MIME_JAVASCRIPT   = 'text/javascript';
  MIME_XHTML        = 'application/xhtml+xml';

// ## return a json response based on the passed object
//
// * supports JSONP
//
var sendJSON = function(req, res, data, view) {
  
  var out;
  var mime;
  
  var 
    format = req.param('format'),
    accept = req.headers.accept;
 
  // HTML response...  
  if (view && (format != "json") && accept && ( 0 <= accept.indexOf('text/html') || 0 <= accept.indexOf('application/xhtml+xml'))) {    
    view(req, res, data);        
  }
  // JSON response...
  else {

    var parts   = require('url').parse(req.url, true);  
    
    // JSONP support
    if (parts.query.callback) {
      callback = parts.query.callback;
      out = callback + '(' + JSON.stringify(data) + ')';
      mime = MIME_JSONP;
    }
    // plain JSON
    else {      
      out = JSON.stringify(data);
      mime = MIME_JSON;
    }    
    
    // output to client
    res.charset = 'utf-8';
    res.header('Content-Type', mime);    
    res.send(out);
    
  }
}

// ## find another lat,lon some distance away
//
// see: http://www.movable-type.co.uk/scripts/latlong.html
//
function destinationPoint(lat, lon, brng, dist) {
  dist = dist/6371;  // convert dist to angular distance in radians, earth's mean radius in km
  brng = brng * Math.PI / 180;
  var lat1 = lat * Math.PI / 180;
  var lon1 = lon * Math.PI / 180;
  var lat2 = Math.asin( Math.sin(lat1)*Math.cos(dist) + 
      Math.cos(lat1)*Math.sin(dist)*Math.cos(brng) );
  var lon2 = lon1 + Math.atan2(Math.sin(brng)*Math.sin(dist)*Math.cos(lat1), 
      Math.cos(dist)-Math.sin(lat1)*Math.sin(lat2));
  lon2 = (lon2+3*Math.PI)%(2*Math.PI) - Math.PI;  // normalise to -180...+180
  if (isNaN(lat2) || isNaN(lon2)) return null;
  return [lat2 / Math.PI * 180, lon2 / Math.PI * 180];
}
