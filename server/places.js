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
  Places    = exports;
  
  
 Places.stuff = function(req, res, next) {
 
  log.debug('Places.stuff');
  
  // location
  var top = parseFloat(req.param('lat')) || 36.175;
  var left = parseFloat(req.param('lon')) ||  -115.136389;
  
  // type
  var placeType = req.param('type') || "*";
  
  var bottom = top - 0.02;
  var right = left + 0.04;
  
  // [bbox=left,bottom,right,top]
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
    
      log.debug(data);
      
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
    
    
    res.charset = 'utf-8';
    res.header('Content-Type', mime);    
    res.send(out);
    
    //
    //res.writeHead(200, {
    //  'Content-Length'  : out.length,
    //  'Content-Type'    : mime,
    //});
    //res.end(out); 
  }
}